import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, ExternalLink, X } from "lucide-react";
import { canShareFiles, fetchImageFile, saveImageFile } from "../../lib/saveImage.js";

/**
 * Full-screen image viewer: swipe / arrows, open original, save to the photo library.
 * images: [{ url, name, caption? }]
 */
export default function ImageLightbox({ images, index, onIndexChange, onClose, footer }) {
  const image = images[index];
  const [file, setFile] = useState(null); // pre-fetched for an instant share sheet
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setSaveState(null);
    fetchImageFile(image.url, image.name)
      .then((result) => !cancelled && setFile(result))
      .catch(() => !cancelled && setFile(null));
    return () => {
      cancelled = true;
    };
  }, [image.url, image.name]);

  const go = useCallback(
    (step) => {
      const next = index + step;
      if (next >= 0 && next < images.length) onIndexChange(next);
    },
    [index, images.length, onIndexChange]
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(event) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") go(-1);
      if (event.key === "ArrowRight") go(1);
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKey);
    };
  }, [go, onClose]);

  const [touchX, setTouchX] = useState(null);
  function onTouchEnd(event) {
    if (touchX === null || event.touches.length > 0) return;
    const delta = event.changedTouches[0].clientX - touchX;
    if (Math.abs(delta) > 60) go(delta < 0 ? 1 : -1);
    setTouchX(null);
  }

  async function save() {
    if (!file) return;
    const result = await saveImageFile(file); // first await → share sheet opens within the tap
    setSaveState(result === "cancelled" ? null : result);
  }

  const shareLabel = canShareFiles(file) ? "Альбомға сақтау" : "Жүктеп алу";

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label={image.name}>
      <div className="viewer__top">
        <span className="viewer__counter">
          {images.length > 1 ? `${index + 1} / ${images.length}` : ""}
        </span>
        <div className="viewer__actions">
          <a href={image.url} target="_blank" rel="noreferrer" className="icon-button icon-button--glass" aria-label="Түпнұсқаны ашу">
            <ExternalLink size={18} />
          </a>
          <button type="button" className="icon-button icon-button--glass" onClick={onClose} aria-label="Жабу">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="viewer__stage" onTouchStart={(event) => event.touches.length === 1 && setTouchX(event.touches[0].clientX)} onTouchEnd={onTouchEnd}>
        <img key={image.url} src={image.url} alt={image.caption ?? image.name} className="is-full" />
        {index > 0 && (
          <button type="button" className="viewer__nav viewer__nav--prev" onClick={() => go(-1)} aria-label="Алдыңғы">
            <ChevronLeft size={26} />
          </button>
        )}
        {index < images.length - 1 && (
          <button type="button" className="viewer__nav viewer__nav--next" onClick={() => go(1)} aria-label="Келесі">
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      <div className="viewer__info">
        {footer ?? (image.caption && <strong>{image.caption}</strong>)}
        <div className="viewer__save">
          <button type="button" className="button button--primary" onClick={save} disabled={!file}>
            <Download size={17} /> {file ? shareLabel : "Дайындалуда…"}
          </button>
          {saveState === "shared" && <span className="passkeys__ok">Мәзірден «Сохранить изображение» таңда ✓</span>}
          {saveState === "downloaded" && <span className="passkeys__ok">Жүктелді ✓</span>}
        </div>
      </div>
    </div>,
    document.body
  );
}
