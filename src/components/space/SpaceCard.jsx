import { useEffect, useRef, useState } from "react";
import { Rocket, Satellite } from "lucide-react";

// "Ғарыш бүгін": live ISS position + upcoming launches (public data, no student data involved).
// ISS: api.wheretheiss.at (refreshed every 10 s while the page is visible).
// Launches: Launch Library 2 (thespacedevs), cached in the browser for 1 hour to respect rate limits.

const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const LAUNCHES_URL = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=5&hide_recent_previous=true";
const LAUNCH_CACHE = "ulpa-launches-v1";
// Very simplified continent outlines (lon, lat) — only for orientation on the mini map.
const LAND = [
  [[-168,66],[-140,70],[-95,72],[-80,62],[-62,58],[-55,50],[-66,44],[-76,35],[-81,25],[-97,26],[-105,20],[-90,15],[-80,8],[-85,12],[-105,23],[-117,32],[-124,40],[-125,49],[-135,58],[-150,60],[-165,60]],
  [[-55,60],[-45,60],[-20,70],[-20,82],[-60,82],[-72,77],[-60,70]],
  [[-80,8],[-60,10],[-50,0],[-35,-6],[-40,-22],[-48,-28],[-58,-38],[-65,-55],[-72,-50],[-75,-40],[-71,-18],[-81,-5]],
  [[-10,36],[-9,43],[-2,44],[-5,48],[5,52],[10,58],[5,62],[15,69],[30,71],[45,68],[70,73],[100,78],[140,72],[180,68],[180,62],[160,60],[142,52],[135,43],[122,40],[122,30],[110,20],[105,10],[100,13],[98,8],[92,22],[80,15],[77,8],[72,20],[65,25],[57,25],[50,30],[35,36],[28,41],[22,37],[15,40],[10,44],[3,43]],
  [[-17,21],[-10,30],[10,37],[32,31],[35,28],[43,12],[51,12],[40,-5],[40,-15],[35,-25],[20,-35],[13,-20],[10,-2],[5,5],[-8,4],[-15,10]],
  [[35,28],[43,13],[52,16],[58,22],[50,30],[35,33]],
  [[114,-22],[122,-17],[131,-12],[137,-12],[142,-11],[146,-19],[153,-28],[150,-37],[140,-38],[130,-32],[115,-34]],
];

const PLACES = [
  { name: "Алматы", lat: 43.24, lon: 76.89 },
  { name: "Байқоңыр", lat: 45.96, lon: 63.31 },
];

function distanceKm(a, b) {
  const rad = (deg) => (deg * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLon = rad(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}

const fmt = (value, digits = 0) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: digits }).format(value);

