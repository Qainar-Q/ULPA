import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { KeyRound } from "lucide-react";
import AuthLayout from "../components/layout/AuthLayout.jsx";
import PasswordField from "../components/ui/PasswordField.jsx";
import StudentCodeField from "../components/StudentCodeField.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { authErrorMessage } from "../features/auth/errors.js";

// Format "k7qm4xtp" → "K7QM-4XTP" while typing.
function formatAccessCode(raw) {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
  return clean.length > 4 ? `${clean.slice(0, 4)}-${clean.slice(4)}` : clean;
}

export default function ActivatePage() {
  const { activate } = useAuth();
  const [params] = useSearchParams();
  const [code, setCode] = useState(() => (params.get("code") ?? "").replace(/\D/g, "").slice(0, 2));
  const [accessCode, setAccessCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy) return;
    setError(null);

    if (password.length < 8) return setError("weak_password");
    if (password !== confirm) return setError("password_mismatch");

    setBusy(true);
    const result = await activate(code, accessCode, password);
    // Success signs the student in; the router then leaves this page.
    if (result.error) {
      setError(result.error);
      setBusy(false);
    }
  }

  return (
    <AuthLayout
      title="Аккаунтты белсендіру"
      subtitle="Әкімші берген бір реттік кодты енгізіп, өз құпия сөзіңді орнат. Құпия сөзді ұмытсаң да осы бет қолданылады."
      footer={
        <>
          Аккаунтың белсенді ме?{" "}
          <Link to="/login" className="text-link">
            Кіру
          </Link>
        </>
      }
    >
      <form className="form" onSubmit={handleSubmit} noValidate>
        <StudentCodeField
          id="act-code"
          value={code}
          onChange={setCode}
          invalid={error === "code_format"}
        />

        <div className="field">
          <label className="field__label" htmlFor="act-access">
            Белсендіру коды
          </label>
          <input
            id="act-access"
            className="input input--code"
            autoComplete="one-time-code"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="XXXX-XXXX"
            value={accessCode}
            onChange={(event) => setAccessCode(formatAccessCode(event.target.value))}
            aria-invalid={error === "invalid_code" || error === "code_locked" || undefined}
            required
          />
        </div>

        <PasswordField
          id="act-password"
          label="Жаңа құпия сөз"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          hint="Кемінде 8 таңба. Басқа сайттарда қолданбаған құпия сөз таңда."
          invalid={error === "weak_password"}
        />
        <PasswordField
          id="act-confirm"
          label="Құпия сөзді қайталау"
          value={confirm}
          onChange={setConfirm}
          autoComplete="new-password"
          invalid={error === "password_mismatch"}
        />

        {error && (
          <p className="form__error" role="alert">
            {authErrorMessage(error)}
          </p>
        )}

        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? "Тексерілуде…" : <><KeyRound size={17} /> Белсендіру</>}
        </button>
      </form>
    </AuthLayout>
  );
}
