import { useMemo } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarDays, Coffee } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import SessionItem from "../components/SessionItem.jsx";
import CatalogState from "../components/CatalogState.jsx";
import GroupSwitch from "../components/GroupSwitch.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { WEEKDAYS, almatyWeekday, weekdayLabel } from "../lib/time.js";
import { formatClock, nextSession, sessionState, sessionsOnDay } from "../lib/schedule.js";

const VIEWS = [
  { id: "today", label: "Бүгін" },
  { id: "week", label: "Апта" },
];

const SCHOOL_DAYS = WEEKDAYS.slice(0, 6); // Mon–Sat

export default function SchedulePage() {
  const [view, setView] = useQueryParam("view", "today");
  const [courseSlug, setCourseSlug] = useQueryParam("course", "");
  const today = almatyWeekday();
  const [dayParam, setDayParam] = useQueryParam("day", "");
  const selectedDay = Number(dayParam) || (today <= 6 ? today : 1);

  const { mySessions, courseById, courseBySlug, viewerGroup } = useCatalog();
  const filterCourse = courseSlug ? courseBySlug(courseSlug) : null;

  const sessions = useMemo(
    () => (filterCourse ? mySessions.filter((session) => session.course_id === filterCourse.id) : mySessions),
    [mySessions, filterCourse]
  );

  const upcoming = nextSession(sessions);
  const todaySessions = sessionsOnDay(sessions, today);
  const daySessions = sessionsOnDay(sessions, view === "week" ? selectedDay : today);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow={`Алматы уақыты · ${viewerGroup ?? "—"}-топ`}
        title="Сабақ кестесі"
        description="Дәрістер екі топқа ортақ. Зертханалық жұмыстар тек өз тобыңа көрсетіледі."
        actions={
          <Link to="/attendance" className="button button--ghost">
            <CalendarCheck size={17} /> Қатысуым
          </Link>
        }
      />

      <div className="toolbar">
        <Segmented label="Кесте көрінісі" options={VIEWS} value={view} onChange={setView} />
        <CourseSelect id="schedule-course" value={courseSlug} onChange={setCourseSlug} />
      </div>
      <GroupSwitch />

      <CatalogState>
        {view === "week" && (
          <div className="week-strip" role="tablist" aria-label="Апта күндері">
            {SCHOOL_DAYS.map((day) => {
              const count = sessionsOnDay(sessions, day.id).length;
              return (
                <button
                  key={day.id}
                  type="button"
                  role="tab"
                  aria-selected={day.id === selectedDay}
                  className={`week-strip__day${day.id === selectedDay ? " is-selected" : ""}${day.id === today ? " is-today" : ""}`}
                  onClick={() => setDayParam(String(day.id))}
                >
                  <span>{day.short}</span>
                  <small>{count > 0 ? count : "—"}</small>
                </button>
              );
            })}
          </div>
        )}

        <section className="panel">
          <div className="day-head">
            <h2>{weekdayLabel(view === "week" ? selectedDay : today)}</h2>
            {view === "today" && <span className="day-head__tag">Бүгін</span>}
            <span className="day-head__count">{daySessions.length} сабақ</span>
          </div>

          {daySessions.length > 0 ? (
            <ul className="session-list">
              {daySessions.map((session) => (
                <SessionItem
                  key={session.id}
                  session={session}
                  course={courseById(session.course_id)}
                  state={view === "today" ? sessionState(session, upcoming?.daysAhead === 0 ? upcoming.session.id : null) : undefined}
                />
              ))}
            </ul>
          ) : (
            <EmptyState icon={view === "today" ? Coffee : CalendarDays} title="Бұл күні сабақ жоқ" compact>
              {upcoming
                ? `Келесі сабақ: ${weekdayLabel(upcoming.session.weekday)}, ${formatClock(upcoming.session.start_time)} — ${courseById(upcoming.session.course_id)?.name ?? ""}`
                : "Кестеде сабақ табылмады."}
            </EmptyState>
          )}
        </section>

        {view === "today" && todaySessions.length > 0 && !todaySessions.some((s) => s.id === upcoming?.session.id) && upcoming && (
          <p className="muted">
            Бүгінгі сабақтар аяқталды. Келесі: {weekdayLabel(upcoming.session.weekday)}, {formatClock(upcoming.session.start_time)} —{" "}
            {courseById(upcoming.session.course_id)?.name}
          </p>
        )}
      </CatalogState>
    </div>
  );
}
