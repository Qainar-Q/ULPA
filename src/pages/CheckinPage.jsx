import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, MapPinCheck, XCircle } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { clock, myOpenCheckins, studentCheckin } from "../teacher/teacherApi.js";

const ERRORS = {
  wrong_code: "Код сәйкес келмеді немесе ескірді. Тақтадағы жаңа кодты енгіз.",
  too_many: "Тым көп әрекет. 10 минуттан кейін қайта көр.",
};

/** Students: check in to a lesson with the teacher's QR or 6-digit code. */
export default function CheckinPage() {
  const { courseById } = useCatalog();
  const [sessionParam] = useQueryParam("s", "");
  const [codeParam] = useQueryParam("c", "");
  const [code, setCode] = useState(codeParam);
  const [result, setResult] = useState(null);
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState([]);
  const tried = useRef(false);

  useEffect(() => {
    myOpenCheckins().then(setOpen).catch(() => {});
  }, [result]);

  async function submit(value = code, session = null) {
    const digits = String(value).replace(/\D/g, "");
    if (digits.length !== 6) return setResult({ ok: false, error: "format" });
    setBusy(true);
    try {
      setResult(await studentCheckin(digits, session));
    } catch {
      setResult({ ok: false, error: "network" });
    }
    setBusy(false);
  }

  // Opened from the QR: check in straight away.
  useEffect(() => {
    if (codeParam && !tried.current) {
      tried.current = true;
      submit(codeParam, sessionParam || null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam, sessionParam]);

  const course = result?.ok ? courseById(result.course_id) : null;

  return (
    <div className="stack-lg">
      <PageHeader eyebrow="Сабаққа" title="Белгілену" description="Оқытушы көрсеткен QR-ды телефон камерасымен сканерле немесе 6 таңбалы кодты енгіз. Код 20 секунд сайын ауысады." />

      {result?.ok ? (
        <section className="panel checkin-done">
          <CheckCircle2 size={44} aria-hidden="true" />
          <h2>{result.status === "late" ? "Белгілендің (кешіктің)" : "Белгілендің ✓"}</h2>
          <p>
            {course?.name ?? "Сабақ"} · {clock(result.start_time)}
          </p>
          <Link to="/" className="button button--ghost">Басты бетке</Link>
        </section>
      ) : (
        <form
          className="panel checkin-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          {open.filter((item) => !item.done).length > 0 && (
            <p className="checkin-form__open">
              <MapPinCheck size={16} aria-hidden="true" /> Қазір ашық:{" "}
              {open
                .filter((item) => !item.done)
                .map((item) => `${courseById(item.course_id)?.name ?? "сабақ"} (${clock(item.start_time)})`)
                .join(", ")}
            </p>
          )}
          <input
            className="input checkin-form__code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={7}
            placeholder="000 000"
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/[^\d ]/g, ""))}
            aria-label="6 таңбалы код"
            autoFocus={!codeParam}
          />
          {result && !result.ok && (
            <p className="form__error" role="alert">
              <XCircle size={14} aria-hidden="true" /> {ERRORS[result.error] ?? (result.error === "format" ? "6 сан енгіз." : "Интернетті тексер.")}
            </p>
          )}
          <button type="submit" className="button button--primary button--block" disabled={busy}>
            {busy ? "Тексерілуде…" : "Белгілену"}
          </button>
        </form>
      )}
      <p className="muted small">Белгіні оқытушы қояды не QR арқылы өзің қоясың. Өз қатысуыңды «Қатысу» бетінен көре аласың — басқалардыкі саған көрінбейді.</p>
    </div>
  );
}
