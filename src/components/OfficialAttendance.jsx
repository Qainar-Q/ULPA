import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GraduationCap, QrCode } from "lucide-react";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { courseAccent } from "../lib/courseStyle.js";
import { formatIsoDate } from "../lib/time.js";
import { STATUS, clock, myOfficialAttendance, percent } from "../teacher/teacherApi.js";

/** The marks teachers (or QR check-in) recorded for me. Only I can see mine. */
export default function OfficialAttendance() {
  const { courseById } = useCatalog();
  const [rows, setRows] = useState(null);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    myOfficialAttendance().then(setRows).catch(() => setRows([]));
  }, []);

  const byCourse = useMemo(() => {
    const map = new Map();
    for (const row of rows ?? []) {
      const item = map.get(row.course_id) ?? { present: 0, late: 0, absent: 0, excused: 0 };
      item[row.status] += 1;
      map.set(row.course_id, item);
    }
    return [...map.entries()];
  }, [rows]);

  return (
    <section className="panel official">
      <div className="official__head">
        <h2 className="panel-title">
          <GraduationCap size={18} aria-hidden="true" /> Оқытушы белгілері
        </h2>
        <Link to="/checkin" className="button button--primary button--sm">
          <QrCode size={15} /> Белгілену
        </Link>
      </div>
      {rows && rows.length === 0 && <p className="muted small">Оқытушылар әлі белгі қоймаған. Сабақта QR көрсетілсе — «Белгілену» батырмасын бас.</p>}
      {byCourse.length > 0 && (
        <ul className="official__courses">
          {byCourse.map(([courseId, item]) => {
            const course = courseById(courseId);
            const value = percent(item);
            return (
              <li key={courseId} style={courseAccent(course)}>
                <strong>{course?.name ?? "Пән"}</strong>
                <span className={`official__pct${value !== null && value < 70 ? " is-low" : ""}`}>{value === null ? "—" : `${value}%`}</span>
                <span className="muted small">
                  ✓ {item.present} · ⏰ {item.late} · ✕ {item.absent} · 📝 {item.excused}
                </span>
              </li>
            );
          })}
        </ul>
      )}
      {rows && rows.length > 0 && (
        <>
          <ul className="official__list">
            {(showAll ? rows : rows.slice(0, 6)).map((row) => (
              <li key={`${row.schedule_entry_id}-${row.session_date}`} className={`official__row official__row--${STATUS[row.status].tone}`}>
                <span>{formatIsoDate(row.session_date)} · {clock(row.start_time)}</span>
                <span>{courseById(row.course_id)?.name}</span>
                <b>{STATUS[row.status].short} {STATUS[row.status].label}{row.method === "qr" ? " · QR" : ""}</b>
              </li>
            ))}
          </ul>
          {rows.length > 6 && (
            <button type="button" className="text-link" onClick={() => setShowAll(!showAll)}>
              {showAll ? "Жасыру" : `Барлығы (${rows.length})`}
            </button>
          )}
        </>
      )}
      <p className="muted small">Бұл — оқытушы қойған белгілер, тек өзіңе көрінеді. Төмендегі «жеке белгілер» — сенің өз есебің.</p>
    </section>
  );
}
