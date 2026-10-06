import { NavLink } from "react-router-dom";
import { Megaphone, ShieldCheck } from "lucide-react";
import BrandMark from "./BrandMark.jsx";
import { NAV_ITEMS } from "./navItems.js";
import { useTasks } from "../../features/tasks/TasksContext.jsx";
import { APP_NAME, CLASS_LABEL } from "../../config/app.js";
import { useAuth } from "../../features/auth/AuthContext.jsx";

export default function Sidebar() {
  const { student, isAdmin } = useAuth();
  const { openTasks } = useTasks();

  return (
    <aside className="sidebar" aria-label="Негізгі мәзір">
      <NavLink to="/" className="brand" aria-label="ULPA басты бет">
        <BrandMark />
        <span className="brand__text">
          <strong>{APP_NAME}</strong>
          <small>{CLASS_LABEL}</small>
        </span>
      </NavLink>

      <nav className="side-nav">
        {NAV_ITEMS.map(({ to, title, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="side-nav__item">
            <Icon size={18} strokeWidth={1.8} />
            <span>{title}</span>
            {to === "/tasks" && openTasks.length > 0 && <span className="side-nav__count">{openTasks.length}</span>}
          </NavLink>
        ))}
        <NavLink to="/announcements" className="side-nav__item">
          <Megaphone size={18} strokeWidth={1.8} />
          <span>Хабарландырулар</span>
        </NavLink>
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
        <p className="sidebar__version">ULPA · v0.3</p>
      </div>
    </aside>
  );
}
