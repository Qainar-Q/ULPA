import { NavLink } from "react-router-dom";
import { NAV_ITEMS } from "./navItems.js";

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Негізгі мәзір">
      {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} className="bottom-nav__item">
          <Icon size={21} strokeWidth={1.8} />
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
