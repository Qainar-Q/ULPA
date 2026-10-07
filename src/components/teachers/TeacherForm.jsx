import { useEffect, useRef, useState } from "react";
import { Camera, Trash2 } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import { useCatalog } from "../../features/catalog/CatalogContext.jsx";
import { deleteTeacher, removeTeacherPhoto, saveTeacher } from "../../features/teachers/teacherApi.js";

/** Admin: add or edit a teacher card. */
export default function TeacherForm({ teacher, photoUrl, onClose, onSaved }) {
  const { courses } = useCatalog();
  const [values, setValues] = useState({
    full_name: teacher?.full_name ?? "",
    position: teacher?.position ?? "",
    phone: teacher?.phone ?? "",
    email: teacher?.email ?? "",
    office: teacher?.office ?? "",
    office_hours: teacher?.office_hours ?? "",
    note: teacher?.note ?? "",
  });
  const [courseIds, setCourseIds] = useState(teacher?.courseIds ?? []);
  const [photo, setPhoto] = useState(null);
  const [preview, setPreview] = useState(photoUrl ?? null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const fileRef = useRef(null);
  const set = (key) => (event) => setValues((current) => ({ ...current, [key]: event.target.value }));

  useEffect(() => {
    if (!photo) return undefined;
    const url = URL.createObjectURL(photo);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [photo]);

  function pick(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("Тек сурет таңда.");
    setError(null);
    setPhoto(file);
  }

  async function submit(event) {
    event.preventDefault();
    if (values.full_name.trim().length < 2) return setError("Аты-жөнін жаз.");
    if (values.email.trim() && !/^\S+@\S+\.\S+$/.test(values.email.trim())) return setError("Email дұрыс емес.");
    setBusy(true);
    setError(null);
    try {
      await saveTeacher(teacher, values, courseIds, photo);
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(saveError?.code === "23505" ? "Мұндай оқытушы бұрыннан бар." : "Сақталмады. Қайта көр.");
      setBusy(false);
    }
  }

  async function dropPhoto() {
    if (!teacher?.photo_path || !window.confirm("Фотоны алып тастау керек пе?")) return;
    setBusy(true);
    try {
      await removeTeacherPhoto(teacher);
      setPreview(null);
      await onSaved();
    } catch {
      setError("Фото жойылмады.");
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(`«${teacher.full_name}» картасын жою керек пе?`)) return;
    setBusy(true);
    try {
      await deleteTeacher(teacher);
      await onSaved();
      onClose();
    } catch {
      setError("Жойылмады.");
      setBusy(false);
    }
  }

  const toggleCourse = (id) => setCourseIds((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]));

  return (
    <Modal title={teacher ? "Оқытушыны өзгерту" : "Жаңа оқытушы"} onClose={busy ? () => {} : onClose}>
      <form className="upload" onSubmit={submit}>
        <div className="teacher-form__photo">
          <button type="button" className="teacher-form__pick" onClick={() => fileRef.current?.click()} disabled={busy}>
            {preview ? <img src={preview} alt="" /> : <Camera size={26} />}
          </button>
          <div className="teacher-form__photo-text">
            <button type="button" className="button button--ghost button--sm" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Camera size={15} /> {preview ? "Фотоны ауыстыру" : "Фото қосу"}
            </button>
            {teacher?.photo_path && !photo && (
              <button type="button" className="text-link" onClick={dropPhoto} disabled={busy}>
                Фотоны алып тастау
              </button>
            )}
            <p className="field__hint">Автоматты түрде кішірейтіледі.</p>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={pick} />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tf-name">Аты-жөні</label>
          <input id="tf-name" className="input" maxLength={120} value={values.full_name} onChange={set("full_name")} placeholder="Мысалы: Толеуханов Айдос Ерланұлы" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="tf-pos">Лауазымы <span className="muted">(міндетті емес)</span></label>
          <input id="tf-pos" className="input" maxLength={120} value={values.position} onChange={set("position")} placeholder="Мысалы: аға оқытушы, PhD" />
        </div>
        <div className="teacher-form__row">
          <div className="field">
            <label className="field__label" htmlFor="tf-phone">Телефон</label>
            <input id="tf-phone" className="input" type="tel" inputMode="tel" maxLength={40} value={values.phone} onChange={set("phone")} placeholder="+7 7xx xxx xx xx" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tf-email">Email</label>
            <input id="tf-email" className="input" type="email" maxLength={120} value={values.email} onChange={set("email")} />
          </div>
        </div>
        <div className="teacher-form__row">
          <div className="field">
            <label className="field__label" htmlFor="tf-office">Кабинет</label>
            <input id="tf-office" className="input" maxLength={120} value={values.office} onChange={set("office")} placeholder="Мысалы: 305, бас корпус" />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="tf-hours">Кеңес уақыты</label>
            <input id="tf-hours" className="input" maxLength={300} value={values.office_hours} onChange={set("office_hours")} placeholder="Мысалы: Сс 14:00–15:00" />
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="tf-note">Ескерту <span className="muted">(міндетті емес)</span></label>
          <textarea id="tf-note" className="input input--textarea" rows={2} maxLength={1000} value={values.note} onChange={set("note")} placeholder="Мысалы: тапсырманы тек Platonus арқылы қабылдайды" />
        </div>
        <div className="field">
          <span className="field__label">Пәндері</span>
          <div className="teacher-form__courses">
            {courses.map((course) => (
              <label key={course.id} className={`chip-check${courseIds.includes(course.id) ? " is-on" : ""}`}>
                <input type="checkbox" checked={courseIds.includes(course.id)} onChange={() => toggleCourse(course.id)} />
                {course.code} · {course.name}
              </label>
            ))}
          </div>
        </div>
        <p className="field__hint">Байланыс деректері тек сынып мүшелеріне көрінеді.</p>
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? "Сақталуда…" : "Сақтау"}
        </button>
        {teacher && (
          <button type="button" className="button button--ghost button--danger button--block" onClick={remove} disabled={busy}>
            <Trash2 size={16} /> Картаны жою
          </button>
        )}
      </form>
    </Modal>
  );
}
