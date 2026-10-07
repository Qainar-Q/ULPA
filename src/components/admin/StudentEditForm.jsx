import { useState } from "react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import { supabase } from "../../lib/supabase.js";

const MONTHS = ["қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым", "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан"];

/** Admin: edit name, group, birthday and monitor flag. Role is never changed here. */
export default function StudentEditForm({ student, onClose, onSaved }) {
  const [values, setValues] = useState({
    fullName: student.full_name,
    groupNo: String(student.group_no),
    month: student.birth_month ? String(student.birth_month) : "",
    day: student.birth_day ? String(student.birth_day) : "",
    isMonitor: Boolean(student.is_monitor),
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));

  async function submit(event) {
    event.preventDefault();
    if (!values.fullName.trim()) return setError("Атын жаз.");
    if (Boolean(values.month) !== Boolean(values.day)) return setError("Туған күннің айы мен күнін бірге толтыр немесе екеуін де бос қалдыр.");
    setBusy(true);
    setError(null);
    const { error: saveError } = await supabase.rpc("admin_update_student", {
      p_code: student.code,
      p_full_name: values.fullName.trim(),
      p_group_no: Number(values.groupNo),
      p_birth_month: values.month ? Number(values.month) : null,
      p_birth_day: values.day ? Number(values.day) : null,
      p_is_monitor: values.isMonitor,
    });
    if (saveError) {
      setError(saveError.code === "22023" ? "Мұндай күн жоқ (мысалы, 30 ақпан)." : "Сақталмады. Қайта көр.");
      setBusy(false);
      return;
    }
    await onSaved();
    onClose();
  }

  return (
    <Modal title={`${student.code} · ${student.full_name}`} onClose={busy ? () => {} : onClose}>
      <form className="upload" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="se-name">Аты</label>
          <input id="se-name" className="input" maxLength={80} value={values.fullName} onChange={(event) => set("fullName")(event.target.value)} />
        </div>
        <div className="field">
          <span className="field__label">Топ</span>
          <Segmented label="Топ" options={[{ id: "1", label: "1-топ" }, { id: "2", label: "2-топ" }]} value={values.groupNo} onChange={set("groupNo")} />
          {String(student.group_no) !== values.groupNo && (
            <p className="field__hint">Топ ауысса, студент жаңа топтың зертханалық сабақтары мен фотоларын көреді.</p>
          )}
        </div>
        <div className="form-grid form-grid--2">
          <div className="field">
            <label className="field__label" htmlFor="se-day">Туған күні</label>
            <input id="se-day" className="input" inputMode="numeric" placeholder="25" maxLength={2} value={values.day} onChange={(event) => set("day")(event.target.value.replace(/\D/g, ""))} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="se-month">Айы</label>
            <div className="select-wrap">
              <select id="se-month" className="input" value={values.month} onChange={(event) => set("month")(event.target.value)}>
                <option value="">—</option>
                {MONTHS.map((name, index) => (
                  <option key={name} value={index + 1}>{name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <label className="toggle">
          <span>Староста (хабарландыру жариялай алады)</span>
          <input type="checkbox" checked={values.isMonitor} onChange={(event) => set("isMonitor")(event.target.checked)} />
          <span className="toggle__track" aria-hidden="true" />
        </label>
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? "Сақталуда…" : "Сақтау"}
        </button>
      </form>
    </Modal>
  );
}
