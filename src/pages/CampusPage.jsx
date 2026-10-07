import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, MapPin, Minus, Navigation, Plus, X } from "lucide-react";
import PageHeader from "../components/ui/PageHeader.jsx";
import { KINDS, MAP_IMAGE, OUR_BUILDING, PLACES, ROOM_BUILDINGS, buildingForRoom, googleMapsUrl, twoGisUrl } from "../features/campus/campusData.js";
import { useQueryParam } from "../lib/useQueryParam.js";

const FILTERS = [
  { id: "all", label: "Барлығы", test: null },
  { id: "ours", label: "★ Біздің корпус", test: (p) => p.id === OUR_BUILDING },
  { id: "faculty", label: "Факультеттер", test: (p) => p.kind === "faculty" },
  { id: "facility", label: "Кітапхана, спорт, тамақ", test: (p) => p.kind === "facility" },
  { id: "dorm", label: "Жатақханалар", test: (p) => p.kind === "dorm" },
];
const ZOOMS = [1, 1.5, 2, 2.6];
// Phones are narrow: the picture starts wider than the screen and scrolls sideways.
const MIN_WIDTH = 640;

const roomsIn = (id) => Object.entries(ROOM_BUILDINGS).filter(([, place]) => place === id).map(([room]) => room);
const badgeText = (p) => p.symbol ?? p.num ?? (p.kind === "parking" ? "P" : "");
// One list entry for all dormitories and one for all parkings.
const LIST = PLACES.filter((p) => !p.group || PLACES.find((q) => q.group === p.group) === p);

