// Save an image to the phone's photo library.
// Browsers cannot write to Photos directly. On iPhone/Android the share sheet
// (navigator.share with a file) offers "Save Image" / "Сохранить изображение".
// Elsewhere (desktop) the image is downloaded instead.

/** Fetch an image into a File ahead of time, so the share sheet can open instantly on tap. */
export async function fetchImageFile(url, name = "ulpa.jpg") {
  const response = await fetch(url);
  if (!response.ok) throw new Error(String(response.status));
  const blob = await response.blob();
  const type = blob.type && blob.type.startsWith("image/") ? blob.type : "image/jpeg";
  const safeName = /\.(jpe?g|png|webp|gif)$/i.test(name) ? name : `${name.replace(/\.[^.]+$/, "")}.jpg`;
  return new File([blob], safeName, { type });
}

export function canShareFiles(file) {
  try {
    return Boolean(file && navigator.canShare?.({ files: [file] }));
  } catch {
    return false;
  }
}

/**
 * Call directly inside a click handler (no awaits before it), otherwise iOS
 * refuses to open the share sheet. Returns "shared" | "downloaded" | "cancelled".
 */
export async function saveImageFile(file) {
  if (canShareFiles(file)) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch (error) {
      if (error?.name === "AbortError") return "cancelled";
      // fall through to download
    }
  }
  const url = URL.createObjectURL(file);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return "downloaded";
}
