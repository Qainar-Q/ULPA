import { Link } from "react-router-dom";
import { MapPin, UserRound } from "lucide-react";
import { courseAccent } from "../lib/courseStyle.js";
import { formatClock } from "../lib/schedule.js";
import { SESSION_TYPES } from "../config/app.js";

/**
 * One class in a schedule list.
 * state: "past" | "next" | "later" | undefined (week view)
 */
export default function SessionItem({ session, course, state, compact = false }) {
  const shared = session.group_no === null;

  return (
    <li className={`session${state ? ` session--${state}` : ""}${compact ? " session--compact" : ""}`} style={courseAccent(course)}>
      <div className="session__time">
        <strong>{formatClock(session.start_time)}</strong>
        {session.end_time && <small>{formatClock(session.end_time)}</small>}
        {state === "next" && <span className="session__now">Келесі</span>}
      </div>
      <div className="session__body">
        <Link to={`/courses/${course?.slug ?? ""}`} className="session__course">
          {course?.name ?? "—"}
        </Link>
        <div className="session__meta">
          <span className={`session__type session__type--${session.session_type}`}>
            {SESSION_TYPES[session.session_type]}
          </span>
          <span className="session__group">{shared ? "Екі топқа ортақ" : `${session.group_no}-топ`}</span>
          {session.room && (
            <span className="session__room">
              <MapPin size={13} aria-hidden="true" /> {session.room}
            </span>
          )}
          {!compact && course?.teacher && (
            <span className="session__teacher">
              <UserRound size={13} aria-hidden="true" /> {course.teacher}
            </span>
          )}
        </div>
      </div>
    </li>
  );
}
