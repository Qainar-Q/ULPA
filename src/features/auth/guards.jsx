import { Navigate, Outlet, useLocation } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "./AuthContext.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import BrandMark from "../../components/layout/BrandMark.jsx";

export function FullScreenLoader() {
  return (
    <div className="splash" role="status" aria-live="polite">
      <BrandMark size={44} />
      <span className="splash__text">Жүктелуде…</span>
    </div>
  );
}

/** Pages inside require a signed-in student. Others are sent to /login. */
export function RequireAuth() {
  const { status } = useAuth();
  const location = useLocation();

  if (status === "loading") return <FullScreenLoader />;
  if (status !== "signedIn") {
    return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  }
  return <Outlet />;
}

/**
 * Admin-only pages. This only hides the UI — the real protection is in the
 * database (RLS + admin checks inside every admin function).
 */
export function RequireAdmin() {
  const { isAdmin } = useAuth();
  if (!isAdmin) {
    return (
      <EmptyState icon={ShieldAlert} title="Рұқсат жоқ">
        Бұл бет тек әкімшіге арналған.
      </EmptyState>
    );
  }
  return <Outlet />;
}

/** Login/activation pages: already signed-in users go home. */
export function RedirectIfSignedIn() {
  const { status } = useAuth();
  const location = useLocation();
  if (status === "loading") return <FullScreenLoader />;
  if (status === "signedIn") {
    const from = location.state?.from;
    const target = typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/";
    return <Navigate to={target} replace />;
  }
  return <Outlet />;
}
