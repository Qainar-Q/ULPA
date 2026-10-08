import { Link, useParams } from "react-router-dom";
import { useState } from "react";
import { ArrowLeft, BookOpen, CalendarDays, ClipboardList, FileText, Pencil, Plus, UserRound } from "lucide-react";
import EmptyState from "../components/ui/EmptyState.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import SessionItem from "../components/SessionItem.jsx";
import CatalogState from "../components/CatalogState.jsx";
import RecentPhotos from "../components/photos/RecentPhotos.jsx";
import MaterialList from "../components/materials/MaterialList.jsx";
import MaterialUploadDialog from "../components/materials/MaterialUploadDialog.jsx";
import CourseInfoForm from "../components/CourseInfoForm.jsx";
import { useMaterials } from "../features/materials/materialApi.js";
import { useAuth } from "../features/auth/AuthContext.jsx";
import TaskCard from "../components/tasks/TaskCard.jsx";
import { useTasks } from "../features/tasks/TasksContext.jsx";
import NotFoundPage from "./NotFoundPage.jsx";
import { courseAccent } from "../lib/courseStyle.js";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { WEEKDAYS } from "../lib/time.js";
import TeacherCard from "../components/teachers/TeacherCard.jsx";
import { useTeachers } from "../features/teachers/teacherApi.js";

function CourseDetail({ course }) {
  const { mySessions, courseById, reload: reloadCatalog } = useCatalog();
  const { isAdmin } = useAuth();
  const materials = useMaterials({ courseId: course.id });
  const teacherData = useTeachers();
  const courseTeachers = teacherData.teachers.filter((teacher) => teacher.courseIds.includes(course.id));
  const [uploading, setUploading] = useState(false);
  const [editingInfo, setEditingInfo] = useState(false);
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
            <UserRound size={15} />{" "}
            {courseTeachers.length > 0 ? (
              courseTeachers.map((teacher, index) => (
                <span key={teacher.id}>
                  {index > 0 && ", "}
                  <Link to={`/teachers#teacher-${teacher.id}`}>{teacher.full_name}</Link>
                </span>
              ))
            ) : (
              course.teacher
            )}
          </p>
        </div>
      </section>

      <nav className="chip-nav" aria-label="Пән бөлімдері">
        <a href="#schedule">Кесте</a>
        <a href="#about">Сипаттама</a>
        <a href="#materials">Материалдар</a>
        <a href="#photos">Фото</a>
        <a href="#tasks">Тапсырма</a>
        <Link to={`/notes?course=${course.slug}`}>Конспектілер</Link>
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
          <SectionTitle
            title="Пән туралы"
            action={
              isAdmin && (
                <button type="button" className="text-link" onClick={() => setEditingInfo(true)}>
                  <Pencil size={14} /> Өзгерту
                </button>
              )
            }
          />
          {course.description ? (
            <p className="prose">{course.description}</p>
          ) : (
            <EmptyState icon={BookOpen} title="Сипаттама қосылмаған" compact>
              Пән сипаттамасын әкімші қоса алады.
            </EmptyState>
          )}
        </section>

        {courseTeachers.length > 0 && (
          <section className="panel" id="teacher">
            <SectionTitle title="Оқытушы" action={<Link to="/teachers" className="text-link">Барлығы</Link>} />
            <div className="teacher-list teacher-list--compact">
              {courseTeachers.map((teacher) => (
                <TeacherCard
                  key={teacher.id}
                  teacher={teacher}
                  photoUrl={teacherData.photos[teacher.photo_path]}
                  courses={teacher.courseIds.map(courseById).filter(Boolean)}
                  compact
                />
              ))}
            </div>
          </section>
        )}

        <section className="panel" id="materials">
          <SectionTitle
            title="Оқу материалдары"
            meta={materials.items.length ? `${materials.items.length}` : undefined}
            action={
              <button type="button" className="text-link" onClick={() => setUploading(true)}>
                <Plus size={14} /> Қосу
              </button>
            }
          />
          {materials.status === "ready" && materials.items.length > 0 ? (
            <MaterialList items={materials.items} courseById={courseById} onDeleted={materials.reload} />
          ) : (
            <EmptyState icon={FileText} title={materials.status === "loading" ? "Жүктелуде…" : "Материал жоқ"} compact>
              {materials.status === "ready" ? "Лекция файлдары мен құжаттарды бөліс." : null}
            </EmptyState>
          )}
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

      {uploading && <MaterialUploadDialog defaultCourseId={course.id} onClose={() => setUploading(false)} onUploaded={materials.reload} />}
      {editingInfo && <CourseInfoForm course={course} onClose={() => setEditingInfo(false)} onSaved={reloadCatalog} />}
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
