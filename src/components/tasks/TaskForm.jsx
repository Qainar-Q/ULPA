import { useRef, useState } from "react";
import { FileUp, Paperclip, Trash2, X } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import { useCatalog } from "../../features/catalog/CatalogContext.jsx";
import {
  attachmentProblem,
  deleteAttachment,
  saveTask,
  uploadAttachment,
} from "../../features/tasks/taskApi.js";
import { isoToLocalInput, localInputToIso } from "../../lib/due.js";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { groupChoices } from "../../lib/permissions.js";


function formatSize(bytes) {
  if (!bytes) return "";
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} МБ` : `${Math.ceil(bytes / 1e3)} КБ`;
}

/** Create or edit an assignment, with attachments (anyone in the class; own group or shared). */
export default function TaskForm({ task, defaultCourseId, onClose, onSaved }) {
  const { courses } = useCatalog();
  const { student, isAdmin } = useAuth();
  const groupOptions = groupChoices(student, isAdmin);
  const [values, setValues] = useState({
    courseId: task?.course_id ?? defaultCourseId ?? "",
    title: task?.title ?? "",
    description: task?.description ?? "",
    due: isoToLocalInput(task?.due_at),
    groupNo: task?.group_no ? String(task.group_no) : isAdmin ? "both" : String(student?.group_no ?? "both"),
  });
  const [existing, setExisting] = useState((task?.assignment_attachments ?? []).filter((file) => file.uploaded));
  const [newFiles, setNewFiles] = useState([]);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(null); // null | "saving" | "uploading n/m"
  const fileRef = useRef(null);
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));

  function addFiles(list) {
    setError(null);
    const accepted = [];
    for (const file of Array.from(list ?? [])) {
      const problem = attachmentProblem(file);
      if (problem === "too_large") setError(`«${file.name}» 20 МБ-тан үлкен.`);
      else if (problem === "type") setError(`«${file.name}»: тек PDF, сурет, Word, Excel, PowerPoint, TXT немесе ZIP.`);
      else accepted.push(file);
    }
    setNewFiles((current) => [...current, ...accepted].slice(0, 10));
  }

  async function removeExisting(file) {
    if (!window.confirm(`«${file.file_name}» файлын жою керек пе?`)) return;
    try {
      await deleteAttachment(file);
      setExisting((current) => current.filter((item) => item.id !== file.id));
    } catch {
      setError("Файл жойылмады.");
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!values.courseId) return setError("Пәнді таңда.");
    if (!values.title.trim()) return setError("Тапсырма атауын жаз.");

    setError(null);
    setBusy("saving");
    try {
      const id = await saveTask(task?.id, { ...values, dueAt: localInputToIso(values.due) });
      for (let index = 0; index < newFiles.length; index += 1) {
        setBusy(`uploading ${index + 1}/${newFiles.length}`);
        await uploadAttachment(id, newFiles[index]);
      }
      await onSaved(id);
      onClose();
    } catch (saveError) {
      setError(
        saveError?.code === "42501"
          ? "Бұл топқа тапсырма қосуға рұқсатың жоқ."
          : saveError?.message?.includes("daily task limit")
            ? "Бүгінге лимит бітті (күніне 20 тапсырма). Ертең қайта көр."
            : "Сақталмады. Интернетті тексеріп, қайта көр."
      );
      setBusy(null);
    }
  }

  return (
    <Modal title={task ? "Тапсырманы өзгерту" : "Жаңа тапсырма"} onClose={busy ? () => {} : onClose}>
      <form className="upload" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="tf-course">Пән</label>
          <div className="select-wrap">
            <select id="tf-course" className="input" value={values.courseId} onChange={(event) => set("courseId")(event.target.value)}>
              <option value="">Пәнді таңда…</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tf-title">Атауы</label>
          <input id="tf-title" className="input" maxLength={150} value={values.title} onChange={(event) => set("title")(event.target.value)} placeholder="Мысалы: №3 зертханалық жұмыс есебі" />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tf-desc">Сипаттама <span className="muted">(міндетті емес)</span></label>
          <textarea id="tf-desc" className="input input--textarea" rows={4} maxLength={5000} value={values.description} onChange={(event) => set("description")(event.target.value)} placeholder="Не істеу керек, қандай форматта тапсыру керек…" />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="tf-due">Тапсыру мерзімі (Алматы уақыты)</label>
          <input id="tf-due" type="datetime-local" className="input" value={values.due} onChange={(event) => set("due")(event.target.value)} />
          <p className="field__hint">Бос қалдырсаң — мерзімсіз тапсырма.</p>
        </div>

        <div className="field">
          <span className="field__label">Кімге</span>
          <Segmented label="Кімге" options={groupOptions} value={values.groupNo} onChange={set("groupNo")} />
          <p className="field__hint">
            {values.groupNo === "both" ? "Ортақ тапсырма: екі топқа да көрінеді." : `Тек ${values.groupNo}-топқа көрінеді.`}
          </p>
        </div>

        <div className="field">
          <span className="field__label">Файлдар</span>
          <ul className="file-list">
            {existing.map((file) => (
              <li key={file.id}>
                <Paperclip size={14} aria-hidden="true" />
                <span className="file-list__name">{file.file_name}</span>
                <span className="file-list__size">{formatSize(file.size_bytes)}</span>
                <button type="button" className="file-list__remove" onClick={() => removeExisting(file)} aria-label="Жою" disabled={Boolean(busy)}>
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
            {newFiles.map((file, index) => (
              <li key={`${file.name}-${index}`} className="is-new">
                <FileUp size={14} aria-hidden="true" />
                <span className="file-list__name">{file.name}</span>
                <span className="file-list__size">{formatSize(file.size)}</span>
                <button type="button" className="file-list__remove" onClick={() => setNewFiles((current) => current.filter((_, i) => i !== index))} aria-label="Алып тастау" disabled={Boolean(busy)}>
                  <X size={14} />
                </button>
              </li>
            ))}
          </ul>
          <button type="button" className="button button--ghost button--sm" onClick={() => fileRef.current?.click()} disabled={Boolean(busy)}>
            <Paperclip size={15} /> Файл қосу
          </button>
          <input ref={fileRef} type="file" multiple hidden onChange={(event) => { addFiles(event.target.files); event.target.value = ""; }} />
          <p className="field__hint">PDF, сурет, Word, Excel, PowerPoint, TXT, ZIP · әрқайсысы 20 МБ дейін.</p>
        </div>

        {error && <p className="form__error" role="alert">{error}</p>}

        <button type="submit" className="button button--primary button--block" disabled={Boolean(busy)}>
          {busy === "saving" ? "Сақталуда…" : busy ? `Файл жүктелуде… ${busy.split(" ")[1]}` : "Сақтау"}
        </button>
      </form>
    </Modal>
  );
}
