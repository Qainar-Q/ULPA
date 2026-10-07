import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, MapPin, Move, RotateCcw, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import { BUILDINGS, KINDS, OFF_CAMPUS, OUR_BUILDING, ROOM_BUILDINGS, buildingForRoom, twoGisUrl } from "../features/campus/campusData.js";
import { useQueryParam } from "../lib/useQueryParam.js";
import { useAuth } from "../features/auth/AuthContext.jsx";
import { supabase } from "../lib/supabase.js";

const FILTERS = [
  { id: "all", label: "Барлығы", test: null },
  { id: "ours", label: "★ Біздің корпус", test: (b) => b.id === OUR_BUILDING },
  { id: "faculty", label: "Факультеттер", test: (b) => b.kind === "faculty" },
  { id: "facility", label: "Кітапхана, спорт, қызметтер", test: (b) => b.kind === "facility" },
  { id: "dorm", label: "Жатақханалар", test: (b) => b.kind === "dorm" },
];

const roomsIn = (id) => Object.entries(ROOM_BUILDINGS).filter(([, building]) => building === id).map(([room]) => room);
const badgeText = (b) => b.symbol ?? b.num ?? "•";

function supportsWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function CampusPage() {
  const { isAdmin } = useAuth();
  const mapRef = useRef(null);
  const apiRef = useRef(null);
  const [room] = useQueryParam("room", "");
  const [buildingParam, setBuildingParam] = useQueryParam("b", "");
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState("all");
  const [status, setStatus] = useState(() => (supportsWebGL() ? "loading" : "unsupported"));
  const [positions, setPositions] = useState(null); // { id: {lat, lng} } saved by the admin
  const [editing, setEditing] = useState(false);
  const [saved, setSaved] = useState(null);
  const roomBuilding = buildingForRoom(room);

  // Saved marker positions (falls back to the first guess from the illustration).
  useEffect(() => {
    supabase
      .from("campus_markers")
      .select("id, lat, lng")
      .then(({ data }) => setPositions(Object.fromEntries((data ?? []).map((row) => [row.id, { lat: row.lat, lng: row.lng }]))));
  }, []);

  // 2GIS point, or the admin's saved correction.
  const placed = useMemo(() => BUILDINGS.map((b) => ({ ...b, ...(positions?.[b.id] ?? {}), corrected: Boolean(positions?.[b.id]) })), [positions]);

  // Build the map once positions are known (the map engine is only downloaded here).
  useEffect(() => {
    if (status === "unsupported" || !positions || !mapRef.current) return undefined;
    let disposed = false;
    import("../features/campus/campusMap.js")
      .then(({ createCampusMap }) => {
        if (disposed) return;
        const theme = document.documentElement.dataset.theme === "light" ? "light" : "dark";
        apiRef.current = createCampusMap(mapRef.current, {
          theme,
          markers: placed.map((b) => ({ id: b.id, lat: b.lat, lng: b.lng, kind: b.kind, text: badgeText(b), label: b.name, short: b.short, ours: b.id === OUR_BUILDING })),
          onSelect: (id) => setSelected(id),
          onMove: async (id, position) => {
            const { error } = await supabase.from("campus_markers").upsert({ id, lat: position.lat, lng: position.lng });
            setSaved(error ? "error" : id);
            if (!error) setPositions((current) => ({ ...current, [id]: position }));
          },
        });
        setStatus("ready");
      })
      .catch(() => !disposed && setStatus("unsupported"));
    return () => {
      disposed = true;
      apiRef.current?.dispose();
      apiRef.current = null;
    };
    // Built once; later position changes come from dragging on this same map.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [positions === null, status === "unsupported"]);

  // Deep links: ?room=114 or ?b=library → fly there.
  useEffect(() => {
    if (status !== "ready") return;
    const target = roomBuilding?.id ?? (BUILDINGS.some((b) => b.id === buildingParam) ? buildingParam : null);
    if (target) setTimeout(() => apiRef.current?.select(target, { focus: true }), 400);
  }, [status, roomBuilding, buildingParam]);

  useEffect(() => {
    apiRef.current?.setFilter(FILTERS.find((item) => item.id === filter)?.test ?? null);
  }, [filter, status]);

  useEffect(() => {
    apiRef.current?.setEditable(editing);
  }, [editing, status]);

  useEffect(() => {
    if (!saved) return undefined;
    const timer = setTimeout(() => setSaved(null), 2200);
    return () => clearTimeout(timer);
  }, [saved]);

  const building = useMemo(() => placed.find((item) => item.id === selected) ?? null, [placed, selected]);

  function choose(id) {
    setBuildingParam(id);
    if (apiRef.current) apiRef.current.select(id, { focus: true });
    mapRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }

  const groups = Object.entries(KINDS).map(([kind, meta]) => ({
    kind,
    meta,
    items: placed.filter((item) => item.kind === kind),
  }));
  const corrected = placed.filter((b) => b.corrected).length;

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="ҚазҰУ"
        title="Кампус картасы"
        description="ҚазҰУ кампусы ғана. Белгілер 2GIS-тегі нақты орындарда. Біздің мехмат ★ белгіленген."
        actions={
          isAdmin && (
            <button type="button" className={`button ${editing ? "button--primary" : "button--ghost"}`} onClick={() => setEditing(!editing)}>
              <Move size={16} /> {editing ? "Дайын" : "Белгілерді түзету"}
            </button>
          )
        }
      />

      {editing && (
        <p className="campus-room">
          <Move size={16} aria-hidden="true" />
          <span>
            Белгіні ұстап, дұрыс ғимаратқа сүйре — ғимараттың ортасына өзі «жабысады» және бірден сақталады. Түзетілгені: {corrected}.
          </span>
        </p>
      )}

      {room && !editing && (
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

      <div className={`campus-map${editing ? " is-editing" : ""}`}>
        <div className="campus-map__canvas" ref={mapRef} />
        {status === "loading" && <div className="campus-map__loading">Карта жүктелуде…</div>}
        {status === "unsupported" && <div className="campus-map__loading">Бұл құрылғы картаны көрсете алмайды — төмендегі тізімді қолдан.</div>}
        {status === "ready" && (
          <button type="button" className="icon-button campus-map__reset" onClick={() => apiRef.current?.resetView()} aria-label="Бастапқы көрініс">
            <RotateCcw size={18} />
          </button>
        )}
        {saved && <div className="campus-map__saved">{saved === "error" ? "Сақталмады" : "Сақталды ✓"}</div>}
        {building && !editing && (
          <div className="campus-card" role="dialog" aria-label={building.name}>
            <span className={`campus-badge campus-badge--${building.kind} campus-card__badge`}>{badgeText(building)}</span>
            <div className="campus-card__body">
              <strong>{building.name}</strong>
              <span>{KINDS[building.kind].label}</span>
              {building.address && <p>{building.address}</p>}
              {building.note && <p>{building.note}</p>}
              {roomsIn(building.id).length > 0 && <p>Біздің аудиториялар: {roomsIn(building.id).join(", ")}</p>}
              <a className="campus-card__2gis" href={twoGisUrl(building)} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> 2GIS-те ашу · маршрут
              </a>
            </div>
            <button type="button" className="icon-button" onClick={() => apiRef.current?.select(null)} aria-label="Жабу">
              <X size={16} />
            </button>
          </div>
        )}
      </div>
      <p className="muted small">
        Карта: OpenStreetMap (OpenFreeMap), орындар: 2GIS. Картаны екі саусақпен бұруға болады — белгілер ғимараттан тайып кетпейді. Белгі қате тұрса, әкімшіге айт.
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
                      <span className={`campus-badge campus-badge--${item.kind}`}>{badgeText(item)}</span>
                      <span>{item.name}</span>
                      {item.id === OUR_BUILDING && <span className="tag">★ біздікі</span>}
                      {editing && !item.corrected && <span className="tag tag--pending">түзетілмеген</span>}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <h3 className="campus-list__title">
          <MapPin size={14} aria-hidden="true" /> Кампустан тыс
        </h3>
        <ul className="campus-offsite">
          {OFF_CAMPUS.map((place) => (
            <li key={place.name}>
              <a href={twoGisUrl(place)} target="_blank" rel="noreferrer">
                <span>{place.name}</span>
                <span className="muted small">{place.address}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>
      <p className="muted small">
        Сабақ кестесінде аудитория нөмірін бассаң, карта сол ғимаратты көрсетеді. <Link to="/schedule">Кестеге өту</Link>
      </p>
    </div>
  );
}