function useIss() {
  const [state, setState] = useState({ status: "loading", position: null, trail: [] });
  const trail = useRef([]);

  useEffect(() => {
    let cancelled = false;
    let timer;
    async function tick() {
      if (document.visibilityState === "visible") {
        try {
          const response = await fetch(ISS_URL);
          if (!response.ok) throw new Error(String(response.status));
          const data = await response.json();
          const position = { lat: data.latitude, lon: data.longitude, altitude: data.altitude, velocity: data.velocity, daylight: data.visibility === "daylight" };
          trail.current = [...trail.current, position].slice(-40);
          if (!cancelled) setState({ status: "ready", position, trail: trail.current });
        } catch {
          if (!cancelled) setState((current) => (current.position ? current : { ...current, status: "error" }));
        }
      }
      timer = setTimeout(tick, 10000);
    }
    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  return state;
}

function useLaunches() {
  const [state, setState] = useState({ status: "loading", items: [] });

  useEffect(() => {
    let cancelled = false;
    try {
      const cached = JSON.parse(localStorage.getItem(LAUNCH_CACHE) ?? "null");
      if (cached && Date.now() - cached.at < 60 * 60 * 1000) {
        setState({ status: "ready", items: cached.items });
        return undefined;
      }
    } catch {
      /* no cache */
    }
    fetch(LAUNCHES_URL)
      .then((response) => (response.ok ? response.json() : Promise.reject(new Error(String(response.status)))))
      .then((data) => {
        const items = (data.results ?? []).map((launch) => ({
          id: launch.id,
          name: launch.name,
          net: launch.net,
          status: launch.status?.abbrev ?? launch.status?.name ?? "",
          provider: launch.launch_service_provider?.name ?? "",
          location: launch.pad?.location?.name ?? launch.pad?.name ?? "",
        }));
        try {
          localStorage.setItem(LAUNCH_CACHE, JSON.stringify({ at: Date.now(), items }));
        } catch {
          /* storage blocked */
        }
        if (!cancelled) setState({ status: "ready", items });
      })
      .catch(() => !cancelled && setState({ status: "error", items: [] }));
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}

function countdown(iso, now) {
  const diff = new Date(iso).getTime() - now;
  if (diff <= 0) return "Ұшуда / жаңа ұшты";
  const minutes = Math.floor(diff / 60000);
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const mins = minutes % 60;
  if (days > 0) return `${days} к ${hours} сағ`;
  if (hours > 0) return `${hours} сағ ${mins} мин`;
  return `${mins} мин`;
}

/** Equirectangular mini map: grid, equator, Almaty & Baikonur, ISS trail and dot. */
function IssMap({ position, trail }) {
  const x = (lon) => ((lon + 180) / 360) * 360;
  const y = (lat) => ((90 - lat) / 180) * 180;
  // Break the trail where it wraps around the date line.
  const segments = [];
  let current = [];
  trail.forEach((point, index) => {
    if (index > 0 && Math.abs(point.lon - trail[index - 1].lon) > 180) {
      segments.push(current);
      current = [];
    }
    current.push(`${x(point.lon).toFixed(1)},${y(point.lat).toFixed(1)}`);
  });
  segments.push(current);

  return (
    <svg className="iss-map" viewBox="0 0 360 180" role="img" aria-label="ХҒС орны картада">
      {[...Array(11)].map((_, i) => (
        <line key={`v${i}`} x1={i * 36} y1="0" x2={i * 36} y2="180" className="iss-map__grid" />
      ))}
      {[...Array(5)].map((_, i) => (
        <line key={`h${i}`} x1="0" y1={i * 45} x2="360" y2={i * 45} className="iss-map__grid" />
      ))}
      {LAND.map((shape, index) => (
        <polygon key={index} points={shape.map(([lon, lat]) => `${x(lon).toFixed(1)},${y(lat).toFixed(1)}`).join(" ")} className="iss-map__land" />
      ))}
      <line x1="0" y1="90" x2="360" y2="90" className="iss-map__equator" />
      {/* Approximate box around Kazakhstan for orientation */}
      <rect x={x(46.5)} y={y(55.5)} width={x(87.3) - x(46.5)} height={y(40.6) - y(55.5)} className="iss-map__kz" rx="3" />
      {PLACES.map((place) => (
        <g key={place.name}>
          <circle cx={x(place.lon)} cy={y(place.lat)} r="2.2" className="iss-map__place" />
          <text x={x(place.lon) + 4} y={y(place.lat) + (place.name === "Алматы" ? 9 : -4)} className="iss-map__label">
            {place.name}
          </text>
        </g>
      ))}
      {segments.filter((segment) => segment.length > 1).map((segment, index) => (
        <polyline key={index} points={segment.join(" ")} className="iss-map__trail" />
      ))}
      {position && (
        <g transform={`translate(${x(position.lon)} ${y(position.lat)})`}>
          <circle r="9" className="iss-map__pulse" />
          <circle r="3.6" className="iss-map__iss" />
        </g>
      )}
    </svg>
  );
}

export default function SpaceCard() {
  const iss = useIss();
  const launches = useLaunches();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  if (iss.status === "error" && launches.status === "error") return null; // offline: just hide

  const almaty = iss.position ? distanceKm(iss.position, PLACES[0]) : null;

  return (
    <section className="panel space-card">
      <div className="section-title">
        <h2>Ғарыш бүгін</h2>
        <span className="section-title__meta">тікелей</span>
      </div>

      <div className="space-card__grid">
        {iss.status !== "error" && (
          <div className="space-card__iss">
            <div className="space-card__head">
              <Satellite size={16} aria-hidden="true" />
              <strong>ХҒС қазір қайда?</strong>
            </div>
            <IssMap position={iss.position} trail={iss.trail} />
            {iss.position ? (
              <dl className="iss-stats">
                <div><dt>Ендік / бойлық</dt><dd>{fmt(iss.position.lat, 2)}°, {fmt(iss.position.lon, 2)}°</dd></div>
                <div><dt>Биіктік</dt><dd>{fmt(iss.position.altitude)} км</dd></div>
                <div><dt>Жылдамдық</dt><dd>{fmt(iss.position.velocity)} км/сағ</dd></div>
                <div><dt>Алматыдан</dt><dd>{fmt(almaty)} км</dd></div>
              </dl>
            ) : (
              <p className="muted small">Жүктелуде…</p>
            )}
          </div>
        )}

        {launches.status !== "error" && (
          <div className="space-card__launches">
            <div className="space-card__head">
              <Rocket size={16} aria-hidden="true" />
              <strong>Жақын ұшырылымдар</strong>
            </div>
            {launches.status === "loading" ? (
              <p className="muted small">Жүктелуде…</p>
            ) : (
              <ul className="launch-list">
                {launches.items.map((launch) => {
                  const baikonur = /baikonur|байконур|байқоңыр/i.test(launch.location);
                  return (
                    <li key={launch.id} className={baikonur ? "is-baikonur" : undefined}>
                      <div className="launch-list__main">
                        <strong>{launch.name}</strong>
                        <span>{launch.provider}{launch.location ? ` · ${launch.location}` : ""}</span>
                      </div>
                      <div className="launch-list__time">
                        <b>{countdown(launch.net, now)}</b>
                        {baikonur && <span className="tag tag--admin">Байқоңыр</span>}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            <p className="space-card__source">Дереккөз: Launch Library 2, wheretheiss.at</p>
          </div>
        )}
      </div>
    </section>
  );
}
