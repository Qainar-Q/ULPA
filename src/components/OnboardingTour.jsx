import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation } from "react-router-dom";
import { ArrowLeft, ArrowRight, X } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { useAuth } from "../features/auth/AuthContext.jsx";

/**
 * First-login guided tour: highlights one part of the app at a time with a short
 * explanation. Next / back / skip. Remembered per student on the server, and can
 * be replayed from the profile page (window event "ulpa:tour").
 *
 * Each step lists candidate selectors; the first one visible on this screen is used
 * (bottom bar on phones, sidebar on computers). No target → centred card.
 */
const STEPS = [
  {
    title: "ULPA-ға қош келдің! 👋",
    text: "Бұл — ҒТТ сыныбының жеке оқу платформасы. Кесте, тапсырмалар, сабақ фотолары, GPA — бәрі бір жерде. Мұны тек біздің сынып көреді. 1 минутта қысқаша көрсетейін.",
  },
  {
    targets: ['.bottom-nav a[href="/"]', '.side-nav a[href="/"]'],
    title: "Басты бет",
    text: "Бүгінгі сабақтар, жақын тапсырмалар, хабарландырулар мен туған күндер — күн сайын осы жерден бастайсың.",
  },
  {
    targets: ['.bottom-nav a[href="/schedule"]', '.side-nav a[href="/schedule"]'],
    title: "Кесте",
    text: "Сенің тобыңның апталық кестесі: қай сабақ, қай аудиторияда, қазір не жүріп жатыр.",
  },
  {
    targets: ['.bottom-nav a[href="/photos"]', '.side-nav a[href="/photos"]'],
    title: "EASYФОТО",
    text: "Тақтаның фотосын түсіріп, сыныппен бөліс. Лайк бас, пікір жаз, керегін альбомға сақта.",
  },
  {
    targets: ['.bottom-nav a[href="/tasks"]', '.side-nav a[href="/tasks"]'],
    title: "Тапсырмалар",
    text: "Үй тапсырмалары мен мерзімдері. Орындаған соң «орындалды» деп белгіле — бұл белгі тек саған көрінеді. Жаңа тапсырманы өзің де қоса аласың.",
  },
  {
    targets: ['.bottom-nav a[href="/gpa"]', '.side-nav a[href="/gpa"]'],
    title: "GPA",
    text: "АБ1, АБ2 және емтихан бағаларын енгіз — әр пәннің және жалпы GPA өзі есептеледі. Бағаларыңды тек өзің көресің.",
  },
  {
    targets: [".quick-links", '.side-nav a[href="/announcements"]'],
    title: "Тағы не бар",
    text: "Материалдар, оқытушылардың байланысы, хабарландырулар, сынып дауыс беруі жеке қатысу есебің және кампус картасы. Қызыл нүкте — жаңа нәрсе бар деген сөз.",
  },
  {
    targets: [".topbar-search", ".side-search"],
    title: "Іздеу",
    text: "Тапсырма, материал, оқытушы, хабарландыру — бәрін осы жерден тез тап. Қазақ әріптерін теру міндетті емес: «канат» деп жазсаң, «қанат» та табылады.",
  },
  {
    targets: [".avatar-button", ".user-chip"],
    title: "Профиль",
    text: "Мұнда хабарландыруларды қосасың, Face ID / саусақ ізімен кіруді баптайсың және ақ/қара тақырыпты таңдайсың.",
  },
  {
    title: "Дайынсың! 🚀",
    text: "Кеңес: ULPA-ны телефонның басты экранына қос (Профиль → Телефонға орнату) — сонда қосымша сияқты ашылады және хабарландырулар келеді.",
    last: true,
  },
];

