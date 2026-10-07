import { useState } from "react";
import { Camera, CloudOff, ImagePlus } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import Segmented from "../components/ui/Segmented.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import CourseSelect from "../components/CourseSelect.jsx";
import PhotoGrid from "../components/photos/PhotoGrid.jsx";
import PhotoViewer from "../components/photos/PhotoViewer.jsx";
import PhotoUploadDialog from "../components/photos/PhotoUploadDialog.jsx";
import { useQueryParam } from "../lib/useQueryParam.js";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { usePhotos } from "../features/photos/usePhotos.js";
import { PHOTO_TYPES } from "../config/app.js";

const TYPE_FILTERS = [{ id: "all", label: "Барлығы" }, ...PHOTO_TYPES];

export default function PhotosPage() {
  const [type, setType] = useQueryParam("type", "all");
  const [courseSlug, setCourseSlug] = useQueryParam("course", "");
  const { courseBySlug, courseById, status: catalogStatus } = useCatalog();
  const course = courseSlug ? courseBySlug(courseSlug) : null;

  const { status, photos, thumbs, engagement, reload, refreshEngagement } = usePhotos({
    courseId: course?.id,
    type: type === "all" ? undefined : type,
    limit: 120,
  });

  const [viewerIndex, setViewerIndex] = useState(null);
  const [uploading, setUploading] = useState(false);

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="Оқу фотолары"
        title="EASYФОТО"
        description="Тақта мен сабақ фотолары. Дәріс фотолары екі топқа ортақ, зертханалық жұмыс фотолары тек өз тобыңа көрінеді."
        actions={
          <button type="button" className="button button--primary" onClick={() => setUploading(true)} disabled={catalogStatus !== "ready"}>
            <ImagePlus size={17} /> Фото жүктеу
          </button>
        }
      />

      <div className="toolbar">
        <Segmented label="Фото түрі" options={TYPE_FILTERS} value={type} onChange={setType} />
        <CourseSelect id="photo-course" value={courseSlug} onChange={setCourseSlug} />
      </div>

      {status === "loading" && (
        <ul className="photo-grid" aria-busy="true" aria-label="Жүктелуде">
          {Array.from({ length: 8 }, (_, index) => (
            <li key={index}>
              <span className="photo-tile photo-tile--skeleton" />
            </li>
          ))}
        </ul>
      )}

      {status === "error" && (
        <EmptyState
          icon={CloudOff}
          title="Фотолар жүктелмеді"
          action={<button type="button" className="button button--ghost" onClick={reload}>Қайта көру</button>}
        >
          Интернет байланысын тексеріп, қайта көр.
        </EmptyState>
      )}

      {status === "ready" && photos.length === 0 && (
        <EmptyState
          icon={Camera}
          title={course || type !== "all" ? "Бұл сүзгі бойынша фото жоқ" : "Әзірге фото жоқ"}
          action={
            <button type="button" className="button button--primary" onClick={() => setUploading(true)}>
              <ImagePlus size={17} /> Алғашқы фотоны жүктеу
            </button>
          }
        >
          Тақтаның фотосын түсіріп, сыныптастарыңмен бөліс.
        </EmptyState>
      )}

      {status === "ready" && photos.length > 0 && (
        <PhotoGrid photos={photos} thumbs={thumbs} courseById={courseById} onOpen={setViewerIndex} engagement={engagement} />
      )}

      {viewerIndex !== null && photos[viewerIndex] && (
        <PhotoViewer
          photos={photos}
          index={viewerIndex}
          thumbs={thumbs}
          courseById={courseById}
          onIndexChange={setViewerIndex}
          onEngagementChange={refreshEngagement}
          onClose={() => setViewerIndex(null)}
          onDeleted={() => {
            setViewerIndex(null);
            reload();
          }}
        />
      )}

      {uploading && (
        <PhotoUploadDialog defaultCourseSlug={courseSlug} onClose={() => setUploading(false)} onUploaded={reload} />
      )}
    </div>
  );
}
