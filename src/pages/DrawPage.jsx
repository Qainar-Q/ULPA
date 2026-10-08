import { useEffect, useMemo, useRef, useState } from "react";
import { Dices, Minus, Plus, Trash2, Users } from "lucide-react";
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
const DEFAULT_TITLE = { groups: "Топқа бөлу", pick: "Жеребе", order: "Жауап беру кезегі" };

function DrawResult({ draw, big = false }) {
  if (draw.mode === "groups")
    return (
      <div className={`draw-groups${big ? " draw-groups--big" : ""}`}>
        {draw.result.map((members, index) => (
          <div key={index} className="draw-group">
            <strong>{index + 1}-топ</strong>
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
  const [roster, setRoster] = useState([]);
  const [picked, setPicked] = useState(new Set());
  const [extra, setExtra] = useState("");
  const [mode, setMode] = useState("groups");
  const [amount, setAmount] = useState(3);
  const [title, setTitle] = useState("");
  const [rolling, setRolling] = useState(null); // name shown while "rolling"
  const [latest, setLatest] = useState(null);
  const [history, setHistory] = useState([]);
  const [error, setError] = useState(null);
  const timer = useRef(null);

  useEffect(() => {
    classRoster()
      .then((rows) => {
        setRoster(rows);
        setPicked(new Set(rows.map((row) => row.code)));
      })
      .catch(() => setError("Тізім жүктелмеді."));
    listDraws().then(setHistory).catch(() => {});
    return () => clearInterval(timer.current);
  }, []);

  const extraNames = useMemo(
    () => extra.split(/[,\n]/).map((name) => name.trim()).filter(Boolean).slice(0, 40),
    [extra]
  );
  const pool = [...roster.filter((row) => picked.has(row.code)).map((row) => row.full_name), ...extraNames];
  const max = Math.max(mode === "groups" ? 2 : 1, pool.length);
  const amountOk = mode === "order" || (mode === "groups" ? amount >= 2 && amount <= pool.length : amount >= 1 && amount <= pool.length);

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

  async function run() {
    if (pool.length < 2) return setError("Кемінде 2 адам таңда.");
    if (!amountOk) return setError(mode === "groups" ? "Топ саны адам санынан көп болмасын." : "Саны дұрыс емес.");
    setError(null);
    setLatest(null);
    // Short "drum roll" while the server shuffles.
    let index = 0;
    timer.current = setInterval(() => {
      index = (index + 1 + Math.floor(Math.random() * pool.length)) % pool.length;
      setRolling(pool[index]);
    }, 70);
    try {
      const [draw] = await Promise.all([
        makeDraw({
          title: title.trim() || DEFAULT_TITLE[mode],
          mode,
          amount: mode === "order" ? pool.length : amount,
          codes: [...picked],
          extra: extraNames,
        }),
        new Promise((resolve) => setTimeout(resolve, 1400)),
      ]);
      setLatest(draw);
      setHistory((current) => [draw, ...current]);
    } catch (drawError) {
      setError(drawError?.message?.includes("rate_limited") ? "Бүгін тым көп жеребе тарттың. Ертең қайта көр." : "Болмады. Қайта көр.");
    }
    clearInterval(timer.current);
    setRolling(null);
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
          {mode === "groups" && "Таңдалғандарды кездейсоқ бірнеше топқа бөледі (топтардағы адам саны тең дерлік)."}
          {mode === "pick" && "Таңдалғандардың ішінен кездейсоқ бір немесе бірнеше адамды таңдайды."}
          {mode === "order" && "Барлығын кездейсоқ ретке қояды — жауап беру, қорғау кезегі үшін."}
        </p>

        <div className="draw-row">
          <div className="field draw-title">
            <label className="field__label" htmlFor="draw-title">Атауы</label>
            <input id="draw-title" className="input" maxLength={100} value={title} placeholder={DEFAULT_TITLE[mode]} onChange={(event) => setTitle(event.target.value)} />
          </div>
          {mode !== "order" && (
            <div className="field">
              <span className="field__label">{mode === "groups" ? "Топ саны" : "Неше адам"}</span>
              <div className="stepper">
                <button type="button" className="icon-button" onClick={() => setAmount(Math.max(mode === "groups" ? 2 : 1, amount - 1))} aria-label="Азайту">
                  <Minus size={16} />
                </button>
                <span aria-live="polite">{amount}</span>
                <button type="button" className="icon-button" onClick={() => setAmount(Math.min(max, amount + 1))} aria-label="Көбейту">
                  <Plus size={16} />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <span className="field__label draw-label">
            <Users size={14} aria-hidden="true" /> Қатысушылар · {pool.length}
          </span>
          <div className="draw-quick">
            <button type="button" className="search-chip" onClick={() => choose(() => true)}>Бүкіл сынып</button>
            <button type="button" className="search-chip" onClick={() => choose((row) => row.group_no === 1)}>1-топ</button>
            <button type="button" className="search-chip" onClick={() => choose((row) => row.group_no === 2)}>2-топ</button>
            <button type="button" className="search-chip" onClick={() => choose(() => false)}>Ешкім</button>
          </div>
          <div className="draw-people">
            {roster.map((row) => (
              <button
                key={row.code}
                type="button"
                className={`draw-person${picked.has(row.code) ? " is-on" : ""}${row.code === student?.code ? " is-me" : ""}`}
                onClick={() => toggle(row.code)}
                aria-pressed={picked.has(row.code)}
              >
                {row.full_name}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label className="field__label" htmlFor="draw-extra">Қосымша аттар <span className="muted">(үтір арқылы, міндетті емес)</span></label>
          <input id="draw-extra" className="input" value={extra} onChange={(event) => setExtra(event.target.value)} placeholder="Мысалы: 1-тақырып, 2-тақырып, 3-тақырып" />
        </div>

        {error && <p className="form__error" role="alert">{error}</p>}
        <button type="button" className="button button--primary button--block draw-go" onClick={run} disabled={Boolean(rolling)}>
          <Dices size={18} /> {rolling ? "Араластырылуда…" : "Бастау"}
        </button>
      </section>

      {(rolling || latest) && (
        <section className="panel draw-stage" aria-live="polite">
          {rolling ? (
            <div className="draw-rolling">{rolling}</div>
          ) : (
            <>
              <h2 className="panel-title">🎉 {latest.title}</h2>
              <DrawResult draw={latest} big />
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
                  </summary>
                  <DrawResult draw={draw} />
                  {(draw.created_by === student?.id || isAdmin) && (
                    <button type="button" className="button button--ghost button--sm" onClick={() => remove(draw)}>
                      <Trash2 size={14} /> Жою
                    </button>
                  )}
                </details>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
