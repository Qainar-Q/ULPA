import { useState } from "react";
import Modal from "./ui/Modal.jsx";
import { supabase } from "../lib/supabase.js";

/** Admin: edit a course's teacher and description (RLS allows admins only). */
export default function CourseInfoForm({ course, onClose, onSaved }) {
  const [teacher, setTeacher] = useState(course.teacher ?? "");
  const [description, setDescription] = useState(course.description ?? "");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    const { data, error: saveError } = await supabase
      .from("courses")
      .update({ teacher: teacher.trim() || null, description: description.trim() || null })
      .eq("id", course.id)
      .select("id");
    if (saveError || !data?.length) {
      setError("Сақталмады. Рұқсатты немесе интернетті тексер.");
      setBusy(false);
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <Modal title="Пән туралы ақпарат" onClose={busy ? () => {} : onClose}>
      <form className="upload" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="ci-teacher">Оқытушы</label>
          <input id="ci-teacher" className="input" maxLength={120} value={teacher} onChange={(event) => setTeacher(event.target.value)} />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ci-desc">Сипаттама</label>
          <textarea
            id="ci-desc"
            className="input input--textarea"
            rows={7}
            maxLength={2000}
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder={"Пән не туралы, бағалау тәртібі, оқытушының талаптары, ұсынылатын әдебиет…"}
          />
          <p className="field__hint field__hint--right">{description.length}/2000</p>
        </div>
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? "Сақталуда…" : "Сақтау"}
        </button>
      </form>
    </Modal>
  );
}
