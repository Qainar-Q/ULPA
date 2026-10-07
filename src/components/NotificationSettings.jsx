import { useCallback, useEffect, useState } from "react";
import { Bell, BellOff, Send } from "lucide-react";
import { PREF_LABELS, currentSubscription, disablePush, enablePush, loadPrefs, pushSupport, savePref, sendTestPush } from "../lib/push.js";

/** Turn phone notifications on/off for this device and choose what to receive. */
export default function NotificationSettings() {
  const support = pushSupport();
  const [state, setState] = useState("loading"); // loading | off | on | denied
  const [prefs, setPrefs] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  const refresh = useCallback(async () => {
    if (!support.supported) return;
    if (Notification.permission === "denied") return setState("denied");
    const subscription = await currentSubscription().catch(() => null);
    setState(subscription && Notification.permission === "granted" ? "on" : "off");
  }, [support.supported]);

  useEffect(() => {
    refresh();
    loadPrefs().then(setPrefs).catch(() => {});
  }, [refresh]);

  async function turnOn() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await enablePush();
      if (result === "granted") {
        setState("on");
        setMessage({ tone: "ok", text: "Қосылды! «Тексеру» батырмасымен сынап көр." });
      } else if (result === "denied") {
        setState("denied");
      } else {
        setMessage({ tone: "error", text: "Рұқсат берілмеді. Қайта басып, «Рұқсат ету» таңда." });
      }
    } catch {
      setMessage({ tone: "error", text: "Қосылмады. Интернетті тексеріп, қайта көр." });
    }
    setBusy(false);
  }

  async function turnOff() {
    setBusy(true);
    setMessage(null);
    try {
      await disablePush();
      setState("off");
    } catch {
      setMessage({ tone: "error", text: "Өшірілмеді. Қайта көр." });
    }
    setBusy(false);
  }

  async function test() {
    setBusy(true);
    setMessage(null);
    try {
      const result = await sendTestPush();
      setMessage(
        result?.sent > 0
          ? { tone: "ok", text: "Жіберілді — бірнеше секундта хабарландыру келеді." }
          : { tone: "error", text: "Құрылғы табылмады. Өшіріп, қайта қосып көр." }
      );
    } catch {
      setMessage({ tone: "error", text: "Жіберілмеді. Қайта көр." });
    }
    setBusy(false);
  }

  async function toggle(key, on) {
    setPrefs((current) => ({ ...current, [key]: on }));
    try {
      await savePref(key, on);
    } catch {
      setPrefs((current) => ({ ...current, [key]: !on }));
    }
  }

  if (!support.supported) {
    return support.needsInstall ? (
      <p className="muted small">
        iPhone-да хабарландыру тек басты экранға қосылған қосымшада жұмыс істейді: Safari → «Бөлісу» → «На экран „Домой“», содан кейін ULPA-ны сол белгішеден ашып, осы жерден қос.
      </p>
    ) : (
      <p className="muted small">Бұл браузер хабарландыруларды қолдамайды.</p>
    );
  }

  return (
    <div className="notify">
      {state === "denied" && (
        <p className="form__error">
          Хабарландыруға тыйым салынған. Телефон баптауларында ULPA / браузер үшін хабарландыруларға рұқсат бер, сосын бетті жаңарт.
        </p>
      )}
      {state === "off" && (
        <>
          <p className="muted small">Жаңа тапсырма, хабарландыру, сауалнама және мерзім туралы телефоныңа хабар келеді.</p>
          <button type="button" className="button button--primary button--wrap" onClick={turnOn} disabled={busy}>
            <Bell size={17} /> Хабарландыруларды қосу
          </button>
        </>
      )}
      {state === "on" && (
        <>
          <p className="notify__status">
            <Bell size={16} /> Бұл құрылғыда қосулы
          </p>
          {prefs && (
            <div className="notify__prefs">
              {PREF_LABELS.map(({ key, label }) => (
                <label key={key} className="toggle">
                  <span>{label}</span>
                  <input type="checkbox" checked={prefs[key] !== false} onChange={(event) => toggle(key, event.target.checked)} />
                  <span className="toggle__track" aria-hidden="true" />
                </label>
              ))}
            </div>
          )}
          <div className="notify__actions">
            <button type="button" className="button button--ghost" onClick={test} disabled={busy}>
              <Send size={16} /> Тексеру
            </button>
            <button type="button" className="button button--ghost" onClick={turnOff} disabled={busy}>
              <BellOff size={16} /> Өшіру
            </button>
          </div>
        </>
      )}
      {message && <p className={message.tone === "ok" ? "passkeys__ok" : "form__error"}>{message.text}</p>}
    </div>
  );
}
