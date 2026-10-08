import { useEffect, useState } from "react";
import { BADGES, isEarned, rememberBadges } from "../../features/classlife/badges.js";
import { myBadges } from "../../features/classlife/classlifeApi.js";

/** Profile: all badges, earned ones lit, the rest with progress. */
export default function BadgesPanel() {
  const [rows, setRows] = useState(null);

  useEffect(() => {
    myBadges()
      .then((data) => {
        setRows(data);
        rememberBadges(data.filter(isEarned).map((row) => row.badge));
      })
      .catch(() => setRows([]));
  }, []);

  if (!rows) return null;
  const known = rows.filter((row) => BADGES[row.badge]);
  const earned = known.filter(isEarned).length;

  return (
    <section className="panel">
      <h2 className="panel-title">
        Жетістіктерім <span className="muted small">{earned}/{known.length}</span>
      </h2>
      <ul className="badges">
        {known
          .slice()
          .sort((a, b) => Number(isEarned(b)) - Number(isEarned(a)))
          .map((row) => {
            const meta = BADGES[row.badge];
            const done = isEarned(row);
            return (
              <li key={row.badge} className={`badge${done ? " is-earned" : ""}`}>
                <span className="badge__emoji" aria-hidden="true">{meta.emoji}</span>
                <strong>{meta.name}</strong>
                <span className="badge__text">{meta.text}</span>
                {!done && (
                  <span className="badge__progress" aria-label={`${row.progress} / ${row.goal}`}>
                    <span style={{ width: `${Math.min(100, (row.progress / row.goal) * 100)}%` }} />
                  </span>
                )}
                {!done && <span className="badge__count">{Math.min(row.progress, row.goal)}/{row.goal}</span>}
              </li>
            );
          })}
      </ul>
      <p className="muted small">Жетістіктерің тек өзіңе көрінеді.</p>
    </section>
  );
}
