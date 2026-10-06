import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, Clock3, Paperclip, Users } from "lucide-react";
import { courseAccent } from "../../lib/courseStyle.js";
import { dueInfo } from "../../lib/due.js";
import { useTasks } from "../../features/tasks/TasksContext.jsx";

/** One assignment row with its own (per-student) done checkbox. */
export default function TaskCard({ task, course, compact = false, progress }) {
  const { isDone, toggleDone } = useTasks();
  const done = isDone(task.id);
  const due = dueInfo(task.due_at);
  const [busy, setBusy] = useState(false);
  const files = (task.assignment_attachments ?? []).filter((file) => file.uploaded).length;

  async function toggle() {
    setBusy(true);
    try {
      await toggleDone(task.id, !done);
    } catch {
      window.alert("Сақталмады. Интернетті тексеріп, қайта көр.");
    }
    setBusy(false);
  }

  return (
    <li className={`task${done ? " task--done" : ""}${compact ? " task--compact" : ""}`} style={courseAccent(course)}>
      <button
        type="button"
        className="task__check"
        onClick={toggle}
        disabled={busy}
        aria-pressed={done}
        aria-label={done ? "Орындалмаған деп белгілеу" : "Орындалды деп белгілеу"}
      >
        {done && <Check size={16} strokeWidth={3} />}
      </button>
      <Link to={`/tasks/${task.id}`} className="task__body">
        <span className="task__course">
          <span className="course-code course-code--sm">{course?.code}</span>
          {task.group_no ? `${task.group_no}-топ` : "Ортақ"}
        </span>
        <strong className="task__title">{task.title}</strong>
        <span className="task__meta">
          <span className={`due due--${done ? "done" : due.tone}`}>
            <Clock3 size={13} aria-hidden="true" /> {done ? "Орындалды" : due.label}
          </span>
          {files > 0 && (
            <span>
              <Paperclip size={13} aria-hidden="true" /> {files}
            </span>
          )}
          {progress && (
            <span title="Орындағандар">
              <Users size={13} aria-hidden="true" /> {progress.done}/{progress.total}
            </span>
          )}
        </span>
      </Link>
    </li>
  );
}
