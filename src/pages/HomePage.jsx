import { Link } from "react-router-dom";
import { ClipboardList, Calculator, ChevronRight, Coffee } from "lucide-react";
import CourseCard from "../components/CourseCard.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import SessionItem from "../components/SessionItem.jsx";
import CatalogState from "../components/CatalogState.jsx";
import RecentPhotos from "../components/photos/RecentPhotos.jsx";
import { PROGRAM_NAME } from "../config/app.js";
import { almatyWeekday, formatLongDate, greetingFor, weekdayLabel } from "../lib/time.js";
import { formatClock, nextSession, sessionState, sessionsOnDay } from "../lib/schedule.js";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";

export default function HomePage() {
  const now = new Date();
  const { student } = useAuth();
  const { courses, mySessions, courseById } = useCatalog();

  const today = almatyWeekday(now);
  const todaySessions = sessionsOnDay(mySessions, today);
  const upcoming = nextSession(mySessions, now);
  const upcomingTodayId = upcoming?.daysAhead === 0 ? upcoming.session.id : null;

  return (
    <div className="stack-lg">
      <section className="hero">
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__orbit" aria-hidden="true">
          <span className="hero__ring hero__ring--outer" />
          <span className="hero__ring hero__ring--inner" />
          <span className="hero__planet" />
          <span className="hero__sat" />
        </div>
        <div className="hero__content">
          <span className="eyebrow">{formatLongDate(now)}</span>
          <h1 className="hero__title">
            {greetingFor(now)}, {student?.full_name}!
          </h1>
          <p className="hero__text">
            {PROGRAM_NAME} · {student?.group_no}-топ.{" "}
            {todaySessions.length > 0 ? `Бүгін ${todaySessions.length} сабақ бар.` : "Бүгін сабақ жоқ."}
          </p>
          <div className="hero__actions">
            <Link to="/schedule" className="button button--primary">
              Бүгінгі кесте <ChevronRight size={16} />
            </Link>
            <Link to="/gpa" className="button button--ghost">
              <Calculator size={16} /> GPA есептеу
            </Link>
          </div>
        </div>
      </section>

      <div className="home-columns">
        <section className="panel">
          <SectionTitle
            title="Бүгінгі сабақтар"
            action={<Link to="/schedule" className="text-link">Кесте <ChevronRight size={14} /></Link>}
          />
          <CatalogState compact>
            {todaySessions.length > 0 ? (
              <ul className="session-list">
                {todaySessions.map((session) => (
                  <SessionItem
                    key={session.id}
                    session={session}
                    course={courseById(session.course_id)}
                    state={sessionState(session, upcomingTodayId, now)}
                    compact
                  />
                ))}
              </ul>
            ) : (
              <EmptyState icon={Coffee} title="Бүгін сабақ жоқ" compact>
                {upcoming
                  ? `Келесі: ${weekdayLabel(upcoming.session.weekday)}, ${formatClock(upcoming.session.start_time)} — ${courseById(upcoming.session.course_id)?.name ?? ""}`
                  : null}
              </EmptyState>
            )}
          </CatalogState>
        </section>

        <section className="panel">
          <SectionTitle
            title="Жақын тапсырмалар"
            action={<Link to="/tasks" className="text-link">Барлығы <ChevronRight size={14} /></Link>}
          />
          <EmptyState icon={ClipboardList} title="Тапсырма жоқ" tag="Келесі кезеңде" compact>
            Мерзімі жақындаған тапсырмалар осында шығады.
          </EmptyState>
        </section>
      </div>

      <section>
        <SectionTitle title="Менің пәндерім" meta={courses.length ? `${courses.length} пән` : undefined} />
        <CatalogState>
          <div className="course-grid">
            {courses.map((course) => {
              const courseSessions = mySessions.filter((session) => session.course_id === course.id);
              return (
                <CourseCard
                  key={course.slug}
                  course={course}
                  next={nextSession(courseSessions, now)}
                  weeklyCount={courseSessions.length}
                />
              );
            })}
          </div>
        </CatalogState>
      </section>

      <section className="panel">
        <SectionTitle
          title="Соңғы фотолар"
          action={<Link to="/photos" className="text-link">EASYФОТО <ChevronRight size={14} /></Link>}
        />
        <RecentPhotos limit={6} />
      </section>
    </div>
  );
}
