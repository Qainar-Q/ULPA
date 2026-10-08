import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BADGES, isEarned, rememberBadges, seenBadges } from "../../features/classlife/badges.js";
import { myBadges } from "../../features/classlife/classlifeApi.js";

/** Once per app start: congratulate on badges earned since last time. */
export default function BadgeToast() {
  const [fresh, setFresh] = useState([]);

  useEffect(() => {
    const timer = setTimeout(() => {
      myBadges()
        .then((rows) => {
          const earned = rows.filter((row) => isEarned(row) && BADGES[row.badge]).map((row) => row.badge);
          const seen = seenBadges();
          const firstRun = seen.size === 0;
          rememberBadges(earned);
          // First run: don't flood with old badges, only the welcome one.
          const newOnes = firstRun ? earned.filter((id) => id === "welcome") : earned.filter((id) => !seen.has(id));
          if (newOnes.length) setFresh(newOnes);
        })
        .catch(() => {});
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!fresh.length) return undefined;
    const timer = setTimeout(() => setFresh([]), 7000);
    return () => clearTimeout(timer);
  }, [fresh]);

  if (!fresh.length) return null;
  const first = BADGES[fresh[0]];
  return (
    <Link to="/profile#badges" className="badge-toast" role="status" onClick={() => setFresh([])}>
      <span className="badge-toast__emoji" aria-hidden="true">{first.emoji}</span>
      <span>
        <strong>Жаңа жетістік!</strong>
        <span>
          {first.name}
          {fresh.length > 1 && ` және тағы ${fresh.length - 1}`}
        </span>
      </span>
    </Link>
  );
}
