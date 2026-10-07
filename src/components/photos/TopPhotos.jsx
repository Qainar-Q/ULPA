import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import SectionTitle from "../ui/SectionTitle.jsx";
import PhotoGrid from "./PhotoGrid.jsx";
import PhotoViewer from "./PhotoViewer.jsx";
import { listTopPhotos, signUrls } from "../../features/photos/photoApi.js";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { useCatalog } from "../../features/catalog/CatalogContext.jsx";

/** Home: photos with the most reactions/comments in the last 7 days. Hidden when there are none. */
export default function TopPhotos({ limit = 6 }) {
  const { status: authStatus } = useAuth();
  const { courseById } = useCatalog();
  const [state, setState] = useState({ photos: [], weekly: {}, thumbs: {} });
  const [viewerIndex, setViewerIndex] = useState(null);

  const load = useCallback(async () => {
    try {
      const { photos, weekly } = await listTopPhotos(limit);
      const thumbs = await signUrls(photos.map((photo) => photo.thumb_path));
      setState({ photos, weekly, thumbs });
    } catch {
      setState({ photos: [], weekly: {}, thumbs: {} });
    }
  }, [limit]);

  useEffect(() => {
    if (authStatus === "signedIn") load();
  }, [authStatus, load]);

  if (state.photos.length === 0) return null;

  return (
    <section className="panel top-photos">
      <SectionTitle
        title="🏆 Аптаның үздік фотолары"
        action={<Link to="/photos" className="text-link">EASYФОТО <ChevronRight size={14} /></Link>}
      />
      <p className="muted small top-photos__hint">Соңғы 7 күндегі реакция мен пікір саны бойынша</p>
      <PhotoGrid photos={state.photos} thumbs={state.thumbs} courseById={courseById} onOpen={setViewerIndex} engagement={state.weekly} compact ranked />
      {viewerIndex !== null && state.photos[viewerIndex] && (
        <PhotoViewer
          photos={state.photos}
          index={viewerIndex}
          thumbs={state.thumbs}
          courseById={courseById}
          onIndexChange={setViewerIndex}
          onClose={() => {
            setViewerIndex(null);
            load();
          }}
          onDeleted={() => {
            setViewerIndex(null);
            load();
          }}
        />
      )}
    </section>
  );
}
