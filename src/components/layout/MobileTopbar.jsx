import { useEffect, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import { Search } from "lucide-react";
import BrandMark from "./BrandMark.jsx";
import { useAuth } from "../../features/auth/AuthContext.jsx";

/** Compact header shown only on phones and small tablets. */
export default function MobileTopbar() {
  const { student } = useAuth();
  // Transparent while at the very top (blends with the page); frosted once content scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 4);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);

  return (
    <header className={`mobile-topbar${scrolled ? " is-scrolled" : ""}`}>
      <Link to="/" className="brand brand--compact" aria-label="ULPA басты бет">
        <BrandMark size={30} />
        <strong>ULPA</strong>
      </Link>
      <div className="mobile-topbar__actions">
        <NavLink to="/search" className="icon-button topbar-search" aria-label="Іздеу">
          <Search size={19} />
        </NavLink>
        <NavLink to="/profile" className="avatar-button" aria-label="Профиль">
          <span className="avatar">{student?.full_name.slice(0, 1) ?? "?"}</span>
        </NavLink>
      </div>
    </header>
  );
}
