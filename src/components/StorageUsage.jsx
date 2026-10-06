import { useEffect, useState } from "react";
import { HardDrive } from "lucide-react";
import { supabase } from "../lib/supabase.js";
import { STORAGE_LIMIT_BYTES, STORAGE_WARN_RATIO } from "../config/app.js";

function formatMB(bytes) {
  return `${(bytes / 1e6).toFixed(bytes < 1e8 ? 1 : 0)} МБ`;
}

/** Admin-only meter for the photo storage quota (free plan: 1 GB). */
export default function StorageUsage() {
  const [usage, setUsage] = useState(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    supabase.rpc("admin_storage_usage").then(({ data, error }) => {
      if (error || !data?.[0]) setFailed(true);
      else setUsage(data[0]);
    });
  }, []);

  if (failed) return null;
  if (!usage) return <div className="usage usage--loading" aria-busy="true" />;

  const bytes = Number(usage.bytes);
  const ratio = Math.min(1, bytes / STORAGE_LIMIT_BYTES);
  const warn = ratio >= STORAGE_WARN_RATIO;
  const averageMB = Number(usage.photos) > 0 ? bytes / 1e6 / Number(usage.photos) : null;
  const remainingPhotos = averageMB ? Math.floor((STORAGE_LIMIT_BYTES - bytes) / 1e6 / averageMB) : null;

  return (
    <section className={`usage panel${warn ? " usage--warn" : ""}`}>
      <div className="usage__head">
        <HardDrive size={18} aria-hidden="true" />
        <strong>Фото сақтау орны</strong>
        <span className="usage__numbers">
          {formatMB(bytes)} / {formatMB(STORAGE_LIMIT_BYTES)}
        </span>
      </div>
      <div className="usage__bar" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
        <span style={{ width: `${Math.max(ratio * 100, 1)}%` }} />
      </div>
      <p className="usage__note">
        {usage.photos} фото
        {averageMB ? ` · орташа ${averageMB.toFixed(2)} МБ` : ""}
        {remainingPhotos !== null ? ` · тағы шамамен ${remainingPhotos} фото сыяды` : ""}
      </p>
      {warn && (
        <p className="usage__warning">
          Орынның {Math.round(ratio * 100)}% толды. Ескі фотоларды жүктеп алып тазалау немесе сақтау орнын кеңейту керек.
        </p>
      )}
    </section>
  );
}