export default function CampusPage() {
  const scrollRef = useRef(null);
  const [room] = useQueryParam("room", "");
  const [placeParam, setPlaceParam] = useQueryParam("b", "");
  const roomPlace = buildingForRoom(room);
  const [selected, setSelected] = useState(() => roomPlace?.id ?? (PLACES.some((p) => p.id === placeParam) ? placeParam : null));
  const [filter, setFilter] = useState("all");
  const [zoom, setZoom] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const place = useMemo(() => PLACES.find((p) => p.id === selected) ?? null, [selected]);
  const test = FILTERS.find((item) => item.id === filter)?.test;
  const isLit = (p) => (place ? p.id === place.id || (place.group && p.group === place.group) : Boolean(test?.(p)));

  // Keep the chosen place in view inside the scrollable picture.
  function reveal(target, smooth = true) {
    const box = scrollRef.current;
    if (!box || !target) return;
    const inner = box.firstElementChild;
    const x = (target.x / MAP_IMAGE.width) * inner.offsetWidth;
    const y = (target.y / MAP_IMAGE.height) * inner.offsetHeight;
    box.scrollTo({ left: x - box.clientWidth / 2, top: y - box.clientHeight / 2, behavior: smooth ? "smooth" : "auto" });
  }

  useLayoutEffect(() => {
    if (loaded) reveal(place ?? PLACES.find((p) => p.id === OUR_BUILDING), false);
    // Only once the picture has its size, and after zooming.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, zoom]);

  useEffect(() => {
    if (!room) return;
    const target = buildingForRoom(room);
    if (target) setSelected(target.id);
  }, [room]);

  function choose(id, { scrollPage = false } = {}) {
    const next = id === selected ? null : id;
    setSelected(next);
    setPlaceParam(next ?? "");
    const target = PLACES.find((p) => p.id === next);
    if (target) {
      reveal(target);
      if (scrollPage) scrollRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  return (
    <div className="stack-lg">
      <PageHeader
        eyebrow="ҚазҰУ"
        title="Кампус картасы"
        description="Университеттің ресми картасы. Нөмірді немесе төмендегі тізімді бас — жолды 2GIS не Google Maps ашып көрсетеді."
      />

      {room && (
        <p className={`campus-room${roomPlace ? "" : " campus-room--unknown"}`}>
          <MapPin size={16} aria-hidden="true" />
          {roomPlace ? (
            <span>
              <strong>{room}</strong> аудитория — {roomPlace.name} (картада <strong>{roomPlace.num}</strong>)
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
          <button
            key={item.id}
            type="button"
            className={`search-chip${filter === item.id ? " is-on" : ""}`}
            onClick={() => {
              setFilter(item.id);
              setSelected(null);
              setPlaceParam("");
            }}
            aria-pressed={filter === item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="campus-pic">
        <div className="campus-pic__scroll" ref={scrollRef}>
          <div className="campus-pic__inner" style={{ width: `max(${ZOOMS[zoom] * 100}%, ${MIN_WIDTH * ZOOMS[zoom]}px)`, aspectRatio: `${MAP_IMAGE.width} / ${MAP_IMAGE.height}` }}>
            <img
              src={MAP_IMAGE.src}
              width={MAP_IMAGE.width}
              height={MAP_IMAGE.height}
              alt="ҚазҰУ кампусының ресми картасы"
              draggable="false"
              onLoad={() => setLoaded(true)}
            />
            {PLACES.map((p) => (
              <button
                key={p.id}
                type="button"
                className={`campus-spot campus-spot--${p.kind}${isLit(p) ? " is-lit" : ""}${p.id === selected ? " is-selected" : ""}`}
                style={{ left: `${(p.x / MAP_IMAGE.width) * 100}%`, top: `${(p.y / MAP_IMAGE.height) * 100}%` }}
                onClick={() => choose(p.id)}
                aria-label={p.name}
                aria-pressed={p.id === selected}
              />
            ))}
            {(() => {
              const ours = PLACES.find((p) => p.id === OUR_BUILDING);
              return (
                <span className="campus-here" style={{ left: `${(ours.x / MAP_IMAGE.width) * 100}%`, top: `${(ours.y / MAP_IMAGE.height) * 100}%` }}>
                  ★ Біз осындамыз
                </span>
              );
            })()}
          </div>
        </div>
        <div className="campus-pic__zoom">
          <button type="button" className="icon-button" onClick={() => setZoom((z) => Math.min(z + 1, ZOOMS.length - 1))} disabled={zoom === ZOOMS.length - 1} aria-label="Үлкейту">
            <Plus size={18} />
          </button>
          <button type="button" className="icon-button" onClick={() => setZoom((z) => Math.max(z - 1, 0))} disabled={zoom === 0} aria-label="Кішірейту">
            <Minus size={18} />
          </button>
        </div>
      </div>

      {place && (
        <div className="campus-card campus-card--static" role="region" aria-label={place.name}>
          <span className={`campus-badge campus-badge--${place.kind} campus-card__badge`}>{badgeText(place) || "•"}</span>
          <div className="campus-card__body">
            <strong>{place.name}</strong>
            <span>{KINDS[place.kind].label}</span>
            {place.note && <p>{place.note}</p>}
            {roomsIn(place.id).length > 0 && <p>Біздің аудиториялар: {roomsIn(place.id).join(", ")}</p>}
            <div className="campus-card__links">
              <a className="campus-card__2gis" href={twoGisUrl(place)} target="_blank" rel="noreferrer">
                <Navigation size={14} /> 2GIS
              </a>
              <a className="campus-card__google" href={googleMapsUrl(place)} target="_blank" rel="noreferrer">
                <ExternalLink size={14} /> Google Maps
              </a>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={() => choose(null)} aria-label="Жабу">
            <X size={16} />
          </button>
        </div>
      )}

      <section className="panel">
        <h2 className="panel-title">Ғимараттар</h2>
        <div className="campus-list">
          {Object.entries(KINDS).map(([kind, meta]) => (
            <div key={kind}>
              <h3 className="campus-list__title">
                <span className="campus-dot" style={{ background: meta.color }} /> {meta.label}
              </h3>
              <ul>
                {LIST.filter((p) => p.kind === kind).map((p) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={`campus-list__item${isLit(p) && place ? " is-on" : ""}`}
                      onClick={() => choose(p.id, { scrollPage: true })}
                    >
                      <span className={`campus-badge campus-badge--${p.kind}`}>{badgeText(p) || "⌂"}</span>
                      <span>{p.group === "dorms" ? "Студенттер жатақханалары (ДС)" : p.name}</span>
                      {p.id === OUR_BUILDING && <span className="tag">★ біздікі</span>}
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
