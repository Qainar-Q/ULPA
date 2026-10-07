// Prepare a photo in the browser before upload:
//  * respects camera orientation
//  * resizes (full ≤ 1400 px, thumbnail ≤ 400 px) so uploads are fast on mobile data
//  * re-encodes to JPEG, which also strips EXIF metadata such as GPS location

export const MAX_INPUT_BYTES = 30 * 1024 * 1024; // reject absurdly large source files
// Sized from a real upload: 1536×2048 @ 0.85 was 1.19 MB. 1400 px @ 0.72 ≈ 0.35 MB,
// so ~1,500 photos per semester fit in the 1 GB free storage.
const FULL_EDGE = 1400;
const THUMB_EDGE = 400;

export class ImageError extends Error {
  constructor(code) {
    super(code);
    this.code = code; // "not_image" | "too_large" | "unreadable"
  }
}

async function decode(file) {
  if ("createImageBitmap" in window) {
    try {
      return await createImageBitmap(file, { imageOrientation: "from-image" });
    } catch {
      /* fall back to <img> below (e.g. older Safari) */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = "async";
    img.src = url;
    await img.decode();
    return img;
  } catch {
    throw new ImageError("unreadable");
  } finally {
    URL.revokeObjectURL(url);
  }
}

function render(source, maxEdge, quality) {
  const width = source.width;
  const height = source.height;
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width * scale));
  canvas.height = Math.max(1, Math.round(height * scale));
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(source, 0, 0, canvas.width, canvas.height);

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve({ blob, width: canvas.width, height: canvas.height }) : reject(new ImageError("unreadable"))),
      "image/jpeg",
      quality
    );
  });
}

export async function prepareImage(file) {
  if (!file || !file.type.startsWith("image/")) throw new ImageError("not_image");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("too_large");

  const source = await decode(file);
  try {
    const full = await render(source, FULL_EDGE, 0.72);
    const thumb = await render(source, THUMB_EDGE, 0.68);
    return { full, thumb };
  } finally {
    if (typeof source.close === "function") source.close();
  }
}

const ATTACHMENT_EDGE = 2000; // handwriting and printed tasks stay readable
const ATTACHMENT_QUALITY = 0.8;

/**
 * Shrink an image attachment (homework photo, scanned page) before upload.
 * Non-images, GIFs and files the browser cannot decode are returned unchanged,
 * and so is any image that would not get smaller.
 */
export async function compressImageFile(file) {
  if (!file?.type?.startsWith("image/") || file.type === "image/gif" || file.size < 400 * 1024) return file;
  try {
    const source = await decode(file);
    try {
      const { blob } = await render(source, ATTACHMENT_EDGE, ATTACHMENT_QUALITY);
      if (blob.size >= file.size) return file;
      const name = file.name.replace(/\.[^.]+$/, "") + ".jpg";
      return new File([blob], name, { type: "image/jpeg", lastModified: Date.now() });
    } finally {
      if (typeof source.close === "function") source.close();
    }
  } catch {
    return file; // e.g. HEIC on a browser that cannot read it: upload as is
  }
}

/** Resize any image to fit `maxEdge` and return a JPEG blob (used for teacher portraits). */
export async function resizeToJpeg(file, maxEdge = 640, quality = 0.82) {
  if (!file?.type?.startsWith("image/")) throw new ImageError("not_image");
  if (file.size > MAX_INPUT_BYTES) throw new ImageError("too_large");
  const source = await decode(file);
  try {
    const { blob } = await render(source, maxEdge, quality);
    return blob;
  } finally {
    if (typeof source.close === "function") source.close();
  }
}
