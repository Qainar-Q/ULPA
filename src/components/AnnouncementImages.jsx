import { useEffect, useState } from "react";
import ImageLightbox from "./ui/ImageLightbox.jsx";
import { signedUrls } from "../lib/signedUrls.js";
import { ANNOUNCEMENT_BUCKET, announcementImages } from "../features/announcements/useAnnouncements.js";

/** Photos attached to an announcement: a small grid; tap one to see it full screen. */
export default function AnnouncementImages({ item, compact = false }) {
  const images = announcementImages(item);
  const paths = images.map((image) => image.storage_path).join("|");
  const [urls, setUrls] = useState({});
  const [open, setOpen] = useState(null);

  useEffect(() => {
    if (!paths) return undefined;
    let alive = true;
    signedUrls(ANNOUNCEMENT_BUCKET, paths.split("|"))
      .then((result) => alive && setUrls(result))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [paths]);

  if (!images.length) return null;
  const shown = compact ? images.slice(0, 3) : images;
  const date = (item.created_at ?? "").slice(0, 10);

  return (
    <>
      <div className={`announcement__images announcement__images--${Math.min(shown.length, 3)}`}>
        {shown.map((image, index) => (
          <button key={image.id} type="button" className="announcement__image" onClick={() => setOpen(index)} aria-label={`Фото ${index + 1}`}>
            {urls[image.storage_path] ? <img src={urls[image.storage_path]} alt="" loading="lazy" decoding="async" /> : <span className="announcement__image-wait" />}
            {compact && index === shown.length - 1 && images.length > shown.length && <span className="announcement__more">+{images.length - shown.length}</span>}
          </button>
        ))}
      </div>
      {open !== null && (
        <ImageLightbox
          images={images
            .filter((image) => urls[image.storage_path])
            .map((image, index) => ({ url: urls[image.storage_path], name: `ulpa-habarlandyru-${date}-${index + 1}.jpg` }))}
          index={Math.min(open, images.length - 1)}
          onIndexChange={setOpen}
          onClose={() => setOpen(null)}
        />
      )}
    </>
  );
}
