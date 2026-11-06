// Keeps a copy of each image's geometry metadata once it's been read.
//
// The DICOM loader answers metaData.get() from the parsed file, and drops that file as
// soon as Cornerstone evicts the image from its cache — which a large series open in
// both the 2D viewer and the 3-plane view easily triggers. Anything that asks again
// afterwards (building the 3D view's segmentation layer for drawn regions, ROI volumes)
// then gets undefined. This provider sits in front of the loader's and answers from the
// copy; images it hasn't seen fall through to the loader as before.
import { metaData, eventTarget, Enums as csEnums } from "@cornerstonejs/core";

// What Cornerstone reads from a referenced image to derive a segmentation image from it
// (imageLoader.createAndCacheDerivedImage), plus what our own geometry code reads
const MODULES = ["imagePlaneModule", "generalSeriesModule", "imagePixelModule", "generalImageModule"];
const PRIORITY = 10000; // ahead of the loaders' own providers

const store = new Map(); // imageId -> { module: metadata }
let installed = false;

function provider(type, imageId) {
  return store.get(imageId)?.[type];
}

// Copy the modules for these imageIds while the loader still has them
export function snapshotMetadata(imageIds) {
  imageIds.forEach(imageId => {
    const entry = store.get(imageId) ?? {};
    let added = false;
    MODULES.forEach(type => {
      if (entry[type]) return;
      const value = metaData.get(type, imageId);
      if (value) { entry[type] = value; added = true; }
    });
    if (added) store.set(imageId, entry);
  });
}

export function installMetadataSnapshot() {
  if (installed) return;
  installed = true;
  metaData.addProvider(provider, PRIORITY);
  // Every image as it loads, for stacks and volumes alike
  eventTarget.addEventListener(csEnums.Events.IMAGE_LOADED, evt => {
    const imageId = evt.detail?.image?.imageId;
    if (imageId) snapshotMetadata([imageId]);
  });
}
