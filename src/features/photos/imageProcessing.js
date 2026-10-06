// Prepare a photo in the browser before upload:
//  * respects camera orientation
//  * resizes (full ≤ 2048 px, thumbnail ≤ 480 px) so uploads are fast on mobile data
//  * re-encodes to JPEG, which also strips EXIF metadata such as GPS location

export const MAX_INPUT_BYTES = 30 * 1024 * 1024; // reject absurdly large source files
const FULL_EDGE = 2048;
const THUMB_EDGE = 480;

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
    const full = await render(source, FULL_EDGE, 0.85);
    const thumb = await render(source, THUMB_EDGE, 0.72);
    return { full, thumb };
  } finally {
    if (typeof source.close === "function") source.close();
  }
}
