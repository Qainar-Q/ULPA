import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calculator, CalendarDays, Camera, ClipboardList, Lock, LogIn, Megaphone, ShieldCheck, Users } from "lucide-react";
import BrandMark from "../components/layout/BrandMark.jsx";
import { supabase } from "../lib/supabase.js";
import { calculateCourse, formatGpa, formatScore, toGpa } from "../lib/gpa.js";
import { PROGRAM_NAME } from "../config/app.js";

// Guest mode: shows WHAT the platform offers and how much exists (counts only).
// No real content is loaded here — the database would refuse it anyway.

const FEATURES = [
  { key: "weekly_sessions", icon: CalendarDays, title: "Сабақ кестесі", unit: "сабақ аптасына", text: "Екі топтың кестесі: ортақ дәрістер және әр топтың өз зертханалық жұмыстары." },
  { key: "photos", icon: Camera, title: "EASYФОТО", unit: "фото", text: "Тақта мен сабақ фотолары. Зертханалық фотолар тек өз тобына көрінеді." },
  { key: "assignments", icon: ClipboardList, title: "Тапсырмалар", unit: "тапсырма", text: "Мерзімдер, файлдар және әр студенттің жеке «орындалды» белгісі." },
  { key: "announcements", icon: Megaphone, title: "Хабарландырулар", unit: "хабарландыру", text: "Әкімші мен старосталардың маңызды хабарлары." },
];

function LockedPreview() {
  return (
    <div className="guest-preview" aria-hidden="true">
      <span />
      <span />
      <span />
      <div className="guest-preview__lock">
        <Lock size={16} /> Тек студенттерге
      </div>
    </div>
  );
}

function GpaDemo() {
  const [entry, setEntry] = useState({ ab1: "85", ab2: "90", exam: "88" });
  const result = calculateCourse(entry);
  const gpa = result.status === "complete" ? toGpa(result.final) : null;
  return (
    <div className="guest-gpa">
      <div className="guest-gpa__inputs">
        {[["ab1", "АБ1"], ["ab2", "АБ2"], ["exam", "Емтихан"]].map(([key, label]) => (
          <label key={key} className="score-field">
            <span>{label}</span>
            <input
              className="input input--score"
              type="number"
              inputMode="decimal"
              min="0"
              max="100"
              value={entry[key]}
              onChange={(event) => setEntry((current) => ({ ...current, [key]: event.target.value }))}
            />
          </label>
        ))}
      </div>
      <div className="guest-gpa__result">
        <strong>{gpa ? `${gpa.letter} · ${formatGpa(gpa.points)}` : "—"}</strong>
        <span>{result.status === "complete" ? `${formatScore(result.final)} / 100` : "0–100 аралығында енгіз"}</span>
      </div>
      <p className="muted small">((АБ1 + АБ2) / 2) × 0,60 + Емтихан × 0,40 · 4,0 шкаласы</p>
    </div>
  );
}

export default function GuestPage() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    supabase.rpc("public_overview").then(({ data }) => setStats(data?.[0] ?? null));
  }, []);

  const count = (key) => (stats ? Number(stats[key]) : "—");

  return (
    <div className="guest">
      <header className="guest__bar">
        <div className="brand">
          <BrandMark size={32} />
          <span className="brand__text">
            <strong>ULPA</strong>
            <small>Қонақ режимі</small>
          </span>
        </div>
        <Link to="/login" className="button button--primary button--sm">
          <LogIn size={15} /> Кіру
        </Link>
      </header>

      <main className="guest__main">
        <section className="hero">
          <div className="hero__grid" aria-hidden="true" />
          <div className="hero__content">
            <span className="eyebrow">{PROGRAM_NAME}</span>
            <h1 className="hero__title">ҒТТ тобының оқу платформасы</h1>
            <p className="hero__text">
              Бұл беттен платформада не бар екенін көре аласың. Нақты кесте, фотолар, тапсырмалар мен студенттердің деректері тек
              топ мүшелеріне ғана көрінеді.
            </p>
          </div>
        </section>

        <div className="guest-stats">
          <div><strong>{count("courses")}</strong><span>пән</span></div>
          <div><strong>{count("students")}</strong><span>студент</span></div>
          <div><strong>{count("active_students")}</strong><span>белсенді аккаунт</span></div>
        </div>

        <div className="guest-grid">
          {FEATURES.map(({ key, icon: Icon, title, unit, text }) => (
            <section key={key} className="panel guest-card">
              <div className="guest-card__head">
                <span className="guest-card__icon"><Icon size={18} /></span>
                <h2>{title}</h2>
                <span className="guest-card__count">
                  <b>{count(key)}</b> {unit}
                </span>
              </div>
              <p>{text}</p>
              <LockedPreview />
            </section>
          ))}

          <section className="panel guest-card guest-card--wide">
            <div className="guest-card__head">
              <span className="guest-card__icon"><Calculator size={18} /></span>
              <h2>GPA калькуляторы</h2>
              <span className="guest-card__count">байқап көр</span>
            </div>
            <p>Бұл құрал ешкімнің деректерін қолданбайды — бағаларды енгізіп, нәтижені бірден көр.</p>
            <GpaDemo />
          </section>
        </div>

        <section className="panel guest-note">
          <ShieldCheck size={20} aria-hidden="true" />
          <div>
            <strong>Деректер қорғалған</strong>
            <p>Әр студент тек өзіне рұқсат етілген мәліметтерді көреді. Аккаунтты тек әкімші берген бір реттік кодпен белсендіруге болады.</p>
          </div>
        </section>

        <p className="guest__foot">
          <Users size={14} aria-hidden="true" /> ҒТТ студентісің бе? <Link to="/login" className="text-link">Кіру</Link> немесе{" "}
          <Link to="/activate" className="text-link">аккаунтты белсендіру</Link>
        </p>
      </main>
    </div>
  );
}
