import { useEffect, useState } from "react";
import { Check, Eye, Inbox, Lock, Mail, Send, UserSearch } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { listSuggestions, sendSuggestion, suggestionAuthor, updateSuggestion } from "../features/classlife/classlifeApi.js";
import { formatDateTime } from "../lib/due.js";

const CATEGORIES = [
  { id: "study", label: "Оқу" },
  { id: "class", label: "Топ өмірі" },
  { id: "site", label: "Сайт" },
  { id: "other", label: "Басқа" },
];
const STATUS = { new: "Жаңа", seen: "Оқылды", done: "Шешілді" };
const catLabel = (id) => CATEGORIES.find((item) => item.id === id)?.label ?? id;

function AdminItem({ item, onChanged }) {
  const [reply, setReply] = useState(item.reply ?? "");
  const [author, setAuthor] = useState(null);
  const [busy, setBusy] = useState(false);

  async function patch(values) {
    setBusy(true);
    try {
      await updateSuggestion(item.id, values);
      await onChanged();
    } catch {
      window.alert("Сақталмады.");
    }
    setBusy(false);
  }

  async function reveal() {
    if (!window.confirm("Авторды көрсету керек пе? Бұл тек саған көрінеді — басқаларға айтпа, әйтпесе жәшікке ешкім жазбай қояды.")) return;
    try {
      setAuthor((await suggestionAuthor(item.id)) ?? "белгісіз");
    } catch {
      setAuthor("белгісіз");
    }
  }

  return (
    <article className={`suggestion suggestion--${item.status}`}>
      <header className="suggestion__head">
        <span className="tag">{catLabel(item.category)}</span>
        <span className={`tag${item.status === "new" ? " tag--live" : ""}`}>{STATUS[item.status]}</span>
        <span className="muted small">{formatDateTime(item.created_at)}</span>
      </header>
      <p className="suggestion__body">{item.body}</p>
      <div className="field">
        <label className="field__label" htmlFor={`reply-${item.id}`}>Жауап <span className="muted">(тек авторға көрінеді)</span></label>
        <textarea id={`reply-${item.id}`} className="input input--textarea" rows={2} maxLength={1000} value={reply} onChange={(event) => setReply(event.target.value)} />
      </div>
      <div className="suggestion__actions">
        <button type="button" className="button button--primary button--sm" disabled={busy || reply === (item.reply ?? "")} onClick={() => patch({ reply: reply.trim() || null, status: item.status === "new" ? "seen" : item.status })}>
          <Send size={14} /> Жауап беру
        </button>
        {item.status === "new" && (
          <button type="button" className="button button--ghost button--sm" disabled={busy} onClick={() => patch({ status: "seen" })}>
            <Eye size={14} /> Оқылды
          </button>
        )}
        {item.status !== "done" && (
          <button type="button" className="button button--ghost button--sm" disabled={busy} onClick={() => patch({ status: "done" })}>
            <Check size={14} /> Шешілді
          </button>
        )}
        {author ? (
          <span className="suggestion__author">
            <UserSearch size={14} aria-hidden="true" /> {author}
          </span>
        ) : (
          <button type="button" className="text-link suggestion__reveal" onClick={reveal}>
            Кім жазды?
          </button>
        )}
      </div>
    </article>
  );
}

export default function SuggestionsPage() {
  const { isAdmin } = useAuth();
  const [category, setCategory] = useState("study");
  const [body, setBody] = useState("");
  const [state, setState] = useState({ status: "loading", items: [] });
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  async function load() {
    try {
      setState({ status: "ready", items: await listSuggestions() });
    } catch {
      setState({ status: "error", items: [] });
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function submit(event) {
    event.preventDefault();
    if (body.trim().length < 3) return setMessage({ error: true, text: "Сәл толығырақ жаз." });
    setBusy(true);
    setMessage(null);
    try {
      await sendSuggestion({ category, body: body.trim() });
      setBody("");
      setMessage({ error: false, text: "Жіберілді ✓ Рақмет! Жауап келсе, осы бетте көресің." });
      await load();
    } catch (sendError) {
      setMessage({ error: true, text: sendError?.message?.includes("rate_limited") ? "Бүгінге 5 ұсыныс жеткілікті. Ертең жаз." : "Жіберілмеді. Қайта көр." });
    }
    setBusy(false);
  }

  const shown = isAdmin ? state.items.filter((item) => (filter === "open" ? item.status !== "done" : item.status === "done")) : state.items;

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Жасырын"
        title="Ұсыныс жәшігі"
        description="Топқа, оқуға не сайтқа қатысты ұсынысың, өтінішің не шағымың болса — жаз. Сыныптастарың кім жазғанын ешқашан көрмейді, хатты тек әкімші оқиды."
      />

      <form className="panel suggestion-form" onSubmit={submit}>
        <p className="suggestion-form__lock">
          <Lock size={14} aria-hidden="true" /> Атың сыныптастарға көрсетілмейді. Әкімші қажет болса ғана тексере алады.
        </p>
        <Segmented label="Тақырып" options={CATEGORIES} value={category} onChange={setCategory} />
        <textarea
          className="input input--textarea"
          rows={4}
          maxLength={2000}
          value={body}
          onChange={(event) => setBody(event.target.value)}
          placeholder="Мысалы: Сенбідегі сабақтың уақытын ауыстыруды сұрасақ қалай?"
          aria-label="Ұсыныс мәтіні"
        />
        {message && <p className={message.error ? "form__error" : "form__ok"} role="status">{message.text}</p>}
        <button type="submit" className="button button--primary" disabled={busy}>
          <Mail size={16} /> {busy ? "Жіберілуде…" : "Жіберу"}
        </button>
      </form>

      <section className="stack">
        <div className="section-head">
          <h2 className="panel-title">{isAdmin ? "Келген ұсыныстар" : "Менің ұсыныстарым"}</h2>
          {isAdmin && (
            <Segmented
              label="Сүзгі"
              options={[
                { id: "open", label: "Ашық" },
                { id: "done", label: "Шешілген" },
              ]}
              value={filter}
              onChange={setFilter}
            />
          )}
        </div>
        {state.status === "error" && <p className="form__error">Жүктелмеді.</p>}
        {state.status === "ready" && shown.length === 0 && (
          <EmptyState icon={Inbox} title={isAdmin ? "Бұл жерде ештеңе жоқ" : "Әзірге жібермедің"} compact />
        )}
        {isAdmin
          ? shown.map((item) => <AdminItem key={item.id} item={item} onChanged={load} />)
          : shown.map((item) => (
              <article key={item.id} className={`suggestion suggestion--${item.status}`}>
                <header className="suggestion__head">
                  <span className="tag">{catLabel(item.category)}</span>
                  <span className="tag">{STATUS[item.status]}</span>
                  <span className="muted small">{formatDateTime(item.created_at)}</span>
                </header>
                <p className="suggestion__body">{item.body}</p>
                {item.reply && (
                  <div className="suggestion__reply">
                    <strong>Әкімші жауабы</strong>
                    <p>{item.reply}</p>
                  </div>
                )}
              </article>
            ))}
      </section>
    </div>
  );
}
