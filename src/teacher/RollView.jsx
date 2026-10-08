import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, CheckCheck, ChevronLeft, ChevronRight, QrCode, RotateCcw } from "lucide-react";
import { STATUS, almatyIso, clock, shiftDate, teacherMark, teacherRoll } from "./teacherApi.js";
import { formatIsoDate } from "../lib/time.js";

const ORDER = ["present", "late", "absent", "excused"];

/**
 * Roll call for one lesson (entry + date). Each tap saves at once; marks the
 * teacher has not set yet show as empty. Used by teachers and by the admin.
 */
export default function RollView({ entry, date, base, onDate }) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(0);
  const pending = useRef(new Map());
  const pendingFor = useRef(null); // { entryId, date } the queued taps belong to
  const timer = useRef(null);
  const today = almatyIso();

  const load = useCallback(async () => {
    setError(null);
    try {
      setRows(await teacherRoll(entry.id, date));
    } catch {
      setError("Тізім жүктелмеді. Интернетті тексер.");
    }
  }, [entry.id, date]);

  useEffect(() => {
    setRows(null);
    load();
  }, [load]);

  // Batch quick taps into one request.
  function queue(changes) {
    pendingFor.current = { entryId: entry.id, date };
    for (const [studentId, status] of changes) pending.current.set(studentId, status);
    setRows((current) => current.map((row) => (pending.current.has(row.student_id) ? { ...row, status: pending.current.get(row.student_id), method: "teacher" } : row)));
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 350);
  }

  async function flush() {
    clearTimeout(timer.current);
    const marks = [...pending.current].map(([student_id, status]) => ({ student_id, status }));
    pending.current = new Map();
    if (!marks.length || !pendingFor.current) return;
    const target = pendingFor.current;
    setSaving((n) => n + 1);
    try {
      await teacherMark(target.entryId, target.date, marks);
    } catch {
      setError("Сақталмады — қайта басып көріңіз.");
      load();
    }
    setSaving((n) => n - 1);
  }

  // Leaving the page (or switching the date) right after a tap: send what is queued.
  const flushRef = useRef(flush);
  flushRef.current = flush;
  useEffect(() => () => flushRef.current(), [entry.id, date]);

  const counts = useMemo(() => {
    const out = { present: 0, late: 0, absent: 0, excused: 0, none: 0 };
    for (const row of rows ?? []) out[row.status ?? "none"] += 1;
    return out;
  }, [rows]);

  const canGoForward = shiftDate(date, 7) <= today;

  return (
    <div className="stack-lg">
      <Link to={base || "/"} className="text-link">
        <ArrowLeft size={14} /> Артқа
      </Link>

      <section className="panel roll-head" style={{ "--course-h": entry.hue }}>
        <span className="tag">{entry.course_code}</span>
        <h1 className="roll-head__title">{entry.course_name}</h1>
        <p className="muted">
          {clock(entry.start_time)}
          {entry.end_time ? `–${clock(entry.end_time)}` : ""} · {entry.room ? `${entry.room} ауд.` : "аудитория —"} ·{" "}
          {entry.group_no ? `${entry.group_no}-топ` : "екі топ"} · {entry.session_type === "lab" ? "зертханалық" : "дәріс"}
        </p>
        <div className="roll-date">
          <button type="button" className="icon-button" onClick={() => onDate(shiftDate(date, -7))} aria-label="Алдыңғы апта">
            <ChevronLeft size={18} />
          </button>
          <strong>{formatIsoDate(date)}{date === today ? " · бүгін" : ""}</strong>
          <button type="button" className="icon-button" onClick={() => onDate(shiftDate(date, 7))} disabled={!canGoForward} aria-label="Келесі апта">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="roll-counts">
          <span className="roll-count roll-count--ok">✓ {counts.present}</span>
          <span className="roll-count roll-count--warn">⏰ {counts.late}</span>
          <span className="roll-count roll-count--bad">✕ {counts.absent}</span>
          <span className="roll-count roll-count--info">📝 {counts.excused}</span>
          {counts.none > 0 && <span className="roll-count">… {counts.none}</span>}
          <span className="roll-saving" aria-live="polite">{saving || pending.current.size ? "Сақталуда…" : rows ? "Сақталды ✓" : ""}</span>
        </div>
        <div className="roll-actions">
          {date === today ? (
            <Link to={`${base}/lesson/${entry.id}/${date}/qr`} className="button button--primary">
              <QrCode size={18} /> QR арқылы белгілеу
            </Link>
          ) : (
            <span className="roll-qr-note">
              <QrCode size={15} aria-hidden="true" /> QR тек сабақ болатын күні ашылады — өткен сабақтарды қолмен белгілеңіз.
            </span>
          )}
          <button
            type="button"
            className="button button--ghost"
            disabled={!rows || counts.none === 0}
            onClick={() => queue(rows.filter((row) => !row.status).map((row) => [row.student_id, "present"]))}
          >
            <CheckCheck size={18} /> Қалғандары келді
          </button>
          <button
            type="button"
            className="button button--ghost"
            disabled={!rows || counts.none === rows.length}
            onClick={() => window.confirm("Осы сабақтың барлық белгісін өшіру керек пе?") && queue(rows.map((row) => [row.student_id, null]))}
          >
            <RotateCcw size={16} /> Тазалау
          </button>
        </div>
      </section>

      {error && <p className="form__error" role="alert">{error}</p>}
      {!rows && !error && <p className="muted">Жүктелуде…</p>}

      {rows && (
        <ul className="roll-list">
          {rows.map((row) => (
            <li key={row.student_id} className={`roll-row${row.status ? ` roll-row--${STATUS[row.status].tone}` : ""}`}>
              <div className="roll-row__who">
                <span className="avatar avatar--sm" aria-hidden="true">{row.full_name.slice(0, 1)}</span>
                <span>
                  <strong>{row.full_name}</strong>
                  <small>
                    {row.code} · {row.group_no}-топ{row.method === "qr" ? " · QR" : ""}
                  </small>
                </span>
              </div>
              <div className="roll-row__marks" role="radiogroup" aria-label={row.full_name}>
                {ORDER.map((status) => (
                  <button
                    key={status}
                    type="button"
                    role="radio"
                    aria-checked={row.status === status}
                    aria-label={STATUS[status].label}
                    title={STATUS[status].label}
                    className={`roll-mark roll-mark--${STATUS[status].tone}${row.status === status ? " is-on" : ""}`}
                    onClick={() => queue([[row.student_id, row.status === status ? null : status]])}
                  >
                    {STATUS[status].short}
                  </button>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="muted small">✓ келді · ⏰ кешікті · ✕ жоқ · 📝 себепті. Қайта бассаңыз — белгі өшеді. Әр студент тек өз белгісін көреді.</p>
    </div>
  );
}
