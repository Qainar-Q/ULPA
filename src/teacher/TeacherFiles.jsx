import { useMemo, useRef, useState } from "react";
import { FileUp, Paperclip } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import MaterialList, { formatSize } from "../components/materials/MaterialList.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { materialProblem, uploadMaterial, useMaterials } from "../features/materials/materialApi.js";
import { holdBusy } from "../lib/busy.js";

const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip,image/*";

/**
 * Teachers share files (lecture slides, tasks, lists) with their students.
 * They land in the students' "Материалдар" with an «Оқытушы» label, and students get a notification.
 */
export default function TeacherFiles() {
  const { teacher } = useAuth();
  const courses = teacher.courses;
  const byId = useMemo(() => new Map(courses.map((course) => [course.id, course])), [courses]);
  const { status, items, reload } = useMaterials();
  const mine = items.filter((item) => item.teacher_id === teacher.id);

  const [values, setValues] = useState({ courseId: courses[0]?.id ?? "", title: "", description: "", group: "both" });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const input = useRef(null);
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));

  function pick(event) {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = "";
    if (!chosen) return;
    const problem = materialProblem(chosen);
    if (problem) {
      setFile(null);
      setMessage({ error: true, text: problem === "too_large" ? "Файл 25 МБ-тан үлкен." : "Бұл файл түрі қолдау көрмейді (PDF, Word, Excel, PowerPoint, сурет, ZIP)." });
      return;
    }
    setMessage(null);
    setFile(chosen);
    if (!values.title.trim()) set("title")(chosen.name.replace(/\.[^.]+$/, "").slice(0, 120));
  }

  async function submit(event) {
    event.preventDefault();
    if (!values.courseId) return setMessage({ error: true, text: "Пәнді таңдаңыз." });
    if (!file) return setMessage({ error: true, text: "Файлды таңдаңыз." });
    if (!values.title.trim()) return setMessage({ error: true, text: "Атауын жазыңыз." });
    setBusy(true);
    setMessage(null);
    const release = holdBusy();
    try {
      await uploadMaterial({ courseId: values.courseId, title: values.title, description: values.description, groupNo: values.group, file });
      setFile(null);
      setValues((current) => ({ ...current, title: "", description: "" }));
      setMessage({ error: false, text: "Жіберілді ✓ Студенттер «Материалдар» бетінде көреді, телефонына хабарлама барады." });
      reload();
    } catch {
      setMessage({ error: true, text: "Жүктелмеді. Интернетті тексеріп, қайта көріңіз." });
    } finally {
      release();
      setBusy(false);
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Оқытушы"
        title="Студенттерге файл жіберу"
        description="Дәріс слайдтары, тапсырма шарттары, әдебиет тізімі. Файл студенттердің «Материалдар» бетінде «Оқытушы» белгісімен шығады."
      />

      <form className="panel stack" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="tf-course">Пән</label>
          <div className="select-wrap">
            <select id="tf-course" className="input" value={values.courseId} onChange={(event) => set("courseId")(event.target.value)}>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>
                  {course.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <span className="field__label">Файл</span>
          <button type="button" className="t-file-pick" onClick={() => input.current?.click()}>
            {file ? (
              <>
                <Paperclip size={18} aria-hidden="true" />
                <span>
                  <strong>{file.name}</strong>
                  <small>{formatSize(file.size)} · басқасын таңдау</small>
                </span>
              </>
            ) : (
              <>
                <FileUp size={20} aria-hidden="true" />
                <span>
                  <strong>Файлды таңдау</strong>
                  <small>PDF, Word, Excel, PowerPoint, сурет, ZIP · 25 МБ-қа дейін</small>
                </span>
              </>
            )}
          </button>
          <input ref={input} type="file" accept={ACCEPT} hidden onChange={pick} />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tf-title">Атауы</label>
          <input id="tf-title" className="input" maxLength={120} value={values.title} onChange={(event) => set("title")(event.target.value)} placeholder="Мысалы: 3-дәріс слайдтары" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="tf-desc">Түсініктеме <span className="muted">(міндетті емес)</span></label>
          <textarea id="tf-desc" className="input input--textarea" rows={3} maxLength={1000} value={values.description} onChange={(event) => set("description")(event.target.value)} />
        </div>
        <div className="field">
          <span className="field__label">Кімге</span>
          <Segmented
            label="Кімге"
            options={[
              { id: "both", label: "Барлығына" },
              { id: "1", label: "1-топ" },
              { id: "2", label: "2-топ" },
            ]}
            value={values.group}
            onChange={set("group")}
          />
        </div>
        {message && (
          <p className={message.error ? "form__error" : "form__ok"} role={message.error ? "alert" : "status"}>
            {message.text}
          </p>
        )}
        <button type="submit" className="button button--primary" disabled={busy}>
          <FileUp size={16} /> {busy ? "Жүктелуде…" : "Жіберу"}
        </button>
      </form>

      <section className="stack">
        <h2 className="panel-title">Жіберілген файлдар</h2>
        {status === "loading" && <p className="muted">Жүктелуде…</p>}
        {status === "error" && <p className="form__error">Тізім жүктелмеді.</p>}
        {status === "ready" && mine.length === 0 && <p className="muted">Әзірге файл жоқ.</p>}
        {mine.length > 0 && <MaterialList items={mine} courseById={(id) => byId.get(id)} showCourse onDeleted={reload} />}
      </section>
    </div>
  );
}
