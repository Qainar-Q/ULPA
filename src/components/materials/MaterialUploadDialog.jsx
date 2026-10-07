import { useRef, useState } from "react";
import { FileUp, Paperclip, Upload } from "lucide-react";
import Modal from "../ui/Modal.jsx";
import Segmented from "../ui/Segmented.jsx";
import { useCatalog } from "../../features/catalog/CatalogContext.jsx";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { materialProblem, uploadMaterial } from "../../features/materials/materialApi.js";
import { formatSize } from "./MaterialList.jsx";

export default function MaterialUploadDialog({ defaultCourseId, onClose, onUploaded }) {
  const { courses } = useCatalog();
  const { isAdmin, student } = useAuth();
  const groupOptions = isAdmin
    ? [{ id: "both", label: "Барлығына" }, { id: "1", label: "1-топ" }, { id: "2", label: "2-топ" }]
    : [{ id: "both", label: "Барлығына" }, { id: String(student?.group_no), label: `Тек ${student?.group_no}-топ` }];

  const [file, setFile] = useState(null);
  const [values, setValues] = useState({ courseId: defaultCourseId ?? "", title: "", description: "", groupNo: "both" });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));

  function pick(list) {
    const chosen = list?.[0];
    if (!chosen) return;
    const problem = materialProblem(chosen);
    if (problem === "too_large") return setError("Файл 25 МБ-тан үлкен.");
    if (problem === "type") return setError("Тек PDF, сурет, Word, Excel, PowerPoint, TXT немесе ZIP.");
    setError(null);
    setFile(chosen);
    if (!values.title) set("title")(chosen.name.replace(/\.[^.]+$/, "").slice(0, 150));
  }

  async function submit(event) {
    event.preventDefault();
    if (!file) return setError("Файл таңда.");
    if (!values.courseId) return setError("Пәнді таңда.");
    if (!values.title.trim()) return setError("Атауын жаз.");
    setBusy(true);
    setError(null);
    try {
      await uploadMaterial({ ...values, file });
      await onUploaded();
      onClose();
    } catch {
      setError("Жүктелмеді. Интернетті тексеріп, қайта көр.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Материал қосу" onClose={busy ? () => {} : onClose}>
      <form className="upload" onSubmit={submit}>
        <button type="button" className="upload__picker upload__picker--wide" onClick={() => fileRef.current?.click()} disabled={busy}>
          {file ? <Paperclip size={20} /> : <FileUp size={22} />}
          <span>{file ? `${file.name} · ${formatSize(file.size)}` : "Файл таңдау"}</span>
        </button>
        <input ref={fileRef} type="file" hidden onChange={(event) => { pick(event.target.files); event.target.value = ""; }} />
        <p className="field__hint">PDF, сурет, Word, Excel, PowerPoint, TXT, ZIP · 25 МБ дейін.</p>

        <div className="field">
          <label className="field__label" htmlFor="mu-course">Пән</label>
          <div className="select-wrap">
            <select id="mu-course" className="input" value={values.courseId} onChange={(event) => set("courseId")(event.target.value)}>
              <option value="">Пәнді таңда…</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="mu-title">Атауы</label>
          <input id="mu-title" className="input" maxLength={150} value={values.title} onChange={(event) => set("title")(event.target.value)} placeholder="Мысалы: 3-дәріс слайдтары" />
        </div>

        <div className="field">
          <label className="field__label" htmlFor="mu-desc">Сипаттама <span className="muted">(міндетті емес)</span></label>
          <textarea id="mu-desc" className="input input--textarea" rows={2} maxLength={1000} value={values.description} onChange={(event) => set("description")(event.target.value)} />
        </div>

        <div className="field">
          <span className="field__label">Кімге көрінеді</span>
          <Segmented label="Кімге" options={groupOptions} value={values.groupNo} onChange={set("groupNo")} />
        </div>

        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? "Жүктелуде…" : <><Upload size={17} /> Жүктеу</>}
        </button>
      </form>
    </Modal>
  );
}
