import { useState } from "react";
import { Link } from "react-router-dom";
import { Eye, FlaskConical, Fingerprint, LogIn } from "lucide-react";
import AuthLayout from "../components/layout/AuthLayout.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import StudentCodeField from "../components/StudentCodeField.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { authErrorMessage } from "../features/auth/errors.js";

export default function LoginPage() {
  const { signIn, signInWithPasskey, notice, clearNotice } = useAuth();
  const passkeySupported = typeof window !== "undefined" && Boolean(window.PublicKeyCredential);

  async function handlePasskey() {
    setBusy(true);
    setError(null);
    clearNotice();
    const result = await signInWithPasskey();
    if (result.error) {
      setError(result.error);
      setBusy(false);
    }
  }
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    clearNotice();
    const result = await signIn(code, password);
    // On success the router redirects automatically (RedirectIfSignedIn).
    if (result.error) {
      setError(result.error);
      setBusy(false);
    }
  }

  const shownError = error ?? notice;

  return (
    <AuthLayout
      title="Кіру"
      subtitle="Студент кодың мен құпия сөзіңді енгіз."
      footer={
        <>
          Алғаш кіресің бе немесе құпия сөзді ұмыттың ба?{" "}
          <Link to={code ? `/activate?code=${encodeURIComponent(code)}` : "/activate"} className="text-link">
            Белсендіру коды арқылы
          </Link>
          <Link to="/guest" className="guest-link">
            <Eye size={15} aria-hidden="true" /> Қонақ ретінде қарау
          </Link>
          <a href="/demo" className="guest-link">
            <FlaskConical size={15} aria-hidden="true" /> Демо нұсқасын байқап көру
          </a>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <StudentCodeField
          id="login-code"
          value={code}
          onChange={setCode}
          invalid={error === "code_format"}
        />

        <PasswordField
          id="login-password"
          label="Құпия сөз"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          invalid={error === "invalid_credentials"}
        />

        {shownError && (
          <p className="form__error" role="alert">
            {authErrorMessage(shownError)}
          </p>
        )}

        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? "Тексерілуде…" : <><LogIn size={17} /> Кіру</>}
        </button>

        {passkeySupported && (
          <>
            <div className="divider"><span>немесе</span></div>
            <button type="button" className="button button--ghost button--block" onClick={handlePasskey} disabled={busy}>
              <Fingerprint size={18} /> Face ID / саусақ ізімен кіру
            </button>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
