import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Hand, LocateFixed, MapPin, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import { BUILDINGS, KINDS, OUR_BUILDING, ROOM_BUILDINGS, buildingForRoom } from "../features/campus/campusData.js";
import { useQueryParam } from "../lib/useQueryParam.js";

const FILTERS = [
  { id: "all", label: "Барлығы", test: null },
  { id: "ours", label: "★ Біздің корпус", test: (b) => b.id === OUR_BUILDING },
  { id: "faculty", label: "Факультеттер", test: (b) => b.kind === "faculty" },
  { id: "facility", label: "Кітапхана, тамақ, спорт", test: (b) => b.kind === "facility" },
  { id: "dorm", label: "Жатақханалар", test: (b) => b.kind === "dorm" },
];

const roomsIn = (id) => Object.entries(ROOM_BUILDINGS).filter(([, building]) => building === id).map(([room]) => room);

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function CampusPage() {
  const mapRef = useRef(null);
  const sceneRef = useRef(null);
  const [room] = useQueryParam("room", "");
  const [buildingParam, setBuildingParam] = useQueryParam("b", "");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState(() => (supportsWebGL() ? "loading" : "unsupported"));
  const [hint, setHint] = useState(true);
  const roomBuilding = buildingForRoom(room);

  // Build the 3D scene (three.js is only downloaded for this page).
  useEffect(() => {
    if (status === "unsupported" || !mapRef.current) return undefined;
    let disposed = false;
    import("../features/campus/campusScene.js")
      .then(({ createCampusScene }) => {
        if (disposed) return;
        const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
        sceneRef.current = createCampusScene(mapRef.current, { theme, onSelect: setSelected });
        setStatus("ready");
      })
      .catch(() => !disposed && setStatus("unsupported"));
    const timer = setTimeout(() => setHint(false), 4500);
    return () => {
      disposed = true;
      clearTimeout(timer);
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Deep links: ?room=114 or ?b=library → fly to that building.
  useEffect(() => {
    if (status !== "ready") return;
    const target = roomBuilding?.id ?? (BUILDINGS.some((b) => b.id === buildingParam) ? buildingParam : null);
    if (target) setTimeout(() => sceneRef.current?.select(target, { focus: true }), 350);
  }, [status, roomBuilding, buildingParam]);

  useEffect(() => {
    sceneRef.current?.setFilter(FILTERS.find((item) => item.id === filter)?.test ?? null);
  }, [filter, status]);

  const building = useMemo(() => BUILDINGS.find((item) => item.id === selected) ?? null, [selected]);

  function choose(id) {
    setBuildingParam(id);
    if (sceneRef.current) sceneRef.current.select(id, { focus: true });
    else setSelected(id);
    mapRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const groups = Object.entries(KINDS).map(([kind, meta]) => ({
    kind,
    meta,
    items: BUILDINGS.filter((item) => item.kind === kind && !(kind === "dorm" && item.id !== "dorm-1") && !(item.id.startsWith("parking") && item.id !== "parking-1")),
  }));

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="ҚазҰУ"
        title="Кампус картасы"
        description="Ғимаратты басып, не орналасқанын көр. Біздің мехмат корпусы ★ белгіленген."
      />

      {room && (
        <p className={`campus-room${roomBuilding ? "" : " campus-room--unknown"}`}>
          <MapPin size={16} aria-hidden="true" />
          {roomBuilding ? (
            <span>
              <strong>{room}</strong> аудитория — {roomBuilding.name}
            </span>
          ) : (
            <span>
              <strong>{room}</strong> аудиториясы картада әлі белгіленбеген.
            </span>
          )}
        </p>
      )}

      <div className="chip-row" role="group" aria-label="Сүзгі">
        {FILTERS.map((item) => (
          <button key={item.id} type="button" className={`search-chip${filter === item.id ? " is-on" : ""}`} onClick={() => setFilter(item.id)} aria-pressed={filter === item.id}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="campus-map" ref={mapRef}>
        {status === "loading" && <div className="campus-map__loading">3D карта жүктелуде…</div>}
        {status === "unsupported" && <div className="campus-map__loading">Бұл құрылғы 3D картаны көрсете алмайды — төмендегі тізімді қолдан.</div>}
        {status === "ready" && (
          <button type="button" className="icon-button campus-map__reset" onClick={() => sceneRef.current?.resetView()} aria-label="Бастапқы көрініс">
            <LocateFixed size={18} />
          </button>
        )}
        {status === "ready" && hint && (
          <div className="campus-map__hint" aria-hidden="true">
            <Hand size={16} /> Жылжыту — бір саусақ · айналдыру, үлкейту — екі саусақ
          </div>
        )}
        {building && (
          <div className="campus-card" role="dialog" aria-label={building.name}>
            <span className={`campus-badge campus-badge--${building.kind} campus-card__badge`}>
              {building.num ?? building.symbol ?? (building.kind === "dorm" ? "⌂" : "•")}
            </span>
            <div className="campus-card__body">
              <strong>{building.name}</strong>
              <span>{KINDS[building.kind].label}{building.floors ? ` · ${building.floors} қабат` : ""}</span>
              {building.note && <p>{building.note}</p>}
              {roomsIn(building.id).length > 0 && <p>Біздің аудиториялар: {roomsIn(building.id).join(", ")}</p>}
            </div>
            <button type="button" className="icon-button" onClick={() => sceneRef.current?.select(null)} aria-label="Жабу">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      <p className="muted small">
        Сұлба ресми кампус картасы бойынша жасалған: орналасуы дұрыс, бірақ масштабы шамамен. Аудитория дұрыс белгіленбесе, әкімшіге айт.
      </p>

      <section className="panel">
        <h2 className="panel-title">Ғимараттар</h2>
        <div className="campus-list">
          {groups.map(({ kind, meta, items }) => (
            <div key={kind}>
              <h3 className="campus-list__title">
                <span className={`campus-dot campus-dot--${kind}`} /> {meta.label}
              </h3>
              <ul>
                {items.map((item) => (
                  <li key={item.id}>
                    <button type="button" className={`campus-list__item${item.id === selected ? " is-on" : ""}`} onClick={() => choose(item.id)}>
                      <span className={`campus-badge campus-badge--${item.kind}`}>{item.num ?? item.symbol ?? "⌂"}</span>
                      <span>{item.kind === "dorm" ? "Студенттер жатақханалары" : item.name}</span>
                      {item.id === OUR_BUILDING && <span className="tag">★ біздікі</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
      <p className="muted small">
        Сабақ кестесінде аудитория нөмірін бассаң, карта сол ғимаратты көрсетеді. <Link to="/schedule">Кестеге өту</Link>
      </p>
    </div>
  );
}
