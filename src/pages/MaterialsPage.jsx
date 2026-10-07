import { useMemo, useState } from "react";
import { CloudOff, FileText, Plus, Search } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import MaterialList from "../components/materials/MaterialList.jsx";
import MaterialUploadDialog from "../components/materials/MaterialUploadDialog.jsx";
import { useMaterials } from "../features/materials/materialApi.js";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { useMarkSeen } from "../features/unread/UnreadContext.jsx";

export default function MaterialsPage() {
  useMarkSeen("materials");
  const [courseSlug, setCourseSlug] = useQueryParam("course", "");
  const [query, setQuery] = useState("");
  const [uploading, setUploading] = useState(false);
  const { courseById, courseBySlug, status: catalogStatus } = useCatalog();
  const course = courseSlug ? courseBySlug(courseSlug) : null;
  const { status, items, reload } = useMaterials({ courseId: course?.id });

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => `${item.title} ${item.description ?? ""} ${item.file_name}`.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Оқу ресурстары"
        title="Материалдар"
        description="Дәріс слайдтары, PDF, әдебиет — бүкіл семестрдің материалдары бір жерде. Кез келген студент бөлісе алады."
        actions={
          <button type="button" className="button button--primary" onClick={() => setUploading(true)} disabled={catalogStatus !== "ready"}>
            <Plus size={17} /> Материал қосу
          </button>
        }
      />

      <div className="toolbar">
        <div className="search-field">
          <Search size={16} aria-hidden="true" />
          <input className="input" type="search" placeholder="Іздеу…" value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Материал іздеу" />
        </div>
        <CourseSelect id="mat-course" value={courseSlug} onChange={setCourseSlug} />
      </div>

      {status === "loading" && <div className="skeleton-list" aria-busy="true"><span /><span /><span /></div>}
      {status === "error" && (
        <EmptyState icon={CloudOff} title="Жүктелмеді" action={<button type="button" className="button button--ghost" onClick={reload}>Қайта көру</button>} />
      )}
      {status === "ready" && visible.length === 0 && (
        <EmptyState
          icon={FileText}
          title={query || course ? "Ештеңе табылмады" : "Әзірге материал жоқ"}
          action={<button type="button" className="button button--primary" onClick={() => setUploading(true)}><Plus size={17} /> Алғашқы материалды қосу</button>}
        />
      )}
      {status === "ready" && visible.length > 0 && (
        <MaterialList items={visible} courseById={courseById} showCourse={!course} onDeleted={reload} />
      )}

      {uploading && <MaterialUploadDialog defaultCourseId={course?.id} onClose={() => setUploading(false)} onUploaded={reload} />}
    </div>
  );
}
