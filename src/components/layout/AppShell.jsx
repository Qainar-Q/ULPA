import { useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar.jsx";
import BottomNav from "./BottomNav.jsx";
import MobileTopbar from "./MobileTopbar.jsx";

export default function AppShell() {
  const { pathname } = useLocation();

  // New page → start at the top (important on phones).
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <MobileTopbar />
        <main className="page" id="main">
          <Outlet />
        </main>
      </div>
      <BottomNav />
    </div>
  );
}
