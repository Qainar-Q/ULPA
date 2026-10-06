import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { courseAccent } from "../data/courses.js";

/**
 * Clickable course card. "Next class" and "open tasks" show a dash until
 * the schedule and tasks are stored in the database (stages 4 and 6).
 */
export default function CourseCard({ course }) {
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
          <dd>—</dd>
        </div>
        <div>
          <dt>Тапсырма</dt>
          <dd>—</dd>
        </div>
      </dl>
    </Link>
  );
}
