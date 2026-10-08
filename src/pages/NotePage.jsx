import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bold, Eye, Heading, History, List, Pencil, RotateCcw, Sigma, Trash2, X } from "lucide-react";
import Markdown from "../components/ui/Markdown.jsx";
import Modal from "../components/ui/Modal.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { deleteNote, getNote, getRevisions, loadDraft, saveNote, storeDraft } from "../features/notes/notesApi.js";
import { useQueryParam } from "../lib/useQueryParam.js";
import { courseAccent } from "../lib/courseStyle.js";
import { formatDateTime } from "../lib/due.js";
import { formatIsoDate } from "../lib/time.js";

const EMPTY = { title: "", body: "", courseSlug: "", lessonDate: "" };

function NoteHistory({ noteId, onRestore, onClose }) {
  const [items, setItems] = useState(null);
  const [open, setOpen] = useState(null);
  useEffect(() => {
    getRevisions(noteId).then(setItems).catch(() => setItems([]));
  }, [noteId]);
  const shown = items?.find((item) => item.id === open);
  return (
    <Modal title="Өзгерістер тарихы" onClose={onClose}>
      {!items && <p className="muted">Жүктелуде…</p>}
      {items && !shown && (
        <ul className="note-history">
          {items.map((item, index) => (
            <li key={item.id}>
              <button type="button" className="note-history__item" onClick={() => setOpen(item.id)}>
                <strong>{item.version}-нұсқа</strong>
                <span>{item.editor_name ?? "—"} · {formatDateTime(item.created_at)}</span>
                {index === 0 && <span className="tag">қазіргі</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {shown && (
        <div className="stack">
          <button type="button" className="text-link" onClick={() => setOpen(null)}>
            <ArrowLeft size={14} /> Тізімге
          </button>
          <p className="muted small">
            {shown.version}-нұсқа · {shown.editor_name ?? "—"} · {formatDateTime(shown.created_at)}
          </p>
          <div className="note-history__body">
            <h3>{shown.title}</h3>
            <Markdown text={shown.body} />
          </div>
          {shown.id !== items[0]?.id && (
            <button type="button" className="button button--primary" onClick={() => onRestore(shown)}>
              <RotateCcw size={16} /> Осы нұсқаны қайтару
            </button>
          )}
        </div>
      )}
    </Modal>
  );
}

export default function NotePage() {
  const { id: routeId } = useParams();
  const isNew = routeId === "new";
  const navigate = useNavigate();
  const { student, isAdmin } = useAuth();
  const { courseById, courseBySlug } = useCatalog();
  const [courseParam] = useQueryParam("course", "");
  const [note, setNote] = useState(null);
  const [status, setStatus] = useState(isNew ? "ready" : "loading");
  const [editing, setEditing] = useState(isNew);
  const [preview, setPreview] = useState(false);
  const [values, setValues] = useState(() => (isNew ? loadDraft(null) ?? { ...EMPTY, courseSlug: courseParam } : EMPTY));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [conflict, setConflict] = useState(false);
  const [history, setHistory] = useState(false);
  const textRef = useRef(null);

  async function load() {
    try {
      const data = await getNote(routeId);
      if (!data) return setStatus("missing");
      setNote(data);
      setStatus("ready");
      return data;
    } catch {
      setStatus("error");
    }
    return null;
  }

  useEffect(() => {
    if (!isNew) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeId]);

  // Keep a local draft while editing.
  useEffect(() => {
    if (editing) storeDraft(isNew ? null : routeId, { ...values, baseVersion: note?.version ?? 0 });
  }, [values, editing, isNew, routeId, note?.version]);

  function startEdit() {
    const draft = loadDraft(routeId);
    const fromNote = {
      title: note.title,
      body: note.body,
      courseSlug: courseById(note.course_id)?.slug ?? "",
      lessonDate: note.lesson_date ?? "",
    };
    // Offer the unsaved draft only if it was made on top of this same version.
    if (draft && draft.baseVersion === note.version && (draft.body !== note.body || draft.title !== note.title)) {
      setValues(window.confirm("Сақталмаған өзгерістерің бар. Соларды жалғастырасың ба?") ? draft : fromNote);
    } else {
      setValues(fromNote);
    }
    setEditing(true);
    setPreview(false);
  }

  function cancelEdit() {
    storeDraft(isNew ? null : routeId, null);
    if (isNew) navigate("/notes");
    else {
      setEditing(false);
      setError(null);
      setConflict(false);
    }
  }

  async function save(baseVersion = note?.version ?? 0, override = values) {
    if (!override.title.trim()) return setError("Тақырыбын жаз.");
    setBusy(true);
    setError(null);
    try {
      const course = override.courseSlug ? courseBySlug(override.courseSlug) : null;
      const saved = await saveNote({
        id: isNew ? null : routeId,
        courseId: course?.id ?? null,
        title: override.title.trim(),
        body: override.body,
        lessonDate: override.lessonDate || null,
        baseVersion,
      });
      storeDraft(isNew ? null : routeId, null);
      setConflict(false);
      if (isNew) {
        navigate(`/notes/${saved.id}`, { replace: true });
      } else {
        await load();
        setEditing(false);
      }
    } catch (saveError) {
      if (saveError?.code === "40001") setConflict(true);
      else setError(saveError?.message?.includes("rate_limited") ? "Бүгін тым көп өзгеріс жасадың. Ертең жалғастыр." : "Сақталмады. Интернетті тексеріп, қайта көр.");
    }
    setBusy(false);
  }

  async function overwriteAfterConflict() {
    const latest = await load();
    if (latest) await save(latest.version);
  }

  async function restore(revision) {
    if (!window.confirm(`${revision.version}-нұсқаны қайтару керек пе? Қазіргі мәтін тарихта сақталып қалады.`)) return;
    setHistory(false);
    await save(note.version, { title: revision.title, body: revision.body, courseSlug: courseById(note.course_id)?.slug ?? "", lessonDate: note.lesson_date ?? "" });
  }

  async function remove() {
    if (!window.confirm(`«${note.title}» конспектісін түгел жою керек пе? Тарихымен бірге өшеді.`)) return;
    try {
      await deleteNote(note.id);
      navigate("/notes", { replace: true });
    } catch {
      setError("Жойылмады.");
    }
  }

  // Toolbar: wrap the selection / start a line.
  function insert(kind) {
    const area = textRef.current;
    if (!area) return;
    const { selectionStart: start, selectionEnd: end, value } = area;
    const selected = value.slice(start, end);
    let next;
    let caret;
    if (kind === "bold" || kind === "code") {
      const mark = kind === "bold" ? "**" : "`";
      const inner = selected || (kind === "bold" ? "маңызды" : "формула");
      next = value.slice(0, start) + mark + inner + mark + value.slice(end);
      caret = [start + mark.length, start + mark.length + inner.length];
    } else {
      const prefix = kind === "heading" ? "## " : "- ";
      const lineStart = value.lastIndexOf("\n", start - 1) + 1;
      next = value.slice(0, lineStart) + prefix + value.slice(lineStart);
      caret = [start + prefix.length, end + prefix.length];
    }
    setValues((current) => ({ ...current, body: next }));
    requestAnimationFrame(() => {
      area.focus();
      area.setSelectionRange(...caret);
    });
  }

  if (status === "loading") return <p className="muted">Жүктелуде…</p>;
  if (status === "missing" || status === "error")
    return (
      <EmptyState title={status === "missing" ? "Конспект табылмады" : "Жүктелмеді"} action={<Link to="/notes" className="button button--ghost">Конспектілерге</Link>}>
        {status === "missing" ? "Мүмкін, оны біреу жойған шығар." : "Интернетті тексеріп, бетті жаңарт."}
      </EmptyState>
    );

  const course = note ? courseById(note.course_id) : null;
  const canDelete = note && (note.created_by === student?.id || isAdmin);

  return (
    <div className="stack-lg note-page" style={courseAccent(course)}>
      <Link to={course ? `/notes?course=${course.slug}` : "/notes"} className="text-link">
        <ArrowLeft size={14} /> Конспектілер
      </Link>

      {!editing && note && (
        <article className="panel note-view">
          <div className="note-card__meta">
            {course && <Link to={`/courses/${course.slug}`} className="tag">{course.name}</Link>}
            {note.lesson_date && <span className="note-card__date">{formatIsoDate(note.lesson_date)}</span>}
          </div>
          <h1 className="note-view__title">{note.title}</h1>
          <p className="muted small">
            Соңғы өзгеріс: {note.updated_by_name ?? "—"} · {formatDateTime(note.updated_at)} · {note.version} нұсқа
            {note.creator_name && ` · бастаған: ${note.creator_name}`}
          </p>
          {note.body.trim() ? <Markdown text={note.body} /> : <p className="muted">Әзірге бос. «Өңдеу» батырмасын басып, толықтыр.</p>}
          <div className="note-view__actions">
            <button type="button" className="button button--primary" onClick={startEdit}>
              <Pencil size={16} /> Өңдеу
            </button>
            <button type="button" className="button button--ghost" onClick={() => setHistory(true)}>
              <History size={16} /> Тарих
            </button>
            {canDelete && (
              <button type="button" className="icon-button icon-button--danger" onClick={remove} aria-label="Жою">
                <Trash2 size={16} />
              </button>
            )}
          </div>
          {error && <p className="form__error" role="alert">{error}</p>}
        </article>
      )}

      {editing && (
        <form
          className="panel note-editor"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <h1 className="panel-title">{isNew ? "Жаңа конспект" : "Өңдеу"}</h1>
          <div className="field">
            <label className="field__label" htmlFor="note-title">Тақырып</label>
            <input
              id="note-title"
              className="input"
              maxLength={120}
              value={values.title}
              onChange={(event) => setValues({ ...values, title: event.target.value })}
              placeholder="Мысалы: 3-дәріс. Туынды және оның қолданылуы"
            />
          </div>
          <div className="note-editor__row">
            <div className="field">
              <label className="field__label" htmlFor="note-course">Пән</label>
              <CourseSelect id="note-course" value={values.courseSlug} onChange={(slug) => setValues({ ...values, courseSlug: slug })} allLabel="Пәнсіз" />
            </div>
            <div className="field">
              <label className="field__label" htmlFor="note-date">Сабақ күні <span className="muted">(міндетті емес)</span></label>
              <input id="note-date" type="date" className="input" value={values.lessonDate} onChange={(event) => setValues({ ...values, lessonDate: event.target.value })} />
            </div>
          </div>
          <div className="field">
            <div className="note-editor__tools" role="toolbar" aria-label="Пішімдеу">
              <button type="button" className="icon-button" onClick={() => insert("heading")} aria-label="Тақырыпша" disabled={preview}>
                <Heading size={16} />
              </button>
              <button type="button" className="icon-button" onClick={() => insert("bold")} aria-label="Қалың" disabled={preview}>
                <Bold size={16} />
              </button>
              <button type="button" className="icon-button" onClick={() => insert("list")} aria-label="Тізім" disabled={preview}>
                <List size={16} />
              </button>
              <button type="button" className="icon-button" onClick={() => insert("code")} aria-label="Формула" disabled={preview}>
                <Sigma size={16} />
              </button>
              <button type="button" className={`button button--ghost button--sm${preview ? " is-on" : ""}`} onClick={() => setPreview(!preview)} aria-pressed={preview}>
                <Eye size={15} /> {preview ? "Өңдеуге" : "Көру"}
              </button>
            </div>
            {preview ? (
              <div className="note-editor__preview">{values.body.trim() ? <Markdown text={values.body} /> : <p className="muted">Бос</p>}</div>
            ) : (
              <textarea
                ref={textRef}
                className="input input--textarea note-editor__text"
                rows={16}
                maxLength={60000}
                value={values.body}
                onChange={(event) => setValues({ ...values, body: event.target.value })}
                placeholder={"## Негізгі ұғымдар\n- ...\n\n## Формулалар\n`F = m·a`"}
                aria-label="Конспект мәтіні"
              />
            )}
            <p className="field__hint">## — тақырыпша, **қалың**, - тізім, `формула`. Сақталмаған мәтін осы құрылғыда сақталып тұрады.</p>
          </div>

          {conflict && (
            <div className="note-conflict" role="alert">
              <strong>Сен жазып отырғанда біреу бұл конспектіні сақтап қойды.</strong>
              <p>Олардың өзгерісі жоғалмайды — тарихта қалады. Не істейміз?</p>
              <div className="note-view__actions">
                <button type="button" className="button button--primary button--sm" onClick={overwriteAfterConflict} disabled={busy}>
                  Менің нұсқамды сақтау
                </button>
                <button
                  type="button"
                  className="button button--ghost button--sm"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(values.body);
                    } catch {
                      /* clipboard blocked: the draft is still stored locally */
                    }
                    storeDraft(routeId, null);
                    setConflict(false);
                    setEditing(false);
                    await load();
                  }}
                >
                  Олардыкін ашу (менікі көшірілді)
                </button>
              </div>
            </div>
          )}
          {error && <p className="form__error" role="alert">{error}</p>}
          <div className="note-view__actions">
            <button type="submit" className="button button--primary" disabled={busy}>
              {busy ? "Сақталуда…" : "Сақтау"}
            </button>
            <button type="button" className="button button--ghost" onClick={cancelEdit} disabled={busy}>
              <X size={16} /> Болдырмау
            </button>
          </div>
        </form>
      )}

      {history && note && <NoteHistory noteId={note.id} onRestore={restore} onClose={() => setHistory(false)} />}
    </div>
  );
}
