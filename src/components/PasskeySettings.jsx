import { useCallback, useEffect, useState } from "react";
import { Fingerprint, Trash2 } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { authErrorMessage, classifyPasskeyError } from "../features/auth/errors.js";
import { formatDateTime } from "../lib/due.js";

/** Register / list / remove Face ID, Touch ID or fingerprint keys for this account. */
export default function PasskeySettings() {
  const supported = typeof window !== "undefined" && Boolean(window.PublicKeyCredential);
  const [keys, setKeys] = useState([]);
  const [message, setMessage] = useState(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data, error } = await supabase.auth.passkey.list();
      if (!error) setKeys(data ?? []);
    } catch {
      /* passkeys not enabled on the server yet */
    }
  }, []);

  useEffect(() => {
    if (supported) load();
  }, [supported, load]);

  async function register() {
    setBusy(true);
    setMessage(null);
    try {
      const { error } = await supabase.auth.registerPasskey();
      if (error) {
        const code = error.code === "webauthn_credential_exists" ? null : classifyPasskeyError(error);
        setMessage(code ? { tone: "error", text: authErrorMessage(code) } : { tone: "ok", text: "Бұл құрылғы бұрыннан қосылған." });
      } else {
        setMessage({ tone: "ok", text: "Дайын! Келесі жолы «Face ID / саусақ ізімен кіру» батырмасын бас." });
        load();
      }
    } catch (error) {
      setMessage({ tone: "error", text: authErrorMessage(classifyPasskeyError(error)) });
    }
    setBusy(false);
  }

  async function remove(key) {
    if (!window.confirm(`«${key.friendly_name ?? "Кілт"}» жойылсын ба? Бұл құрылғымен Face ID арқылы кіре алмайсың.`)) return;
    await supabase.auth.passkey.delete({ passkeyId: key.id });
    load();
  }

  if (!supported) {
    return <p className="muted small">Бұл браузер Face ID / саусақ ізін қолдамайды.</p>;
  }

  return (
    <div className="passkeys">
      <p className="muted small">
        Құрылғыңның Face ID, Touch ID немесе саусақ ізін қосып, келесі жолы құпия сөзсіз кір. Құпия сөзің бұрынғыдай жұмыс істей береді.
      </p>
      {keys.length > 0 && (
        <ul className="passkeys__list">
          {keys.map((key) => (
            <li key={key.id}>
              <Fingerprint size={16} aria-hidden="true" />
              <span className="passkeys__name">
                {key.friendly_name ?? "Құрылғы кілті"}
                <small>Қосылған: {formatDateTime(key.created_at)}</small>
              </span>
              <button type="button" className="icon-button icon-button--danger" onClick={() => remove(key)} aria-label="Жою">
                <Trash2 size={15} />
              </button>
            </li>
          ))}
        </ul>
      )}
      <button type="button" className="button button--ghost button--wrap" onClick={register} disabled={busy}>
        <Fingerprint size={17} /> {keys.length ? "Тағы бір құрылғы қосу" : "Осы құрылғыда Face ID / саусақ ізін қосу"}
      </button>
      {message && <p className={message.tone === "ok" ? "passkeys__ok" : "form__error"}>{message.text}</p>}
    </div>
  );
}
