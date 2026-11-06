// volume.load() returns nothing in this Cornerstone version: its callback only fires once
// every slice is in, and progress comes as IMAGE_VOLUME_MODIFIED events. This wraps both.
import { eventTarget, Enums } from "@cornerstonejs/core";

// Resolves with { failed } (slices that couldn't be loaded — they count as done, left
// blank in the volume) once every slice is in; onProgress(0–100) as they arrive
export function loadVolume(volume, onProgress) {
  return new Promise(resolve => {
    const total = volume.imageIds?.length || 1;
    const ours = new Set(volume.imageIds ?? []);
    let failed = 0;
    const onModified = evt => {
      if (evt.detail?.volumeId === volume.volumeId) onProgress?.(Math.round((evt.detail.framesProcessed / total) * 100));
    };
    // The error event names the slice, not the volume
    const onError = evt => { if (ours.has(evt.detail?.imageId)) failed++; };
    eventTarget.addEventListener(Enums.Events.IMAGE_VOLUME_MODIFIED, onModified);
    eventTarget.addEventListener(Enums.Events.IMAGE_LOAD_ERROR, onError);
    volume.load(() => {
      eventTarget.removeEventListener(Enums.Events.IMAGE_VOLUME_MODIFIED, onModified);
      eventTarget.removeEventListener(Enums.Events.IMAGE_LOAD_ERROR, onError);
      onProgress?.(100);
      resolve({ failed });
    });
  });
}

export const failedSlicesNote = failed =>
  failed ? `${failed} slice${failed === 1 ? "" : "s"} couldn't be loaded and ${failed === 1 ? "is" : "are"} blank in this view` : null;
