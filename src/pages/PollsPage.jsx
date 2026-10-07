import { useState } from "react";
import { Check, CloudOff, Lock, Plus, Trash2, Vote, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Modal from "../components/ui/Modal.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { closePoll, createPoll, deletePoll, isPollOpen, usePolls, vote, withdrawVote } from "../features/polls/pollApi.js";
import { canManageItem, groupChoices } from "../lib/permissions.js";
import { formatDateTime, localInputToIso } from "../lib/due.js";

function PollForm({ onClose, onSaved }) {
  const { student, isAdmin } = useAuth();
  const groupOptions = groupChoices(student, isAdmin, "Барлығына");
  const [values, setValues] = useState({
    question: "",
    details: "",
    groupNo: "both",
    multiple: false,
    anonymous: true,
    closes: "",
    options: ["", ""],
  });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setValues((current) => ({ ...current, [key]: value }));
  const setOption = (index, value) =>
    setValues((current) => ({ ...current, options: current.options.map((item, i) => (i === index ? value : item)) }));

  async function submit(event) {
    event.preventDefault();
    const options = values.options.map((item) => item.trim()).filter(Boolean);
    if (!values.question.trim()) return setError("Сұрақты жаз.");
    if (options.length < 2) return setError("Кемінде 2 нұсқа керек.");
    if (new Set(options.map((item) => item.toLowerCase())).size !== options.length) return setError("Нұсқалар қайталанбасын.");
    const closesAt = values.closes ? localInputToIso(values.closes) : null;
    if (closesAt && new Date(closesAt) <= new Date()) return setError("Аяқталу уақыты болашақта болсын.");
    setBusy(true);
    setError(null);
    try {
      await createPoll({ ...values, closesAt, options });
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(
        saveError?.code === "42501"
          ? "Бұл топқа сауалнама жариялауға рұқсатың жоқ."
          : saveError?.message?.includes("daily poll limit")
            ? "Бүгінге лимит бітті (күніне 10 сауалнама)."
            : "Сақталмады. Қайта көр."
      );
      setBusy(false);
    }
  }

  return (
    <Modal title="Жаңа сауалнама" onClose={busy ? () => {} : onClose}>
      <form className="upload" onSubmit={submit}>
        <div className="field">
          <label className="field__label" htmlFor="pf-q">Сұрақ</label>
          <input id="pf-q" className="input" maxLength={200} value={values.question} onChange={(event) => set("question")(event.target.value)} placeholder="Мысалы: Сынып кешін қашан өткіземіз?" />
        </div>
        <div className="field">
          <label className="field__label" htmlFor="pf-d">Түсініктеме <span className="muted">(міндетті емес)</span></label>
          <textarea id="pf-d" className="input input--textarea" rows={2} maxLength={1000} value={values.details} onChange={(event) => set("details")(event.target.value)} />
        </div>
        <div className="field">
          <span className="field__label">Нұсқалар</span>
          <div className="poll-form__options">
            {values.options.map((option, index) => (
              <div key={index} className="poll-form__option">
                <input className="input" maxLength={100} value={option} onChange={(event) => setOption(index, event.target.value)} placeholder={`${index + 1}-нұсқа`} aria-label={`${index + 1}-нұсқа`} />
                {values.options.length > 2 && (
                  <button type="button" className="icon-button" onClick={() => set("options")(values.options.filter((_, i) => i !== index))} aria-label="Нұсқаны алып тастау">
                    <X size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {values.options.length < 10 && (
            <button type="button" className="button button--ghost button--sm" onClick={() => set("options")([...values.options, ""])}>
              <Plus size={15} /> Нұсқа қосу
            </button>
          )}
        </div>
        <div className="field">
          <span className="field__label">Кімге</span>
          <Segmented label="Кімге" options={groupOptions} value={values.groupNo} onChange={set("groupNo")} />
        </div>
        <label className="toggle">
          <span>Бірнеше нұсқа таңдауға болады</span>
          <input type="checkbox" checked={values.multiple} onChange={(event) => set("multiple")(event.target.checked)} />
          <span className="toggle__track" aria-hidden="true" />
        </label>
        <label className="toggle">
          <span>Жасырын дауыс — кім нені таңдағаны ешкімге көрінбейді</span>
          <input type="checkbox" checked={values.anonymous} onChange={(event) => set("anonymous")(event.target.checked)} />
          <span className="toggle__track" aria-hidden="true" />
        </label>
        <div className="field">
          <label className="field__label" htmlFor="pf-c">Аяқталу уақыты <span className="muted">(міндетті емес)</span></label>
          <input id="pf-c" type="datetime-local" className="input" value={values.closes} onChange={(event) => set("closes")(event.target.value)} />
          <p className="field__hint">Жасырын/ашық баптауын кейін өзгерту мүмкін емес.</p>
        </div>
        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? "Жариялануда…" : "Жариялау"}
        </button>
      </form>
    </Modal>
  );
}

function PollCard({ poll, mine, results, total, onChanged }) {
  const { student, isAdmin } = useAuth();
  const open = isPollOpen(poll);
  const myOptions = poll.poll_options.filter((option) => mine.has(option.id)).map((option) => option.id);
  const voted = myOptions.length > 0;
  const showResults = voted || !open;
  const canManage = canManageItem(student, isAdmin, poll.created_by, poll.group_no);
  const [picked, setPicked] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  function toggle(optionId) {
    setPicked((current) =>
      poll.multiple ? (current.includes(optionId) ? current.filter((id) => id !== optionId) : [...current, optionId]) : [optionId]
    );
  }

  async function run(action, failText) {
    setBusy(true);
    setError(null);
    try {
      await action();
      setPicked([]);
      await onChanged();
    } catch {
      setError(failText);
    }
    setBusy(false);
  }

  const maxVotes = Math.max(1, ...poll.poll_options.map((option) => results[option.id]?.votes ?? 0));

  return (
    <article className={`poll${open ? "" : " poll--closed"}`}>
      <header className="poll__head">
        <div className="poll__badges">
          <span className={`tag${open ? " tag--live" : ""}`}>{open ? "Ашық" : <><Lock size={12} /> Аяқталды</>}</span>
          <span className="tag">{poll.group_no ? `${poll.group_no}-топ` : "Барлығына"}</span>
          <span className="tag">{poll.anonymous ? "Жасырын" : "Аттары көрінеді"}</span>
          {poll.multiple && <span className="tag">Бірнеше таңдау</span>}
        </div>
        {canManage && (
          <div className="poll__manage">
            {open && (
              <button type="button" className="button button--ghost button--sm" disabled={busy} onClick={() => window.confirm("Сауалнаманы аяқтау керек пе? Бұдан кейін ешкім дауыс бере алмайды.") && run(() => closePoll(poll.id), "Аяқталмады.")}>
                Аяқтау
              </button>
            )}
            <button type="button" className="icon-button icon-button--danger" disabled={busy} aria-label="Жою" onClick={() => window.confirm(`«${poll.question}» сауалнамасын жою керек пе?`) && run(() => deletePoll(poll.id), "Жойылмады.")}>
              <Trash2 size={15} />
            </button>
          </div>
        )}
      </header>

      <h3 className="poll__question">{poll.question}</h3>
      {poll.details && <p className="poll__details">{poll.details}</p>}

      {showResults ? (
        <ul className="poll__results">
          {poll.poll_options.map((option) => {
            const row = results[option.id] ?? { votes: 0, voters: null };
            const share = total ? Math.round((row.votes / total) * 100) : 0;
            const leading = row.votes > 0 && row.votes === maxVotes;
            return (
              <li key={option.id} className={`poll__result${mine.has(option.id) ? " is-mine" : ""}${leading ? " is-leading" : ""}`}>
                <div className="poll__bar" style={{ "--w": `${share}%` }} aria-hidden="true" />
                <div className="poll__result-row">
                  <span className="poll__label">
                    {mine.has(option.id) && <Check size={14} strokeWidth={3} aria-label="Сенің таңдауың" />}
                    {option.label}
                  </span>
                  <span className="poll__count">{row.votes} · {share}%</span>
                </div>
                {row.voters?.length > 0 && <p className="poll__voters">{row.voters.join(", ")}</p>}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="poll__choices" role={poll.multiple ? "group" : "radiogroup"} aria-label={poll.question}>
          {poll.poll_options.map((option) => {
            const selected = picked.includes(option.id);
            return (
              <button
                key={option.id}
                type="button"
                role={poll.multiple ? "checkbox" : "radio"}
                aria-checked={selected}
                className={`poll__choice${selected ? " is-selected" : ""}${poll.multiple ? " is-multi" : ""}`}
                onClick={() => toggle(option.id)}
              >
                <span className="poll__mark" aria-hidden="true">{selected && <Check size={13} strokeWidth={3} />}</span>
                {option.label}
              </button>
            );
          })}
        </div>
      )}

      <footer className="poll__foot">
        <span className="muted small">
          {total} адам дауыс берді · {poll.creator_name ?? "—"}
          {poll.closes_at && open && ` · ${formatDateTime(poll.closes_at)} дейін`}
        </span>
        {open && !voted && (
          <button type="button" className="button button--primary button--sm" disabled={busy || picked.length === 0} onClick={() => run(() => vote(picked), "Дауыс сақталмады. Қайта көр.")}>
            <Vote size={15} /> Дауыс беру
          </button>
        )}
        {open && voted && (
          <button type="button" className="button button--ghost button--sm" disabled={busy} onClick={() => run(() => withdrawVote(poll.id), "Өзгертілмеді.")}>
            Дауысты өзгерту
          </button>
        )}
      </footer>
      {!showResults && <p className="muted small">Нәтиже дауыс бергеннен кейін көрінеді.</p>}
      {error && <p className="form__error" role="alert">{error}</p>}
    </article>
  );
}

export default function PollsPage() {
  const { status, polls, mine, results, totals, reload } = usePolls();
  const [creating, setCreating] = useState(false);
  const [filter, setFilter] = useState("open");
  const now = new Date();
  const visible = polls.filter((poll) => (filter === "open" ? isPollOpen(poll, now) : !isPollOpen(poll, now)));

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Сынып"
        title="Дауыс беру"
        description="Сұрақ қой — сынып дауыс берсін. Әр адамның бір дауысы бар, оны аяқталғанға дейін өзгертуге болады."
        actions={
          <button type="button" className="button button--primary" onClick={() => setCreating(true)}>
            <Plus size={17} /> Сауалнама құру
          </button>
        }
      />
      <Segmented
        label="Сауалнамалар"
        options={[{ id: "open", label: "Ашық" }, { id: "closed", label: "Аяқталған" }]}
        value={filter}
        onChange={setFilter}
      />
      {status === "loading" && <div className="skeleton-list" aria-busy="true"><span /><span /></div>}
      {status === "error" && <EmptyState icon={CloudOff} title="Жүктелмеді">Интернетті тексеріп, бетті жаңарт.</EmptyState>}
      {status === "ready" && visible.length === 0 && (
        <EmptyState icon={Vote} title={filter === "open" ? "Ашық сауалнама жоқ" : "Аяқталған сауалнама жоқ"}>
          {filter === "open" && "«Сауалнама құру» батырмасымен бірінші болып сұрақ қой."}
        </EmptyState>
      )}
      <div className="poll-list">
        {visible.map((poll) => (
          <PollCard key={poll.id} poll={poll} mine={mine} results={results} total={totals[poll.id] ?? 0} onChanged={reload} />
        ))}
      </div>
      {creating && <PollForm onClose={() => setCreating(false)} onSaved={reload} />}
    </div>
  );
}
