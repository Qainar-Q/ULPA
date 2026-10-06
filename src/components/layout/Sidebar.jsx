import { NavLink } from "react-router-dom";
import { UserRound } from "lucide-react";
import BrandMark from "./BrandMark.jsx";
import { NAV_ITEMS } from "./navItems.js";
import { APP_NAME, CLASS_LABEL } from "../../config/app.js";

export default function Sidebar() {
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
          </NavLink>
        ))}
      </nav>

      <div className="sidebar__footer">
        <NavLink to="/profile" className="side-nav__item">
          <UserRound size={18} strokeWidth={1.8} />
          <span>Профиль</span>
        </NavLink>
        <p className="sidebar__version">ULPA · v0.2</p>
      </div>
    </aside>
  );
}
