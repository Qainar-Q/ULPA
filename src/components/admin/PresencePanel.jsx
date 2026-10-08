import { useCallback, useEffect, useState } from "react";
import { supabase } from "../../lib/supabase.js";
import { useVisiblePolling } from "../../lib/useVisiblePolling.js";

/** Online comes from the server clock; the rest is relative to this device's time. */
function ago(row, now) {
  if (row.online) return "қазір онлайн";
  if (!row.last_seen) return "ешқашан кірмеген";
  const minutes = Math.max(1, Math.floor((now - new Date(row.last_seen)) / 60000));
  if (minutes < 60) return `${minutes} мин бұрын`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} сағ бұрын`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "кеше";
  return `${days} күн бұрын`;
}

function Spark({ values }) {
  const max = Math.max(5, ...values);
  return (
    <span className="spark" aria-hidden="true">
      {values.map((value, index) => (
        <span key={index} style={{ height: `${value ? Math.max(14, (value / max) * 100) : 6}%` }} className={value ? "is-on" : undefined} />
      ))}
    </span>
  );
}

/** Admin: who is online, last visit and how often each student uses ULPA. */
export default function PresencePanel() {
  const [rows, setRows] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_presence");
    if (!error) setRows(data);
    setNow(Date.now());
  }, []);

  useVisiblePolling(load, 30 * 1000);

  if (!rows) return <div className="skeleton-list" aria-busy="true"><span /><span /></div>;

  const sorted = [...rows].sort((a, b) => {
    if (a.online !== b.online) return a.online ? -1 : 1;
    return (b.last_seen ?? "").localeCompare(a.last_seen ?? "");
  });
  const online = rows.filter((row) => row.online).length;
  const today = rows.filter((row) => row.minutes_today > 0).length;
  const week = rows.filter((row) => row.days_7 > 0).length;

  return (
    <section className="panel presence">
      <h2 className="panel-title">Белсенділік</h2>
      <div className="presence__tiles">
        <div><strong className="is-online">{online}</strong><span>қазір онлайн</span></div>
        <div><strong>{today}</strong><span>бүгін кірді</span></div>
        <div><strong>{week}</strong><span>7 күнде кірді</span></div>
      </div>
      <ul className="presence__list">
        {sorted.map((row) => (
          <li key={row.code} className={row.online ? "is-online" : undefined}>
            <span className="presence__avatar" aria-hidden="true">
              {row.full_name.slice(0, 1)}
              {row.online && <i />}
            </span>
            <span className="presence__who">
              <strong>{row.full_name}</strong>
              <small>
                {row.code} · {row.group_no}-топ · {row.activated ? ago(row, now) : "белсендірмеген"}
              </small>
            </span>
            <span className="presence__freq">
              <Spark values={row.last_14 ?? []} />
              <small>
                7 күн: {row.days_7} күн · {row.minutes_7} мин
              </small>
            </span>
          </li>
        ))}
      </ul>
      <p className="muted small">Соңғы 14 күн, әр баған — бір күндегі белсенді минуттар. Студенттер профилінде бұл туралы ескертілген.</p>
    </section>
  );
}
