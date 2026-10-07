import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Trash2, X } from "lucide-react";
import { canShareFiles, fetchImageFile, saveImageFile } from "../../lib/saveImage.js";
import { deletePhoto, signUrls } from "../../features/photos/photoApi.js";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { APP_TIME_ZONE, SESSION_TYPES } from "../../config/app.js";

function formatDate(iso) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(iso));
}

/** Full-screen photo viewer with previous/next, original link and delete. */
export default function PhotoViewer({ photos, index, thumbs, courseById, onIndexChange, onClose, onDeleted }) {
  const { student, isAdmin } = useAuth();
  const photo = photos[index];
  const [fullUrl, setFullUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [file, setFile] = useState(null); // pre-fetched so the share sheet opens within the tap
  const [saveState, setSaveState] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setFile(null);
    setSaveState(null);
    if (!fullUrl) return undefined;
    const date = (photo.created_at ?? "").slice(0, 10);
    fetchImageFile(fullUrl, `ulpa-${date}-${photo.id.slice(0, 6)}.jpg`)
      .then((result) => !cancelled && setFile(result))
      .catch(() => !cancelled && setFile(null));
    return () => {
      cancelled = true;
    };
  }, [fullUrl, photo.created_at, photo.id]);

  async function save() {
    if (!file) return;
    const result = await saveImageFile(file);
    setSaveState(result === "cancelled" ? null : result);
  }

  useEffect(() => {
    let cancelled = false;
    setFullUrl(null);
    setFailed(false);
    signUrls([photo.storage_path])
      .then((urls) => !cancelled && setFullUrl(urls[photo.storage_path] ?? null))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [photo.storage_path]);

  const go = useCallback(
    (step) => {
      const next = index + step;
      if (next >= 0 && next < photos.length) onIndexChange(next);
    },
    [index, photos.length, onIndexChange]
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

  // Simple swipe left/right on touch screens.
  const [touchX, setTouchX] = useState(null);
  function onTouchEnd(event) {
    if (touchX === null) return;
    const delta = event.changedTouches[0].clientX - touchX;
    if (Math.abs(delta) > 60) go(delta < 0 ? 1 : -1);
    setTouchX(null);
  }

  const course = courseById(photo.course_id);
  const canDelete = isAdmin || photo.uploaded_by === student?.id;

  async function handleDelete() {
    if (!window.confirm("Бұл фотоны жою керек пе? Бұл әрекетті қайтару мүмкін емес.")) return;
    setDeleting(true);
    try {
      await deletePhoto(photo);
      onDeleted(photo.id);
    } catch {
      setDeleting(false);
      window.alert("Фото жойылмады. Қайта көр.");
    }
  }

  return createPortal(
    <div className="viewer" role="dialog" aria-modal="true" aria-label="Фото">
      <div className="viewer__top">
        <span className="viewer__counter">
          {index + 1} / {photos.length}
        </span>
        <div className="viewer__actions">
          {fullUrl && (
            <a href={fullUrl} target="_blank" rel="noreferrer" className="icon-button icon-button--glass" aria-label="Түпнұсқаны ашу">
              <ExternalLink size={18} />
            </a>
          )}
          {canDelete && (
            <button type="button" className="icon-button icon-button--glass" onClick={handleDelete} disabled={deleting} aria-label="Жою">
              <Trash2 size={18} />
            </button>
          )}
          <button type="button" className="icon-button icon-button--glass" onClick={onClose} aria-label="Жабу">
            <X size={18} />
          </button>
        </div>
      </div>

      <div className="viewer__stage" onTouchStart={(event) => setTouchX(event.touches[0].clientX)} onTouchEnd={onTouchEnd}>
        {failed ? (
          <p className="viewer__error">Фото жүктелмеді. Желіні тексер.</p>
        ) : (
          <img
            key={photo.id}
            src={fullUrl ?? thumbs[photo.thumb_path]}
            alt={photo.caption ?? course?.name ?? "Фото"}
            className={fullUrl ? "is-full" : "is-preview"}
          />
        )}
        {index > 0 && (
          <button type="button" className="viewer__nav viewer__nav--prev" onClick={() => go(-1)} aria-label="Алдыңғы">
            <ChevronLeft size={26} />
          </button>
        )}
        {index < photos.length - 1 && (
          <button type="button" className="viewer__nav viewer__nav--next" onClick={() => go(1)} aria-label="Келесі">
            <ChevronRight size={26} />
          </button>
        )}
      </div>

      <div className="viewer__info">
        <strong>{course?.name}</strong>
        <div className="viewer__meta">
          <span className={`session__type session__type--${photo.photo_type}`}>{SESSION_TYPES[photo.photo_type]}</span>
          <span>{photo.group_no ? `${photo.group_no}-топ` : "Екі топқа ортақ"}</span>
          <span>{formatDate(photo.created_at)}</span>
          {photo.uploader_name && <span>{photo.uploader_name}</span>}
        </div>
        {photo.caption && <p className="viewer__caption">{photo.caption}</p>}
        {!failed && (
          <div className="viewer__save">
            <button type="button" className="button button--primary" onClick={save} disabled={!file}>
              <Download size={17} /> {file ? (canShareFiles(file) ? "Альбомға сақтау" : "Жүктеп алу") : "Дайындалуда…"}
            </button>
            {saveState === "shared" && <span className="passkeys__ok">Мәзірден «Сохранить изображение» таңда ✓</span>}
            {saveState === "downloaded" && <span className="passkeys__ok">Жүктелді ✓</span>}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
