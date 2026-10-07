import { Link } from "react-router-dom";
import { ClipboardList, Calculator, ChevronRight, Coffee, Cake, FolderOpen, Megaphone, Vote } from "lucide-react";
import CourseCard from "../components/CourseCard.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import SessionItem from "../components/SessionItem.jsx";
import CatalogState from "../components/CatalogState.jsx";
import RecentPhotos from "../components/photos/RecentPhotos.jsx";
import TaskCard from "../components/tasks/TaskCard.jsx";
import SpaceCard from "../components/space/SpaceCard.jsx";
import { useTasks } from "../features/tasks/TasksContext.jsx";
import AnnouncementCard from "../components/AnnouncementCard.jsx";
import { useAnnouncements } from "../features/announcements/useAnnouncements.js";
import { useBirthdays } from "../features/birthdays/useBirthdays.js";

const MONTHS_SHORT = ["қаң", "ақп", "нау", "сәу", "мам", "мау", "шіл", "там", "қыр", "қаз", "қар", "жел"];
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
  const { openTasks, status: tasksStatus } = useTasks();
  const announcements = useAnnouncements(3);
  const birthdays = useBirthdays(14);
  const myBirthdayToday = birthdays.today.some((row) => row.code === student?.code);
  const upcomingTasks = [...openTasks]
    .sort((a, b) => (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"))
    .slice(0, 4);

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

      <nav className="quick-links" aria-label="Жылдам сілтемелер">
        <Link to="/materials" className="quick-links__item">
          <FolderOpen size={18} aria-hidden="true" /> Материалдар
        </Link>
        <Link to="/announcements" className="quick-links__item">
          <Megaphone size={18} aria-hidden="true" /> Хабарландырулар
        </Link>
        <Link to="/polls" className="quick-links__item quick-links__item--wide">
          <Vote size={18} aria-hidden="true" /> Дауыс беру
        </Link>
      </nav>

      {birthdays.today.length > 0 && (
        <section className="birthday-banner" role="status">
          <span className="birthday-banner__emoji" aria-hidden="true">🎂</span>
          <div>
            <strong>
              {myBirthdayToday ? `Туған күніңмен, ${student.full_name}! 🎉` : `Бүгін туған күн: ${birthdays.today.map((row) => row.full_name).join(", ")}`}
            </strong>
            <p>{myBirthdayToday ? "Бүкіл топ атынан құттықтаймыз!" : "Құттықтауды ұмытпа!"}</p>
          </div>
        </section>
      )}

      {announcements.items.length > 0 && (
        <section className="panel">
          <SectionTitle
            title="Хабарландырулар"
            action={<Link to="/announcements" className="text-link">Барлығы <ChevronRight size={14} /></Link>}
          />
          <div className="announcement-list">
            {announcements.items.slice(0, 2).map((item) => (
              <AnnouncementCard key={item.id} item={item} compact />
            ))}
          </div>
        </section>
      )}

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
          {upcomingTasks.length > 0 ? (
            <ul className="task-list">
              {upcomingTasks.map((task) => (
                <TaskCard key={task.id} task={task} course={courseById(task.course_id)} compact />
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardList} title={tasksStatus === "ready" ? "Орындалмаған тапсырма жоқ" : "Жүктелуде…"} compact>
              {tasksStatus === "ready" ? "Жаңа тапсырма берілгенде осында шығады." : null}
            </EmptyState>
          )}
        </section>
      </div>

      {birthdays.upcoming.length > 0 && (
        <section className="panel">
          <SectionTitle title="Жақын туған күндер" />
          <ul className="birthday-list">
            {birthdays.upcoming.map((row) => (
              <li key={row.code}>
                <span className="avatar avatar--sm" aria-hidden="true">{row.full_name.slice(0, 1)}</span>
                <span className="birthday-list__name">{row.full_name}</span>
                <span className="birthday-list__date">
                  <Cake size={13} aria-hidden="true" /> {row.birth_day} {MONTHS_SHORT[row.birth_month - 1]}
                </span>
                <span className="birthday-list__in">{row.inDays === 1 ? "ертең" : `${row.inDays} күннен кейін`}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {announcements.items.length === 0 && (student?.is_monitor || student?.role === "admin") && (
        <Link to="/announcements" className="panel announce-cta">
          <Megaphone size={18} aria-hidden="true" /> Сыныпқа хабарландыру жариялау
          <ChevronRight size={16} aria-hidden="true" />
        </Link>
      )}

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
                  openTasks={openTasks.filter((task) => task.course_id === course.id).length}
                />
              );
            })}
          </div>
        </CatalogState>
      </section>

      <SpaceCard />

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
