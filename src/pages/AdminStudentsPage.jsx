import { useCallback, useEffect, useState } from "react";
import { Check, Copy, KeyRound, RefreshCw, Users, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import { supabase } from "../lib/supabase.js";
import { authErrorMessage } from "../features/auth/errors.js";
import { APP_TIME_ZONE } from "../config/app.js";

const GROUP_FILTERS = [
  { id: "all", label: "Барлығы" },
  { id: "1", label: "1-топ" },
  { id: "2", label: "2-топ" },
];

function formatTime(iso) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: APP_TIME_ZONE,
  }).format(new Date(iso));
}

function AccountStatus({ row }) {
  if (row.open_code_expires_at) {
    return <span className="status status--pending">Код берілген · {formatTime(row.open_code_expires_at)} дейін</span>;
  }
  if (row.activated_at) return <span className="status status--ok">Белсенді</span>;
  return <span className="status status--idle">Белсендірілмеген</span>;
}

/** Shows a freshly issued code exactly once. It is never stored in plain text. */
function IssuedCode({ issued, onClose }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/activate?code=${issued.student.code}`;
  const message = `ULPA · ${issued.student.full_name}\nСтудент коды: ${issued.student.code}\nБелсендіру коды: ${issued.code}\n${link}\n(24 сағат жарамды, бір рет қолданылады)`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="issued" role="dialog" aria-labelledby="issued-title">
      <div className="issued__head">
        <div>
          <span className="eyebrow">{issued.purpose === "reset" ? "Құпия сөзді қалпына келтіру" : "Белсендіру"}</span>
          <h2 id="issued-title">
            {issued.student.code} · {issued.student.full_name}
          </h2>
        </div>
        <button type="button" className="icon-button" onClick={onClose} aria-label="Жабу">
          <X size={18} />
        </button>
      </div>
      <div className="issued__code">{issued.code}</div>
      <p className="issued__note">
        {formatTime(issued.expires_at)} дейін жарамды, бір рет қана қолданылады. Бұл код қайта көрсетілмейді — оны тек осы
        студентке жеке жібер.
      </p>
      <button type="button" className="button button--primary button--block" onClick={copy}>
        {copied ? <><Check size={17} /> Көшірілді</> : <><Copy size={17} /> Хабарламаны көшіру</>}
      </button>
    </div>
  );
}

export default function AdminStudentsPage() {
  const [rows, setRows] = useState([]);
  const [state, setState] = useState("loading"); // loading | ready | error
  const [group, setGroup] = useState("all");
  const [busyCode, setBusyCode] = useState(null);
  const [issued, setIssued] = useState(null);
  const [actionError, setActionError] = useState(null);

  const load = useCallback(async () => {
    setState("loading");
    const { data, error } = await supabase.rpc("admin_list_accounts");
    if (error) {
      setState("error");
      return;
    }
    setRows(data ?? []);
    setState("ready");
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function issueCode(row) {
    const purpose = row.activated_at ? "reset" : "activation";
    const question =
      purpose === "reset"
        ? `${row.code} · ${row.full_name}: құпия сөзді қалпына келтіру коды жасалсын ба? Бұрынғы ашық код жойылады.`
        : `${row.code} · ${row.full_name}: белсендіру коды жасалсын ба?`;
    if (!window.confirm(question)) return;

    setBusyCode(row.code);
    setActionError(null);
    const { data, error } = await supabase.rpc("admin_issue_account_code", {
      p_student_code: row.code,
      p_purpose: purpose,
    });
    setBusyCode(null);

    if (error) {
      setActionError(error.code === "42501" ? "forbidden" : "server_error");
      return;
    }
    setIssued({ ...data, purpose, student: row });
    load();
  }

  const visible = rows.filter((row) => group === "all" || String(row.group_no) === group);
  const activeCount = rows.filter((row) => row.activated_at).length;

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Әкімші"
        title="Студенттер"
        description={state === "ready" ? `${rows.length} студент · ${activeCount} белсенді` : undefined}
        actions={
          <button type="button" className="button button--ghost" onClick={load} disabled={state === "loading"}>
            <RefreshCw size={16} /> Жаңарту
          </button>
        }
      />

      {issued && <IssuedCode issued={issued} onClose={() => setIssued(null)} />}

      {actionError && (
        <p className="form__error" role="alert">
          {authErrorMessage(actionError)}
        </p>
      )}

      <Segmented label="Топ" options={GROUP_FILTERS} value={group} onChange={setGroup} />

      {state === "loading" && <p className="muted">Жүктелуде…</p>}

      {state === "error" && (
        <EmptyState
          icon={Users}
          title="Тізім жүктелмеді"
          action={<button type="button" className="button button--ghost" onClick={load}>Қайта көру</button>}
        >
          Желіні тексеріп, қайта көр.
        </EmptyState>
      )}

      {state === "ready" && (
        <ul className="roster">
          {visible.map((row) => (
            <li key={row.code} className="roster__row">
              <span className="roster__code">{row.code}</span>
              <div className="roster__main">
                <strong>
                  {row.full_name}
                  {row.role === "admin" && <span className="tag tag--admin">Әкімші</span>}
                </strong>
                <div className="roster__meta">
                  <span>{row.group_no}-топ</span>
                  <AccountStatus row={row} />
                </div>
              </div>
              <button
                type="button"
                className="button button--ghost button--sm"
                onClick={() => issueCode(row)}
                disabled={busyCode === row.code}
              >
                <KeyRound size={15} />
                <span>{row.activated_at ? "Қалпына келтіру" : "Код беру"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
