import { NavLink } from "react-router-dom";
import { Search, ShieldCheck } from "lucide-react";
import BrandMark from "./BrandMark.jsx";
import { MORE_LINKS, NAV_ITEMS } from "./navItems.js";
import { useTasks } from "../../features/tasks/TasksContext.jsx";
import { useUnread } from "../../features/unread/UnreadContext.jsx";
import { APP_NAME, CLASS_LABEL } from "../../config/app.js";
import { useAuth } from "../../features/auth/AuthContext.jsx";

export default function Sidebar() {
  const { student, isAdmin } = useAuth();
  const { openTasks } = useTasks();
  const { counts } = useUnread();
  const NewCount = ({ n }) => (n > 0 ? <span className="side-nav__new">{n > 9 ? "9+" : n}</span> : null);

  return (
    <aside className="sidebar" aria-label="Негізгі мәзір">
      <NavLink to="/" className="brand" aria-label="ULPA басты бет">
        <BrandMark />
        <span className="brand__text">
          <strong>{APP_NAME}</strong>
          <small>{CLASS_LABEL}</small>
        </span>
      </NavLink>

      <NavLink to="/search" className="side-search">
        <Search size={16} aria-hidden="true" />
        <span>Іздеу</span>
        <kbd>/</kbd>
      </NavLink>

      <nav className="side-nav">
        {NAV_ITEMS.map(({ to, title, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="side-nav__item">
            <Icon size={18} strokeWidth={1.8} />
            <span>{title}</span>
            {to === "/tasks" && openTasks.length > 0 && (
              <span className={`side-nav__count${counts.tasks > 0 ? " side-nav__count--new" : ""}`}>{openTasks.length}</span>
            )}
            {to === "/photos" && <NewCount n={counts.photos} />}
          </NavLink>
        ))}
        {MORE_LINKS.map(({ to, title, icon: Icon, unread }) => (
          <NavLink key={to} to={to} className="side-nav__item">
            <Icon size={18} strokeWidth={1.8} />
            <span>{title}</span>
            {unread && <NewCount n={counts[unread]} />}
          </NavLink>
        ))}
        {isAdmin && (
          <NavLink to="/admin" className="side-nav__item">
            <ShieldCheck size={18} strokeWidth={1.8} />
            <span>Әкімші</span>
          </NavLink>
        )}
      </nav>

      <div className="sidebar__footer">
        {student && (
          <NavLink to="/profile" className="user-chip">
            <span className="avatar" aria-hidden="true">
              {student.full_name.slice(0, 1)}
            </span>
            <span className="user-chip__text">
              <strong>{student.full_name}</strong>
              <small>
                {student.code} · {student.group_no}-топ
              </small>
            </span>
          </NavLink>
        )}
        <p className="sidebar__version">ULPA · v1.0</p>
      </div>
    </aside>
  );
}
