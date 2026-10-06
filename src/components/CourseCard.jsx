import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { courseAccent } from "../lib/courseStyle.js";
import { formatClock } from "../lib/schedule.js";
import { WEEKDAYS } from "../lib/time.js";

/**
 * Clickable course card. `next` = { session, daysAhead } from nextSession().
 */
export default function CourseCard({ course, next, openTasks = 0 }) {
  const nextLabel = next
    ? next.daysAhead === 0
      ? `Бүгін ${formatClock(next.session.start_time)}`
      : `${WEEKDAYS[next.session.weekday - 1].short} ${formatClock(next.session.start_time)}`
    : "—";

  return (
    <Link to={`/courses/${course.slug}`} className="course-card" style={courseAccent(course)}>
      <div className="course-card__top">
        <span className="course-code">{course.code}</span>
        <ArrowUpRight size={18} className="course-card__arrow" aria-hidden="true" />
      </div>
      <h3 className="course-card__name">{course.name}</h3>
      <p className="course-card__teacher">{course.teacher}</p>
      <dl className="course-card__meta">
        <div>
          <dt>Келесі сабақ</dt>
          <dd>{nextLabel}</dd>
        </div>
        <div>
          <dt>Тапсырма</dt>
          <dd className={openTasks > 0 ? "has-tasks" : undefined}>{openTasks > 0 ? `${openTasks} орындалмаған` : "—"}</dd>
        </div>
      </dl>
    </Link>
  );
}
