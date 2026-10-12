import { useEffect, useMemo, useRef, useState } from "react";
import { Copy, Dices, Minus, Plus, RotateCcw, Trash2, Users } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { classRoster, deleteDraw, listDraws, makeDraw } from "../features/classlife/classlifeApi.js";
import { formatDateTime } from "../lib/due.js";

const MODES = [
  { id: "groups", label: "Топқа бөлу" },
  { id: "pick", label: "Жеребе" },
  { id: "order", label: "Кезек" },
];
const SPLITS = [
  { id: "count", label: "Топ саны" },
  { id: "size", label: "Топтағы адам" },
];
const DEFAULT_TITLE = { groups: "Топқа бөлу", pick: "Жеребе", order: "Жауап беру кезегі" };
const SETTINGS_KEY = "ulpa-draw-settings";
const MIN_ROLL_MS = 900; // a short "drum roll", even when the server answers instantly
const DAY = 24 * 60 * 60 * 1000;

const readSettings = () => {
  try {
    return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}");
  } catch {
    return {};
  }
};

/** Plain text of a result, for pasting into a chat. */
function resultText(draw) {
  const lines = [draw.title];
  if (draw.mode === "groups") draw.result.forEach((members, index) => lines.push("", `${index + 1}-топ:`, ...members.map((name, n) => `${n + 1}. ${name}`)));
  else if (draw.mode === "pick") lines.push(...draw.result.map((name) => `🎯 ${name}`));
  else lines.push(...draw.result.map((name, index) => `${index + 1}. ${name}`));
  return lines.join("\n");
}

function preview(draw) {
  const names = draw.mode === "groups" ? draw.result.map((members) => members.length).join(" · ") + " адам" : draw.result.slice(0, 3).join(", ") + (draw.result.length > 3 ? "…" : "");
  return names;
}

