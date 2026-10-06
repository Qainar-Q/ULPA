import { courseAccent } from "../../lib/courseStyle.js";
import { PHOTO_TYPES } from "../../config/app.js";

const TYPE_LABEL = Object.fromEntries(PHOTO_TYPES.map((type) => [type.id, type.label]));

/** Thumbnail grid. Clicking a tile calls onOpen(index). */
export default function PhotoGrid({ photos, thumbs, courseById, onOpen, compact = false }) {
  return (
    <ul className={`photo-grid${compact ? " photo-grid--compact" : ""}`}>
      {photos.map((photo, index) => {
        const course = courseById(photo.course_id);
        return (
          <li key={photo.id} style={courseAccent(course)}>
            <button type="button" className="photo-tile" onClick={() => onOpen(index)} aria-label={`${course?.name ?? ""} — ${TYPE_LABEL[photo.photo_type]}`}>
              {thumbs[photo.thumb_path] ? (
                <img src={thumbs[photo.thumb_path]} alt="" loading="lazy" decoding="async" />
              ) : (
                <span className="photo-tile__missing" />
              )}
              {!compact && (
                <span className="photo-tile__info">
                  <span className="photo-tile__code">{course?.code}</span>
                  <span className={`photo-tile__type photo-tile__type--${photo.photo_type}`}>
                    {photo.photo_type === "lecture" ? "Дәріс" : `Зерт. · ${photo.group_no}-топ`}
                  </span>
                </span>
              )}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
