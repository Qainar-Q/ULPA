import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { BookOpen, Camera, ClipboardList, FileText, GraduationCap, History, Megaphone, Search, Vote, X } from "lucide-react";
import EmptyState from "../components/ui/EmptyState.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { courseAccent } from "../lib/courseStyle.js";
import { clearRecentSearches, highlight, recentSearches, rememberSearch, searchAll, snippet } from "../features/search/searchApi.js";

const KINDS = {
  course: { label: "Пәндер", icon: BookOpen },
  task: { label: "Тапсырмалар", icon: ClipboardList },
  announcement: { label: "Хабарландырулар", icon: Megaphone },
  material: { label: "Материалдар", icon: FileText },
  teacher: { label: "Оқытушылар", icon: GraduationCap },
  photo: { label: "Фотолар", icon: Camera },
  poll: { label: "Сауалнамалар", icon: Vote },
};
const ORDER = ["course", "task", "material", "teacher", "announcement", "poll", "photo"];

function linkFor(item, course) {
  switch (item.kind) {
    case "course":
      return course ? `/courses/${course.slug}` : "/";
    case "task":
      return `/tasks/${item.id}`;
    case "material":
      return course ? `/courses/${course.slug}#materials` : "/materials";
    case "teacher":
      return `/teachers#teacher-${item.id}`;
    case "photo":
      return course ? `/photos?course=${course.slug}` : "/photos";
    case "poll":
      return "/polls";
    default:
      return "/announcements";
  }
}

function Marked({ text, query }) {
  return highlight(text, query).map((part, index) => (part.hit ? <mark key={index}>{part.text}</mark> : <span key={index}>{part.text}</span>));
}

export default function SearchPage() {
  const { courseById, courses } = useCatalog();
  const [param, setParam] = useQueryParam("q", "");
  const [query, setQuery] = useState(param);
  const [state, setState] = useState({ status: "idle", items: [], for: "" });
  const [recent, setRecent] = useState(recentSearches);
  const inputRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Search 250 ms after typing stops; keep the query in the address bar.
  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setState({ status: "idle", items: [], for: "" });
      return undefined;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState((current) => ({ ...current, status: "loading" }));
      setParam(value, { replace: true });
      try {
        const items = await searchAll(value);
        if (!cancelled) setState({ status: "ready", items, for: value });
      } catch {
        if (!cancelled) setState({ status: "error", items: [], for: value });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const groups = useMemo(() => {
    const byKind = {};
    for (const item of state.items) (byKind[item.kind] ??= []).push(item);
    return ORDER.filter((kind) => byKind[kind]?.length).map((kind) => ({ kind, items: byKind[kind] }));
  }, [state.items]);

  function choose(value) {
    setQuery(value);
    inputRef.current?.focus();
  }

  const showIntro = query.trim().length < 2;

  return (
    <div className="stack-lg search-page">
      <form
        className="search-box"
        role="search"
        onSubmit={(event) => {
          event.preventDefault();
          rememberSearch(query);
          setRecent(recentSearches());
          inputRef.current?.blur();
        }}
      >
        <Search size={20} aria-hidden="true" />
        <input
          ref={inputRef}
          type="search"
          className="search-box__input"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Тапсырма, пән, материал, оқытушы…"
          aria-label="Іздеу"
          enterKeyHint="search"
          maxLength={80}
          autoComplete="off"
        />
        {query && (
          <button type="button" className="search-box__clear" onClick={() => choose("")} aria-label="Тазалау">
            <X size={18} />
          </button>
        )}
      </form>

      {showIntro && (
        <div className="search-intro">
          {recent.length > 0 && (
            <section>
              <div className="search-intro__head">
                <h2>Соңғы іздеулер</h2>
                <button type="button" className="text-link" onClick={() => (clearRecentSearches(), setRecent([]))}>Тазалау</button>
              </div>
              <div className="search-chips">
                {recent.map((item) => (
                  <button key={item} type="button" className="search-chip" onClick={() => choose(item)}>
                    <History size={14} /> {item}
                  </button>
                ))}
              </div>
            </section>
          )}
          <section>
            <h2>Пәндер</h2>
            <div className="search-chips">
              {courses.map((course) => (
                <button key={course.id} type="button" className="search-chip" style={courseAccent(course)} onClick={() => choose(course.name)}>
                  <span className="course-code course-code--sm">{course.code}</span> {course.name}
                </button>
              ))}
            </div>
          </section>
          <p className="muted small">Кеңес: қазақ әріптерін теру міндетті емес — «канат» деп жазсаң, «қанат» та табылады.</p>
        </div>
      )}

      {!showIntro && state.status === "loading" && state.items.length === 0 && <div className="skeleton-list" aria-busy="true"><span /><span /></div>}
      {!showIntro && state.status === "error" && <EmptyState icon={Search} title="Іздеу жұмыс істемеді">Интернетті тексеріп, қайта көр.</EmptyState>}
      {!showIntro && state.status === "ready" && state.items.length === 0 && (
        <EmptyState icon={Search} title="Ештеңе табылмады">Басқа сөзбен немесе қысқарақ жазып көр.</EmptyState>
      )}

      {!showIntro && groups.length > 0 && (
        <div className="search-results" aria-live="polite">
          <p className="muted small">{state.items.length} нәтиже</p>
          {groups.map(({ kind, items }) => {
            const { label, icon: Icon } = KINDS[kind];
            return (
              <section key={kind} className="search-group">
                <h2 className="search-group__title">
                  <Icon size={16} aria-hidden="true" /> {label} <span>{items.length}</span>
                </h2>
                <ul>
                  {items.map((item) => {
                    const course = item.course_id ? courseById(item.course_id) : null;
                    const body = snippet(item.body, state.for);
                    return (
                      <li key={`${kind}-${item.id}`}>
                        <Link to={linkFor(item, course)} className="search-hit" style={courseAccent(course)} onClick={() => rememberSearch(state.for)}>
                          <span className="search-hit__title">
                            {course && kind !== "course" && <span className="course-code course-code--sm">{course.code}</span>}
                            <Marked text={item.title || "Фото"} query={state.for} />
                          </span>
                          {body && (
                            <span className="search-hit__body">
                              <Marked text={body} query={state.for} />
                            </span>
                          )}
                          {item.group_no && <span className="search-hit__meta">{item.group_no}-топ</span>}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