function DrawResult({ draw, big = false }) {
  if (draw.mode === "groups")
    return (
      <div className={`draw-groups${big ? " draw-groups--big" : ""}`}>
        {draw.result.map((members, index) => (
          <div key={index} className="draw-group" style={big ? { animationDelay: `${index * 90}ms` } : undefined}>
            <strong>
              {index + 1}-топ <span className="muted small">· {members.length}</span>
            </strong>
            <ol>
              {members.map((name, n) => (
                <li key={n}>{name}</li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    );
  if (draw.mode === "pick")
    return (
      <ul className={`draw-picked${big ? " draw-picked--big" : ""}`}>
        {draw.result.map((name, index) => (
          <li key={index} style={{ animationDelay: `${index * 120}ms` }}>
            🎯 {name}
          </li>
        ))}
      </ul>
    );
  return (
    <ol className="draw-order">
      {draw.result.map((name, index) => (
        <li key={index}>{name}</li>
      ))}
    </ol>
  );
}

export default function DrawPage() {
  const { student, isAdmin } = useAuth();
  const saved = useRef(readSettings()).current;
  const [roster, setRoster] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [extra, setExtra] = useState(saved.extra ?? "");
  const [mode, setMode] = useState(saved.mode ?? "groups");
  const [split, setSplit] = useState(saved.split ?? "count");
  const [amount, setAmount] = useState(saved.amount ?? 3);
  const [title, setTitle] = useState(saved.title ?? "");
  const [noRepeat, setNoRepeat] = useState(saved.noRepeat ?? false);
  const [rolling, setRolling] = useState(null); // name shown while "rolling"
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const timer = useRef(null);
  const stage = useRef(null);

  useEffect(() => {
    classRoster()
      .then((rows) => {
        setRoster(rows);
        const known = new Set(rows.map((row) => row.code));
        const keep = (saved.picked ?? []).filter((code) => known.has(code));
        setPicked(new Set(keep.length >= 2 ? keep : rows.map((row) => row.code)));
      })
      .catch(() => setError("Тізім жүктелмеді. Интернетті тексеріп, бетті жаңарт."));
    listDraws().then(setHistory).catch(() => {});
    return () => clearInterval(timer.current);
  }, [saved]);

  // Remember the last setup: the same class runs the same kind of draw lesson after lesson.
  useEffect(() => {
    if (!roster.length) return;
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify({ mode, split, amount, title, extra, noRepeat, picked: [...picked] }));
    } catch {
      /* private mode: nothing to remember */
    }
  }, [mode, split, amount, title, extra, noRepeat, picked, roster.length]);

  const extraNames = useMemo(
    () => [...new Set(extra.split(/[,\n]/).map((name) => name.trim()).filter(Boolean))].slice(0, 40),
    [extra]
  );
  const finalTitle = title.trim() || DEFAULT_TITLE[mode];

  // "Don't repeat": names already drawn today under the same title (e.g. who has already answered).
  const alreadyDrawn = useMemo(() => {
    if (mode !== "pick" || !noRepeat) return new Set();
    const since = Date.now() - DAY;
    return new Set(
      history
        .filter((draw) => draw.mode === "pick" && draw.title === finalTitle && new Date(draw.created_at).getTime() > since)
        .flatMap((draw) => draw.result)
    );
  }, [history, mode, noRepeat, finalTitle]);

  const people = roster.filter((row) => picked.has(row.code) && !alreadyDrawn.has(row.full_name));
  const extras = extraNames.filter((name) => !alreadyDrawn.has(name));
  const pool = [...people.map((row) => row.full_name), ...extras];
  const skipped = alreadyDrawn.size ? roster.filter((row) => picked.has(row.code)).length + extraNames.length - pool.length : 0;

  const bySize = mode === "groups" && split === "size";
  const minAmount = mode === "groups" && !bySize ? 2 : 1;
  const maxAmount = Math.max(minAmount, bySize ? pool.length - 1 : pool.length);
  const groupsCount = mode === "groups" ? (bySize ? Math.ceil(pool.length / Math.max(1, amount)) : amount) : 0;
  const amountOk = mode === "order" || (amount >= minAmount && amount <= maxAmount && (mode !== "groups" || (groupsCount >= 2 && groupsCount <= pool.length)));

  // Keep the number sensible when people are removed.
  useEffect(() => {
    if (mode !== "order" && pool.length >= 2 && amount > maxAmount) setAmount(maxAmount);
  }, [pool.length, maxAmount, amount, mode]);

  function groupHint() {
    if (pool.length < 2 || !groupsCount) return null;
    const small = Math.floor(pool.length / groupsCount);
    const big = Math.ceil(pool.length / groupsCount);
    return `${groupsCount} топ · әр топта ${small === big ? big : `${small}–${big}`} адам`;
  }

  function choose(filter) {
    setPicked(new Set(roster.filter(filter).map((row) => row.code)));
  }

  function toggle(code) {
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function switchMode(next) {
    setMode(next);
    setAmount(next === "groups" ? 3 : 1);
  }

  function switchSplit(next) {
    setSplit(next);
    setAmount(next === "size" ? Math.min(4, Math.max(1, pool.length - 1)) : 3);
  }

  async function run() {
    if (pool.length < 2) return setError(skipped ? "Барлығы шығып қойды. «Қайталанбасын» дегенді өшір немесе басқа атау жаз." : "Кемінде 2 адам таңда.");
    if (!amountOk) return setError(mode === "groups" ? "Кемінде 2 топ шығуы керек — санды өзгерт." : "Саны дұрыс емес.");
    setError(null);
    setLatest(null);
    setCopied(false);
    let index = 0;
    timer.current = setInterval(() => {
      index = (index + 1 + Math.floor(Math.random() * pool.length)) % pool.length;
      setRolling(pool[index]);
    }, 70);
    setRolling(pool[0]);
    requestAnimationFrame(() => stage.current?.scrollIntoView({ behavior: "smooth", block: "nearest" }));
    const codes = people.map((row) => row.code);
    try {
      const [draw] = await Promise.all([
        makeDraw({
          title: finalTitle,
          mode,
          amount: mode === "order" ? pool.length : bySize ? groupsCount : amount,
          perGroup: bySize ? amount : null,
          codes,
          extra: extras,
        }),
        new Promise((resolve) => setTimeout(resolve, MIN_ROLL_MS)),
      ]);
      setLatest(draw);
      setHistory((current) => [draw, ...current.filter((item) => item.id !== draw.id)]);
      if (navigator.vibrate) navigator.vibrate(30);
    } catch (drawError) {
      const message = drawError?.message ?? "";
      setError(
        message.includes("rate_limited")
          ? "Бүгін тым көп жеребе тарттың. Ертең қайта көр."
          : drawError?.network || !navigator.onLine
            ? "Интернет әлсіз — жеребе жіберілмеді. Байланыс болғанда «Бастау» батырмасын қайта бас."
            : message.includes("bad_amount")
              ? "Топ саны сәйкес емес — санды өзгертіп көр."
              : message.includes("bad_pool")
                ? "Қатысушылар тізімі дұрыс емес (2-ден 80-ге дейін адам)."
                : message.includes("forbidden")
                  ? "Сессия ескірді. Бетті жаңартып, қайта кір."
                  : "Сервер жауап бермеді. Сәлден кейін қайта бас."
      );
    }
    clearInterval(timer.current);
    setRolling(null);
  }

  async function copy(draw) {
    try {
      await navigator.clipboard.writeText(resultText(draw));
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError("Көшірілмеді.");
    }
  }

  async function remove(draw) {
    if (!window.confirm(`«${draw.title}» нәтижесін жою керек пе?`)) return;
    try {
      await deleteDraw(draw.id);
      setHistory((current) => current.filter((item) => item.id !== draw.id));
      if (latest?.id === draw.id) setLatest(null);
    } catch {
      setError("Жойылмады.");
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Әділ жеребе"
        title="Топқа бөлу · жеребе"
        description="Араластыру серверде жасалады және әр нәтиже бүкіл топқа көрінеді — ешкім «қайта тартып» алдай алмайды."
      />

      <section className="panel draw-setup">
        <Segmented label="Түрі" options={MODES} value={mode} onChange={switchMode} />
        <p className="muted small">
          {mode === "groups" && "Таңдалғандарды кездейсоқ топтарға бөледі (топтардағы адам саны тең дерлік)."}
          {mode === "pick" && "Таңдалғандардың ішінен кездейсоқ бір немесе бірнеше адамды таңдайды."}
          {mode === "order" && "Барлығын кездейсоқ ретке қояды — жауап беру, қорғау кезегі үшін."}
        </p>

        {mode === "groups" && <Segmented label="Қалай бөлу" options={SPLITS} value={split} onChange={switchSplit} />}

        <div className="draw-row">
          <div className="field draw-title">
            <label className="field__label" htmlFor="draw-title">Атауы</label>
            <input id="draw-title" className="input" maxLength={100} value={title} placeholder={DEFAULT_TITLE[mode]} onChange={(event) => setTitle(event.target.value)} />
          </div>
          {mode !== "order" && (
            <div className="field">
              <span className="field__label">{mode === "groups" ? (bySize ? "Топтағы адам" : "Топ саны") : "Неше адам"}</span>
              <div className="stepper">
                <button type="button" className="icon-button" onClick={() => setAmount(Math.max(minAmount, amount - 1))} disabled={amount <= minAmount} aria-label="Азайту">
                  <Minus size={16} />
                </button>
                <span aria-live="polite">{amount}</span>
                <button type="button" className="icon-button" onClick={() => setAmount(Math.min(maxAmount, amount + 1))} disabled={amount >= maxAmount} aria-label="Көбейту">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        {mode === "groups" && groupHint() && <p className="draw-hint">{groupHint()}</p>}

        {mode === "pick" && (
          <label className="toggle">
            <span>
              Бұрын шыққандар қайталанбасын <span className="muted small">(осы атаумен бүгін шыққандар)</span>
            </span>
            <input type="checkbox" checked={noRepeat} onChange={(event) => setNoRepeat(event.target.checked)} />
            <span className="toggle__track" aria-hidden="true" />
          </label>
        )}

        <div className="field">
          <span className="field__label draw-label">
            <Users size={14} aria-hidden="true" /> Қатысушылар · {pool.length}
            {skipped > 0 && <span className="muted small"> · {skipped} адам бұрын шыққан</span>}
          </span>
          <div className="draw-quick">
            <button type="button" className="search-chip" onClick={() => choose(() => true)}>Бүкіл сынып</button>
            <button type="button" className="search-chip" onClick={() => choose((row) => row.group_no === 1)}>1-топ</button>
            <button type="button" className="search-chip" onClick={() => choose((row) => row.group_no === 2)}>2-топ</button>
            <button type="button" className="search-chip" onClick={() => choose(() => false)}>Ешкім</button>
          </div>
          {roster.length === 0 && !error && <p className="muted small">Тізім жүктелуде…</p>}
          <div className="draw-people">
            {roster.map((row) => {
              const done = alreadyDrawn.has(row.full_name);
              return (
                <button
                  key={row.code}
                  type="button"
                  className={`draw-person${picked.has(row.code) ? " is-on" : ""}${row.code === student?.code ? " is-me" : ""}${done ? " is-done" : ""}`}
                  onClick={() => toggle(row.code)}
                  aria-pressed={picked.has(row.code)}
                  title={done ? "Бүгін шықты" : undefined}
                >
                  {done && "✓ "}
                  {row.full_name}
                </button>
              );
            })}
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="draw-extra">Қосымша аттар <span className="muted">(үтір арқылы, міндетті емес)</span></label>
          <input id="draw-extra" className="input" value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="Мысалы: 1-тақырып, 2-тақырып, 3-тақырып" />
        </div>

        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="button" className="button button--primary button--block draw-go" onClick={run} disabled={Boolean(rolling) || roster.length === 0}>
          <Dices size={18} /> {rolling ? "Араластырылуда…" : "Бастау"}
        </button>
      </section>

      {(rolling || latest) && (
        <section className="panel draw-stage" aria-live="polite" ref={stage}>
          {rolling ? (
            <div className="draw-rolling">{rolling}</div>
          ) : (
            <>
              <h2 className="panel-title">🎉 {latest.title}</h2>
              <DrawResult draw={latest} big />
              <div className="draw-actions">
                <button type="button" className="button button--ghost button--sm" onClick={() => copy(latest)}>
                  <Copy size={14} /> {copied ? "Көшірілді ✓" : "Көшіру"}
                </button>
                <button type="button" className="button button--ghost button--sm" onClick={run}>
                  <RotateCcw size={14} /> Тағы тарту
                </button>
              </div>
            </>
          )}
        </section>
      )}

      {history.length > 0 && (
        <section className="panel">
          <h2 className="panel-title">Соңғы нәтижелер</h2>
          <ul className="draw-history">
            {history.map((draw) => (
              <li key={draw.id}>
                <details>
                  <summary>
                    <strong>{draw.title}</strong>
                    <span className="muted small">
                      {MODES.find((item) => item.id === draw.mode)?.label} · {draw.creator_name ?? "—"} · {formatDateTime(draw.created_at)}
                    </span>
                    <span className="draw-history__peek small">{preview(draw)}</span>
                  </summary>
                  <DrawResult draw={draw} />
                  <div className="draw-actions">
                    <button type="button" className="button button--ghost button--sm" onClick={() => copy(draw)}>
                      <Copy size={14} /> Көшіру
                    </button>
                    {(draw.created_by === student?.id || isAdmin) && (
                      <button type="button" className="button button--ghost button--sm" onClick={() => remove(draw)}>
                        <Trash2 size={14} /> Жою
                      </button>
                    )}
                  </div>
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
