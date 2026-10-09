import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, RotateCcw, Sparkles, XCircle } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import Markdown, { InlineMarkdown } from "../components/ui/Markdown.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { holdBusy } from "../lib/busy.js";
import { aiErrorText, makeQuiz } from "../features/classlife/studyAi.js";

const LETTERS = ["A", "B", "C", "D"];

/** AI practice test from a course's shared notes: one question at a time, answer shown right away. */
export default function QuizPage() {
  const { courseBySlug } = useCatalog();
  const [courseSlug, setCourseSlug] = useQueryParam("course", "");
  const [count, setCount] = useState("5");
  const [phase, setPhase] = useState("setup"); // setup | loading | quiz | done
  const [questions, setQuestions] = useState([]);
  const [index, setIndex] = useState(0);
  const [picks, setPicks] = useState([]);
  const [error, setError] = useState(null);
  const [remaining, setRemaining] = useState(null);

  const course = courseSlug ? courseBySlug(courseSlug) : null;
  const score = useMemo(() => picks.filter((pick, i) => pick === questions[i]?.answer).length, [picks, questions]);

  async function start() {
    if (!course) return setError("Алдымен пәнді таңда.");
    setError(null);
    setPhase("loading");
    const release = holdBusy();
    try {
      const result = await makeQuiz(course.id, Number(count));
      setQuestions(result.questions);
      setRemaining(result.remaining ?? null);
      setPicks([]);
      setIndex(0);
      setPhase("quiz");
    } catch (quizError) {
      setError(aiErrorText(quizError.message));
      setPhase("setup");
    } finally {
      release();
    }
  }

  const question = questions[index];
  const picked = picks[index];
  const answered = picked !== undefined;
  const explainRef = useRef(null);

  // After answering, bring the explanation and "next" button into view (phones).
  useEffect(() => {
    if (answered) explainRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [answered, index]);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="AI көмекші"
        title="Өзіңді тексер"
        description="AI топтың конспектілері бойынша тест құрастырады. Емтиханға дайындалуға ыңғайлы."
      />

      {(phase === "setup" || phase === "loading") && (
        <section className="panel stack">
          <div className="field">
            <label className="field__label" htmlFor="quiz-course">Пән</label>
            <CourseSelect id="quiz-course" value={courseSlug} onChange={setCourseSlug} allLabel="Пәнді таңда" />
          </div>
          <div className="field">
            <span className="field__label">Сұрақ саны</span>
            <Segmented
              label="Сұрақ саны"
              options={[
                { id: "5", label: "5" },
                { id: "10", label: "10" },
              ]}
              value={count}
              onChange={setCount}
            />
          </div>
          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}
          <button type="button" className="button button--primary" onClick={start} disabled={phase === "loading"}>
            <Sparkles size={16} /> {phase === "loading" ? "AI сұрақ құрастырып жатыр… (~30 сек)" : "Тест құрастыру"}
          </button>
          <p className="muted small">
            Сұрақтар тек осы пәннің конспектілерінен алынады. AI кейде қателесуі мүмкін — күмәнді жерін конспектіден тексер. Күніне 10 рет.
          </p>
        </section>
      )}

      {phase === "quiz" && question && (
        <section className="panel quiz">
          <div className="quiz__progress" aria-hidden="true">
            {questions.map((_, i) => (
              <span key={i} className={i < index ? (picks[i] === questions[i].answer ? "is-ok" : "is-bad") : i === index ? "is-now" : ""} />
            ))}
          </div>
          <p className="quiz__count">
            {index + 1} / {questions.length} · {course?.name}
          </p>
          <div className="quiz__question">
            <Markdown text={question.q} />
          </div>
          <div className="quiz__options" role="radiogroup" aria-label="Жауап нұсқалары">
            {question.options.map((option, i) => {
              const state = !answered ? "" : i === question.answer ? " is-correct" : i === picked ? " is-wrong" : " is-dim";
              return (
                <button
                  key={i}
                  type="button"
                  role="radio"
                  aria-checked={picked === i}
                  className={`quiz__option${state}`}
                  disabled={answered}
                  onClick={() => setPicks((current) => Object.assign([...current], { [index]: i }))}
                >
                  <span className="quiz__letter">{LETTERS[i]}</span>
                  <span>
                    <InlineMarkdown text={option} />
                  </span>
                </button>
              );
            })}
          </div>
          {answered && (
            <div ref={explainRef} className={`quiz__explain${picked === question.answer ? " is-ok" : " is-bad"}`} aria-live="polite">
              <strong>
                {picked === question.answer ? (
                  <>
                    <CheckCircle2 size={16} /> Дұрыс!
                  </>
                ) : (
                  <>
                    <XCircle size={16} /> Дұрыс жауап: {LETTERS[question.answer]}
                  </>
                )}
              </strong>
              {question.explain && <Markdown text={question.explain} />}
              <button
                type="button"
                className="button button--primary"
                onClick={() => (index + 1 < questions.length ? setIndex(index + 1) : setPhase("done"))}
              >
                {index + 1 < questions.length ? "Келесі" : "Нәтиже"} <ArrowRight size={16} />
              </button>
            </div>
          )}
        </section>
      )}

      {phase === "done" && (
        <section className="panel quiz quiz--done">
          <p className="quiz__score">
            {score} / {questions.length}
          </p>
          <p>{score === questions.length ? "Керемет! Бәрі дұрыс 🎉" : score >= questions.length * 0.7 ? "Жақсы нәтиже 👍" : "Конспектіні тағы бір қарап шық 📖"}</p>
          <div className="roll-actions">
            <button type="button" className="button button--primary" onClick={start}>
              <RotateCcw size={16} /> Жаңа сұрақтар
            </button>
            <button type="button" className="button button--ghost" onClick={() => setPhase("setup")}>
              Басқа пән
            </button>
            <Link to={course ? `/notes?course=${course.slug}` : "/notes"} className="button button--ghost">
              Конспектілер
            </Link>
          </div>
          {remaining !== null && <p className="muted small">Бүгін тағы {remaining} рет AI қолдануға болады.</p>}
        </section>
      )}
    </div>
  );
}
