import { useMemo, useState } from "react";
import { ClipboardList, CloudOff, Plus } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import TaskCard from "../components/tasks/TaskCard.jsx";
import TaskForm from "../components/tasks/TaskForm.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { useTasks } from "../features/tasks/TasksContext.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useClassSize } from "../features/tasks/useClassSize.js";

const STATUS_FILTERS = [
  { id: "open", label: "Орындалмаған" },
  { id: "done", label: "Орындалған" },
  { id: "all", label: "Барлығы" },
];

/** Open tasks: soonest deadline first, undated last. Done tasks: newest first. */
function sortTasks(list, status) {
  return [...list].sort((a, b) => {
    if (status === "done") return (b.due_at ?? "").localeCompare(a.due_at ?? "");
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return a.due_at.localeCompare(b.due_at);
  });
}

export default function TasksPage() {
  const [status, setStatus] = useQueryParam("status", "open");
  const [courseSlug, setCourseSlug] = useQueryParam("course", "");
  const { tasks, isDone, doneCount, status: loadStatus, reload } = useTasks();
  const { courseById, courseBySlug } = useCatalog();
  const { isAdmin } = useAuth();
  const classSize = useClassSize();
  const [creating, setCreating] = useState(false);
  const course = courseSlug ? courseBySlug(courseSlug) : null;

  const visible = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (course && task.course_id !== course.id) return false;
      if (status === "open") return !isDone(task.id);
      if (status === "done") return isDone(task.id);
      return true;
    });
    return sortTasks(filtered, status);
  }, [tasks, course, status, isDone]);

  const overdueCount = visible.filter((task) => !isDone(task.id) && task.due_at && new Date(task.due_at) < new Date()).length;

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Оқу жоспары"
        title="Тапсырмалар"
        description="Белгің тек өзіңе тиесілі — сен «орындалды» деп белгілесең, басқаларға әсер етпейді."
        actions={
          <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
            <Plus size={17} /> Тапсырма қосу
          </button>
        }
      />

      <div className="toolbar">
        <Segmented label="Тапсырма күйі" options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <CourseSelect id="task-course" value={courseSlug} onChange={setCourseSlug} />
      </div>

      {loadStatus === "loading" && (
        <div className="skeleton-list" aria-busy="true"><span /><span /><span /></div>
      )}

      {loadStatus === "error" && (
        <EmptyState icon={CloudOff} title="Тапсырмалар жүктелмеді" action={<button type="button" className="button button--ghost" onClick={reload}>Қайта көру</button>}>
          Интернет байланысын тексеріп, қайта көр.
        </EmptyState>
      )}

      {loadStatus === "ready" && (
        <>
          {overdueCount > 0 && status !== "done" && (
            <p className="form__error">{overdueCount} тапсырманың мерзімі өтіп кетті.</p>
          )}
          {visible.length === 0 ? (
            <EmptyState icon={ClipboardList} title={status === "open" ? "Орындалмаған тапсырма жоқ 🎉" : "Тапсырма жоқ"} compact>
              Жаңа тапсырманы «Тапсырма қосу» батырмасымен қос — ол сенің тобыңа немесе екі топқа көрінеді.
            </EmptyState>
          ) : (
            <ul className="task-list">
              {visible.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  course={courseById(task.course_id)}
                  progress={isAdmin && classSize ? { done: doneCount(task.id), total: classSize(task.group_no) } : null}
                />
              ))}
            </ul>
          )}
        </>
      )}

      {creating && <TaskForm defaultCourseId={course?.id} onClose={() => setCreating(false)} onSaved={reload} />}
    </div>
  );
}
