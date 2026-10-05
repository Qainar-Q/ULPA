```jsx
import { useState } from "react";
import {
  Home,
  CalendarDays,
  Camera,
  ClipboardList,
  Calculator,
  UserRound,
  Rocket,
  BookOpen,
  ChevronRight,
  GraduationCap,
  Plus,
  Trash2,
  CheckCircle2,
  Clock3,
  Menu,
  X,
  LogOut,
} from "lucide-react";
import "./App.css";

const courses = [
  {
    id: 1,
    name: "Ғарыштық жүйелерді жобалау 1",
    teacher: "Калыбекова А.А.",
    short: "ҒЖЖ",
    color: "#70a7ff",
  },
  {
    id: 2,
    name: "Серіктік байланыс жүйелері",
    teacher: "Минглибаев М.Д.",
    short: "СБЖ",
    color: "#55d6c2",
  },
  {
    id: 3,
    name: "Аэродинамика",
    teacher: "Толеуханов А.Е.",
    short: "АД",
    color: "#ffb86b",
  },
  {
    id: 4,
    name: "Бағдарламаланатын логикалық құрылғылар",
    teacher: "Калыбеков А.А.",
    short: "БЛҚ",
    color: "#b49aff",
  },
  {
    id: 5,
    name: "Ракетодинамика",
    teacher: "Байсбаев О.Б.",
    short: "РД",
    color: "#ff8295",
  },
  {
    id: 6,
    name: "Гироскоптың қолданбалы теориясы",
    teacher: "Байсбаев О.Б.",
    short: "ГҚТ",
    color: "#8fbdff",
  },
];

const navigation = [
  { id: "home", label: "Басты", icon: Home },
  { id: "schedule", label: "Кесте", icon: CalendarDays },
  { id: "photos", label: "Фото", icon: Camera },
  { id: "tasks", label: "Тапсырма", icon: ClipboardList },
  { id: "gpa", label: "GPA", icon: Calculator },
];

const pageTitles = {
  home: "Басты бет",
  schedule: "Сабақ кестесі",
  photos: "EASYФОТО",
  tasks: "Тапсырмалар",
  gpa: "GPA калькуляторы",
  profile: "Профиль",
  course: "Пән туралы",
};

function App() {
  const [activePage, setActivePage] = useState("home");
  const [selectedCourse, setSelectedCourse] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [group, setGroup] = useState("1-топ");
  const [tasks, setTasks] = useState([]);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskCourse, setTaskCourse] = useState("5");
  const [taskDate, setTaskDate] = useState("");
  const [doneTasks, setDoneTasks] = useState([]);
  const [ab1, setAb1] = useState("");
  const [ab2, setAb2] = useState("");
  const [exam, setExam] = useState("");
  const [photoType, setPhotoType] = useState("Дәріс");
  const [photoCourse, setPhotoCourse] = useState("5");
  const [notice, setNotice] = useState("");

  const dayToDay =
    ab1 !== "" && ab2 !== ""
      ? ((Number(ab1) + Number(ab2)) / 2) * 0.6
      : null;

  const finalScore =
    dayToDay !== null && exam !== ""
      ? dayToDay + Number(exam) * 0.4
      : null;

  function navigate(page) {
    setActivePage(page);
    setSelectedCourse(null);
    setMobileMenuOpen(false);
    setNotice("");
  }

  function openCourse(course) {
    setSelectedCourse(course);
    setActivePage("course");
    setMobileMenuOpen(false);
  }

  function addTask(event) {
    event.preventDefault();

    if (!taskTitle.trim()) return;

    setTasks((previous) => [
      ...previous,
      {
        id: Date.now(),
        title: taskTitle.trim(),
        courseId: taskCourse,
        date: taskDate,
      },
    ]);

    setTaskTitle("");
    setTaskDate("");
    setNotice("Тапсырма қосылды.");
  }

  function toggleTask(id) {
    setDoneTasks((previous) =>
      previous.includes(id)
        ? previous.filter((item) => item !== id)
        : [...previous, id]
    );
  }

  function deleteTask(id) {
    setTasks((previous) => previous.filter((task) => task.id !== id));
    setDoneTasks((previous) => previous.filter((item) => item !== id));
  }

  function renderHome() {
    return (
      <>
        <section className="welcome-card">
          <div className="welcome-content">
            <span className="eyebrow">ҒАРЫШТЫҚ ТЕХНИКА ЖӘНЕ ТЕХНОЛОГИЯ</span>
            <h1>
              Оқу кеңістігіңе
              <br />
              қош келдің, Қайнар.
            </h1>
            <p>
              Барлық пәндерің, тапсырмаларың және оқу материалдарың бір жерде.
            </p>
            <button
              className="primary-button"
              onClick={() => navigate("tasks")}
            >
              Тапсырмаларды қарау <ChevronRight size={17} />
            </button>
          </div>
          <div className="welcome-illustration">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="planet">
              <Rocket size={46} strokeWidth={1.4} />
            </div>
            <span className="star star-one">✦</span>
            <span className="star star-two">✧</span>
            <span className="star star-three">·</span>
          </div>
        </section>

        <section className="stats-grid">
          <div className="stat-card">
            <span className="stat-icon blue">
              <BookOpen size={19} />
            </span>
            <div>
              <strong>{courses.length}</strong>
              <span>Оқу пәні</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon purple">
              <ClipboardList size={19} />
            </span>
            <div>
              <strong>{tasks.length - doneTasks.length}</strong>
              <span>Белсенді тапсырма</span>
            </div>
          </div>
          <div className="stat-card">
            <span className="stat-icon green">
              <CheckCircle2 size={19} />
            </span>
            <div>
              <strong>{doneTasks.length}</strong>
              <span>Орындалғаны</span>
            </div>
          </div>
        </section>

        <section className="section-block">
          <div className="section-heading">
            <div>
              <span className="eyebrow">СЕНІҢ БАҒДАРЛАМАҢ</span>
              <h2>Менің пәндерім</h2>
            </div>
            <span className="muted-text">{courses.length} пән</span>
          </div>

          <div className="course-grid">
            {courses.map((course) => (
              <button
                className="course-card"
                key={course.id}
                onClick={() => openCourse(course)}
              >
                <div className="course-card-top">
                  <span
                    className="course-symbol"
                    style={{
                      color: course.color,
                      background: `${course.color}18`,
                    }}
                  >
                    {course.short}
                  </span>
                  <ChevronRight size={18} className="course-arrow" />
                </div>
                <h3>{course.name}</h3>
                <p>{course.teacher}</p>
                <div className="course-card-bottom">
                  <span>Оқу материалдары</span>
                  <BookOpen size={15} />
                </div>
              </button>
            ))}
          </div>
        </section>
      </>
    );
  }

  function renderSchedule() {
    return (
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">АПТАЛЫҚ ЖОСПАР</span>
            <h2>Сабақ кестесі</h2>
          </div>
        </div>

        <div className="filter-row">
          <button
            className={`filter-button ${group === "1-топ" ? "selected" : ""}`}
            onClick={() => setGroup("1-топ")}
          >
            1-топ
          </button>
          <button
            className={`filter-button ${group === "2-топ" ? "selected" : ""}`}
            onClick={() => setGroup("2-топ")}
          >
            2-топ
          </button>
        </div>

        <div className="empty-state">
          <CalendarDays size={34} />
          <h3>{group} сабақ кестесі</h3>
          <p>
            Нақты сабақ күндері мен уақыттары енгізілгеннен кейін осы жерде
            көрсетіледі.
          </p>
          <span className="status-label">Кесте деректері әлі енгізілмеген</span>
        </div>
      </section>
    );
  }

  function renderPhotos() {
    return (
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ОҚУ МАТЕРИАЛДАРЫ</span>
            <h2>EASYФОТО</h2>
          </div>
        </div>

        <div className="filter-row">
          {["Дәріс", "Зертханалық жұмыс"].map((type) => (
            <button
              key={type}
              className={`filter-button ${photoType === type ? "selected" : ""}`}
              onClick={() => setPhotoType(type)}
            >
              {type}
            </button>
          ))}
        </div>

        <label className="field-label" htmlFor="photo-course">
          Пәнді таңда
        </label>
        <select
          id="photo-course"
          className="form-control"
          value={photoCourse}
          onChange={(event) => setPhotoCourse(event.target.value)}
        >
          {courses.map((course) => (
            <option key={course.id} value={String(course.id)}>
              {course.name}
            </option>
          ))}
        </select>

        <div className="empty-state">
          <Camera size={34} />
          <h3>{photoType}</h3>
          <p>
            {courses.find((course) => String(course.id) === photoCourse)?.name}
          </p>
          <p>
            {photoType === "Дәріс"
              ? "Дәріс материалдарына арналған ортақ бөлім."
              : `${group} тобының зертханалық материалдарына арналған бөлім.`}
          </p>
          <span className="status-label">Фото сақтау әзірге қосылмаған</span>
        </div>
      </section>
    );
  }

  function renderTasks() {
    return (
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ОҚУ ЖОСПАРЫ</span>
            <h2>Тапсырмалар</h2>
          </div>
        </div>

        <form className="task-form" onSubmit={addTask}>
          <label className="field-label" htmlFor="task-title">
            Тапсырма атауы
          </label>
          <input
            id="task-title"
            className="form-control"
            placeholder="Мысалы: 7-нұсқа есебі"
            value={taskTitle}
            onChange={(event) => setTaskTitle(event.target.value)}
            required
          />

          <label className="field-label" htmlFor="task-course">
            Пән
          </label>
          <select
            id="task-course"
            className="form-control"
            value={taskCourse}
            onChange={(event) => setTaskCourse(event.target.value)}
          >
            {courses.map((course) => (
              <option key={course.id} value={String(course.id)}>
                {course.name}
              </option>
            ))}
          </select>

          <label className="field-label" htmlFor="task-date">
            Тапсыру мерзімі
          </label>
          <input
            id="task-date"
            type="date"
            className="form-control"
            value={taskDate}
            onChange={(event) => setTaskDate(event.target.value)}
          />

          <button className="primary-button" type="submit">
            <Plus size={17} /> Тапсырма қосу
          </button>
          {notice && <p className="success-message">{notice}</p>}
        </form>

        <div className="task-list">
          {tasks.length === 0 ? (
            <div className="empty-state compact">
              <ClipboardList size={30} />
              <h3>Әзірге тапсырма жоқ</h3>
              <p>Жоғарыдағы форма арқылы өз тапсырмаңды қос.</p>
            </div>
          ) : (
            tasks.map((task) => {
              const course = courses.find(
                (item) => String(item.id) === task.courseId
              );
              const isDone = doneTasks.includes(task.id);

              return (
                <div className="task-item" key={task.id}>
                  <button
                    className={`task-check ${isDone ? "checked" : ""}`}
                    onClick={() => toggleTask(task.id)}
                    aria-label="Тапсырма күйін өзгерту"
                  >
                    {isDone && <CheckCircle2 size={18} />}
                  </button>
                  <div className="task-info">
                    <strong className={isDone ? "completed-text" : ""}>
                      {task.title}
                    </strong>
                    <span>{course?.name}</span>
                    {task.date && (
                      <small>
                        <Clock3 size={13} /> {task.date}
                      </small>
                    )}
                  </div>
                  <button
                    className="icon-button danger"
                    onClick={() => deleteTask(task.id)}
                    aria-label="Тапсырманы жою"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </section>
    );
  }

  function renderGpa() {
    return (
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">БАҒАЛАРДЫ ЕСЕПТЕУ</span>
            <h2>GPA калькуляторы</h2>
          </div>
        </div>

        <div className="gpa-layout">
          <div className="gpa-form">
            <p className="muted-text">
              Әр көрсеткішті 0 мен 100 аралығында енгіз.
            </p>

            <label className="field-label" htmlFor="ab1">
              АБ1 бағасы
            </label>
            <input
              id="ab1"
              type="number"
              min="0"
              max="100"
              className="form-control"
              placeholder="0–100"
              value={ab1}
              onChange={(event) => setAb1(event.target.value)}
            />

            <label className="field-label" htmlFor="ab2">
              АБ2 бағасы
            </label>
            <input
              id="ab2"
              type="number"
              min="0"
              max="100"
              className="form-control"
              placeholder="0–100"
              value={ab2}
              onChange={(event) => setAb2(event.target.value)}
            />

            <label className="field-label" htmlFor="exam">
              Емтихан бағасы
            </label>
            <input
              id="exam"
              type="number"
              min="0"
              max="100"
              className="form-control"
              placeholder="0–100"
              value={exam}
              onChange={(event) => setExam(event.target.value)}
            />
          </div>

          <div className="gpa-result">
            <span className="eyebrow">ҚОРЫТЫНДЫ НӘТИЖЕ</span>
            <div className="gpa-number">
              {finalScore === null ? "—" : finalScore.toFixed(2)}
            </div>
            <span className="muted-text">100 баллдық жүйе</span>
            <div className="result-divider" />
            <div className="result-line">
              <span>Күнделікті бағалар (60%)</span>
              <strong>
                {dayToDay === null ? "—" : dayToDay.toFixed(2)}
              </strong>
            </div>
            <div className="result-line">
              <span>Емтихан (40%)</span>
              <strong>
                {exam === "" || Number(exam) < 0 || Number(exam) > 100
                  ? "—"
                  : (Number(exam) * 0.4).toFixed(2)}
              </strong>
            </div>
            {finalScore !== null && (
              <div className="result-status">
                {finalScore > 90
                  ? "Президенттік шәкіртақы деңгейі"
                  : finalScore > 70
                    ? "Шәкіртақы деңгейі"
                    : finalScore >= 50
                      ? "Өту деңгейі"
                      : "Өту балынан төмен"}
              </div>
            )}
            <p className="formula-note">
              ((АБ1 + АБ2) / 2) × 0,60 + Емтихан × 0,40
            </p>
          </div>
        </div>
      </section>
    );
  }

  function renderProfile() {
    return (
      <section className="section-block">
        <div className="section-heading">
          <div>
            <span className="eyebrow">ЖЕКЕ АҚПАРАТ</span>
            <h2>Профиль</h2>
          </div>
        </div>

        <div className="profile-card">
          <div className="profile-avatar">Қ</div>
          <div>
            <h3>Қайнар</h3>
            <p>Ғарыштық техника және технология</p>
            <span className="status-label">Студент · 1-топ</span>
          </div>
        </div>

        <div className="info-row">
          <span>Пайдаланушы коды</span>
          <strong>01</strong>
        </div>
        <div className="info-row">
          <span>Платформа</span>
          <strong>ULPA</strong>
        </div>
        <p className="muted-text">
          Бұл әзірге демонстрациялық профиль. Нақты аккаунтқа кіру және
          мәліметтерді серверде сақтау кейін қосылады.
        </p>
      </section>
    );
  }

  function renderCourse() {
    if (!selectedCourse) return renderHome();

    return (
      <section className="section-block">
        <button className="back-button" onClick={() => navigate("home")}>
          ← Пәндерге оралу
        </button>
        <div className="course-detail-card">
          <span
            className="course-symbol large"
            style={{
              color: selectedCourse.color,
              background: `${selectedCourse.color}18`,
            }}
          >
            {selectedCourse.short}
          </span>
          <h2>{selectedCourse.name}</h2>
          <p>{selectedCourse.teacher}</p>
          <div className="result-divider" />
          <div className="detail-row">
            <BookOpen size={18} />
            <div>
              <strong>Оқу материалдары</strong>
              <p>Бұл бөлімге пәннің материалдарын кейін қосамыз.</p>
            </div>
          </div>
          <div className="detail-row">
            <Camera size={18} />
            <div>
              <strong>EASYФОТО</strong>
              <p>Дәріс және зертханалық жұмыс фотолары.</p>
            </div>
          </div>
          <button className="primary-button" onClick={() => navigate("photos")}>
            Фото бөліміне өту <ChevronRight size={17} />
          </button>
        </div>
      </section>
    );
  }

  function renderPage() {
    switch (activePage) {
      case "schedule":
        return renderSchedule();
      case "photos":
        return renderPhotos();
      case "tasks":
        return renderTasks();
      case "gpa":
        return renderGpa();
      case "profile":
        return renderProfile();
      case "course":
        return renderCourse();
      default:
        return renderHome();
    }
  }

  return (
    <div className="app-shell">
      {mobileMenuOpen && (
        <button
          className="mobile-overlay"
          aria-label="Мәзірді жабу"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={`sidebar ${mobileMenuOpen ? "sidebar-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">
            <Rocket size={23} />
          </div>
          <div>
            <strong>ULPA</strong>
            <span>STUDENT SPACE</span>
          </div>
          <button
            className="sidebar-close icon-button"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Мәзірді жабу"
          >
            <X size={19} />
          </button>
        </div>

        <div className="sidebar-label">МӘЗІР</div>
        <nav className="side-nav">
          {navigation.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.id}
                className={`nav-item ${activePage === item.id ? "active" : ""}`}
                onClick={() => navigate(item.id)}
              >
                <Icon size={19} />
                <span>{item.label}</span>
                {item.id === "tasks" && tasks.length > 0 && (
                  <span className="nav-count">{tasks.length}</span>
                )}
              </button>
            );
          })}
        </nav>

        <div className="sidebar-bottom">
          <div className="sidebar-note">
            <GraduationCap size={20} />
            <div>
              <strong>ҒТТ · 1 топ</strong>
              <span>Space Engineering</span>
            </div>
          </div>
          <button
            className={`nav-item ${activePage === "profile" ? "active" : ""}`}
            onClick={() => navigate("profile")}
          >
            <UserRound size={19} />
            <span>Профиль</span>
          </button>
          <div className="sidebar-version">ULPA · 1.0</div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="menu-toggle icon-button"
              onClick={() => setMobileMenuOpen(true)}
              aria-label="Мәзірді ашу"
            >
              <Menu size={21} />
            </button>
            <div>
              <span className="breadcrumb">ULPA / ОҚУ ПОРТАЛЫ</span>
              <h1>{pageTitles[activePage] || "ULPA"}</h1>
            </div>
          </div>
          <button
            className="user-chip"
            onClick={() => navigate("profile")}
            title="Профильді ашу"
          >
            <span className="user-avatar">Қ</span>
            <span className="user-chip-name">Қайнар</span>
            <ChevronRight size={16} />
          </button>
        </header>

        <div className="page-content">{renderPage()}</div>

        <footer className="app-footer">
          <span>ULPA · Ғарыштық техника және технология</span>
          <span>Оқу кеңістігі</span>
        </footer>
      </main>

      <nav className="mobile-bottom-nav">
        {navigation.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={activePage === item.id ? "active" : ""}
              onClick={() => navigate(item.id)}
            >
              <Icon size={20} />
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

export default App;
```
