import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems.js";
import { useTasks } from "../../features/tasks/TasksContext.jsx";
import { useUnread } from "../../features/unread/UnreadContext.jsx";

export default function BottomNav() {
  const { openTasks } = useTasks();
  const { counts } = useUnread();
  // Home leads to announcements, polls and materials on phones.
  const dots = { "/": counts.announcements + counts.polls + counts.materials, "/photos": counts.photos };
  return (
    <nav className="bottom-nav" aria-label="Негізгі мәзір">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottom-nav__item">
          <span className="nav-icon">
            <Icon size={21} strokeWidth={1.8} />
            {to === "/tasks" && openTasks.length > 0 && (
              <span className={`nav-badge${counts.tasks > 0 ? " nav-badge--new" : ""}`}>
                {openTasks.length}
                {counts.tasks > 0 && <span className="sr-only"> (жаңасы бар)</span>}
              </span>
            )}
            {dots[to] > 0 && (
              <span className="nav-dot">
                <span className="sr-only">Жаңа</span>
              </span>
            )}
          </span>
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
