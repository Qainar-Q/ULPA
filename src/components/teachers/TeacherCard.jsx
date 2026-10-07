import { Link } from "react-router-dom";
import { Clock3, Mail, MapPin, MessageCircle, Pencil, Phone } from "lucide-react";
import { courseAccent } from "../../lib/courseStyle.js";
import { whatsappNumber } from "../../features/teachers/teacherApi.js";

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("");
}

/** One teacher: portrait, position, courses and one-tap contacts. */
export default function TeacherCard({ teacher, photoUrl, courses, onEdit, compact = false }) {
  const wa = whatsappNumber(teacher.phone);
  return (
    <article className={`teacher${compact ? " teacher--compact" : ""}`} id={`teacher-${teacher.id}`}>
      <div className="teacher__top">
        <div className="teacher__photo">
          {photoUrl ? <img src={photoUrl} alt={teacher.full_name} loading="lazy" decoding="async" /> : <span aria-hidden="true">{initials(teacher.full_name)}</span>}
        </div>
        <div className="teacher__id">
          <h3 className="teacher__name">{teacher.full_name}</h3>
          {teacher.position && <p className="teacher__position">{teacher.position}</p>}
          {courses.length > 0 && (
            <div className="teacher__courses">
              {courses.map((course) => (
                <Link key={course.id} to={`/courses/${course.slug}`} className="course-code course-code--sm" style={courseAccent(course)} title={course.name}>
                  {course.code}
                </Link>
              ))}
            </div>
          )}
        </div>
        {onEdit && (
          <button type="button" className="icon-button teacher__edit" onClick={onEdit} aria-label="Өзгерту">
            <Pencil size={15} />
          </button>
        )}
      </div>

      {!compact && (teacher.office || teacher.office_hours || teacher.note) && (
        <dl className="teacher__info">
          {teacher.office && (
            <div>
              <dt><MapPin size={14} aria-hidden="true" /> Кабинет</dt>
              <dd>{teacher.office}</dd>
            </div>
          )}
          {teacher.office_hours && (
            <div>
              <dt><Clock3 size={14} aria-hidden="true" /> Кеңес уақыты</dt>
              <dd>{teacher.office_hours}</dd>
            </div>
          )}
          {teacher.note && <p className="teacher__note">{teacher.note}</p>}
        </dl>
      )}

      {(teacher.phone || teacher.email) && (
        <div className="teacher__contacts">
          {teacher.phone && (
            <a className="teacher__contact" href={`tel:${teacher.phone.replace(/[^\d+]/g, "")}`}>
              <Phone size={15} /> <span>{teacher.phone}</span>
            </a>
          )}
          {wa && (
            <a className="teacher__contact teacher__contact--wa" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer">
              <MessageCircle size={15} /> <span>WhatsApp</span>
            </a>
          )}
          {teacher.email && (
            <a className="teacher__contact" href={`mailto:${teacher.email}`}>
              <Mail size={15} /> <span>{teacher.email}</span>
            </a>
          )}
        </div>
      )}
    </article>
  );
}
