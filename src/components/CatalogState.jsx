import { CloudOff } from "lucide-react";
import EmptyState from "./ui/EmptyState.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";

/** Shows loading / error for course+schedule data; renders children when ready. */
export default function CatalogState({ children, compact = false }) {
  const { status, reload } = useCatalog();

  if (status === "ready") return children;
  if (status === "error") {
    return (
      <EmptyState
        icon={CloudOff}
        title="Деректер жүктелмеді"
        compact={compact}
        action={
          <button type="button" className="button button--ghost" onClick={reload}>
            Қайта көру
          </button>
        }
      >
        Интернет байланысын тексеріп, қайта көр.
      </EmptyState>
    );
  }
  return (
    <div className={`skeleton-list${compact ? " skeleton-list--compact" : ""}`} aria-busy="true" aria-label="Жүктелуде">
      <span />
      <span />
      <span />
    </div>
  );
}
