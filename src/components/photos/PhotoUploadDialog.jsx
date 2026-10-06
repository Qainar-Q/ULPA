import { useEffect, useMemo, useRef, useState } from "react";
import { Camera, ImagePlus, Upload, X } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import { useCatalog } from "../../features/catalog/CatalogContext.jsx";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { prepareImage, ImageError } from "../../features/photos/imageProcessing.js";
import { uploadPhoto } from "../../features/photos/photoApi.js";
import { GROUPS, PHOTO_TYPES } from "../../config/app.js";
import { almatyWeekday } from "../../lib/time.js";
import { almatyMinutes, sessionsOnDay, toMinutes } from "../../lib/schedule.js";

const MAX_FILES = 10;

const ERRORS = {
  not_image: "Тек сурет файлдарын таңдауға болады.",
  too_large: "Файл тым үлкен (30 МБ-тан аспауы керек).",
  unreadable: "Бұл суретті оқу мүмкін болмады. JPEG немесе PNG қолданып көр.",
  no_course: "Пәнді таңда.",
  upload: "Жүктеу кезінде қате шықты. Интернетті тексеріп, қайта көр.",
  too_many: `Бір реттен ${MAX_FILES} фотодан артық болмайды.`,
};

/** The class happening now (or the last one that started today) — a good default. */
function suggestSession(sessions) {
  const now = almatyMinutes();
  const started = sessionsOnDay(sessions, almatyWeekday()).filter((session) => toMinutes(session.start_time) <= now + 10);
  return started[started.length - 1] ?? null;
}

export default function PhotoUploadDialog({ onClose, onUploaded, defaultCourseSlug }) {
  const { courses, mySessions, courseBySlug, courseById } = useCatalog();
  const { isAdmin, student } = useAuth();
  const suggestion = useMemo(() => suggestSession(mySessions), [mySessions]);

  const [files, setFiles] = useState([]); // [{ file, preview }]
  const [courseId, setCourseId] = useState(
    () => courseBySlug(defaultCourseSlug)?.id ?? suggestion?.course_id ?? ""
  );
  const [photoType, setPhotoType] = useState(() => suggestion?.session_type ?? "lecture");
  const [groupNo, setGroupNo] = useState(student?.group_no ?? 1);
  const [caption, setCaption] = useState("");
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(null); // { done, total }

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);

  useEffect(() => () => files.forEach((item) => URL.revokeObjectURL(item.preview)), [files]);

  function addFiles(list) {
    setError(null);
    const incoming = Array.from(list ?? []);
    const images = incoming.filter((file) => file.type.startsWith("image/"));
    if (images.length < incoming.length) setError("not_image");
    setFiles((current) => {
      const next = [...current, ...images.map((file) => ({ file, preview: URL.createObjectURL(file) }))];
      if (next.length > MAX_FILES) {
        setError("too_many");
        next.slice(MAX_FILES).forEach((item) => URL.revokeObjectURL(item.preview));
        return next.slice(0, MAX_FILES);
      }
      return next;
    });
  }

  function removeFile(index) {
    setFiles((current) => {
      URL.revokeObjectURL(current[index].preview);
      return current.filter((_, i) => i !== index);
    });
  }

  async function handleUpload() {
    if (!courseId) return setError("no_course");
    if (files.length === 0) return;
    setError(null);
    setProgress({ done: 0, total: files.length });

    let uploaded = 0;
    for (const item of files) {
      try {
        const prepared = await prepareImage(item.file);
        await uploadPhoto({
          courseId,
          photoType,
          groupNo: isAdmin && photoType === "lab" ? groupNo : null,
          caption,
          prepared,
        });
        uploaded += 1;
        setProgress({ done: uploaded, total: files.length });
      } catch (uploadError) {
        setError(uploadError instanceof ImageError ? uploadError.code : "upload");
        setProgress(null);
        // Keep the files that did not upload so the student can retry.
        setFiles((current) => current.slice(uploaded));
        if (uploaded > 0) onUploaded();
        return;
      }
    }
    onUploaded();
    onClose();
  }

  const busy = progress !== null;
  const course = courseById(courseId);

  return (
    <Modal title="Фото жүктеу" onClose={busy ? () => {} : onClose}>
      <div className="upload">
        <div className="upload__pickers">
          <button type="button" className="upload__picker" onClick={() => cameraRef.current?.click()} disabled={busy}>
            <Camera size={22} />
            <span>Камера</span>
          </button>
          <button type="button" className="upload__picker" onClick={() => galleryRef.current?.click()} disabled={busy}>
            <ImagePlus size={22} />
            <span>Галерея</span>
          </button>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
          <input
            ref={galleryRef}
            type="file"
            accept="image/*"
            multiple
            hidden
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </div>

        {files.length > 0 && (
          <ul className="upload__previews">
            {files.map((item, index) => (
              <li key={item.preview}>
                <img src={item.preview} alt="" />
                {!busy && (
                  <button type="button" onClick={() => removeFile(index)} aria-label="Алып тастау">
                    <X size={14} />
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="field">
          <label className="field__label" htmlFor="upload-course">
            Пән
          </label>
          <div className="select-wrap">
            <select
              id="upload-course"
              className="input"
              value={courseId}
              onChange={(event) => setCourseId(event.target.value)}
              disabled={busy}
              aria-invalid={error === "no_course" || undefined}
            >
              <option value="">Пәнді таңда…</option>
              {courses.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name}
                </option>
              ))}
            </select>
          </div>
          {suggestion && suggestion.course_id === courseId && (
            <p className="field__hint">Қазіргі сабаққа сәйкес таңдалды.</p>
          )}
        </div>

        <div className="field">
          <span className="field__label">Фото түрі</span>
          <Segmented label="Фото түрі" options={PHOTO_TYPES} value={photoType} onChange={setPhotoType} />
          <p className="field__hint">
            {photoType === "lecture"
              ? "Дәріс фотосы екі топқа да көрінеді."
              : isAdmin
                ? "Зертханалық фото тек таңдалған топқа көрінеді."
                : `Зертханалық фото тек ${student?.group_no}-топқа көрінеді.`}
          </p>
        </div>

        {isAdmin && photoType === "lab" && (
          <div className="field">
            <span className="field__label">Топ</span>
            <Segmented label="Топ" options={GROUPS} value={groupNo} onChange={setGroupNo} />
          </div>
        )}

        <div className="field">
          <label className="field__label" htmlFor="upload-caption">
            Қысқаша сипаттама <span className="muted">(міндетті емес)</span>
          </label>
          <textarea
            id="upload-caption"
            className="input input--textarea"
            maxLength={200}
            rows={2}
            placeholder={course ? `Мысалы: ${course.code}, 3-тақырып` : "Мысалы: 3-тақырып, формулалар"}
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            disabled={busy}
          />
          <p className="field__hint field__hint--right">{caption.length}/200</p>
        </div>

        {error && (
          <p className="form__error" role="alert">
            {ERRORS[error] ?? ERRORS.upload}
          </p>
        )}

        <button
          type="button"
          className="button button--primary button--block"
          onClick={handleUpload}
          disabled={busy || files.length === 0}
        >
          {busy ? (
            `Жүктелуде… ${progress.done}/${progress.total}`
          ) : (
            <>
              <Upload size={17} /> {files.length > 1 ? `${files.length} фото жүктеу` : "Жүктеу"}
            </>
          )}
        </button>
        {busy && (
          <div className="progress" aria-hidden="true">
            <span style={{ width: `${(progress.done / progress.total) * 100}%` }} />
          </div>
        )}
      </div>
    </Modal>
  );
}
