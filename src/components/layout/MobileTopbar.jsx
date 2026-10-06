import { Link, NavLink } from "react-router-dom";
import BrandMark from "./BrandMark.jsx";
import { useAuth } from "../../features/auth/AuthContext.jsx";

/** Compact header shown only on phones and small tablets. */
export default function MobileTopbar() {
  const { student } = useAuth();

  return (
    <header className="mobile-topbar">
      <Link to="/" className="brand brand--compact" aria-label="ULPA басты бет">
        <BrandMark size={30} />
        <strong>ULPA</strong>
      </Link>
      <NavLink to="/profile" className="avatar-button" aria-label="Профиль">
        <span className="avatar">{student?.full_name.slice(0, 1) ?? "?"}</span>
      </NavLink>
    </header>
  );
}
