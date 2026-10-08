import { useEffect, useState } from "react";
import { Copy, KeyRound } from "lucide-react";
import Modal from "../../components/ui/Modal.jsx";
import LessonsBoard from "../../teacher/LessonsBoard.jsx";
import { issueTeacherCode, teacherAccounts } from "../../teacher/teacherApi.js";
import { formatDateTime } from "../../lib/due.js";

function ago(iso) {
  if (!iso) return "ешқашан";
  const minutes = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (minutes < 2) return "қазір";
  if (minutes < 60) return `${minutes} мин бұрын`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)} сағ бұрын`;
  return formatDateTime(iso);
}

function CodeDialog({ teacher, result, onClose }) {
  const [copied, setCopied] = useState(false);
  const text = `Сәлеметсіз бе! ULPA (kainar.online) — ҒТТ тобының оқу платформасы.\n1) kainar.online/activate бетін ашыңыз\n2) Код: ${result.login_code}\n3) Белсендіру коды: ${result.code}\n4) Өзіңізге құпия сөз ойлап табыңыз.\nКод ${formatDateTime(result.expires_at)} дейін жарамды.`;
  return (
    <Modal title={teacher.full_name} onClose={onClose}>
      <div className="stack">
        <p>Мына мәтінді оқытушыға жіберіңіз (WhatsApp, Telegram):</p>
        <pre className="t-code-msg">{text}</pre>
        <button
          type="button"
          className="button button--primary"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(text);
              setCopied(true);
            } catch {
              setCopied(false);
            }
          }}
        >
          <Copy size={16} /> {copied ? "Көшірілді ✓" : "Мәтінді көшіру"}
        </button>
        <p className="muted small">Код бір рет қана көрсетіледі және бір рет қолданылады. Жаңа код шығарсаңыз, ескісі жарамсыз болады.</p>
      </div>
    </Modal>
  );
}

export default function AdminTeachersPage() {
  const [rows, setRows] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState(null);

  const load = () => teacherAccounts().then(setRows).catch(() => setError("Жүктелмеді."));
  useEffect(() => {
    load();
  }, []);

  async function issue(teacher) {
    const purpose = teacher.activated ? "reset" : "activation";
    if (teacher.activated && !window.confirm(`${teacher.full_name} — құпия сөзді қалпына келтіру коды керек пе? Ескі құпия сөз жаңасы қойылғанша жұмыс істей береді.`)) return;
    setBusy(teacher.id);
    try {
      const result = await issueTeacherCode(teacher.id, purpose);
      setDialog({ teacher, result });
      load();
    } catch {
      setError("Код шықпады.");
    }
    setBusy(null);
  }

  return (
    <div className="stack-lg">
      <section className="panel">
        <h2 className="panel-title">Оқытушы аккаунттары</h2>
        <p className="muted small">
          Оқытушы kainar.online/activate бетінде өз кодын (91, 92…) және сіз берген белсендіру кодын енгізіп, құпия сөз қояды. Оқытушылар тек өз пәндерінің кестесін,
          студенттер тізімін және қатысуды көреді.
        </p>
        {error && <p className="form__error">{error}</p>}
        {!rows && !error && <p className="muted">Жүктелуде…</p>}
        <ul className="t-accounts">
          {(rows ?? []).map((row) => (
            <li key={row.id} className="t-account">
              <div className="t-account__head">
                <span className={`t-account__dot${row.online ? " is-online" : ""}`} aria-hidden="true" />
                <strong>{row.full_name}</strong>
                <span className="tag">{row.login_code ?? "—"}</span>
                <span className={`tag${row.activated ? " tag--live" : ""}`}>{row.activated ? "Белсенді" : "Белсендірілмеген"}</span>
              </div>
              <p className="muted small">{row.courses.join(" · ") || "Пән бекітілмеген"}</p>
              <dl className="t-account__stats">
                <div><dt>Соңғы кіруі</dt><dd>{row.online ? "қазір онлайн" : ago(row.last_seen)}</dd></div>
                <div><dt>7 күнде</dt><dd>{row.days_7} күн · {row.minutes_7} мин</dd></div>
                <div><dt>30 күнде</dt><dd>{row.days_30} күн</dd></div>
                <div><dt>Белгілеген сабақ</dt><dd>{row.lessons_marked}{row.last_marked ? ` · соңғысы ${ago(row.last_marked)}` : ""}</dd></div>
              </dl>
              <div className="t-account__actions">
                {row.open_code_expires_at && <span className="muted small">Ашық код {formatDateTime(row.open_code_expires_at)} дейін</span>}
                <button type="button" className="button button--ghost button--sm" disabled={busy === row.id} onClick={() => issue(row)}>
                  <KeyRound size={14} /> {row.activated ? "Құпия сөзді қалпына келтіру" : "Белсендіру коды"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      <div>
        <h2 className="panel-title">Барлық сабақтар (әкімші ретінде)</h2>
        <p className="muted small">Кез келген сабақтың қатысуын көріп, түзете аласыз — оқытушы сияқты.</p>
      </div>
      <LessonsBoard base="/admin/teachers" />
      {dialog && <CodeDialog teacher={dialog.teacher} result={dialog.result} onClose={() => setDialog(null)} />}
    </div>
  );
}
