import { Camera, ImagePlus, Lock } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { PHOTO_TYPES } from "../config/app.js";

const TYPE_FILTERS = [{ id: "all", label: "Барлығы" }, ...PHOTO_TYPES];

export default function PhotosPage() {
  const [type, setType] = useQueryParam("type", "all");
  const [course, setCourse] = useQueryParam("course", "");

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Оқу фотолары"
        title="EASYФОТО"
        description="Тақта мен сабақ фотолары. Дәріс фотолары ортақ, зертханалық жұмыс фотолары тек өз тобыңа көрінеді."
        actions={
          <button type="button" className="button button--primary" disabled title="Кіру жүйесі қосылғаннан кейін">
            <ImagePlus size={17} /> Фото жүктеу
          </button>
        }
      />

      <div className="toolbar">
        <Segmented label="Фото түрі" options={TYPE_FILTERS} value={type} onChange={setType} />
        <CourseSelect id="photo-course" value={course} onChange={setCourse} />
      </div>

      <div className="info-note">
        <Lock size={16} aria-hidden="true" />
        <span>Фото жүктеу кіру жүйесі мен қорғалған сақтау орны қосылғаннан кейін ашылады.</span>
      </div>

      <EmptyState icon={Camera} title="Әзірге фото жоқ" tag="Сақтау орны күтілуде">
        Жүктелген фотолар осында тор түрінде көрінеді.
      </EmptyState>
    </div>
  );
}