// "What's new" for students who finished the tour earlier. Each feature step has the
// time it was released; a student sees only the steps newer than their last tour.
// When adding a feature: append a step with `since` = release time (UTC).
const NEWS_INTRO = {
  title: "ULPA жаңарды ✨",
  text: "Сен соңғы рет кіргеннен бері жаңа мүмкіндіктер қосылды. Қысқаша көрсетейін.",
};
const NEWS_STEPS = [
  {
    since: "2026-10-07T18:15:00Z",
    targets: ['.quick-links a[href="/teachers"]', '.side-nav a[href="/teachers"]'],
    title: "Оқытушылар",
    text: "Әр пәннің оқытушысы: фотосы, кабинеті, кеңес уақыты. Бір басумен қоңырау шал, WhatsApp-қа немесе поштаға жаз.",
  },
  {
    since: "2026-10-07T18:15:00Z",
    targets: [".topbar-search", ".side-search"],
    title: "Іздеу",
    text: "Тапсырма, материал, оқытушы — бәрін осы жерден тез тап. Қазақ әріптерін теру міндетті емес: «канат» → «қанат».",
  },
  {
    since: "2026-10-07T18:35:00Z",
    targets: ['.quick-links a[href="/attendance"]', '.side-nav a[href="/attendance"]'],
    title: "Қатысуым",
    text: "Қай сабаққа бармағаныңды, кешіккеніңді белгіле — әр пән бойынша қатысу пайызы есептеледі. Мұны тек сен көресің.",
  },
  {
    since: "2026-10-07T19:35:00Z",
    targets: ['.quick-links a[href="/campus"]', '.side-nav a[href="/campus"]'],
    title: "Кампус картасы",
    text: "ҚазҰУ кампусының нақты картасы (2GIS орындарымен): ғимаратты басып, не орналасқанын көр, 2GIS-те маршрут аш. Кестедегі аудитория нөмірін бассаң — карта сол корпусты көрсетеді.",
  },
];
const NEWEST = Math.max(...NEWS_STEPS.map((step) => Date.parse(step.since)));

function newsSince(doneAt) {
  const done = Date.parse(doneAt);
  const fresh = NEWS_STEPS.filter((step) => Date.parse(step.since) > done);
  if (fresh.length === 0) return null;
  const steps = [NEWS_INTRO, ...fresh];
  steps[steps.length - 1] = { ...steps[steps.length - 1], last: true, cta: "Түсінікті!" };
  return steps;
}

const LOCAL_KEY = "ulpa-tour-done";
const PAD = 6;
const GAP = 12;

