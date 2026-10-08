import { Megaphone, Pencil, Pin, Trash2 } from "lucide-react";
import { formatDateTime } from "../lib/due.js";

const ROLE_LABEL = { admin: "Әкімші", monitor: "Староста", teacher: "Оқытушы" };

export default function AnnouncementCard({ item, canManage, onEdit, onDelete, compact = false }) {
  return (
    <article className={`announcement${item.pinned ? " announcement--pinned" : ""}${compact ? " announcement--compact" : ""}`}>
      <div className="announcement__icon" aria-hidden="true">
        {item.pinned ? <Pin size={16} /> : <Megaphone size={16} />}
      </div>
      <div className="announcement__body">
        <h3>{item.title}</h3>
        {item.body && <p className={compact ? "announcement__text--clamp" : undefined}>{item.body}</p>}
        <div className="announcement__meta">
          <span>
            {item.author_name ?? "—"}
            {ROLE_LABEL[item.author_role] && ` · ${ROLE_LABEL[item.author_role]}`}
          </span>
          <span>{item.group_no ? `${item.group_no}-топқа` : "Барлығына"}</span>
          <span>{formatDateTime(item.created_at)}</span>
        </div>
      </div>
      {canManage && (
        <div className="announcement__actions">
          <button type="button" className="icon-button" onClick={onEdit} aria-label="Өзгерту">
            <Pencil size={15} />
          </button>
          <button type="button" className="icon-button icon-button--danger" onClick={onDelete} aria-label="Жою">
            <Trash2 size={15} />
          </button>
        </div>
      )}
    </article>
  );
}
