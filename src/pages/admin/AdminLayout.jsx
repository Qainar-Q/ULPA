import { NavLink, Outlet } from "react-router-dom";
import { CalendarDays, LayoutDashboard, Users } from "lucide-react";
import StorageUsage from "../../components/StorageUsage.jsx";

/** Admin area with its own tabs. Access is checked by RequireAdmin + the database. */
export default function AdminLayout() {
  return (
    <div className="stack-lg">
      <nav className="admin-tabs" aria-label="Әкімші бөлімдері">
        <NavLink to="/admin" end className="admin-tabs__item">
          <Users size={16} /> Студенттер
        </NavLink>
        <NavLink to="/admin/schedule" className="admin-tabs__item">
          <CalendarDays size={16} /> Кесте
        </NavLink>
        <NavLink to="/admin/overview" className="admin-tabs__item">
          <LayoutDashboard size={16} /> Шолу
        </NavLink>
      </nav>
      <StorageUsage />
      <Outlet />
    </div>
  );
}
