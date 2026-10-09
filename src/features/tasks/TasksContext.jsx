import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext.jsx";
import { fetchTasks, setDone } from "./taskApi.js";
import { readCache, writeCache } from "../../lib/cache.js";

// Assignments visible to the signed-in student (the database filters by group)
// plus that student's own done marks.

const TasksContext = createContext(null);

export function TasksProvider({ children }) {
  const { status: authStatus, student } = useAuth();
  const [state, setState] = useState({ status: "idle", tasks: [], statuses: [] });

  const userId = student?.id ?? null;

  const load = useCallback(async () => {
    setState((current) => ({ ...current, status: current.tasks.length ? "ready" : "loading" }));
    try {
      const data = await fetchTasks();
      setState({ status: "ready", ...data });
      writeCache("tasks", userId, data);
    } catch {
      // Offline with a saved copy on screen: keep it.
      setState((current) => ({ ...current, status: current.tasks.length ? "ready" : "error" }));
    }
  }, [userId]);

  useEffect(() => {
    if (authStatus === "signedIn") {
      const cached = readCache("tasks", userId);
      if (cached?.tasks) setState((current) => (current.tasks.length ? current : { status: "ready", ...cached }));
      load();
    }
    if (authStatus === "signedOut") setState({ status: "idle", tasks: [], statuses: [] });
  }, [authStatus, student?.id, load]);

  const toggleDone = useCallback(
    async (assignmentId, done) => {
      // Optimistic update so the checkbox reacts instantly.
      setState((current) => ({
        ...current,
        statuses: done
          ? [...current.statuses, { assignment_id: assignmentId, student_id: student.id, completed_at: new Date().toISOString() }]
          : current.statuses.filter((row) => !(row.assignment_id === assignmentId && row.student_id === student.id)),
      }));
      try {
        await setDone(assignmentId, done);
      } catch (error) {
        await load();
        throw error;
      }
    },
    [student?.id, load]
  );

  const value = useMemo(() => {
    const doneSet = new Set(state.statuses.filter((row) => row.student_id === student?.id).map((row) => row.assignment_id));
    const doneCount = new Map();
    for (const row of state.statuses) doneCount.set(row.assignment_id, (doneCount.get(row.assignment_id) ?? 0) + 1);
    const openTasks = state.tasks.filter((task) => !doneSet.has(task.id));
    return {
      status: state.status,
      tasks: state.tasks,
      openTasks,
      isDone: (id) => doneSet.has(id),
      doneCount: (id) => doneCount.get(id) ?? 0, // meaningful for admins (they can read all marks)
      toggleDone,
      reload: load,
    };
  }, [state, student?.id, toggleDone, load]);

  return <TasksContext.Provider value={value}>{children}</TasksContext.Provider>;
}

export function useTasks() {
  const context = useContext(TasksContext);
  if (!context) throw new Error("useTasks must be used inside <TasksProvider>");
  return context;
}
