import { useNavigate, useParams } from "react-router-dom";
import RollView from "./RollView.jsx";
import CheckinView from "./CheckinView.jsx";
import CourseStatsView from "./CourseStatsView.jsx";
import { coursesOf, useTeacherSchedule } from "./useTeacherSchedule.js";

function useEntry() {
  const { entryId } = useParams();
  const { status, rows } = useTeacherSchedule();
  return { status, entry: rows.find((row) => row.id === entryId) ?? null };
}

const Missing = ({ status }) => (status === "loading" ? <p className="muted">Жүктелуде…</p> : <p className="form__error">Сабақ табылмады немесе рұқсат жоқ.</p>);

export function RollRoute({ base = "" }) {
  const { date } = useParams();
  const navigate = useNavigate();
  const { status, entry } = useEntry();
  if (!entry) return <Missing status={status} />;
  return <RollView entry={entry} date={date} base={base} onDate={(next) => navigate(`${base}/lesson/${entry.id}/${next}`, { replace: true })} />;
}

export function CheckinRoute({ base = "" }) {
  const { date } = useParams();
  const { status, entry } = useEntry();
  if (!entry) return <Missing status={status} />;
  return <CheckinView entry={entry} date={date} base={base} />;
}

export function CourseRoute({ base = "" }) {
  const { courseId } = useParams();
  const { status, rows } = useTeacherSchedule();
  const course = coursesOf(rows).find((item) => item.id === courseId);
  if (!course) return <Missing status={status} />;
  return <CourseStatsView course={course} base={base} />;
}
