// Semester grade logic. Pure functions only — no UI here, so it is easy to test.
//
// Final = ((AB1 + AB2) / 2) × 0.60 + Exam × 0.40   (100-point scale)

export const WEIGHTS = { ongoing: 0.6, exam: 0.4 };

// Reward thresholds are platform hints, NOT official scholarship decisions.
// "Above" means strictly greater than the value.
export const REWARD_RULES = [
  {
    id: "presidential",
    above: 90,
    title: "Президенттік шәкіртақы деңгейі",
    hint: "Өте жоғары нәтиже. Ресми шешімді университет қабылдайды.",
  },
  {
    id: "scholarship",
    above: 70,
    title: "Шәкіртақы деңгейі",
    hint: "Шәкіртақы шегінен жоғары. Ресми шешімді университет қабылдайды.",
  },
];

/**
 * Parse a raw input value.
 * Empty string → null (missing, NOT zero). Out of range or non-numeric → NaN.
 */
export function parseScore(raw) {
  if (raw === "" || raw === null || raw === undefined) return null;
  const value = Number(String(raw).replace(",", "."));
  if (!Number.isFinite(value) || value < 0 || value > 100) return Number.NaN;
  return value;
}

export function isValidScore(value) {
  return value !== null && !Number.isNaN(value);
}

/**
 * Calculate one course result.
 * status: "empty" | "partial" | "invalid" | "complete"
 */
export function calculateCourse({ ab1, ab2, exam }) {
  const scores = [parseScore(ab1), parseScore(ab2), parseScore(exam)];
  const [a1, a2, ex] = scores;

  if (scores.some((value) => Number.isNaN(value))) {
    return { status: "invalid", ongoing: null, examPart: null, final: null };
  }
  if (scores.every((value) => value === null)) {
    return { status: "empty", ongoing: null, examPart: null, final: null };
  }

  const ongoing =
    a1 !== null && a2 !== null ? ((a1 + a2) / 2) * WEIGHTS.ongoing : null;
  const examPart = ex !== null ? ex * WEIGHTS.exam : null;
  const complete = ongoing !== null && examPart !== null;

  return {
    status: complete ? "complete" : "partial",
    ongoing,
    examPart,
    final: complete ? ongoing + examPart : null,
  };
}

/** Average of completed courses only. Missing courses are excluded, not counted as 0. */
export function averageOfCompleted(results) {
  const finals = results
    .filter((result) => result.status === "complete")
    .map((result) => result.final);
  if (finals.length === 0) return null;
  return finals.reduce((sum, value) => sum + value, 0) / finals.length;
}

export function rewardFor(score) {
  if (score === null || score === undefined) return null;
  return REWARD_RULES.find((rule) => score > rule.above) ?? null;
}

export function formatScore(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(2).replace(".", ",");
}

// ---------------------------------------------------------------------------
// 4.0 scale (credit-system table used by Kazakhstan universities).
// The 100-point course result is rounded to a whole number, then looked up.
// ---------------------------------------------------------------------------
export const GPA_SCALE = [
  { min: 95, letter: "A", points: 4.0 },
  { min: 90, letter: "A-", points: 3.67 },
  { min: 85, letter: "B+", points: 3.33 },
  { min: 80, letter: "B", points: 3.0 },
  { min: 75, letter: "B-", points: 2.67 },
  { min: 70, letter: "C+", points: 2.33 },
  { min: 65, letter: "C", points: 2.0 },
  { min: 60, letter: "C-", points: 1.67 },
  { min: 55, letter: "D+", points: 1.33 },
  { min: 50, letter: "D", points: 1.0 },
  { min: 25, letter: "FX", points: 0 },
  { min: 0, letter: "F", points: 0 },
];

export function toGpa(score) {
  if (score === null || score === undefined || Number.isNaN(score)) return null;
  const rounded = Math.round(score);
  return GPA_SCALE.find((row) => rounded >= row.min) ?? GPA_SCALE[GPA_SCALE.length - 1];
}

/** Average GPA points over completed courses (equal weight per course). */
export function averageGpa(results) {
  const points = results
    .filter((result) => result.status === "complete")
    .map((result) => toGpa(result.final).points);
  if (points.length === 0) return null;
  return points.reduce((sum, value) => sum + value, 0) / points.length;
}

export function formatGpa(value) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toFixed(2).replace(".", ",");
}
