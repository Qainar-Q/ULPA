import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { CAMPUS_BOUNDS, CAMPUS_CENTER } from "./campusData.js";

// Free OpenStreetMap vector tiles from OpenFreeMap (no key, no limits; attribution shown).
const STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};
const COLORS = {
  dark: { building: "#2c3b55", outline: "#5d7396", hover: "#35e0cf", mask: "#03070f", maskOpacity: 0.62, edge: "#35e0cf" },
  light: { building: "#d9d2c5", outline: "#a99f8e", hover: "#0fa898", mask: "#ffffff", maskOpacity: 0.7, edge: "#0fa898" },
};
const { south, north, west, east } = CAMPUS_BOUNDS;
// Flat, top-down and south-up like the official campus map: Al-Farabi Ave at the top.
// Flat means a marker always sits exactly on its building, whichever way the map is turned.
const CAMPUS_BOX = [
  [CAMPUS_BOUNDS.west, CAMPUS_BOUNDS.south],
  [CAMPUS_BOUNDS.east, CAMPUS_BOUNDS.north],
];
const FIT = { bearing: 180, padding: 24 };
const PAD = 0.004;

maplibregl.setWorkerUrl(workerUrl);

/** Flat buildings, a dim veil outside the campus and a campus outline. */
function decorate(map, theme) {
  const colors = COLORS[theme];
  const style = map.getStyle();
  const source = Object.entries(style.sources).find(([, value]) => value.type === "vector")?.[0];
  if (source) {
    for (const layer of style.layers) {
      if (layer["source-layer"] === "building" || layer.type === "fill-extrusion") map.setLayoutProperty(layer.id, "visibility", "none");
    }
    const firstSymbol = style.layers.find((layer) => layer.type === "symbol")?.id;
    map.addLayer(
      { id: "ulpa-buildings", type: "fill", source, "source-layer": "building", minzoom: 13, paint: { "fill-color": colors.building, "fill-outline-color": colors.outline } },
      firstSymbol
    );
    map.addLayer(
      { id: "ulpa-buildings-line", type: "line", source, "source-layer": "building", minzoom: 15, paint: { "line-color": colors.outline, "line-width": 1 } },
      firstSymbol
    );
  }
  const ring = [[west, south], [east, south], [east, north], [west, north], [west, south]];
  map.addSource("ulpa-campus", {
    type: "geojson",
    data: {
      type: "FeatureCollection",
      features: [
        { type: "Feature", properties: { part: "veil" }, geometry: { type: "Polygon", coordinates: [[[-180, -85], [180, -85], [180, 85], [-180, 85], [-180, -85]], [...ring].reverse()] } },
        { type: "Feature", properties: { part: "edge" }, geometry: { type: "LineString", coordinates: ring } },
      ],
    },
  });
  map.addLayer({ id: "ulpa-veil", type: "fill", source: "ulpa-campus", filter: ["==", ["get", "part"], "veil"], paint: { "fill-color": colors.mask, "fill-opacity": colors.maskOpacity } });
  map.addLayer({
    id: "ulpa-edge",
    type: "line",
    source: "ulpa-campus",
    filter: ["==", ["get", "part"], "edge"],
    paint: { "line-color": colors.edge, "line-width": 2, "line-dasharray": [2, 2], "line-opacity": 0.7 },
  });
}

/** Centre of the building polygon under a screen point (to snap a dragged marker). */
function buildingCentreAt(map, point) {
  if (!map.getLayer("ulpa-buildings")) return null;
  const feature = map.queryRenderedFeatures(point, { layers: ["ulpa-buildings"] })[0];
  if (!feature) return null;
  const polygon = feature.geometry.type === "MultiPolygon" ? feature.geometry.coordinates[0] : feature.geometry.coordinates;
  const ring = polygon?.[0];
  if (!ring?.length) return null;
  // Area-weighted centroid of the outer ring.
  let area = 0, cx = 0, cy = 0;
  for (let i = 0; i < ring.length - 1; i += 1) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    const f = x1 * y2 - x2 * y1;
    area += f; cx += (x1 + x2) * f; cy += (y1 + y2) * f;
  }
  if (Math.abs(area) < 1e-14) return null;
  const centre = { lng: cx / (3 * area), lat: cy / (3 * area) };
  // A long or L-shaped building can have its centroid outside: then keep the drop point.
  const back = map.queryRenderedFeatures(map.project([centre.lng, centre.lat]), { layers: ["ulpa-buildings"] });
  return back.length ? centre : null;
}

