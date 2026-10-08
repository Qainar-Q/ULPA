import { useEffect, useMemo, useState } from "react";
import { useVisiblePolling } from "../lib/useVisiblePolling.js";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Maximize2, Square } from "lucide-react";
import qrcode from "qrcode-generator";
import { checkinStatus, clock, closeCheckin, openCheckin } from "./teacherApi.js";

/** QR as plain SVG rectangles (no HTML injection). */
export function QrSvg({ text }) {
  const cells = useMemo(() => {
    const qr = qrcode(0, "M");
    qr.addData(text);
    qr.make();
    const size = qr.getModuleCount();
    const dark = [];
    for (let r = 0; r < size; r += 1) for (let c = 0; c < size; c += 1) if (qr.isDark(r, c)) dark.push([c, r]);
    return { size, dark };
  }, [text]);
  const pad = 2;
  return (
    <svg className="qr" viewBox={`0 0 ${cells.size + pad * 2} ${cells.size + pad * 2}`} role="img" aria-label="QR код" shapeRendering="crispEdges">
      <rect width="100%" height="100%" fill="#fff" />
      <path d={cells.dark.map(([x, y]) => `M${x + pad} ${y + pad}h1v1h-1z`).join("")} fill="#000" />
    </svg>
  );
}

/**
 * Live check-in for today's lesson: a QR + 6-digit code that change every 20 s.
 * Students scan it (or type the code) and appear in the list right away.
 */
export default function CheckinView({ entry, date, base }) {
  const navigate = useNavigate();
  const [sessionId, setSessionId] = useState(null);
  const [state, setState] = useState(null);
  const [error, setError] = useState(null);
  const [big, setBig] = useState(false);

  useEffect(() => {
    let alive = true;
    openCheckin(entry.id, date)
      .then((id) => alive && setSessionId(id))
      .catch((openError) => alive && setError(openError?.message?.includes("invalid_lesson") ? "QR тек бүгінгі сабаққа ашылады." : "Ашылмады. Қайта көріңіз."));
    return () => {
      alive = false;
    };
  }, [entry.id, date]);

  const closed = state && !state.open;
  useVisiblePolling(
    async () => {
      try {
        const next = await checkinStatus(sessionId);
        setState({ ...next, at: Date.now() });
      } catch {
        /* keep the last code on a network blip */
      }
    },
    2000,
    Boolean(sessionId) && !closed
  );

  // Keep the screen on while the QR is shown (phones lock after ~30 s otherwise).
  useEffect(() => {
    let lock = null;
    let released = false;
    const request = async () => {
      try {
        if (!released && document.visibilityState === "visible" && "wakeLock" in navigator) lock = await navigator.wakeLock.request("screen");
      } catch {
        lock = null;
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      released = true;
      document.removeEventListener("visibilitychange", request);
      lock?.release?.().catch?.(() => {});
    };
  }, []);

  // Smooth countdown between polls.
  const [, setNow] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  const secondsLeft = state ? Math.max(0, Math.round(state.seconds_left - (Date.now() - state.at) / 1000)) : 20;

  async function finish() {
    if (sessionId) await closeCheckin(sessionId).catch(() => {});
    navigate(`${base}/lesson/${entry.id}/${date}`);
  }

  const url = state ? `${window.location.origin}/checkin?s=${sessionId}&c=${state.code}` : "";

  return (
    <div className={`stack-lg checkin${big ? " checkin--big" : ""}`}>
      <Link to={`${base}/lesson/${entry.id}/${date}`} className="text-link">
        <ArrowLeft size={14} /> Қолмен белгілеу
      </Link>
      <section className="panel checkin__panel">
        <p className="checkin__course">
          <strong>{entry.course_name}</strong> · {clock(entry.start_time)} · {entry.group_no ? `${entry.group_no}-топ` : "екі топ"}
        </p>
        {error && <p className="form__error">{error}</p>}
        {state && state.open && (
          <>
            <div className="checkin__qr">
              <QrSvg text={url} />
            </div>
            <p className="checkin__hint">
              Студенттер: <strong>ULPA қосымшасын ашып → «Белгілену»</strong> бетіне кодты енгізіңдер (басты бетте де батырма шығады). Камерамен сканерлеуге де болады.
            </p>
            <p className="checkin__code" aria-live="polite">
              {state.code.slice(0, 3)} {state.code.slice(3)}
            </p>
            <div className="checkin__timer" style={{ "--p": `${(secondsLeft / 20) * 100}%` }}>
              <span>Код {secondsLeft} секундтан кейін ауысады</span>
            </div>
          </>
        )}
        {state && !state.open && <p className="muted">Белгілену жабылды.</p>}
        {!state && !error && <p className="muted">Ашылуда…</p>}
        <div className="roll-actions">
          <button type="button" className="button button--ghost" onClick={() => setBig(!big)}>
            <Maximize2 size={16} /> {big ? "Кішірейту" : "Үлкен экран"}
          </button>
          <button type="button" className="button button--primary" onClick={finish}>
            <Square size={16} /> Аяқтау
          </button>
        </div>
      </section>

      <section className="panel">
        <h2 className="panel-title">
          Белгіленгендер <span className="muted small">{state?.checked_in?.length ?? 0}</span>
        </h2>
        {state?.checked_in?.length ? (
          <ul className="checkin__list">
            {state.checked_in.map((name, index) => (
              <li key={`${name}-${index}`}>✓ {name}</li>
            ))}
          </ul>
        ) : (
          <p className="muted">Әзірге ешкім жоқ.</p>
        )}
        <p className="muted small">Сабақ басталғаннан 15 минуттан кейін белгіленгендер «кешікті» болып жазылады. Аяқтаған соң тізімді қолмен түзете аласыз.</p>
      </section>
    </div>
  );
}
