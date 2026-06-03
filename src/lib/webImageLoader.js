/**
 * Cornerstone3D v4 — custom image loader for JPEG / PNG / blob URLs.
 *
 * Converts to grayscale (MONOCHROME2) and registers all metadata modules
 * that CS3D's buildMetadata() requires, including generalSeriesModule which
 * was the silent crash point.
 *
 * Register: imageLoader.registerImageLoader('web', loadWebImage)
 * Usage:    imageId = "web:<url>"
 */
import { utilities } from "@cornerstonejs/core";

const { genericMetadataProvider } = utilities;

const API_BASE = (process.env.REACT_APP_API_URL || "").trim().replace(/\/$/, "");

/**
 * If the URL points to our authenticated backend, fetch with the JWT and
 * return a blob: URL that <img> can load. Otherwise return the URL as-is.
 */
async function toLoadableUrl(url) {
  const token = localStorage.getItem("token");
  if (token && API_BASE && url.includes(API_BASE)) {
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.status}`);
    const blob = await resp.blob();
    return URL.createObjectURL(blob);
  }
  return url;
}

function loadWebImage(imageId) {
  const rawUrl = imageId.replace(/^web:/, "");

  const promise = (async () => {
    const url = await toLoadableUrl(rawUrl);

    return new Promise((resolve, reject) => {
      const img = new Image();
      // blob: URLs are same-origin — crossOrigin breaks them on some browsers
      if (!url.startsWith("blob:")) img.crossOrigin = "anonymous";

      img.onload = () => {
        try {
          const w = img.naturalWidth;
          const h = img.naturalHeight;

          // ── Draw to offscreen canvas ────────────────────────────────────────
          const canvas = document.createElement("canvas");
          canvas.width  = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0);
          const rgba = ctx.getImageData(0, 0, w, h).data; // Uint8ClampedArray RGBA

          // ── RGB → grayscale luminance ───────────────────────────────────────
          const pixelData = new Uint8Array(w * h);
          let minPx = 255, maxPx = 0;
          for (let i = 0, j = 0; i < rgba.length; i += 4, j++) {
            const v = Math.round(
              0.2126 * rgba[i] + 0.7152 * rgba[i + 1] + 0.0722 * rgba[i + 2]
            );
            pixelData[j] = v;
            if (v < minPx) minPx = v;
            if (v > maxPx) maxPx = v;
          }

          const windowWidth  = maxPx - minPx || 255;
          const windowCenter = Math.round(minPx + windowWidth / 2);

          // ── Register ALL metadata modules buildMetadata() needs ─────────────
          // 1. imagePlaneModule  (MetadataModules.IMAGE_PLANE = "imagePlaneModule")
          genericMetadataProvider.add(imageId, {
            type: "imagePlaneModule",
            metadata: {
              rows:                    h,
              columns:                 w,
              rowPixelSpacing:         1,
              columnPixelSpacing:      1,
              pixelSpacing:            [1, 1],
              imagePositionPatient:    [0, 0, 0],
              imageOrientationPatient: [1, 0, 0, 0, 1, 0],
              rowCosines:              [1, 0, 0],
              columnCosines:           [0, 1, 0],
            },
          });

          // 2. imagePixelModule
          genericMetadataProvider.add(imageId, {
            type: "imagePixelModule",
            metadata: {
              samplesPerPixel:            1,
              photometricInterpretation:  "MONOCHROME2",
              rows:                h,
              columns:             w,
              bitsAllocated:       8,
              bitsStored:          8,
              highBit:             7,
              pixelRepresentation: 0,
            },
          });

          // 3. generalSeriesModule — required by buildMetadata(); crashes on null
          genericMetadataProvider.add(imageId, {
            type: "generalSeriesModule",
            metadata: { modality: "OT" }, // OT = "Other" — generic modality
          });

          // ── IImage (resolve directly — no wrapper for CS3D v4) ─────────────
          resolve({
            imageId,
            minPixelValue:      minPx,
            maxPixelValue:      maxPx,
            slope:              1,
            intercept:          0,
            windowCenter,
            windowWidth,
            color:              false,
            rgba:               false,
            numberOfComponents: 1,
            rows:               h,
            columns:            w,
            height:             h,
            width:              w,
            columnPixelSpacing: 1,
            rowPixelSpacing:    1,
            invert:             false,
            sizeInBytes:        pixelData.byteLength,
            getPixelData:       () => pixelData,
            // imageFrame.pixelData is required so ensureVoxelManager can delete it
            imageFrame: { pixelData },
          });
        } catch (err) {
          reject(err);
        }
      };

      img.onerror = () =>
        reject(new Error(`webImageLoader: could not load "${url}"`));

      img.src = url;
    });
  })();

  return { promise };
}

export default loadWebImage;
