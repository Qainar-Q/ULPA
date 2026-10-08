import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { QrCode } from "lucide-react";
import { useCatalog } from "../features/catalog/CatalogContext.jsx";
import { clock, myOpenCheckins } from "../teacher/teacherApi.js";

/** Home: a teacher has opened check-in for one of my lessons right now. */
export default function OpenCheckinBanner() {
  const { courseById } = useCatalog();
  const [open, setOpen] = useState([]);

  useEffect(() => {
    const load = () => myOpenCheckins().then((rows) => setOpen(rows.filter((row) => !row.done))).catch(() => {});
    load();
    const timer = setInterval(load, 45000);
    return () => clearInterval(timer);
  }, []);

  if (!open.length) return null;
  const first = open[0];
  return (
    <Link to="/checkin" className="checkin-banner">
      <QrCode size={22} aria-hidden="true" />
      <span>
        <strong>Сабаққа белгілену ашық</strong>
        <span>{courseById(first.course_id)?.name ?? "Сабақ"} · {clock(first.start_time)} — кодты енгіз немесе QR-ды сканерле</span>
      </span>
    </Link>
  );
}
