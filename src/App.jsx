import { useState } from "react";
import {
  Home,
  CalendarDays,
  Camera,
  ClipboardList,
  GraduationCap,
  Search,
  Bell,
  UserRound,
  Atom,
  ChevronRight,
  BookOpen,
} from "lucide-react";
import "./App.css";

const courses = [
  { name: "Ғарыштық жүйелерді жобалау 1", teacher: "Калыбекова А.А.", color: "blue" },
  { name: "Серіктік байланыс жүйелері", teacher: "Минглибаев М.Д.", color: "cyan" },
  { name: "Аэродинамика", teacher: "Толеуханов А.Е.", color: "purple" },
  { name: "Бағдарламаланатын логикалық құрылғылар", teacher: "Калыбеков А.А.", color: "orange" },
  { name: "Ракетодинамика", teacher: "Байсбаев О.Б.", color: "pink" },
  { name: "Гироскоптың қолданбалы теориясы", teacher: "Байсбаев О.Б.", color: "green" },
];

const navigation = [
  { label: "Басты", icon: Home },
  { label: "Кесте", icon: CalendarDays },
  { label: "Фото", icon: Camera },
  { label: "Тапсырма", icon: ClipboardList },
  { label: "GPA", icon: GraduationCap },
];

export default function App() {
  const [active, setActive] = useState("Басты");
  const [search, setSearch] = useState("");

  const filteredCourses = courses.filter((course) =>
    course.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#home">
          <span className="brand-icon"><Atom size={25} /></span>
          <span>ULPA<small>STUDENT SPACE</small></span>
        </a>

        <div className="group-card">
          <span className="status-dot" />
          <div><strong>ҒТТ · 1 топ</strong><small>Студенттік кеңістік</small></div>
        </div>

        <p className="menu-caption">НЕГІЗГІ МӘЗІР</p>
        {navigation.map(({ label, icon: Icon }) => (
          <button
            className={`nav-item ${active === label ? "selected" : ""}`}
            key={label}
            onClick={() => setActive(label)}
          >
            <Icon size={19} /><span>{label}</span>
          </button>
        ))}

        <div className="sidebar-bottom">
          <div className="profile-mini">
            <div className="avatar">Қ</div>
            <div><strong>Қайнар</strong><small>01 · Әкімші</small></div>
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">ULPA <span>/</span> {active}</div>
          <div className="top-actions">
            <button className="icon-button" aria-label="Хабарландырулар"><Bell size={19} /></button>
            <button className="profile-button" onClick={() => setActive("Профиль")}>
              <span className="avatar">Қ</span><span>Профиль</span>
            </button>
          </div>
        </header>

        <section className="welcome">
          <div className="welcome-copy">
            <div className="eyebrow"><span /> СТУДЕНТТІК ПОРТАЛ</div>
            <h1>Сәлем, Қайнар<span>.</span></h1>
            <p>Бүгін жаңа білімге тағы бір қадам жаса.</p>
          </div>
          <div className="orbit-art">
            <div className="orbit-ring ring-one" />
            <div className="orbit-ring ring-two" />
            <div className="planet"><Atom size={43} /></div>
            <span className="orbit-star star-one">✦</span>
            <span className="orbit-star star-two">✧</span>
          </div>
          <div className="welcome-index">ULPA / 2026</div>
        </section>

        <section className="stats-grid">
          <article className="stat-card"><span>Пәндер</span><strong>06</strong><small>Оқу курстары</small></article>
          <article className="stat-card"><span>Топ</span><strong>01</strong><small>Бірінші топ</small></article>
          <article className="stat-card"><span>Семестр</span><strong>01</strong><small>Оқу кеңістігі</small></article>
        </section>

        <section className="courses-section">
          <div className="section-heading">
            <div><span className="section-kicker">СЕНІҢ БАҒДАРЛАМАҢ</span><h2>Менің пәндерім</h2></div>
            <span className="course-count">{filteredCourses.length} ПӘН</span>
          </div>

          <label className="search-box">
            <Search size={19} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Пәнді іздеу..."
            />
            <span>⌘ K</span>
          </label>

          <div className="course-grid">
            {filteredCourses.map((course, index) => (
              <article className="course-card" key={course.name}>
                <div className="course-top">
                  <div className={`course-symbol ${course.color}`}><BookOpen size={21} /></div>
                  <span className="course-number">0{index + 1}</span>
                </div>
                <h3>{course.name}</h3>
                <p>{course.teacher}</p>
                <button className="course-link" onClick={() => setActive(course.name)}>
                  Пәнді ашу <ChevronRight size={17} />
                </button>
              </article>
            ))}
            {filteredCourses.length === 0 && <p className="empty-state">Пән табылмады.</p>}
          </div>
        </section>

        <footer className="footer">
          <span><Atom size={15} /> ULPA</span>
          <span>Ғарыштық техника және технология</span>
          <span>2026</span>
        </footer>
      </main>

      <nav className="mobile-nav">
        {navigation.map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={active === label ? "mobile-active" : ""}
            onClick={() => setActive(label)}
          >
            <Icon size={20} /><span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
