import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  BookOpen,
  CalendarDays,
  Camera,
  ClipboardList,
  FileText,
  UserRound,
} from "lucide-react";
import EmptyState from "../components/ui/EmptyState.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import NotFoundPage from "./NotFoundPage.jsx";
import { courseAccent, findCourse } from "../data/courses.js";

export default function CourseDetailPage() {
  const { slug } = useParams();
  const course = findCourse(slug);

  if (!course) return <NotFoundPage />;

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
        <a href="#about">Сипаттама</a>
        <a href="#schedule">Кесте</a>
        <a href="#materials">Материалдар</a>
        <a href="#photos">Фото</a>
        <a href="#tasks">Тапсырма</a>
      </nav>

      <div className="detail-grid">
        <section className="panel" id="about">
          <SectionTitle title="Пән туралы" />
          <EmptyState icon={BookOpen} title="Сипаттама қосылмаған" compact>
            Пән сипаттамасын әкімші қоса алады.
          </EmptyState>
        </section>

        <section className="panel" id="schedule">
          <SectionTitle title="Кесте" />
          <EmptyState icon={CalendarDays} title="Сабақ уақыттары енгізілмеген" tag="Дерекқор күтілуде" compact />
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
          <EmptyState icon={Camera} title="Фото жоқ" compact />
        </section>

        <section className="panel detail-grid__wide" id="tasks">
          <SectionTitle
            title="Тапсырмалар"
            action={<Link to={`/tasks?course=${course.slug}`} className="text-link">Барлығы</Link>}
          />
          <EmptyState icon={ClipboardList} title="Тапсырма жоқ" compact>
            Оқытушы берген тапсырмалар осында шығады.
          </EmptyState>
        </section>
      </div>
    </div>
  );
}
