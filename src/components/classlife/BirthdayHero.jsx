import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Send, X } from "lucide-react";
import { birthdayWall, sendWish } from "../../features/classlife/classlifeApi.js";
import { almatyDateParts } from "../../lib/time.js";

const EMOJIS = ["🎂", "🎉", "🎁", "🥳", "💐", "❤️", "⭐", "🎈"];
const COLORS = ["#ff6b8a", "#ffd166", "#35e0cf", "#5b94ff", "#b388ff", "#ff9f43"];

function Confetti({ count = 70 }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, index) => ({
        left: Math.random() * 100,
        delay: Math.random() * 2.5,
        duration: 3 + Math.random() * 3,
        color: COLORS[index % COLORS.length],
        size: 6 + Math.random() * 7,
        round: Math.random() > 0.6,
      })),
    [count]
  );
  return (
    <div className="confetti" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          style={{
            left: `${piece.left}%`,
            width: piece.size,
            height: piece.round ? piece.size : piece.size * 0.45,
            borderRadius: piece.round ? "50%" : 2,
            background: piece.color,
            animationDelay: `${piece.delay}s`,
            animationDuration: `${piece.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

const todayKey = () => {
  const { year, month, day } = almatyDateParts(new Date());
  return `${year}-${month}-${day}`;
};

/** Full-screen celebration, shown once per day per device when home opens on a birthday. */
function Celebration({ people, isMe, onWish, onClose }) {
  useEffect(() => {
    function onKey(event) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const names = people.map((row) => row.full_name).join(" және ");
  return createPortal(
    <div className="bday-overlay" role="dialog" aria-modal="true" aria-label="Туған күн">
      <Confetti count={110} />
      <div className="bday-overlay__card">
        <button type="button" className="icon-button bday-overlay__close" onClick={onClose} aria-label="Жабу">
          <X size={18} />
        </button>
        <div className="bday-overlay__avatars">
          {people.map((row) => (
            <span key={row.code} className="bday-avatar bday-avatar--xl">
              {row.full_name.slice(0, 1)}
              <span className="bday-avatar__crown" aria-hidden="true">👑</span>
            </span>
          ))}
        </div>
        {isMe ? (
          <>
            <h2>Туған күніңмен, {people[0].full_name}! 🎉</h2>
            <p>Бүкіл ҒТТ тобы атынан құттықтаймыз! Сыныптастарыңның тілектері басты бетте.</p>
            <button type="button" className="button button--primary" onClick={onClose}>
              Рақмет! 🥳
            </button>
          </>
        ) : (
          <>
            <p className="bday-overlay__eyebrow">🎂 Бүгін туған күн!</p>
            <h2>{names}</h2>
            <p>Құттықтауды ұмытпа — бір ауыз тілек жаз, ол бірден хабарлама болып барады.</p>
            <button type="button" className="button button--primary" onClick={onWish}>
              🎁 Құттықтау жазу
            </button>
          </>
        )}
      </div>
    </div>,
    document.body
  );
}

function Wall({ person, isMe }) {
  const [wishes, setWishes] = useState([]);
  const [emoji, setEmoji] = useState("🎉");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function load() {
    try {
      setWishes(await birthdayWall(person.code));
    } catch {
      /* wall is optional */
    }
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person.code]);

  const mine = wishes.find((wish) => wish.mine);

  async function submit(event) {
    event.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await sendWish(person.code, emoji, body.trim());
      setBody("");
      await load();
    } catch {
      setError("Жіберілмеді. Қайта көр.");
    }
    setBusy(false);
  }

  return (
    <div className="bday-wall">
      {!isMe && (
        <form className="bday-compose" onSubmit={submit} id={`wish-${person.code}`}>
          <div className="bday-emojis" role="radiogroup" aria-label="Эмодзи">
            {EMOJIS.map((item) => (
              <button key={item} type="button" role="radio" aria-checked={emoji === item} className={`bday-emoji${emoji === item ? " is-on" : ""}`} onClick={() => setEmoji(item)}>
                {item}
              </button>
            ))}
          </div>
          <div className="bday-compose__row">
            <input
              className="input"
              maxLength={300}
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder={mine ? "Тілегіңді өзгерту…" : "Тілегіңді жаз…"}
              aria-label="Тілек"
            />
            <button type="submit" className="button button--primary" disabled={busy || !body.trim()} aria-label="Жіберу">
              <Send size={16} />
            </button>
          </div>
          {error && <p className="form__error">{error}</p>}
        </form>
      )}
      {wishes.length > 0 ? (
        <ul className="bday-wishes">
          {wishes.map((wish) => (
            <li key={wish.id} className={wish.mine ? "is-mine" : ""}>
              <span className="bday-wishes__emoji" aria-hidden="true">{wish.emoji}</span>
              <div>
                <strong>{wish.author_name ?? "Сыныптас"}</strong>
                <p>{wish.body}</p>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="bday-wall__empty">{isMe ? "Тілектер осында шығады 💌" : "Бірінші болып құттықта!"}</p>
      )}
    </div>
  );
}

/** Home page: today's birthday people, big and festive, with a wish wall. */
export default function BirthdayHero({ people, myCode }) {
  const iAmHero = people.some((row) => row.code === myCode);
  const seenKey = `ulpa-bday-${todayKey()}`;
  const [overlay, setOverlay] = useState(() => {
    try {
      return localStorage.getItem(seenKey) !== "1";
    } catch {
      return true;
    }
  });
  // Wait until the welcome tour (if any) is closed, so the two never overlap.
  const [tourOpen, setTourOpen] = useState(true);
  useEffect(() => {
    if (!overlay) return undefined;
    const check = () => setTourOpen(Boolean(document.querySelector(".tour")));
    const first = setTimeout(check, 1200);
    const timer = setInterval(check, 800);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [overlay]);

  function closeOverlay() {
    try {
      localStorage.setItem(seenKey, "1");
    } catch {
      /* fine: overlay shows again next time */
    }
    setOverlay(false);
  }

  return (
    <>
      {overlay && !tourOpen && (
        <Celebration
          people={iAmHero ? people.filter((row) => row.code === myCode) : people}
          isMe={iAmHero}
          onClose={closeOverlay}
          onWish={() => {
            closeOverlay();
            setTimeout(() => {
              const form = document.getElementById(`wish-${people[0].code}`);
              form?.scrollIntoView({ block: "center", behavior: "smooth" });
              form?.querySelector("input")?.focus({ preventScroll: true });
            }, 50);
          }}
        />
      )}
      {people.map((person) => {
        const isMe = person.code === myCode;
        return (
          <section key={person.code} className="bday-hero" aria-label="Туған күн">
            <Confetti count={28} />
            <div className="bday-hero__top">
              <span className="bday-avatar">
                {person.full_name.slice(0, 1)}
                <span className="bday-avatar__crown" aria-hidden="true">👑</span>
              </span>
              <div>
                <span className="bday-hero__eyebrow">🎂 Бүгін туған күн</span>
                <h2 className="bday-hero__name">{isMe ? `Туған күніңмен, ${person.full_name}!` : person.full_name}</h2>
                <p className="bday-hero__text">{isMe ? "Бүкіл топ атынан құттықтаймыз! Міне, сыныптастарыңның тілектері:" : "Бір ауыз жылы тілек жаз — ол бірден хабарлама болып жетеді."}</p>
              </div>
            </div>
            <Wall person={person} isMe={isMe} />
          </section>
        );
      })}
    </>
  );
}
