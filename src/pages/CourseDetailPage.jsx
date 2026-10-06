import { Link, useParams } from "react-router-dom";
import { ArrowLeft, BookOpen, CalendarDays, ClipboardList, FileText, UserRound } from "lucide-react";
import EmptyState from "../components/ui/EmptyState.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import SessionItem from "../components/SessionItem.jsx";
import CatalogState from "../components/CatalogState.jsx";
import RecentPhotos from "../components/photos/RecentPhotos.jsx";
import TaskCard from "../components/tasks/TaskCard.jsx";
import { useTasks } from "../features/tasks/TasksContext.jsx";
import NotFoundPage from "./NotFoundPage.jsx";
import { courseAccent } from "../lib/courseStyle.js";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { WEEKDAYS } from "../lib/time.js";

function CourseDetail({ course }) {
  const { mySessions } = useCatalog();
  const sessions = mySessions
    .filter((session) => session.course_id === course.id)
    .sort((a, b) => a.weekday - b.weekday || a.start_time.localeCompare(b.start_time));
  const days = WEEKDAYS.filter((day) => sessions.some((session) => session.weekday === day.id));
  const { tasks, isDone } = useTasks();
  const courseTasks = tasks
    .filter((task) => task.course_id === course.id)
    .sort((a, b) => Number(isDone(a.id)) - Number(isDone(b.id)) || (a.due_at ?? "9999").localeCompare(b.due_at ?? "9999"));

  return (
    <div className="stack-lg">
      <Link to="/" className="back-link">
        <ArrowLeft size={16} /> Пәндерге оралу
      </Link>

      <section className="course-hero" style={courseAccent(course)}>
        <span className="course-code course-code--lg">{course.code}</span>
        <div>
          <h1 className="course-hero__title">{course.name}</h1>
          <p className="course-hero__teacher">
            <UserRound size={15} /> {course.teacher}
          </p>
        </div>
      </section>

      <nav className="chip-nav" aria-label="Пән бөлімдері">
        <a href="#schedule">Кесте</a>
        <a href="#about">Сипаттама</a>
        <a href="#materials">Материалдар</a>
        <a href="#photos">Фото</a>
        <a href="#tasks">Тапсырма</a>
      </nav>

      <div className="detail-grid">
        <section className="panel detail-grid__wide" id="schedule">
          <SectionTitle title="Апталық кесте" meta={`${sessions.length} сабақ`} />
          {sessions.length > 0 ? (
            <div className="course-week">
              {days.map((day) => (
                <div key={day.id} className="course-week__day">
                  <h3>{day.label}</h3>
                  <ul className="session-list">
                    {sessions
                      .filter((session) => session.weekday === day.id)
                      .map((session) => (
                        <SessionItem key={session.id} session={session} course={course} compact />
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState icon={CalendarDays} title="Бұл пәннен сабақ жоқ" compact />
          )}
        </section>

        <section className="panel" id="about">
          <SectionTitle title="Пән туралы" />
          {course.description ? (
            <p className="prose">{course.description}</p>
          ) : (
            <EmptyState icon={BookOpen} title="Сипаттама қосылмаған" compact>
              Пән сипаттамасын әкімші қоса алады.
            </EmptyState>
          )}
        </section>

        <section className="panel" id="materials">
          <SectionTitle title="Оқу материалдары" />
          <EmptyState icon={FileText} title="Материал жоқ" compact>
            Лекция файлдары мен құжаттар осында жиналады.
          </EmptyState>
        </section>

        <section className="panel" id="photos">
          <SectionTitle
            title="Фото"
            action={<Link to={`/photos?course=${course.slug}`} className="text-link">EASYФОТО</Link>}
          />
          <RecentPhotos courseId={course.id} limit={6} />
        </section>

        <section className="panel" id="tasks">
          <SectionTitle
            title="Тапсырмалар"
            action={<Link to={`/tasks?course=${course.slug}`} className="text-link">Барлығы</Link>}
          />
          {courseTasks.length > 0 ? (
            <ul className="task-list">
              {courseTasks.map((task) => (
                <TaskCard key={task.id} task={task} course={course} compact />
              ))}
            </ul>
          ) : (
            <EmptyState icon={ClipboardList} title="Тапсырма жоқ" compact>
              Оқытушы берген тапсырмалар осында шығады.
            </EmptyState>
          )}
        </section>
      </div>
    </div>
  );
}

export default function CourseDetailPage() {
  const { slug } = useParams();
  const { status, courseBySlug } = useCatalog();
  const course = courseBySlug(slug);

  if (status !== "ready") return <CatalogState />;
  if (!course) return <NotFoundPage />;
  return <CourseDetail course={course} />;
}
