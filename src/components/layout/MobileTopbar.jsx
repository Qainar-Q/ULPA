import { Link, NavLink } from "react-router-dom";
import { UserRound } from "lucide-react";
import BrandMark from "./BrandMark.jsx";

/** Compact header shown only on phones and small tablets. */
export default function MobileTopbar() {
  return (
    <header className="mobile-topbar">
      <Link to="/" className="brand brand--compact" aria-label="ULPA басты бет">
        <BrandMark size={30} />
        <strong>ULPA</strong>
      </Link>
      <NavLink to="/profile" className="icon-button" aria-label="Профиль">
        <UserRound size={20} strokeWidth={1.8} />
      </NavLink>
    </header>
  );
}
