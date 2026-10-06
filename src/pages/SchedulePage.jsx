import { CalendarDays } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { WEEKDAYS, almatyWeekday } from "../lib/time.js";

const VIEWS = [
  { id: "today", label: "Бүгін" },
  { id: "week", label: "Апта" },
];

export default function SchedulePage() {
  const [view, setView] = useQueryParam("view", "today");
  const [course, setCourse] = useQueryParam("course", "");
  const today = almatyWeekday();

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Алматы уақыты"
        title="Сабақ кестесі"
        description="Дәрістер екі топқа ортақ болуы мүмкін, зертханалық жұмыстар топ бойынша бөлек көрсетіледі."
      />

      <div className="toolbar">
        <Segmented label="Кесте көрінісі" options={VIEWS} value={view} onChange={setView} />
        <CourseSelect id="schedule-course" value={course} onChange={setCourse} />
      </div>

      {view === "week" && (
        <div className="week-strip" role="list">
          {WEEKDAYS.map((day) => (
            <div key={day.id} role="listitem" className={`week-strip__day${day.id === today ? " is-today" : ""}`}>
              <span>{day.short}</span>
              <small>—</small>
            </div>
          ))}
        </div>
      )}

      <EmptyState icon={CalendarDays} title="Кесте әлі енгізілмеген" tag="Дерекқор күтілуде">
        Нақты сабақ уақыттары ойдан құрастырылмайды. Әкімші кестені енгізгеннен кейін сенің тобыңның сабақтары осында көрінеді.
      </EmptyState>
    </div>
  );
}
