import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Check, Clock3, Download, Paperclip, Pencil, Trash2, Users } from "lucide-react";
import EmptyState from "../components/ui/EmptyState.jsx";
import TaskForm from "../components/tasks/TaskForm.jsx";
import NotFoundPage from "./NotFoundPage.jsx";
import { useTasks } from "../features/tasks/TasksContext.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useClassSize } from "../features/tasks/useClassSize.js";
import { attachmentUrl, deleteTask } from "../features/tasks/taskApi.js";
import { courseAccent } from "../lib/courseStyle.js";
import { dueInfo, formatDateTime } from "../lib/due.js";

function formatSize(bytes) {
  if (!bytes) return "";
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} МБ` : `${Math.ceil(bytes / 1e3)} КБ`;
}

function AttachmentRow({ file }) {
  const [busy, setBusy] = useState(false);
  async function open() {
    setBusy(true);
    try {
      window.location.assign(await attachmentUrl(file));
    } catch {
      window.alert("Файл ашылмады. Қайта көр.");
    }
    setBusy(false);
  }
  return (
    <li>
      <button type="button" className="attachment" onClick={open} disabled={busy}>
        <Paperclip size={16} aria-hidden="true" />
        <span className="attachment__name">{file.file_name}</span>
        <span className="attachment__size">{formatSize(file.size_bytes)}</span>
        <Download size={16} aria-hidden="true" />
      </button>
    </li>
  );
}

export default function TaskDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { tasks, status, isDone, toggleDone, doneCount, reload } = useTasks();
  const { courseById } = useCatalog();
  const { isAdmin } = useAuth();
  const classSize = useClassSize();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);

  if (status === "loading" || status === "idle") return <div className="skeleton-list" aria-busy="true"><span /><span /></div>;
  const task = tasks.find((item) => item.id === id);
  if (!task) return <NotFoundPage />;

  const course = courseById(task.course_id);
  const done = isDone(task.id);
  const due = dueInfo(task.due_at);
  const files = (task.assignment_attachments ?? []).filter((file) => file.uploaded);

  async function toggle() {
    setBusy(true);
    try {
      await toggleDone(task.id, !done);
    } catch {
      window.alert("Сақталмады. Қайта көр.");
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(`«${task.title}» тапсырмасын барлығы үшін жою керек пе? Файлдары да жойылады.`)) return;
    try {
      await deleteTask(task);
      await reload();
      navigate("/tasks", { replace: true });
    } catch {
      window.alert("Жойылмады. Қайта көр.");
    }
  }

  return (
    <div className="stack-lg">
      <Link to="/tasks" className="back-link">
        <ArrowLeft size={16} /> Тапсырмаларға оралу
      </Link>

      <section className="task-hero" style={courseAccent(course)}>
        <div className="task-hero__top">
          <Link to={`/courses/${course?.slug}`} className="course-code">{course?.code}</Link>
          <span className="task-hero__course">{course?.name}</span>
        </div>
        <h1 className="task-hero__title">{task.title}</h1>
        <div className="task-hero__meta">
          <span className={`due due--${done ? "done" : due.tone}`}>
            <Clock3 size={14} aria-hidden="true" /> {due.label}
          </span>
          <span className="tag">{task.group_no ? `${task.group_no}-топ` : "Екі топқа ортақ"}</span>
          {isAdmin && classSize && (
            <span className="tag">
              <Users size={13} aria-hidden="true" /> {doneCount(task.id)}/{classSize(task.group_no)} орындады
            </span>
          )}
        </div>
        <button type="button" className={`done-toggle${done ? " is-done" : ""}`} onClick={toggle} disabled={busy} aria-pressed={done}>
          <span className="done-toggle__box">{done && <Check size={16} strokeWidth={3} />}</span>
          {done ? "Орындалды — белгіні алу" : "Орындалды деп белгілеу"}
        </button>
      </section>

      <section className="panel">
        <h2 className="panel-title">Сипаттама</h2>
        {task.description ? <p className="prose">{task.description}</p> : <p className="muted">Сипаттама жоқ.</p>}
        {task.due_at && <p className="muted small task-due-exact">Мерзімі: {formatDateTime(task.due_at)} (Алматы уақыты)</p>}
      </section>

      <section className="panel">
        <h2 className="panel-title">Файлдар</h2>
        {files.length > 0 ? (
          <ul className="attachment-list">{files.map((file) => <AttachmentRow key={file.id} file={file} />)}</ul>
        ) : (
          <EmptyState icon={Paperclip} title="Файл тіркелмеген" compact />
        )}
      </section>

      {isAdmin && (
        <div className="admin-actions">
          <button type="button" className="button button--ghost" onClick={() => setEditing(true)}>
            <Pencil size={16} /> Өзгерту
          </button>
          <button type="button" className="button button--ghost button--danger" onClick={remove}>
            <Trash2 size={16} /> Жою
          </button>
        </div>
      )}

      {editing && <TaskForm task={task} onClose={() => setEditing(false)} onSaved={reload} />}
    </div>
  );
}
