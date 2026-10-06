import { useEffect, useState } from "react";
import { Download, Share, SquarePlus } from "lucide-react";

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches || window.navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(window.navigator.userAgent);

/** "Add ULPA to the home screen": one-tap on Android/desktop Chrome, instructions on iPhone. */
export default function InstallApp() {
  const [prompt, setPrompt] = useState(null);
  const [installed, setInstalled] = useState(isStandalone());

  useEffect(() => {
    const onPrompt = (event) => {
      event.preventDefault();
      setPrompt(event);
    };
    const onInstalled = () => setInstalled(true);
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (installed) return <p className="passkeys__ok">ULPA басты экранға қосылған ✓</p>;

  if (prompt) {
    return (
      <button
        type="button"
        className="button button--ghost button--wrap"
        onClick={async () => {
          prompt.prompt();
          const { outcome } = await prompt.userChoice;
          if (outcome === "accepted") setInstalled(true);
          setPrompt(null);
        }}
      >
        <Download size={17} /> Басты экранға қосу
      </button>
    );
  }

  if (isIOS()) {
    return (
      <ol className="install-steps">
        <li>Safari-де төмендегі <Share size={15} aria-label="Бөлісу" /> «Бөлісу» батырмасын бас.</li>
        <li><SquarePlus size={15} aria-hidden="true" /> «На экран Домой» / «Add to Home Screen» таңда.</li>
        <li>«Қосу» бас — ULPA белгішесі басты экранда пайда болады.</li>
      </ol>
    );
  }

  return (
    <p className="muted small">
      Chrome мәзірінен (⋮) «Басты экранға қосу» / «Install app» таңда.
    </p>
  );
}
