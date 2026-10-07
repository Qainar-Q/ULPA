import { useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { CloudOff, GraduationCap, Plus } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import TeacherCard from "../components/teachers/TeacherCard.jsx";
import TeacherForm from "../components/teachers/TeacherForm.jsx";
import { useTeachers } from "../features/teachers/teacherApi.js";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { useAuth } from "../features/auth/AuthContext.jsx";

export default function TeachersPage() {
  const { status, teachers, photos, reload } = useTeachers();
  const { courseById } = useCatalog();
  const { isAdmin } = useAuth();
  const { hash } = useLocation();
  const [editing, setEditing] = useState(null); // null | {} (new) | teacher

  // /teachers#teacher-<id> (from a course page) → scroll to that card.
  useEffect(() => {
    if (status !== "ready" || !hash) return;
    const element = document.getElementById(hash.slice(1));
    if (element) {
      element.scrollIntoView({ block: "center" });
      element.classList.add("is-highlight");
      setTimeout(() => element.classList.remove("is-highlight"), 1800);
    }
  }, [status, hash]);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Байланыс"
        title="Оқытушылар"
        description="Пән оқытушылары, кабинеттері және байланыс деректері. Бұл бет тек біздің сыныпқа көрінеді."
        actions={
          isAdmin && (
            <button type="button" className="button button--primary" onClick={() => setEditing({})}>
              <Plus size={17} /> Оқытушы қосу
            </button>
          )
        }
      />
      {status === "loading" && <div className="skeleton-list" aria-busy="true"><span /><span /></div>}
      {status === "error" && <EmptyState icon={CloudOff} title="Жүктелмеді">Интернетті тексеріп, бетті жаңарт.</EmptyState>}
      {status === "ready" && teachers.length === 0 && <EmptyState icon={GraduationCap} title="Әзірге ешкім қосылмаған" />}
      <div className="teacher-list">
        {teachers.map((teacher) => (
          <TeacherCard
            key={teacher.id}
            teacher={teacher}
            photoUrl={photos[teacher.photo_path]}
            courses={teacher.courseIds.map(courseById).filter(Boolean)}
            onEdit={isAdmin ? () => setEditing(teacher) : undefined}
          />
        ))}
      </div>
      {editing && (
        <TeacherForm
          teacher={editing.id ? editing : null}
          photoUrl={editing.id ? photos[editing.photo_path] : null}
          onClose={() => setEditing(null)}
          onSaved={reload}
        />
      )}
    </div>
  );
}
