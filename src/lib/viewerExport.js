// Exporting what's on screen: a picture of the viewer (image, measurements, AI overlay,
// brush paint — not the text corners, so no patient details), a movie through the
// slices, printing, and the series' DICOM files as a ZIP (optionally de-identified).
import { zipFiles } from "./zipWriter";
import { anonymizeDicom } from "./dicomAnonymize";
import { isDicomImage } from "./dicomUtils";

const visible = (el) => {
  const style = getComputedStyle(el);
  const rect = el.getBoundingClientRect();
  return style.display !== "none" && style.visibility !== "hidden" && Number(style.opacity) > 0 && rect.width > 0 && rect.height > 0;
};

const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = reject;
  img.src = src;
});

// The viewer element as a canvas: its canvases, SVG layers and overlay images, in page
// order, at the screen's pixel density. Controls (buttons, and anything marked
// data-export-skip: dialogs, banners, overlay cards) are left out.
export async function captureViewer(root) {
  const dpr = window.devicePixelRatio || 1;
  const box = root.getBoundingClientRect();
  const out = document.createElement("canvas");
  out.width = Math.round(box.width * dpr);
  out.height = Math.round(box.height * dpr);
  const ctx = out.getContext("2d");
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.scale(dpr, dpr);
  const layers = [...root.querySelectorAll("canvas, svg, img")]
    .filter(el => !el.closest("button, [data-export-skip]") && visible(el));
  for (const el of layers) {
    const r = el.getBoundingClientRect();
    const x = r.left - box.left, y = r.top - box.top;
    const style = getComputedStyle(el);
    ctx.save();
    ctx.globalAlpha = Number(style.opacity) || 1;
    if (style.mixBlendMode === "screen") ctx.globalCompositeOperation = "screen";
    try {
      if (el.tagName === "CANVAS") {
        ctx.drawImage(el, x, y, r.width, r.height);
      } else if (el.tagName === "IMG") {
        if (el.complete && el.naturalWidth) ctx.drawImage(el, x, y, r.width, r.height);
      } else {
        // An SVG (Cornerstone's measurements, cursors): serialised and drawn as an image
        if (el.closest("svg") !== el) { ctx.restore(); continue; } // nested svg: drawn with its parent
        const copy = el.cloneNode(true);
        copy.setAttribute("xmlns", "http://www.w3.org/2000/svg");
        copy.setAttribute("width", r.width);
        copy.setAttribute("height", r.height);
        const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(copy)], { type: "image/svg+xml" }));
        try { ctx.drawImage(await loadImage(url), x, y, r.width, r.height); }
        finally { URL.revokeObjectURL(url); }
      }
    } catch (err) {
      console.warn("[Export] a layer couldn't be drawn:", err);
    }
    ctx.restore();
  }
  return out;
}

export const canvasBlob = (canvas, type = "image/png") => new Promise(resolve => canvas.toBlob(resolve, type));

export function download(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}

// The picture onto the clipboard. Safari wants the ClipboardItem made synchronously in the
// click, with a promise for the data.
export function copyImage(blobPromise) {
  return navigator.clipboard.write([new ClipboardItem({ "image/png": blobPromise })]);
}

// Print the picture alone, from a hidden frame
export function printImage(dataUrl, title) {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;width:0;height:0;border:0;right:0;bottom:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  doc.open();
  doc.write(`<!doctype html><title>${title}</title><style>@page{margin:10mm}html,body{margin:0;background:#fff}img{max-width:100%;max-height:100vh;display:block;margin:auto}</style><img src="${dataUrl}">`);
  doc.close();
  const img = doc.querySelector("img");
  const go = () => { frame.contentWindow.focus(); frame.contentWindow.print(); setTimeout(() => frame.remove(), 1000); };
  if (img.complete) go(); else img.onload = go;
}

// A movie through the slices: showSlice(i) puts slice i on screen (resolving once drawn),
// each frame captured from root. MP4 where the browser records it (Safari), else WebM.
export async function recordMovie(root, count, showSlice, { fps = 10, onProgress } = {}) {
  const type = ["video/mp4", "video/webm;codecs=vp9", "video/webm"].find(t => window.MediaRecorder?.isTypeSupported?.(t));
  if (!type) throw new Error("This browser can't record video");
  const first = await captureViewer(root);
  const stage = document.createElement("canvas");
  stage.width = first.width; stage.height = first.height;
  const ctx = stage.getContext("2d");
  const stream = stage.captureStream(0);
  const track = stream.getVideoTracks()[0];
  const recorder = new MediaRecorder(stream, { mimeType: type, videoBitsPerSecond: 8_000_000 });
  const chunks = [];
  recorder.ondataavailable = e => e.data.size && chunks.push(e.data);
  const stopped = new Promise(resolve => { recorder.onstop = resolve; });
  recorder.start();
  for (let i = 0; i < count; i++) {
    await showSlice(i);
    const frame = await captureViewer(root);
    ctx.drawImage(frame, 0, 0, stage.width, stage.height);
    track.requestFrame?.();
    onProgress?.(Math.round(((i + 1) / count) * 100));
    await new Promise(r => setTimeout(r, 1000 / fps));
  }
  recorder.stop();
  await stopped;
  return { blob: new Blob(chunks, { type }), extension: type.startsWith("video/mp4") ? "mp4" : "webm" };
}

const safeName = (text, fallback) => (String(text ?? "").replace(/[^\w.-]+/g, "_").replace(/^_+|_+$/g, "") || fallback);

// The series' DICOM files as a ZIP. getBytes(image) → ArrayBuffer for one image record.
export async function seriesZip(images, getBytes, { anonymize = false, patient, series, onProgress } = {}) {
  const dicom = images.filter(isDicomImage);
  const folder = `${anonymize ? "ANONYMOUS" : safeName(patient, "patient")}/${safeName(series, "series")}`;
  const files = [];
  for (let i = 0; i < dicom.length; i++) {
    const buffer = await getBytes(dicom[i]);
    files.push({
      name: `${folder}/IM${String(i + 1).padStart(4, "0")}.dcm`,
      data: anonymize ? anonymizeDicom(buffer) : new Uint8Array(buffer),
    });
    onProgress?.(Math.round(((i + 1) / dicom.length) * 100));
  }
  return { blob: zipFiles(files), name: `${folder.replace("/", "_")}${anonymize ? "_anonymised" : ""}.zip`, count: files.length };
}