/**
 * Campus map in `container`.
 * markers: [{ id, lat, lng, kind, text, label, ours }]
 * Returns { select(id), setFilter(fn), setEditable(bool), setPositions(map), resetView(), dispose() }.
 */
export function createCampusMap(container, { theme = "dark", markers, onSelect, onMove } = {}) {
  const map = new maplibregl.Map({
    container,
    style: STYLES[theme] ?? STYLES.dark,
    center: [CAMPUS_CENTER.lng, CAMPUS_CENTER.lat],
    zoom: 16,
    bearing: 180,
    bounds: CAMPUS_BOX,
    fitBoundsOptions: FIT,
    maxPitch: 0,
    minZoom: 15,
    maxZoom: 19.5,
    maxBounds: [
      [west - PAD, south - PAD],
      [east + PAD, north + PAD],
    ],
    attributionControl: { compact: true },
  });
  map.touchPitch.disable();
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: false, showCompass: true }), "top-right");
  map.addControl(
    new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true }),
    "top-right"
  );
  map.on("style.load", () => {
    try {
      decorate(map, theme);
    } catch {
      /* style without a building layer: the plain map is still fine */
    }
  });

  const entries = new Map();
  let selectedId = null;
  let filter = null;
  let editable = false;

  for (const item of markers) {
    const element = document.createElement("div");
    element.className = "campus-pin";
    const badge = document.createElement("button");
    badge.type = "button";
    badge.className = `campus-badge campus-badge--${item.kind}${item.ours ? " is-ours" : ""}`;
    badge.textContent = item.text;
    badge.setAttribute("aria-label", item.label);
    const name = document.createElement("span");
    name.className = `campus-pin__name${item.ours ? " is-ours" : ""}`;
    name.textContent = item.ours ? `★ ${item.short}` : item.short;
    element.append(badge, name);
    badge.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!editable) select(item.id, { focus: true });
    });
    // Anchor at the badge centre (badge is 22px high, on top of the name).
    const marker = new maplibregl.Marker({ element, anchor: "top", offset: [0, -11], draggable: false }).setLngLat([item.lng, item.lat]).addTo(map);
    marker.on("dragend", () => {
      const dropped = marker.getLngLat();
      const snapped = buildingCentreAt(map, map.project(dropped)) ?? { lat: dropped.lat, lng: dropped.lng };
      marker.setLngLat([snapped.lng, snapped.lat]);
      onMove?.(item.id, { lat: snapped.lat, lng: snapped.lng });
    });
    entries.set(item.id, { item, marker, element, badge });
  }

  function paint() {
    const zoom = map.getZoom();
    for (const [id, entry] of entries) {
      const visible = !filter || filter(entry.item);
      entry.element.classList.toggle("is-dim", !visible);
      entry.badge.classList.toggle("is-selected", id === selectedId);
      entry.badge.classList.toggle("is-editing", editable);
      // Names: always for our building and the selected one; for all when zoomed in.
      const named = entry.item.ours || id === selectedId || editable || (visible && zoom >= (entry.item.kind === "dorm" ? 17.6 : 16.8));
      entry.element.classList.toggle("is-named", named);
      entry.element.style.zIndex = id === selectedId ? "3" : entry.item.ours ? "2" : "";
    }
  }
  map.on("zoomend", paint);

  function select(id, { focus = false } = {}) {
    selectedId = id && entries.has(id) ? id : null;
    paint();
    if (selectedId && focus) {
      const { lng, lat } = entries.get(selectedId).marker.getLngLat();
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 17.5), duration: 800, essential: true });
    }
    onSelect?.(selectedId);
  }

  map.on("click", () => {
    if (!editable) select(null);
  });

  paint();

  return {
    select,
    setFilter(fn) {
      filter = fn;
      paint();
    },
    setEditable(on) {
      editable = on;
      for (const entry of entries.values()) entry.marker.setDraggable(on);
      if (on) select(null);
      paint();
    },
    /** Move markers to new positions ({ id: {lat, lng} }) without rebuilding the map. */
    setPositions(positions) {
      for (const [id, entry] of entries) {
        const next = positions[id];
        if (next) entry.marker.setLngLat([next.lng, next.lat]);
      }
    },
    resetView() {
      map.fitBounds(CAMPUS_BOX, { ...FIT, duration: 800, essential: true });
    },
    dispose() {
      map.remove();
    },
  };
}
