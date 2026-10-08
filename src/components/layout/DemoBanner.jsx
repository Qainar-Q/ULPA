import { FlaskConical, LogIn } from "lucide-react";
import { exitDemo, isDemo } from "../../demo/demoMode.js";

/** Always-visible reminder that this is the demo with made-up data. */
export default function DemoBanner() {
  if (!isDemo()) return null;
  return (
    <div className="demo-banner" role="note">
      <FlaskConical size={16} aria-hidden="true" />
      <span>
        <strong>Демо нұсқа.</strong> Барлық адамдар мен деректер ойдан шығарылған. Өзгерістерің тек осы бетте сақталады.
      </span>
      <button type="button" className="button button--ghost button--sm" onClick={() => exitDemo("/login")}>
        <LogIn size={14} /> Шығу
      </button>
    </div>
  );
}
