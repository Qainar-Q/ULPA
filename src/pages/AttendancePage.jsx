import { useMemo, useState } from "react";
import { CalendarCheck, ChevronDown, CloudOff, Lock } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CatalogState from "../components/CatalogState.jsx";
import OfficialAttendance from "../components/OfficialAttendance.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { STATUSES, pastOccurrences, summarize, useAttendanceMarks } from "../features/attendance/attendance.js";
import { SEMESTER_START, SESSION_TYPES } from "../config/app.js";
import { formatIsoDate } from "../lib/time.js";
import { formatClock } from "../lib/schedule.js";
import { courseAccent } from "../lib/courseStyle.js";

const PAGE_DAYS = 14;

function tone(rate) {
  if (rate >= 90) return "good";
  if (rate >= 80) return "warn";
  return "bad";
}

function StatusSelect({ value, onChange, disabled }) {
  return (
    <label className={`att-status att-status--${value}`}>
      <span className="sr-only">Қатысу</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} disabled={disabled}>
        {STATUSES.map((status) => (
          <option key={status.id} value={status.id}>
            {status.label}
          </option>
        ))}
      </select>
      <ChevronDown size={14} aria-hidden="true" />
    </label>
  );
}

export default function AttendancePage() {
  const { mySessions, courses, courseById } = useCatalog();
  const { status, marks, setMark } = useAttendanceMarks();
  const [courseFilter, setCourseFilter] = useState("all");
  const [days, setDays] = useState(PAGE_DAYS);
  const [error, setError] = useState(null);

  const occurrences = useMemo(() => pastOccurrences(mySessions, SEMESTER_START), [mySessions]);
  const summary = useMemo(() => summarize(occurrences, marks), [occurrences, marks]);

  const filtered = occurrences.filter((item) => courseFilter === "all" || item.session.course_id === courseFilter);
  const dates = [...new Set(filtered.map((item) => item.date))];
  const shownDates = dates.slice(0, days);
  const byDate = shownDates.map((date) => ({ date, items: filtered.filter((item) => item.date === date) }));

  async function change(item, value) {
    setError(null);
    try {
      await setMark(item.session.id, item.date, value);
    } catch {
      setError("Сақталмады. Интернетті тексеріп, қайта көр.");
    }
  }

  const total = summary.total;
  const rate = summary.rate(total);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Жеке"
        title="Қатысу"
        description="Әдепкі бойынша әр сабаққа «болдым» деп есептеледі — тек болмаған, кешіккен немесе өтпей қалған сабақтарды белгіле."
      />
      <OfficialAttendance />
      <p className="att-private">
        <Lock size={14} aria-hidden="true" /> Бұл деректер тек саған көрінеді — әкімшіге де, сыныптастарыңа да емес.
      </p>

      <CatalogState>
        {status === "error" && <EmptyState icon={CloudOff} title="Жүктелмеді">Интернетті тексеріп, бетті жаңарт.</EmptyState>}

        <section className="att-hero">
          <div className={`att-ring att-ring--${tone(rate)}`} style={{ "--p": rate }}>
            <strong>{rate}%</strong>
            <span>қатысу</span>
          </div>
          <dl className="att-totals">
            <div>
              <dt>Өткен сабақ</dt>
              <dd>{total.held}</dd>
            </div>
            <div>
              <dt>Себепсіз болмаған</dt>
              <dd className={total.absent ? "is-bad" : undefined}>{total.absent}</dd>
            </div>
            <div>
              <dt>Себепті</dt>
              <dd>{total.excused}</dd>
            </div>
            <div>
              <dt>Кешіккен</dt>
              <dd>{total.late}</dd>
            </div>
          </dl>
        </section>
        <p className="muted small">
          {formatIsoDate(SEMESTER_START)} бастап есептеледі. Түс: 90%+ жасыл, 80–89% сары, одан төмен қызыл — бұл тек бағдар, университет ережесі емес.
        </p>

        <div className="att-courses">
          {courses.map((course) => {
            const stats = summary.byCourse[course.id];
            if (!stats) return null;
            const courseRate = summary.rate(stats);
            const active = courseFilter === course.id;
            return (
              <button
                key={course.id}
                type="button"
                className={`att-course${active ? " is-active" : ""}`}
                style={courseAccent(course)}
                onClick={() => setCourseFilter(active ? "all" : course.id)}
                aria-pressed={active}
              >
                <span className="att-course__top">
                  <span className="course-code course-code--sm">{course.code}</span>
                  <span className={`att-course__rate att-course__rate--${tone(courseRate)}`}>{courseRate}%</span>
                </span>
                <span className="att-course__name">{course.name}</span>
                <span className="att-bar" aria-hidden="true">
                  <span style={{ width: `${courseRate}%` }} />
                </span>
                <span className="att-course__meta">
                  {stats.held} сабақ
                  {stats.absent > 0 && <b> · {stats.absent} жоқ</b>}
                  {stats.excused > 0 && ` · ${stats.excused} себепті`}
                  {stats.late > 0 && ` · ${stats.late} кеш`}
                </span>
              </button>
            );
          })}
        </div>

        <section className="panel">
          <div className="att-list-head">
            <h2 className="panel-title">Сабақтар</h2>
            {courseFilter !== "all" && (
              <button type="button" className="text-link" onClick={() => setCourseFilter("all")}>
                {courseById(courseFilter)?.code} · барлығын көрсету
              </button>
            )}
          </div>
          {error && <p className="form__error" role="alert">{error}</p>}
          {byDate.length === 0 && <EmptyState icon={CalendarCheck} title="Әзірге өткен сабақ жоқ" compact />}
          <div className="att-days">
            {byDate.map(({ date, items }) => (
              <div key={date} className="att-day">
                <h3 className="att-day__title">{formatIsoDate(date)}</h3>
                <ul>
                  {items.map((item) => {
                    const course = courseById(item.session.course_id);
                    const value = marks[item.key] ?? "present";
                    return (
                      <li key={item.key} className={`att-row att-row--${value}`} style={courseAccent(course)}>
                        <span className="att-row__time">{formatClock(item.session.start_time)}</span>
                        <span className="att-row__body">
                          <strong>{course?.name}</strong>
                          <span>{SESSION_TYPES[item.session.session_type]}{item.session.room ? ` · ${item.session.room}` : ""}</span>
                        </span>
                        <StatusSelect value={value} onChange={(next) => change(item, next)} disabled={status !== "ready"} />
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
          {dates.length > days && (
            <button type="button" className="button button--ghost button--block" onClick={() => setDays(days + PAGE_DAYS)}>
              Бұрынғы сабақтарды көрсету
            </button>
          )}
        </section>
      </CatalogState>
    </div>
  );
}
