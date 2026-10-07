import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Compass, KeyRound, LogOut, ShieldCheck } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import PasskeySettings from "../components/PasskeySettings.jsx";
import InstallApp from "../components/InstallApp.jsx";
import ThemeSwitch from "../components/ThemeSwitch.jsx";
import NotificationSettings from "../components/NotificationSettings.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { PROGRAM_NAME } from "../config/app.js";

const MONTHS_KK = [
  "қаңтар", "ақпан", "наурыз", "сәуір", "мамыр", "маусым",
  "шілде", "тамыз", "қыркүйек", "қазан", "қараша", "желтоқсан",
];

export default function ProfilePage() {
  const { student, isAdmin, signOut } = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();

  function replayTour() {
    navigate("/");
    setTimeout(() => window.dispatchEvent(new Event("ulpa:tour")), 400);
  }

  if (!student) return null;

  const birthday =
    student.birth_month && student.birth_day
      ? `${student.birth_day} ${MONTHS_KK[student.birth_month - 1]}`
      : "Енгізілмеген";

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
  }

  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Жеке ақпарат" title="Профиль" />

      <section className="profile-card">
        <span className="avatar avatar--lg" aria-hidden="true">
          {student.full_name.slice(0, 1)}
        </span>
        <div>
          <h2 className="profile-card__name">{student.full_name}</h2>
          <p className="profile-card__program">{PROGRAM_NAME}</p>
          <div className="profile-card__tags">
            <span className="tag">{student.group_no}-топ</span>
            {isAdmin && <span className="tag tag--admin">Әкімші</span>}
            {student.is_monitor && <span className="tag tag--admin">Староста</span>}
          </div>
        </div>
      </section>

      <dl className="info-list panel">
        <div>
          <dt>Студент коды</dt>
          <dd>{student.code}</dd>
        </div>
        <div>
          <dt>Топ</dt>
          <dd>{student.group_no}-топ</dd>
        </div>
        <div>
          <dt>Туған күн</dt>
          <dd>{birthday}</dd>
        </div>
      </dl>
      <p className="muted small">
        Аты, тобы және туған күнін тек әкімші өзгерте алады. Туған күнің басқа студенттерге көрінбейді.
        Әкімші сенің ULPA-ға соңғы кірген уақытыңды және қанша күн қолданғаныңды көреді (қай бетті ашқаның сақталмайды).
      </p>

      <section className="panel">
        <h2 className="panel-title">Хабарландырулар</h2>
        <NotificationSettings />
      </section>

      <section className="panel">
        <h2 className="panel-title">Көрініс</h2>
        <ThemeSwitch />
      </section>

      <section className="panel">
        <h2 className="panel-title">Face ID / саусақ ізі</h2>
        <PasskeySettings />
      </section>

      <section className="panel">
        <h2 className="panel-title">Телефонға орнату</h2>
        <InstallApp />
      </section>

      <div className="action-list panel">
        {isAdmin && (
          <Link to="/admin" className="action-list__item">
            <ShieldCheck size={18} />
            <span>Әкімші панелі</span>
            <ChevronRight size={16} />
          </Link>
        )}
        <button type="button" className="action-list__item" onClick={replayTour}>
          <Compass size={18} />
          <span>Нұсқаулықты қайта көру</span>
          <ChevronRight size={16} />
        </button>
        <div className="action-list__item action-list__item--static">
          <KeyRound size={18} />
          <span>Құпия сөзді өзгерту үшін әкімшіден қалпына келтіру кодын сұра.</span>
        </div>
        <button type="button" className="action-list__item action-list__item--danger" onClick={handleSignOut} disabled={signingOut}>
          <LogOut size={18} />
          <span>{signingOut ? "Шығуда…" : "Шығу"}</span>
        </button>
      </div>
    </div>
  );
}
