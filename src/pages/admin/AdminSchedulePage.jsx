import { useState } from "react";
import { Clock, Pencil, Plus, Trash2 } from "lucide-react";
import PageHeader from "../../components/ui/PageHeader.jsx";
import Segmented from "../../components/ui/Segmented.jsx";
import Modal from "../../components/ui/Modal.jsx";
import EmptyState from "../../components/ui/EmptyState.jsx";
import CatalogState from "../../components/CatalogState.jsx";
import { useCatalog } from "../../features/catalog/CatalogContext.jsx";
import {
  createSession,
  deleteSession,
  scheduleErrorMessage,
  setMissingEndTimes,
  updateSession,
} from "../../features/catalog/scheduleApi.js";
import { WEEKDAYS, almatyWeekday } from "../../lib/time.js";
import { formatClock, sessionsOnDay } from "../../lib/schedule.js";
import { courseAccent } from "../../lib/courseStyle.js";
import { SESSION_TYPES } from "../../config/app.js";

const DAYS = WEEKDAYS.slice(0, 6);
const GROUP_FILTERS = [
  { id: "all", label: "Барлығы" },
  { id: "1", label: "1-топ" },
  { id: "2", label: "2-топ" },
];

function emptyForm(weekday) {
  return { courseId: "", weekday: String(weekday), startTime: "08:00", endTime: "", room: "", sessionType: "lecture", groupNo: "both" };
}

function formFromSession(session) {
  return {
    courseId: session.course_id,
    weekday: String(session.weekday),
    startTime: formatClock(session.start_time),
    endTime: formatClock(session.end_time),
    room: session.room ?? "",
    sessionType: session.session_type,
    groupNo: session.group_no === null ? "both" : String(session.group_no),
  };
}

