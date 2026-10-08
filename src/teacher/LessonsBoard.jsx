import { Link } from "react-router-dom";
import { BarChart3, ChevronRight, ClipboardCheck, QrCode } from "lucide-react";
import EmptyState from "../components/ui/EmptyState.jsx";
import { almatyIso, clock, isoWeekday, lastDateFor } from "./teacherApi.js";
import { coursesOf, useTeacherSchedule } from "./useTeacherSchedule.js";
import { weekdayLabel } from "../lib/time.js";

function lessonLine(row) {
  return `${clock(row.start_time)}${row.end_time ? `–${clock(row.end_time)}` : ""} · ${row.room ? `${row.room} ауд.` : "—"} · ${row.group_no ? `${row.group_no}-топ` : "екі топ"}`;
}

/** Today's lessons, the whole week and course summaries. */
export default function LessonsBoard({ base = "" }) {
  const { status, rows } = useTeacherSchedule();
  const today = almatyIso();
  const weekday = isoWeekday(today);
  const todays = rows.filter((row) => row.weekday === weekday);
  const days = [...new Set(rows.map((row) => row.weekday))].sort();

  if (status === "loading") return <p className="muted">Жүктелуде…</p>;
  if (status === "error") return <p className="form__error">Кесте жүктелмеді. Бетті жаңартыңыз.</p>;
  if (!rows.length) return <EmptyState icon={ClipboardCheck} title="Сабақ табылмады">Сізге пән әлі бекітілмеген. Әкімшіге хабарласыңыз.</EmptyState>;

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2 className="panel-title">Бүгінгі сабақтар</h2>
        {todays.length === 0 && (() => {
          // Next lesson day after today (wrapping to next week).
          const next = [...rows].sort((a, b) => ((a.weekday - weekday + 7) % 7 || 7) - ((b.weekday - weekday + 7) % 7 || 7) || a.start_time.localeCompare(b.start_time))[0];
          return (
            <div className="t-empty-today">
              <p>
                Бүгін сабағыңыз жоқ. <strong>QR-белгілеу</strong> мен «Белгілеу» батырмалары сабақ болатын күні осы жерде шығады.
              </p>
              {next && (
                <p className="muted small">
                  Келесі сабақ: {weekdayLabel(next.weekday)}, {clock(next.start_time)} · {next.course_name}
                </p>
              )}
              <Link to={`${base}/qr-test`} className="button button--ghost button--sm">
                <QrCode size={15} /> QR қалай көрінетінін байқап көру
              </Link>
            </div>
          );
        })()}
        <ul className="t-lessons">
          {todays.map((row) => (
            <li key={row.id} className="t-lesson" style={{ "--course-h": row.hue }}>
              <div>
                <strong>{row.course_name}</strong>
                <span className="muted small">{lessonLine(row)}</span>
              </div>
              <div className="t-lesson__actions">
                <Link to={`${base}/lesson/${row.id}/${today}/qr`} className="button button--primary button--sm">
                  <QrCode size={15} /> QR
                </Link>
                <Link to={`${base}/lesson/${row.id}/${today}`} className="button button--ghost button--sm">
                  <ClipboardCheck size={15} /> Белгілеу
                </Link>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <h2 className="panel-title">Апталық кесте</h2>
        <p className="muted small">Сабақты бассаңыз — соңғы өткен күнінің тізімі ашылады (күнді ауыстыруға болады).</p>
        {days.map((day) => (
          <div key={day} className="t-day">
            <h3 className="t-day__title">{weekdayLabel(day)}</h3>
            <ul className="t-lessons">
              {rows
                .filter((row) => row.weekday === day)
                .map((row) => (
                  <li key={row.id}>
                    <Link to={`${base}/lesson/${row.id}/${lastDateFor(row.weekday, today)}`} className="t-lesson t-lesson--link" style={{ "--course-h": row.hue }}>
                      <div>
                        <strong>{row.course_name}</strong>
                        <span className="muted small">{lessonLine(row)}</span>
                      </div>
                      <ChevronRight size={18} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="panel">
        <h2 className="panel-title">Пәндер бойынша қатысу</h2>
        <ul className="t-lessons">
          {coursesOf(rows).map((course) => (
            <li key={course.id}>
              <Link to={`${base}/course/${course.id}`} className="t-lesson t-lesson--link" style={{ "--course-h": course.hue }}>
                <div>
                  <strong>{course.name}</strong>
                  <span className="muted small">{course.code} · қорытынды және Excel</span>
                </div>
                <BarChart3 size={18} aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
