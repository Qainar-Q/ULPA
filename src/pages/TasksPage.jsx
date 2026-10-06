import { ClipboardList } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";

const STATUS_FILTERS = [
  { id: "open", label: "Орындалмаған" },
  { id: "done", label: "Орындалған" },
  { id: "all", label: "Барлығы" },
];

export default function TasksPage() {
  const [status, setStatus] = useQueryParam("status", "open");
  const [course, setCourse] = useQueryParam("course", "");

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Оқу жоспары"
        title="Тапсырмалар"
        description="Оқытушы берген тапсырмалар. Әр студенттің орындалу белгісі тек өзіне тиесілі."
      />

      <div className="toolbar">
        <Segmented label="Тапсырма күйі" options={STATUS_FILTERS} value={status} onChange={setStatus} />
        <CourseSelect id="task-course" value={course} onChange={setCourse} />
      </div>

      <EmptyState icon={ClipboardList} title="Тапсырма жоқ" tag="Дерекқор күтілуде">
        Тапсырмаларды әкімші қосады. Бұрынғы нұсқадағы тапсырмалар бет жаңарғанда жоғалатын, сондықтан олар дерекқорға көшіріледі.
      </EmptyState>
    </div>
  );
}
