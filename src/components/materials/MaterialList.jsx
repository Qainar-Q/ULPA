import { useState } from "react";
import { Download, FileArchive, FileImage, FileSpreadsheet, FileText, Presentation, Trash2 } from "lucide-react";
import { deleteMaterial, materialUrl } from "../../features/materials/materialApi.js";
import { useAuth } from "../../features/auth/AuthContext.jsx";
import { courseAccent } from "../../lib/courseStyle.js";
import { formatDateTime } from "../../lib/due.js";

export function formatSize(bytes) {
  if (!bytes) return "";
  return bytes > 1e6 ? `${(bytes / 1e6).toFixed(1)} МБ` : `${Math.ceil(bytes / 1e3)} КБ`;
}

function iconFor(mime = "") {
  if (mime.startsWith("image/")) return FileImage;
  if (mime.includes("sheet") || mime.includes("excel")) return FileSpreadsheet;
  if (mime.includes("presentation") || mime.includes("powerpoint")) return Presentation;
  if (mime.includes("zip")) return FileArchive;
  return FileText;
}

function MaterialRow({ item, course, showCourse, onDeleted }) {
  const { student, isAdmin } = useAuth();
  const [busy, setBusy] = useState(false);
  const Icon = iconFor(item.mime_type);
  const canDelete = isAdmin || item.uploaded_by === student?.id;

  async function open() {
    setBusy(true);
    try {
      window.location.assign(await materialUrl(item));
    } catch {
      window.alert("Файл ашылмады. Қайта көр.");
    }
    setBusy(false);
  }

  async function remove() {
    if (!window.confirm(`«${item.title}» жойылсын ба?`)) return;
    try {
      await deleteMaterial(item);
      onDeleted?.();
    } catch {
      window.alert("Жойылмады.");
    }
  }

  return (
    <li className="material" style={courseAccent(course)}>
      <button type="button" className="material__main" onClick={open} disabled={busy}>
        <span className="material__icon" aria-hidden="true">
          <Icon size={20} />
        </span>
        <span className="material__body">
          <strong>{item.title}</strong>
          {item.description && <span className="material__desc">{item.description}</span>}
          <span className="material__meta">
            {showCourse && course && <span className="course-code course-code--sm">{course.code}</span>}
            <span>{formatSize(item.size_bytes)}</span>
            <span>{item.group_no ? `${item.group_no}-топ` : "Барлығына"}</span>
            <span>{item.uploader_name}</span>
            <span>{formatDateTime(item.created_at)}</span>
          </span>
        </span>
        <Download size={18} className="material__dl" aria-hidden="true" />
      </button>
      {canDelete && (
        <button type="button" className="icon-button icon-button--danger material__delete" onClick={remove} aria-label="Жою">
          <Trash2 size={15} />
        </button>
      )}
    </li>
  );
}

export default function MaterialList({ items, courseById, showCourse = false, onDeleted }) {
  return (
    <ul className="material-list">
      {items.map((item) => (
        <MaterialRow key={item.id} item={item} course={courseById(item.course_id)} showCourse={showCourse} onDeleted={onDeleted} />
      ))}
    </ul>
  );
}
