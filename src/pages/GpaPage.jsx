import { useEffect, useMemo, useRef } from "react";
import { Award, RotateCcw, Sparkles, Volume2, Vibrate } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import { COURSES, courseAccent } from "../data/courses.js";
import { useGpa } from "../features/gpa/GpaContext.jsx";
import { playChime, vibrate } from "../features/gpa/rewardFeedback.js";
import {
  REWARD_RULES,
  averageOfCompleted,
  calculateCourse,
  formatScore,
  rewardFor,
} from "../lib/gpa.js";

const FIELDS = [
  { key: "ab1", label: "АБ1" },
  { key: "ab2", label: "АБ2" },
  { key: "exam", label: "Емтихан" },
];

const STATUS_TEXT = {
  empty: "Баға енгізілмеген",
  partial: "Аяқталмаған",
  invalid: "0–100 аралығында енгіз",
};

export default function GpaPage() {
  const { entries, updateEntry, clearAll, feedback, setFeedback } = useGpa();

  const results = useMemo(
    () => COURSES.map((course) => ({ course, ...calculateCourse(entries[course.slug]) })),
    [entries]
  );
  const average = averageOfCompleted(results);
  const completedCount = results.filter((result) => result.status === "complete").length;
  const reward = rewardFor(average);

  // Fire optional feedback only when the tier goes UP.
  const previousTier = useRef(reward?.id ?? null);
  useEffect(() => {
    const rank = (id) => (id ? REWARD_RULES.length - REWARD_RULES.findIndex((r) => r.id === id) : 0);
    const current = reward?.id ?? null;
    if (rank(current) > rank(previousTier.current)) {
      if (feedback.vibration) vibrate(current === "presidential" ? [40, 60, 40, 60, 80] : [40]);
      if (feedback.sound) playChime(current);
    }
    previousTier.current = current;
  }, [reward, feedback]);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Семестр нәтижесі"
        title="GPA калькуляторы"
        description="Бағаларды енгізсең, нәтиже бірден есептеледі. Бос қалған баға 0 деп саналмайды."
        actions={
          <button type="button" className="button button--ghost" onClick={clearAll}>
            <RotateCcw size={16} /> Тазалау
          </button>
        }
      />

      <div className="gpa-layout">
        <div className="gpa-courses">
          {results.map(({ course, status, ongoing, examPart, final }) => {
            const entry = entries[course.slug];
            return (
              <section key={course.slug} className="gpa-row" style={courseAccent(course)}>
                <div className="gpa-row__head">
                  <span className="course-code">{course.code}</span>
                  <h3 className="gpa-row__name">{course.name}</h3>
                </div>

                <div className="gpa-row__inputs">
                  {FIELDS.map((field) => {
                    const id = `${course.slug}-${field.key}`;
                    return (
                      <label key={field.key} className="score-field" htmlFor={id}>
                        <span>{field.label}</span>
                        <input
                          id={id}
                          className="input input--score"
                          type="number"
                          inputMode="decimal"
                          min="0"
                          max="100"
                          step="0.01"
                          placeholder="—"
                          value={entry[field.key]}
                          onChange={(event) => updateEntry(course.slug, field.key, event.target.value)}
                          aria-invalid={status === "invalid"}
                        />
                      </label>
                    );
                  })}
                </div>

                <div className={`gpa-row__result gpa-row__result--${status}`}>
                  {status === "complete" ? (
                    <>
                      <strong>{formatScore(final)}</strong>
                      <small>
                        {formatScore(ongoing)} + {formatScore(examPart)}
                      </small>
                    </>
                  ) : (
                    <span>{STATUS_TEXT[status]}</span>
                  )}
                </div>
              </section>
            );
          })}
        </div>

        <aside className="gpa-score" aria-label="Орташа нәтиже">
          <div className={`score-card${reward ? ` score-card--${reward.id}` : ""}`}>
            <span className="eyebrow">Орташа нәтиже</span>
            <div className="score-card__value" aria-live="polite">
              {formatScore(average)}
            </div>
            <span className="score-card__scale">
              100 баллдық жүйе · {completedCount}/{COURSES.length} пән толық
            </span>

            {reward ? (
              <div className="reward" key={reward.id}>
                {reward.id === "presidential" ? <Sparkles size={18} /> : <Award size={18} />}
                <div>
                  <strong>{reward.title}</strong>
                  <p>{reward.hint}</p>
                </div>
              </div>
            ) : (
              average !== null && <p className="score-card__hint">70 баллдан жоғары болса, шәкіртақы белгісі шығады.</p>
            )}
          </div>
        </aside>

        <div className="gpa-extra">
          <div className="panel formula">
            <span className="eyebrow">Формула</span>
            <p className="formula__expr">
              ((АБ1 + АБ2) / 2) × 0,60 + Емтихан × 0,40
            </p>
            <ul className="formula__legend">
              <li><span>Ағымдағы бағалар</span><strong>60%</strong></li>
              <li><span>Емтихан</span><strong>40%</strong></li>
            </ul>
            <p className="formula__note">
              Белгілер платформаның ескертуі ғана, ресми шәкіртақы шешімі емес.
            </p>
          </div>

          <div className="panel toggles">
            <span className="eyebrow">Марапат әсерлері</span>
            <label className="toggle">
              <Volume2 size={17} />
              <span>Дыбыс</span>
              <input
                type="checkbox"
                checked={feedback.sound}
                onChange={(event) => setFeedback((current) => ({ ...current, sound: event.target.checked }))}
              />
              <span className="toggle__track" aria-hidden="true" />
            </label>
            <label className="toggle">
              <Vibrate size={17} />
              <span>Діріл</span>
              <input
                type="checkbox"
                checked={feedback.vibration}
                onChange={(event) => setFeedback((current) => ({ ...current, vibration: event.target.checked }))}
              />
              <span className="toggle__track" aria-hidden="true" />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}