function SessionForm({ initial, editingId, onClose, onSaved }) {
  const { courses } = useCatalog();
  const [form, setForm] = useState(initial);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (key) => (value) => setForm((current) => ({ ...current, [key]: value }));

  // Labs always belong to one group.
  const groupOptions =
    form.sessionType === "lab"
      ? [{ id: "1", label: "1-топ" }, { id: "2", label: "2-топ" }]
      : [{ id: "both", label: "Екі топқа ортақ" }, { id: "1", label: "1-топ" }, { id: "2", label: "2-топ" }];

  function changeType(type) {
    setForm((current) => ({
      ...current,
      sessionType: type,
      groupNo: type === "lab" && current.groupNo === "both" ? "1" : current.groupNo,
    }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!form.courseId) return setError("Пәнді таңда.");
    setBusy(true);
    setError(null);
    try {
      if (editingId) await updateSession(editingId, form);
      else await createSession(form);
      await onSaved();
      onClose();
    } catch (saveError) {
      setError(scheduleErrorMessage(saveError));
      setBusy(false);
    }
  }

  return (
    <Modal title={editingId ? "Сабақты өзгерту" : "Сабақ қосу"} onClose={onClose}>
      <form className="upload" onSubmit={handleSubmit}>
        <div className="field">
          <label className="field__label" htmlFor="sf-course">Пән</label>
          <div className="select-wrap">
            <select id="sf-course" className="input" value={form.courseId} onChange={(event) => set("courseId")(event.target.value)}>
              <option value="">Пәнді таңда…</option>
              {courses.map((course) => (
                <option key={course.id} value={course.id}>{course.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label className="field__label" htmlFor="sf-day">Күн</label>
          <div className="select-wrap">
            <select id="sf-day" className="input" value={form.weekday} onChange={(event) => set("weekday")(event.target.value)}>
              {DAYS.map((day) => (
                <option key={day.id} value={day.id}>{day.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="form-grid">
          <div className="field">
            <label className="field__label" htmlFor="sf-start">Басталуы</label>
            <input id="sf-start" type="time" className="input" value={form.startTime} onChange={(event) => set("startTime")(event.target.value)} required />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sf-end">Аяқталуы</label>
            <input id="sf-end" type="time" className="input" value={form.endTime} onChange={(event) => set("endTime")(event.target.value)} />
          </div>
          <div className="field">
            <label className="field__label" htmlFor="sf-room">Аудитория</label>
            <input id="sf-room" className="input" maxLength={40} value={form.room} onChange={(event) => set("room")(event.target.value)} placeholder="114" />
          </div>
        </div>

        <div className="field">
          <span className="field__label">Түрі</span>
          <Segmented
            label="Сабақ түрі"
            options={[{ id: "lecture", label: SESSION_TYPES.lecture }, { id: "lab", label: SESSION_TYPES.lab }]}
            value={form.sessionType}
            onChange={changeType}
          />
        </div>

        <div className="field">
          <span className="field__label">Кімге</span>
          <Segmented label="Топ" options={groupOptions} value={form.groupNo} onChange={set("groupNo")} />
        </div>

        {error && <p className="form__error" role="alert">{error}</p>}

        <button type="submit" className="button button--primary button--block" disabled={busy}>
          {busy ? "Сақталуда…" : "Сақтау"}
        </button>
      </form>
    </Modal>
  );
}

function EndTimeTool({ sessions, onDone }) {
  const missing = sessions.filter((session) => !session.end_time).length;
  const [minutes, setMinutes] = useState("50");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);

  if (missing === 0) return null;

  async function apply() {
    const value = Number(minutes);
    if (!Number.isInteger(value) || value < 10 || value > 240) return setMessage("10–240 минут аралығында енгіз.");
    if (!window.confirm(`Аяқталу уақыты жоқ ${missing} сабаққа «басталуы + ${value} мин» қойылсын ба?`)) return;
    setBusy(true);
    setMessage(null);
    try {
      const count = await setMissingEndTimes(sessions, value);
      await onDone();
      setMessage(`${count} сабақ жаңартылды.`);
    } catch (error) {
      setMessage(scheduleErrorMessage(error));
    }
    setBusy(false);
  }

  return (
    <section className="panel end-tool">
      <Clock size={18} aria-hidden="true" />
      <div className="end-tool__text">
        <strong>{missing} сабақтың аяқталу уақыты жоқ</strong>
        <p>Бір сабақ неше минут екенін енгізсең, барлығына бірден қойылады.</p>
        {message && <p className="end-tool__message">{message}</p>}
      </div>
      <div className="end-tool__form">
        <input
          className="input end-tool__input"
          inputMode="numeric"
          value={minutes}
          onChange={(event) => setMinutes(event.target.value.replace(/\D/g, ""))}
          aria-label="Сабақ ұзақтығы, минут"
        />
        <span>мин</span>
        <button type="button" className="button button--ghost button--sm" onClick={apply} disabled={busy}>
          Қою
        </button>
      </div>
    </section>
  );
}

export default function AdminSchedulePage() {
  const { sessions, courseById, reload } = useCatalog();
  const today = almatyWeekday();
  const [day, setDay] = useState(today <= 6 ? today : 1);
  const [group, setGroup] = useState("all");
  const [editing, setEditing] = useState(null); // { initial, id? }

  const daySessions = sessionsOnDay(sessions, day).filter(
    (session) => group === "all" || session.group_no === null || String(session.group_no) === group
  );

  async function handleDelete(session) {
    const course = courseById(session.course_id);
    if (!window.confirm(`${course?.name}, ${formatClock(session.start_time)} — жою керек пе?`)) return;
    try {
      await deleteSession(session.id);
      await reload();
    } catch (error) {
      window.alert(scheduleErrorMessage(error));
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="Әкімші"
        title="Кестені басқару"
        description="Өзгерістер барлық студенттерге бірден көрінеді. Зертханалық жұмыс тек таңдалған топқа көрінеді."
        actions={
          <button type="button" className="button button--primary" onClick={() => setEditing({ initial: emptyForm(day) })}>
            <Plus size={17} /> Сабақ қосу
          </button>
        }
      />

      <CatalogState>
        <EndTimeTool sessions={sessions} onDone={reload} />

        <div className="week-strip" role="tablist" aria-label="Апта күндері">
          {DAYS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={item.id === day}
              className={`week-strip__day${item.id === day ? " is-selected" : ""}${item.id === today ? " is-today" : ""}`}
              onClick={() => setDay(item.id)}
            >
              <span>{item.short}</span>
              <small>{sessionsOnDay(sessions, item.id).length || "—"}</small>
            </button>
          ))}
        </div>

        <Segmented label="Топ" options={GROUP_FILTERS} value={group} onChange={setGroup} />

        {daySessions.length === 0 ? (
          <EmptyState icon={Clock} title="Бұл күні сабақ жоқ" compact />
        ) : (
          <ul className="admin-sessions">
            {daySessions.map((session) => {
              const course = courseById(session.course_id);
              return (
                <li key={session.id} className="admin-session" style={courseAccent(course)}>
                  <span className="admin-session__time">
                    {formatClock(session.start_time)}
                    {session.end_time && <small>–{formatClock(session.end_time)}</small>}
                  </span>
                  <div className="admin-session__body">
                    <strong>{course?.name}</strong>
                    <div className="session__meta">
                      <span className={`session__type session__type--${session.session_type}`}>{SESSION_TYPES[session.session_type]}</span>
                      <span>{session.group_no ? `${session.group_no}-топ` : "Екі топқа ортақ"}</span>
                      {session.room && <span className="session__room">{session.room}</span>}
                    </div>
                  </div>
                  <div className="admin-session__actions">
                    <button type="button" className="icon-button" onClick={() => setEditing({ initial: formFromSession(session), id: session.id })} aria-label="Өзгерту">
                      <Pencil size={16} />
                    </button>
                    <button type="button" className="icon-button icon-button--danger" onClick={() => handleDelete(session)} aria-label="Жою">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CatalogState>

      {editing && (
        <SessionForm initial={editing.initial} editingId={editing.id} onClose={() => setEditing(null)} onSaved={reload} />
      )}
    </>
  );
}
