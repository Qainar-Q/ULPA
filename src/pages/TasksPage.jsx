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
import { useMarkSeen } from "../features/unread/UnreadContext.jsx";

/** Open tasks: soonest deadline first, undated last. Done / overdue: most recent deadline first. */
function sortTasks(list, status) {
  return [...list].sort((a, b) => {
    if (status === "done" || status === "overdue") return (b.due_at ?? "").localeCompare(a.due_at ?? "");
    if (!a.due_at) return 1;
    if (!b.due_at) return -1;
    return a.due_at.localeCompare(b.due_at);
  });
}

export default function TasksPage() {
  useMarkSeen("tasks");
  const [status, setStatus] = useQueryParam("status", "open");
  const [courseSlug, setCourseSlug] = useQueryParam("course", "");
  const { tasks, isDone, isOverdue, overdueTasks, doneCount, status: loadStatus, reload } = useTasks();
  const { courseById, courseBySlug } = useCatalog();
  const { isAdmin } = useAuth();
  const classSize = useClassSize();
  const [creating, setCreating] = useState(false);
  const course = courseSlug ? courseBySlug(courseSlug) : null;

  const visible = useMemo(() => {
    const filtered = tasks.filter((task) => {
      if (course && task.course_id !== course.id) return false;
      // Past the deadline and not marked done → only in "Мерзімі өткен".
      if (status === "open") return !isDone(task.id) && !isOverdue(task);
      if (status === "overdue") return !isDone(task.id) && isOverdue(task);
      if (status === "done") return isDone(task.id);
      return true;
    });
    return sortTasks(filtered, status);
  }, [tasks, course, status, isDone, isOverdue]);

  const overdueCount = overdueTasks.filter((task) => !course || task.course_id === course.id).length;
  const STATUS_FILTERS = [
    { id: "open", label: "Ағымдағы" },
    { id: "overdue", label: overdueCount ? `Мерзімі өткен · ${overdueCount}` : "Мерзімі өткен" },
    { id: "done", label: "Орындалған" },
    { id: "all", label: "Барлығы" },
  ];

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
        <Segmented label="Тапсырма күйі" options={STATUS_FILTERS} value={status} onChange={setStatus} className="segmented--grid4" />
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
          {status === "open" && overdueCount > 0 && (
            <button type="button" className="overdue-note" onClick={() => setStatus("overdue")}>
              {overdueCount} тапсырманың мерзімі өтіп кетті, бірақ «орындалды» деп белгіленбеген → қарау
            </button>
          )}
          {status === "overdue" && visible.length > 0 && (
            <p className="muted small">Мерзімі өтіп кеткен, бірақ сен «орындалды» деп белгілемеген тапсырмалар. Тапсырған болсаң — белгілеп қой.</p>
          )}
          {visible.length === 0 ? (
            <EmptyState
              icon={ClipboardList}
              title={status === "open" ? "Ағымдағы тапсырма жоқ 🎉" : status === "overdue" ? "Мерзімі өткен тапсырма жоқ 👍" : "Тапсырма жоқ"}
              compact
            >
              {status === "overdue"
                ? "Мерзімі өтіп, белгіленбей қалған тапсырмалар осында шығады."
                : "Жаңа тапсырманы «Тапсырма қосу» батырмасымен қос — ол сенің тобыңа немесе екі топқа көрінеді."}
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
