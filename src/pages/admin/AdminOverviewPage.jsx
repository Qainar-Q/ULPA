import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CloudOff, RefreshCw } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import { supabase } from "../../lib/supabase.js";
import { useCatalog } from "../../features/catalog/CatalogContext.jsx";
import { courseAccent } from "../../lib/courseStyle.js";
import { dueInfo } from "../../lib/due.js";
import PresencePanel from "../../components/admin/PresencePanel.jsx";

function Meter({ value, total }) {
  const ratio = total ? value / total : 0;
  const tone = ratio >= 0.8 ? "good" : ratio >= 0.4 ? "mid" : "low";
  return (
    <div className={`meter meter--${tone}`} role="img" aria-label={`${value}/${total}`}>
      <span style={{ width: `${Math.max(ratio * 100, 2)}%` }} />
    </div>
  );
}

/** Admin class dashboard: activation, assignment completion, content per course. */
export default function AdminOverviewPage() {
  const { courseById } = useCatalog();
  const [state, setState] = useState({ status: "loading", data: null });

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc("admin_dashboard");
    setState(error ? { status: "error", data: null } : { status: "ready", data });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (state.status === "loading") return <div className="skeleton-list" aria-busy="true"><span /><span /><span /></div>;
  if (state.status === "error") {
    return <EmptyState icon={CloudOff} title="Жүктелмеді" action={<button type="button" className="button button--ghost" onClick={load}>Қайта көру</button>} />;
  }

  const d = state.data;
  const openAssignments = d.assignments.filter((a) => !a.due_at || new Date(a.due_at) > new Date());

  return (
    <>
      <PageHeader
        eyebrow="Әкімші"
        title="Сынып шолуы"
        actions={<button type="button" className="button button--ghost" onClick={load}><RefreshCw size={16} /> Жаңарту</button>}
      />

      <div className="stat-tiles">
        <div className="stat-tile"><span>Белсенді аккаунт</span><strong>{d.activated}<small>/{d.students}</small></strong><Meter value={d.activated} total={d.students} /></div>
        <div className="stat-tile"><span>Белсенді тапсырма</span><strong>{openAssignments.length}</strong></div>
        <div className="stat-tile"><span>Хабарландыру</span><strong>{d.announcements}</strong></div>
      </div>

      <PresencePanel />

      <section className="panel">
        <h2 className="panel-title">Белсендірмегендер · {d.not_activated.length}</h2>
        {d.not_activated.length === 0 ? (
          <p className="passkeys__ok">Барлығы белсендірді 🎉</p>
        ) : (
          <>
            <ul className="chip-list">
              {d.not_activated.map((s) => (
                <li key={s.code}><b>{s.code}</b> {s.full_name} <small>{s.group_no}-топ</small></li>
              ))}
            </ul>
            <Link to="/admin" className="text-link">Код беру →</Link>
          </>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Тапсырмаларды орындау</h2>
        {d.assignments.length === 0 ? (
          <p className="muted">Тапсырма жоқ.</p>
        ) : (
          <ul className="progress-list">
            {d.assignments.map((a) => {
              const course = courseById(a.course_id);
              const due = dueInfo(a.due_at);
              return (
                <li key={a.id} style={courseAccent(course)}>
                  <Link to={`/tasks/${a.id}`} className="progress-list__title">
                    <span className="course-code course-code--sm">{course?.code}</span> {a.title}
                  </Link>
                  <div className="progress-list__row">
                    <Meter value={a.done} total={a.target} />
                    <b>{a.done}/{a.target}</b>
                  </div>
                  <span className={`due due--${due.tone}`}>{due.label}{a.group_no ? ` · ${a.group_no}-топ` : ""}</span>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="panel">
        <h2 className="panel-title">Пәндер бойынша мазмұн</h2>
        <div className="table-scroll">
          <table className="data-table">
            <thead>
              <tr><th>Пән</th><th>Фото</th><th>Материал</th><th>Тапсырма</th></tr>
            </thead>
            <tbody>
              {d.courses.map((row) => {
                const course = courseById(row.course_id);
                return (
                  <tr key={row.course_id} style={courseAccent(course)}>
                    <td><span className="course-code course-code--sm">{course?.code}</span> <span className="data-table__name">{course?.name}</span></td>
                    <td className={row.photos ? undefined : "is-zero"}>{row.photos}</td>
                    <td className={row.materials ? undefined : "is-zero"}>{row.materials}</td>
                    <td className={row.assignments ? undefined : "is-zero"}>{row.assignments}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
