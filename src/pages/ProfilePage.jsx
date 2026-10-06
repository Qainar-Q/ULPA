import { KeyRound, ShieldCheck, UserRound } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";

export default function ProfilePage() {
  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Жеке ақпарат" title="Профиль" />

      <EmptyState icon={UserRound} title="Профиль кіргеннен кейін көрінеді" tag="Кіру жүйесі күтілуде">
        Студент коды (01–18), аты, тобы және баптаулар нақты аккаунтқа кіргенде ғана көрсетіледі.
      </EmptyState>

      <div className="feature-list">
        <div className="feature-list__item">
          <KeyRound size={18} />
          <div>
            <strong>Кодпен кіру</strong>
            <p>Әр студенттің жеке коды мен өзі орнатқан құпия сөзі болады.</p>
          </div>
        </div>
        <div className="feature-list__item">
          <ShieldCheck size={18} />
          <div>
            <strong>Қорғалған деректер</strong>
            <p>Туған күн және жеке ақпарат тек өзіңе және әкімшіге көрінеді.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
