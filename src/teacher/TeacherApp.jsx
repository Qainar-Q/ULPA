import { useEffect, useState } from "react";
import { Link, NavLink, Navigate, Route, Routes } from "react-router-dom";
import { useScrollMemory } from "../lib/useScrollMemory.js";
import { House, LogOut, Megaphone, Send, UserRound } from "lucide-react";
import BrandMark from "../components/layout/BrandMark.jsx";
import DemoBanner from "../components/layout/DemoBanner.jsx";
import DemoStartPage from "../pages/DemoStartPage.jsx";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import PasskeySettings from "../components/PasskeySettings.jsx";
import ThemeSwitch from "../components/ThemeSwitch.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";
import { greetingFor, formatLongDate } from "../lib/time.js";
import { formatDateTime } from "../lib/due.js";
import LessonsBoard from "./LessonsBoard.jsx";
import { CheckinRoute, CourseRoute, RollRoute } from "./LessonRoutes.jsx";
import QrTestView from "./QrTestView.jsx";
import { announce, myAnnouncements } from "./teacherApi.js";

function TeacherHome() {
  const { teacher } = useAuth();
  const now = new Date();
  return (
    <div className="stack-lg">
      <section className="hero t-hero">
        <div className="hero__grid" aria-hidden="true" />
        <div className="hero__content">
          <span className="eyebrow">{formatLongDate(now)}</span>
          <h1 className="hero__title">
            {greetingFor(now)}, {teacher.full_name}!
          </h1>
          <p className="hero__text">Оқытушы кабинеті · {teacher.courses.map((course) => course.name).join(", ")}</p>
          <div className="hero__actions">
            <Link to="/announce" className="button button--ghost">
              <Megaphone size={16} /> Топқа хабарландыру
            </Link>
          </div>
        </div>
      </section>
      <LessonsBoard />
    </div>
  );
}

function AnnouncePage() {
  const [values, setValues] = useState({ title: "", body: "", group: "both" });
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = () => myAnnouncements().then(setItems).catch(() => {});
  useEffect(() => {
    load();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (!values.title.trim()) return setMessage({ error: true, text: "Тақырыбын жазыңыз." });
    setBusy(true);
    setMessage(null);
    try {
      await announce({ title: values.title.trim(), body: values.body.trim(), groupNo: values.group === "both" ? null : Number(values.group) });
      setValues({ title: "", body: "", group: values.group });
      setMessage({ error: false, text: "Жіберілді ✓ Студенттерге хабарлама барады." });
      load();
    } catch (sendError) {
      setMessage({ error: true, text: sendError?.message?.includes("rate_limited") ? "Бүгінге лимит бітті (10 хабарландыру)." : "Жіберілмеді. Қайта көріңіз." });
    }
    setBusy(false);
  }

  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Оқытушы" title="Топқа хабарландыру" description="Мысалы: сабақ ауысты, аудитория өзгерді, келесі сабаққа не дайындау керек. Студенттердің телефонына хабарлама барады." />
      <form className="panel stack" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="ta-title">Тақырып</label>
          <input id="ta-title" className="input" maxLength={120} value={values.title} onChange={(event) => setValues({ ...values, title: event.target.value })} placeholder="Ертеңгі сабақ 208 аудиторияда" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="ta-body">Мәтін <span className="muted">(міндетті емес)</span></label>
          <textarea id="ta-body" className="input input--textarea" rows={4} maxLength={3000} value={values.body} onChange={(event) => setValues({ ...values, body: event.target.value })} />
        </div>
        <div className="field">
          <span className="field__label">Кімге</span>
          <Segmented
            label="Кімге"
            options={[
              { id: "both", label: "Барлығына" },
              { id: "1", label: "1-топ" },
              { id: "2", label: "2-топ" },
            ]}
            value={values.group}
            onChange={(group) => setValues({ ...values, group })}
          />
        </div>
        {message && <p className={message.error ? "form__error" : "form__ok"}>{message.text}</p>}
        <button type="submit" className="button button--primary" disabled={busy}>
          <Send size={16} /> {busy ? "Жіберілуде…" : "Жіберу"}
        </button>
      </form>
      {items.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Жіберілгендер</h2>
          <ul className="t-sent">
            {items.map((item) => (
              <li key={item.id}>
                <strong>{item.title}</strong>
                {item.body && <p>{item.body}</p>}
                <span className="muted small">
                  {item.group_no ? `${item.group_no}-топ` : "Барлығына"} · {formatDateTime(item.created_at)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function TeacherProfile() {
  const { teacher, signOut } = useAuth();
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Профиль" title={teacher.full_name} description={`Кіру коды: ${teacher.login_code}`} />
      <section className="panel">
        <h2 className="panel-title">Пәндеріңіз</h2>
        <ul className="t-sent">
          {teacher.courses.map((course) => (
            <li key={course.id}>
              <strong>{course.name}</strong> <span className="muted small">{course.code}</span>
            </li>
          ))}
        </ul>
      </section>
      <section className="panel">
        <h2 className="panel-title">Көрініс</h2>
        <ThemeSwitch />
      </section>
      <section className="panel">
        <h2 className="panel-title">Face ID / саусақ ізі</h2>
        <PasskeySettings />
      </section>
      <p className="muted small">
        Оқытушы аккаунты тек сіздің пәндеріңіздің кестесін, студенттер тізімін (аты, тобы) және өзіңіз қойған қатысу белгілерін көреді. Студенттердің жеке деректері
        (бағалары, фотолары, хаттары) сізге көрінбейді.
      </p>
      <button type="button" className="button button--ghost" onClick={signOut}>
        <LogOut size={16} /> Шығу
      </button>
    </div>
  );
}

const NAV = [
  { to: "/", label: "Басты", icon: House, end: true },
  { to: "/announce", label: "Хабарландыру", icon: Megaphone },
  { to: "/profile", label: "Профиль", icon: UserRound },
];

/** Separate, simple app for teacher accounts (no class pages at all). */
export default function TeacherApp() {
  const { teacher } = useAuth();

  // Activity for the admin dashboard, about once a minute while visible.
  useEffect(() => {
    const touch = () => document.visibilityState === "visible" && supabase.rpc("touch_presence").then(() => {}, () => {});
    touch();
    const timer = setInterval(touch, 60 * 1000);
    document.addEventListener("visibilitychange", touch);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", touch);
    };
  }, []);

  useScrollMemory();

  return (
    <div className="t-app">
      <header className="t-bar">
        <Link to="/" className="brand">
          <BrandMark size={34} />
          <span className="brand__text">
            <strong>ULPA</strong>
            <small>Оқытушы</small>
          </span>
        </Link>
        <nav className="t-bar__nav" aria-label="Мәзір">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={to} to={to} end={end} className="t-bar__link">
              <Icon size={18} aria-hidden="true" />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <span className="avatar t-bar__me" title={teacher.full_name}>{teacher.full_name.slice(0, 1)}</span>
      </header>
      <main className="t-main">
        <DemoBanner />
        <Routes>
          <Route path="demo" element={<DemoStartPage />} />
          <Route index element={<TeacherHome />} />
          <Route path="lesson/:entryId/:date" element={<RollRoute />} />
          <Route path="lesson/:entryId/:date/qr" element={<CheckinRoute />} />
          <Route path="course/:courseId" element={<CourseRoute />} />
          <Route path="qr-test" element={<QrTestView />} />
          <Route path="announce" element={<AnnouncePage />} />
          <Route path="profile" element={<TeacherProfile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
