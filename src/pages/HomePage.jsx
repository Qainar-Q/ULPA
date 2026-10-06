import { Link } from "react-router-dom";
import { CalendarDays, ClipboardList, Camera, Calculator, ChevronRight } from "lucide-react";
import CourseCard from "../components/CourseCard.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import SectionTitle from "../components/ui/SectionTitle.jsx";
import { COURSES } from "../data/courses.js";
import { PROGRAM_NAME, CLASS_LABEL } from "../config/app.js";
import { formatLongDate, greetingFor } from "../lib/time.js";

export default function HomePage() {
  const now = new Date();

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
          <h1 className="hero__title">{greetingFor(now)}!</h1>
          <p className="hero__text">
            {PROGRAM_NAME} · {CLASS_LABEL}. Пәндер, кесте, тапсырмалар мен оқу фотолары бір жерде.
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
          <EmptyState icon={CalendarDays} title="Кесте әлі енгізілмеген" tag="Дерекқор күтілуде" compact>
            Нақты сабақ уақыттары әкімші енгізгеннен кейін осында көрінеді.
          </EmptyState>
        </section>

        <section className="panel">
          <SectionTitle
            title="Жақын тапсырмалар"
            action={<Link to="/tasks" className="text-link">Барлығы <ChevronRight size={14} /></Link>}
          />
          <EmptyState icon={ClipboardList} title="Тапсырма жоқ" tag="Дерекқор күтілуде" compact>
            Мерзімі жақындаған тапсырмалар осында шығады.
          </EmptyState>
        </section>
      </div>

      <section>
        <SectionTitle title="Менің пәндерім" meta={`${COURSES.length} пән`} />
        <div className="course-grid">
          {COURSES.map((course) => (
            <CourseCard key={course.slug} course={course} />
          ))}
        </div>
      </section>

      <section className="panel">
        <SectionTitle
          title="Соңғы фотолар"
          action={<Link to="/photos" className="text-link">EASYФОТО <ChevronRight size={14} /></Link>}
        />
        <EmptyState icon={Camera} title="Әзірге фото жүктелмеген" tag="Сақтау орны күтілуде" compact>
          Дәріс және зертханалық жұмыс фотолары осында көрінеді.
        </EmptyState>
      </section>
    </div>
  );
}