function visibleElement(selectors = []) {
  for (const selector of selectors) {
    for (const element of document.querySelectorAll(selector)) {
      const rect = element.getBoundingClientRect();
      if (rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden") return element;
    }
  }
  return null;
}

export default function OnboardingTour() {
  const { status, student } = useAuth();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [steps, setSteps] = useState(STEPS);
  const [rect, setRect] = useState(null);
  const [cardPos, setCardPos] = useState(null);
  const cardRef = useRef(null);
  const nextRef = useRef(null);
  const checkedRef = useRef(false);

  // First visit to the home page after signing in → show once, unless already done.
  useEffect(() => {
    if (status !== "signedIn" || !student || pathname !== "/" || checkedRef.current) return;
    checkedRef.current = true;
    const localKey = `${LOCAL_KEY}:${student.id}`;
    try {
      const local = Date.parse(localStorage.getItem(localKey) ?? "");
      if (local >= NEWEST) return; // finished after the latest features → nothing to show
    } catch {
      /* storage unavailable */
    }
    const show = (list) => {
      setSteps(list);
      setStep(0);
      setTimeout(() => setOpen(true), 600); // let the home page render first
    };
    supabase
      .from("onboarding_done")
      .select("done_at")
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) return; // offline or server issue: try again next time
        if (!data) return show(STEPS); // first time: full tour
        const news = newsSince(data.done_at); // seen an older tour: only what's new since then
        if (news) return show(news);
        try {
          localStorage.setItem(localKey, data.done_at);
        } catch {
          /* ignore */
        }
      });
  }, [status, student, pathname]);

  // Replay from the profile page.
  useEffect(() => {
    function replay() {
      setSteps(STEPS);
      setStep(0);
      setOpen(true);
    }
    window.addEventListener("ulpa:tour", replay);
    return () => window.removeEventListener("ulpa:tour", replay);
  }, []);

  const finish = useCallback(() => {
    setOpen(false);
    if (student) {
      try {
        localStorage.setItem(`${LOCAL_KEY}:${student.id}`, new Date().toISOString());
      } catch {
        /* ignore */
      }
    }
    supabase.rpc("complete_onboarding").then(() => {}, () => {});
  }, [student]);

  const current = steps[step];

  // Find and measure the highlighted element.
  const measure = useCallback(() => {
    const element = visibleElement(current?.targets);
    if (!element) return setRect(null);
    const r = element.getBoundingClientRect();
    setRect({ top: r.top - PAD, left: r.left - PAD, width: r.width + PAD * 2, height: r.height + PAD * 2 });
  }, [current]);

  useLayoutEffect(() => {
    if (!open) return undefined;
    const element = visibleElement(current?.targets);
    if (element) {
      const r = element.getBoundingClientRect();
      if (r.top < 70 || r.bottom > window.innerHeight - 80) element.scrollIntoView({ block: "center" });
    }
    measure();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [open, step, current, measure]);

  // Place the card next to the highlight (below if there is room, else above).
  useLayoutEffect(() => {
    if (!open || !cardRef.current) return;
    const card = cardRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    if (!rect) return setCardPos(null);
    const width = Math.min(340, vw - 32);
    let left = rect.left + rect.width / 2 - width / 2;
    left = Math.max(16, Math.min(left, vw - 16 - width));
    const below = rect.top + rect.height + GAP;
    const top = below + card.height <= vh - 12 ? below : Math.max(12, rect.top - GAP - card.height);
    // Sidebar items on computers: put the card to the right of the item instead.
    if (rect.left < 280 && vw >= 1024) {
      return setCardPos({ top: Math.max(12, Math.min(rect.top, vh - card.height - 12)), left: rect.left + rect.width + GAP, width });
    }
    setCardPos({ top, left, width });
  }, [open, rect, step]);

  useEffect(() => {
    if (!open) return undefined;
    nextRef.current?.focus({ preventScroll: true });
    function onKey(event) {
      if (event.key === "Escape") finish();
      if (event.key === "ArrowRight") setStep((value) => Math.min(value + 1, steps.length - 1));
      if (event.key === "ArrowLeft") setStep((value) => Math.max(value - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, step, steps, finish]);

  if (!open || !current) return null;

  const centred = !rect;
  return createPortal(
    <div className={`tour${centred ? " tour--centred" : ""}`} role="dialog" aria-modal="true" aria-labelledby="tour-title">
      {rect ? (
        <div className="tour__spot" style={{ top: rect.top, left: rect.left, width: rect.width, height: rect.height }} aria-hidden="true" />
      ) : (
        <div className="tour__dim" aria-hidden="true" />
      )}
      <div
        ref={cardRef}
        className="tour__card"
        style={cardPos && !centred ? { top: cardPos.top, left: cardPos.left, width: cardPos.width } : undefined}
        aria-live="polite"
      >
        <div className="tour__head">
          <span className="tour__count">
            {step + 1} / {steps.length}
          </span>
          {!current.last && (
            <button type="button" className="tour__skip" onClick={finish}>
              Өткізу <X size={14} />
            </button>
          )}
        </div>
        <h2 id="tour-title" className="tour__title">{current.title}</h2>
        <p className="tour__text">{current.text}</p>
        <div className="tour__dots" aria-hidden="true">
          {steps.map((_, index) => (
            <span key={index} className={index === step ? "is-active" : index < step ? "is-done" : undefined} />
          ))}
        </div>
        <div className="tour__actions">
          {step > 0 && !current.last && (
            <button type="button" className="button button--ghost" onClick={() => setStep(step - 1)}>
              <ArrowLeft size={16} /> Артқа
            </button>
          )}
          <button
            ref={nextRef}
            type="button"
            className="button button--primary tour__next"
            onClick={() => (current.last ? finish() : setStep(step + 1))}
          >
            {current.last ? current.cta ?? "Бастадық!" : step === 0 ? "Бастау" : "Келесі"} {!current.last && <ArrowRight size={16} />}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
