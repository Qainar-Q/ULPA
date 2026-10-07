import { useState } from "react";
import { Camera } from "lucide-react";
import EmptyState from "../ui/EmptyState.jsx";
import PhotoGrid from "./PhotoGrid.jsx";
import PhotoViewer from "./PhotoViewer.jsx";
import { usePhotos } from "../../features/photos/usePhotos.js";
import { useCatalog } from "../../features/catalog/CatalogContext.jsx";

/** Small photo strip for the home page and course pages. */
export default function RecentPhotos({ courseId, limit = 6 }) {
  const { courseById } = useCatalog();
  const { status, photos, thumbs, engagement, reload, refreshEngagement } = usePhotos({ courseId, limit });
  const [viewerIndex, setViewerIndex] = useState(null);

  if (status === "loading") {
    return (
      <ul className="photo-grid photo-grid--compact" aria-busy="true">
        {Array.from({ length: 3 }, (_, index) => (
          <li key={index}>
            <span className="photo-tile photo-tile--skeleton" />
          </li>
        ))}
      </ul>
    );
  }

  if (status === "error" || photos.length === 0) {
    return (
      <EmptyState icon={Camera} title={status === "error" ? "Фотолар жүктелмеді" : "Әзірге фото жоқ"} compact>
        {status === "error" ? "Желіні тексер." : "Дәріс және зертханалық жұмыс фотолары осында көрінеді."}
      </EmptyState>
    );
  }

  return (
    <>
      <PhotoGrid photos={photos} thumbs={thumbs} courseById={courseById} onOpen={setViewerIndex} engagement={engagement} compact />
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
    </>
  );
}
