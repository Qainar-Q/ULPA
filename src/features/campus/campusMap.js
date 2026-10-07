import * as maplibregl from "maplibre-gl";
import workerUrl from "maplibre-gl/dist/maplibre-gl-worker.mjs?url";
import "maplibre-gl/dist/maplibre-gl.css";
import { CAMPUS_CENTER, OUR_BUILDING } from "./campusData.js";

// Free OpenStreetMap vector tiles from OpenFreeMap (no key, no limits; attribution shown).
const STYLES = {
  dark: "https://tiles.openfreemap.org/styles/dark",
  light: "https://tiles.openfreemap.org/styles/liberty",
};
const BUILDING_COLORS = {
  dark: { fill: "#c3cee0", opacity: 0.82 },
  light: { fill: "#e9e4da", opacity: 0.9 },
};
const START = { center: [CAMPUS_CENTER.lng, CAMPUS_CENTER.lat], zoom: 16.1, pitch: 55, bearing: -18 };

maplibregl.setWorkerUrl(workerUrl);

/** Add our own 3D buildings (OpenMapTiles "building" layer, extruded by real height). */
function add3dBuildings(map, theme) {
  const style = map.getStyle();
  const source = Object.entries(style.sources).find(([, value]) => value.type === "vector")?.[0];
  if (!source) return;
  for (const layer of style.layers) {
    if (layer.type === "fill-extrusion" || (layer["source-layer"] === "building" && layer.type === "fill")) {
      map.setLayoutProperty(layer.id, "visibility", "none");
    }
  }
  const firstSymbol = style.layers.find((layer) => layer.type === "symbol")?.id;
  const colors = BUILDING_COLORS[theme];
  map.addLayer(
    {
      id: "ulpa-buildings-3d",
      type: "fill-extrusion",
      source,
      "source-layer": "building",
      minzoom: 14,
      paint: {
        "fill-extrusion-color": colors.fill,
        "fill-extrusion-height": ["coalesce", ["get", "render_height"], 10],
        "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
        "fill-extrusion-opacity": colors.opacity,
        "fill-extrusion-vertical-gradient": true,
      },
    },
    firstSymbol
  );
}

/**
 * Real campus map in `container`.
 * markers: [{ id, lat, lng, kind, text, label, ours }]
 * Returns { select(id), setFilter(fn), setEditable(bool), resetView(), dispose() }.
 */
export function createCampusMap(container, { theme = "dark", markers, onSelect, onMove } = {}) {
  const map = new maplibregl.Map({
    container,
    style: STYLES[theme] ?? STYLES.dark,
    ...START,
    maxPitch: 70,
    minZoom: 13,
    maxBounds: [
      [CAMPUS_CENTER.lng - 0.05, CAMPUS_CENTER.lat - 0.035],
      [CAMPUS_CENTER.lng + 0.05, CAMPUS_CENTER.lat + 0.035],
    ],
    attributionControl: { compact: true },
    cooperativeGestures: false,
  });
  map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "top-right");
  map.addControl(
    new maplibregl.GeolocateControl({ positionOptions: { enableHighAccuracy: true }, trackUserLocation: true, showAccuracyCircle: true }),
    "top-right"
  );
  map.on("style.load", () => {
    try {
      add3dBuildings(map, theme);
    } catch {
      /* style without a building layer: flat map is still fine */
    }
  });

  const entries = new Map();
  let selectedId = null;
  let filter = null;
  let editable = false;

  for (const item of markers) {
    const element = document.createElement("button");
    element.type = "button";
    element.className = `campus-badge campus-badge--${item.kind}${item.ours ? " is-ours" : ""}`;
    element.textContent = item.text;
    element.setAttribute("aria-label", item.label);
    element.addEventListener("click", (event) => {
      event.stopPropagation();
      if (!editable) select(item.id, { focus: true });
    });
    const marker = new maplibregl.Marker({ element, anchor: "center", draggable: false }).setLngLat([item.lng, item.lat]).addTo(map);
    marker.on("dragend", () => {
      const { lng, lat } = marker.getLngLat();
      onMove?.(item.id, { lat, lng });
    });

    let nameMarker = null;
    if (item.ours) {
      const name = document.createElement("div");
      name.className = "campus-label";
      name.textContent = `★ ${item.label}`;
      nameMarker = new maplibregl.Marker({ element: name, anchor: "top", offset: [0, 16] }).setLngLat([item.lng, item.lat]).addTo(map);
      marker.on("drag", () => nameMarker.setLngLat(marker.getLngLat()));
    }
    entries.set(item.id, { item, marker, element, nameMarker });
  }

  function paint() {
    for (const [id, entry] of entries) {
      const visible = !filter || filter(entry.item);
      entry.element.classList.toggle("is-dim", !visible);
      entry.element.classList.toggle("is-selected", id === selectedId);
      entry.element.classList.toggle("is-editing", editable);
    }
  }

  function select(id, { focus = false } = {}) {
    selectedId = id && entries.has(id) ? id : null;
    paint();
    if (selectedId && focus) {
      const { lng, lat } = entries.get(selectedId).marker.getLngLat();
      map.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), 17.2), pitch: 58, duration: 900, essential: true });
    }
    onSelect?.(selectedId, selectedId ? entries.get(selectedId).marker.getLngLat() : null);
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
    resetView() {
      map.flyTo({ ...START, duration: 900, essential: true });
    },
    dispose() {
      map.remove();
    },
  };
}
