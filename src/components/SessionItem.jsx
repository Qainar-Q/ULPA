import { Link } from "react-router-dom";
import { MapPin, UserRound } from "lucide-react";
import { courseAccent } from "../lib/courseStyle.js";
import { formatClock, sessionProgress } from "../lib/schedule.js";
import { SESSION_TYPES } from "../config/app.js";

/**
 * One class in a schedule list.
 * state: "now" | "past" | "next" | "later" | undefined (another day)
 */
export default function SessionItem({ session, course, state, now, compact = false }) {
  const shared = session.group_no === null;
  const progress = state === "now" ? sessionProgress(session, now) : null;

  return (
    <li className={`session${state ? ` session--${state}` : ""}${compact ? " session--compact" : ""}`} style={courseAccent(course)}>
      <div className="session__time">
        <strong>{formatClock(session.start_time)}</strong>
        {session.end_time && <small>{formatClock(session.end_time)}</small>}
        {state === "next" && <span className="session__now">Келесі</span>}
        {state === "now" && <span className="session__now session__now--live">Қазір</span>}
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
          {progress && <span className="session__left">{progress.minutesLeft} мин қалды</span>}
          {!compact && course?.teacher && (
            <span className="session__teacher">
              <UserRound size={13} aria-hidden="true" /> {course.teacher}
            </span>
          )}
        </div>
      </div>
      {progress && (
        <span className="session__progress" aria-hidden="true">
          <span style={{ width: `${Math.round(progress.ratio * 100)}%` }} />
        </span>
      )}
    </li>
  );
}
