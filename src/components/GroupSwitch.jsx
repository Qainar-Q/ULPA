import Segmented from "./ui/Segmented.jsx";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { GROUPS } from "../config/app.js";

/** Admin-only switch to preview either group's schedule. Students never see it. */
export default function GroupSwitch() {
  const { canSwitchGroup, viewerGroup, setViewerGroup } = useCatalog();
  if (!canSwitchGroup) return null;

  return (
    <Segmented
      label="Топты таңдау"
      options={GROUPS.map((group) => ({ id: group.id, label: group.label }))}
      value={viewerGroup}
      onChange={setViewerGroup}
    />
  );
}
