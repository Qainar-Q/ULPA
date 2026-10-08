import { useEffect } from "react";
import PageLoading from "../components/ui/PageLoading.jsx";
import { enterDemo } from "../demo/demoMode.js";

/** /demo: switch this tab to demo mode and open the app with made-up data. */
export default function DemoStartPage() {
  useEffect(() => {
    enterDemo(new URLSearchParams(window.location.search).get("as") === "teacher" ? "teacher" : "student");
    window.location.replace("/");
  }, []);
  return <PageLoading />;
}
