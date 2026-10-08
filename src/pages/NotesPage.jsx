import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarDays, NotebookPen, Plus } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import { markdownPreview } from "../components/ui/Markdown.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { listNotes } from "../features/notes/notesApi.js";
import { useQueryParam } from "../lib/useQueryParam.js";
import { courseAccent } from "../lib/courseStyle.js";
import { formatDateTime } from "../lib/due.js";
import { formatIsoDate } from "../lib/time.js";

export default function NotesPage() {
  const { courseById, courseBySlug } = useCatalog();
  const [courseSlug, setCourseSlug] = useQueryParam("course", "");
  const [state, setState] = useState({ status: "loading", items: [] });

  useEffect(() => {
    listNotes()
      .then((items) => setState({ status: "ready", items }))
      .catch(() => setState({ status: "error", items: [] }));
  }, []);

  const course = courseSlug ? courseBySlug(courseSlug) : null;
  const items = useMemo(() => (course ? state.items.filter((note) => note.course_id === course.id) : state.items), [state.items, course]);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Бірге жазамыз"
        title="Конспектілер"
        description="Әр сабақтың конспектісін бүкіл топ бірге жазады. Кім не өзгерткені сақталады — кез келген ескі нұсқаны қайтаруға болады."
        actions={
          <Link to={`/notes/new${course ? `?course=${course.slug}` : ""}`} className="button button--primary">
            <Plus size={16} /> Жаңа конспект
          </Link>
        }
      />

      <div className="toolbar">
        <CourseSelect id="notes-course" value={courseSlug} onChange={setCourseSlug} />
      </div>

      {state.status === "loading" && <p className="muted">Жүктелуде…</p>}
      {state.status === "error" && <p className="form__error">Конспектілер жүктелмеді. Бетті жаңарт.</p>}
      {state.status === "ready" && items.length === 0 && (
        <EmptyState icon={NotebookPen} title="Әзірге конспект жоқ">
          Бірінші болып жаз — сабақта не өткенін қысқаша түсір, қалғандары толықтырады.
        </EmptyState>
      )}

      <ul className="note-list">
        {items.map((note) => {
          const noteCourse = courseById(note.course_id);
          return (
            <li key={note.id}>
              <Link to={`/notes/${note.id}`} className="note-card" style={courseAccent(noteCourse)}>
                <div className="note-card__meta">
                  {noteCourse && <span className="tag">{noteCourse.code ?? noteCourse.name}</span>}
                  {note.lesson_date && (
                    <span className="note-card__date">
                      <CalendarDays size={13} aria-hidden="true" /> {formatIsoDate(note.lesson_date)}
                    </span>
                  )}
                </div>
                <strong className="note-card__title">{note.title}</strong>
                {note.body && <p className="note-card__preview">{markdownPreview(note.body)}</p>}
                <span className="note-card__by">
                  {note.updated_by_name ?? note.creator_name ?? "—"} · {formatDateTime(note.updated_at)}
                  {note.version > 1 && ` · ${note.version} нұсқа`}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
