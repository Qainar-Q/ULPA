import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems.js";
import { useTasks } from "../../features/tasks/TasksContext.jsx";

export default function BottomNav() {
  const { openTasks } = useTasks();
  return (
    <nav className="bottom-nav" aria-label="Негізгі мәзір">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottom-nav__item">
          <span className="nav-icon">
            <Icon size={21} strokeWidth={1.8} />
            {to === "/tasks" && openTasks.length > 0 && <span className="nav-badge">{openTasks.length}</span>}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
