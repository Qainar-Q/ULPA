import { Suspense, useEffect } from "react";
import PageLoading from "../ui/PageLoading.jsx";
import { prefetchPages } from "../../lib/prefetch.js";
import { Outlet, useNavigate } from "react-router-dom";
import { useScrollMemory } from "../../lib/useScrollMemory.js";
import Sidebar from "./Sidebar.jsx";
import BottomNav from "./BottomNav.jsx";
import MobileTopbar from "./MobileTopbar.jsx";
import OnboardingTour from "../OnboardingTour.jsx";
import BadgeToast from "../classlife/BadgeToast.jsx";
import DemoBanner from "./DemoBanner.jsx";

export default function AppShell() {
  const navigate = useNavigate();

  // After the first screen is shown, quietly fetch the most used pages.
  useEffect(() => prefetchPages(), []);

  // "/" or Ctrl/⌘+K opens search (computers), unless typing somewhere.
  useEffect(() => {
    function onKey(event) {
      const typing = event.target?.closest?.("input, textarea, select, [contenteditable='true']");
      if ((event.key === "k" && (event.metaKey || event.ctrlKey)) || (event.key === "/" && !typing && !event.metaKey && !event.ctrlKey)) {
        if (document.querySelector(".modal, .viewer, .tour")) return;
        event.preventDefault();
        navigate("/search");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [navigate]);

  // New page → start at the top; going back → return to where you were.
  useScrollMemory();

  return (
    <div className="app-shell">
      <Sidebar />
      <div className="app-main">
        <MobileTopbar />
        <main className="page" id="main">
          <DemoBanner />
          {/* Navigation stays visible while a page's code loads */}
          <Suspense fallback={<PageLoading />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
      <BottomNav />
      <OnboardingTour />
      <BadgeToast />
    </div>
  );
}
