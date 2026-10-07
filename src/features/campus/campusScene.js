import * as THREE from "three";
import { MapControls } from "three/examples/jsm/controls/MapControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { BUILDINGS, KINDS, OUR_BUILDING, PATHS, POOLS } from "./campusData.js";

// Image pixels → plan (the illustration is foreshortened vertically, so y is stretched back).
const toX = (px) => (px - 680) / 10;
const toZ = (py) => (py * 1.6 - 560) / 10;
const ANGLE = { u: THREE.MathUtils.degToRad(44.5), v: THREE.MathUtils.degToRad(-45.5) };
const FLOOR = 0.55;

const THEMES = {
  dark: {
    background: "#060c18",
    grass: "#14352b",
    path: "#3e4c66",
    wall: "#cfd8e6",
    window: "#5b6b85",
    roof: "#eef3fb",
    tree: "#1f5a43",
    water: "#3fb7e8",
    track: "#b0533f",
    field: "#2f7a4a",
    hemiSky: "#c9dcff",
    hemiGround: "#0b1a14",
  },
  light: {
    background: "#e9f0f7",
    grass: "#a9d3b0",
    path: "#e3d2c6",
    wall: "#f4f1ea",
    window: "#8fa3bf",
    roof: "#ffffff",
    tree: "#4f9a62",
    water: "#53b9ea",
    track: "#c8664f",
    field: "#5aa86b",
    hemiSky: "#ffffff",
    hemiGround: "#8fb59a",
  },
};
const ACCENT = new THREE.Color("#35e0cf");

function windowTexture(colors) {
  const canvas = document.createElement("canvas");
  canvas.width = 64;
  canvas.height = 64;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = colors.wall;
  ctx.fillRect(0, 0, 64, 64);
  ctx.fillStyle = colors.window;
  ctx.fillRect(12, 18, 40, 26);
  ctx.fillStyle = "rgba(255,255,255,0.25)";
  ctx.fillRect(12, 18, 40, 4);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

/** Deterministic pseudo-random numbers so the trees are always in the same places. */
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

function distanceToSegment(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz)));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

/**
 * Builds the 3D campus inside `container`.
 * Returns { select(id), focus(id), setFilter(fn|null), resetView(), dispose() }.
 */
export function createCampusScene(container, { theme = "dark", onSelect } = {}) {
  const colors = THEMES[theme] ?? THEMES.dark;
  const disposables = [];
  const track = (thing) => (disposables.push(thing), thing);

  // ---- Renderer, camera, controls ----
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.domElement.className = "campus-canvas";
  container.appendChild(renderer.domElement);

  const labels = new CSS2DRenderer();
  labels.domElement.className = "campus-labels";
  container.appendChild(labels.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(colors.background);
  scene.fog = new THREE.Fog(colors.background, 110, 220);

  const camera = new THREE.PerspectiveCamera(38, 1, 0.5, 600);
  // Start view: the whole academic core fits the screen (farther away on narrow phones).
  const HOME = { target: new THREE.Vector3(-1, 0, -8), position: new THREE.Vector3() };
  const VIEW_DIR = new THREE.Vector3(-0.12, 0.72, 0.68).normalize();
  function homePosition(aspect) {
    const halfHorizontal = Math.atan(Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * aspect);
    const distance = THREE.MathUtils.clamp(34 / Math.tan(halfHorizontal), 82, 150);
    return HOME.target.clone().add(VIEW_DIR.clone().multiplyScalar(distance));
  }
  HOME.position.copy(homePosition(1.6));
  camera.position.copy(HOME.position);

  const controls = new MapControls(camera, renderer.domElement);
  controls.target.copy(HOME.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.screenSpacePanning = false;
  controls.minDistance = 12;
  controls.maxDistance = 170;
  controls.maxPolarAngle = THREE.MathUtils.degToRad(74);
  controls.minPolarAngle = THREE.MathUtils.degToRad(12);
  controls.update();

  // ---- Lights ----
  scene.add(new THREE.HemisphereLight(colors.hemiSky, colors.hemiGround, theme === "light" ? 1.6 : 1.25));
  const sun = new THREE.DirectionalLight("#ffffff", theme === "light" ? 1.8 : 1.5);
  sun.position.set(-40, 70, 30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 10, far: 200 });
  sun.shadow.bias = -0.0006;
  scene.add(sun);

  // ---- Ground ----
  const ground = new THREE.Mesh(track(new THREE.PlaneGeometry(400, 400)), track(new THREE.MeshStandardMaterial({ color: colors.grass, roughness: 1 })));
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  scene.add(ground);

  // ---- Walkways ----
  const pathMaterial = track(new THREE.MeshStandardMaterial({ color: colors.path, roughness: 0.95 }));
  const segments = [];
  for (const path of PATHS) {
    const points = path.points.map(([px, py]) => [toX(px), toZ(py)]);
    for (let i = 0; i < points.length - 1; i += 1) {
      const [ax, az] = points[i];
      const [bx, bz] = points[i + 1];
      const length = Math.hypot(bx - ax, bz - az);
      const slab = new THREE.Mesh(track(new THREE.BoxGeometry(length, 0.06, path.width)), pathMaterial);
      slab.position.set((ax + bx) / 2, 0.03, (az + bz) / 2);
      slab.rotation.y = -Math.atan2(bz - az, bx - ax);
      slab.receiveShadow = true;
      scene.add(slab);
      segments.push({ ax, az, bx, bz, width: path.width });
    }
    for (const [x, z] of points) {
      const joint = new THREE.Mesh(track(new THREE.CylinderGeometry(path.width / 2, path.width / 2, 0.06, 20)), pathMaterial);
      joint.position.set(x, 0.03, z);
      scene.add(joint);
    }
  }

  // ---- Pools ----
  const waterMaterial = track(new THREE.MeshStandardMaterial({ color: colors.water, emissive: colors.water, emissiveIntensity: 0.25, roughness: 0.2 }));
  for (const pool of POOLS) {
    const water = new THREE.Mesh(track(new THREE.BoxGeometry(pool.L, 0.1, pool.W)), waterMaterial);
    water.position.set(toX(pool.px), 0.07, toZ(pool.py));
    water.rotation.y = ANGLE.u;
    scene.add(water);
  }

  // ---- Buildings ----
  const baseTexture = track(windowTexture(colors));
  const roofMaterial = track(new THREE.MeshStandardMaterial({ color: colors.roof, roughness: 0.85 }));
  const pickable = [];
  const entries = new Map(); // id → { building, group, meshes, badge, label, top, materials }

  function wallMaterial(repeatX, repeatY) {
    const texture = baseTexture.clone();
    texture.needsUpdate = true;
    texture.repeat.set(Math.max(1, Math.round(repeatX)), Math.max(1, repeatY));
    track(texture);
    return track(new THREE.MeshStandardMaterial({ map: texture, roughness: 0.8 }));
  }

  for (const building of BUILDINGS) {
    const group = new THREE.Group();
    group.position.set(toX(building.px), 0, toZ(building.py));
    const meshes = [];
    let top = 0.6;

    if (building.shape === "round") {
      const height = building.floors * FLOOR + 0.2;
      const material = building.glass
        ? track(new THREE.MeshStandardMaterial({ color: "#7cc7ff", transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.3 }))
        : wallMaterial(building.R * 2, building.floors);
      const body = new THREE.Mesh(track(new THREE.CylinderGeometry(building.R, building.R * 1.04, height, 40)), [material, roofMaterial, roofMaterial]);
      body.position.y = height / 2;
      meshes.push(body);
      if (!building.glass) {
        const dome = new THREE.Mesh(track(new THREE.SphereGeometry(building.R * 0.75, 32, 12, 0, Math.PI * 2, 0, Math.PI / 2)), roofMaterial);
        dome.scale.y = 0.35;
        dome.position.y = height;
        meshes.push(dome);
      }
      top = height + building.R * 0.3;
    } else if (building.shape === "stadium") {
      const trackMesh = new THREE.Mesh(track(new THREE.CircleGeometry(1, 48)), track(new THREE.MeshStandardMaterial({ color: colors.track, roughness: 1 })));
      trackMesh.scale.set(building.L / 2, building.W / 2, 1);
      trackMesh.rotation.x = -Math.PI / 2;
      trackMesh.position.y = 0.05;
      const field = new THREE.Mesh(track(new THREE.CircleGeometry(1, 48)), track(new THREE.MeshStandardMaterial({ color: colors.field, roughness: 1 })));
      field.scale.set(building.L / 2 - 1.2, building.W / 2 - 1.2, 1);
      field.rotation.x = -Math.PI / 2;
      field.position.y = 0.08;
      const stand = new THREE.Mesh(track(new THREE.BoxGeometry(building.L * 0.6, 1, 1.4)), roofMaterial);
      stand.position.set(0, 0.5, building.W / 2 + 0.6);
      const inner = new THREE.Group();
      inner.add(trackMesh, field, stand);
      inner.rotation.y = ANGLE.u;
      group.add(inner);
      meshes.push(trackMesh, field, stand);
      top = 1.4;
    } else if (building.shape === "flat") {
      const pad = new THREE.Mesh(track(new THREE.BoxGeometry(building.L, 0.08, building.W)), track(new THREE.MeshStandardMaterial({ color: "#56627a", roughness: 1 })));
      pad.position.y = 0.05;
      pad.rotation.y = ANGLE[building.orient];
      meshes.push(pad);
      top = 0.6;
    } else {
      const height = building.floors * FLOOR + 0.25;
      const long = wallMaterial(building.L / 1.1, building.floors);
      const short = wallMaterial(building.W / 1.1, building.floors);
      const sides = building.glass
        ? track(new THREE.MeshStandardMaterial({ color: "#8fd0ff", transparent: true, opacity: 0.9, roughness: 0.15, metalness: 0.2 }))
        : null;
      const box = new THREE.Mesh(track(new THREE.BoxGeometry(building.L, height, building.W)), [
        sides ?? short, sides ?? short, building.glass ? sides : roofMaterial, roofMaterial, sides ?? long, sides ?? long,
      ]);
      box.position.y = height / 2;
      box.rotation.y = ANGLE[building.orient];
      meshes.push(box);
      // Small roof structure on tall buildings for a bit of silhouette.
      if (building.floors >= 7) {
        const cap = new THREE.Mesh(track(new THREE.BoxGeometry(building.L * 0.45, 0.8, building.W * 0.5)), roofMaterial);
        cap.position.y = height + 0.4;
        cap.rotation.y = ANGLE[building.orient];
        meshes.push(cap);
      }
      top = height + (building.floors >= 7 ? 0.8 : 0);
    }

    for (const mesh of meshes) {
      mesh.castShadow = building.shape !== "flat" && building.shape !== "stadium";
      mesh.receiveShadow = true;
      mesh.userData.id = building.id;
      if (!mesh.parent) group.add(mesh);
      pickable.push(mesh);
    }

    // Number badge (as on the official map) + name label (shown when selected / our building).
    const badgeEl = document.createElement("button");
    badgeEl.type = "button";
    badgeEl.className = `campus-badge campus-badge--${building.kind}${building.id === OUR_BUILDING ? " is-ours" : ""}`;
    badgeEl.textContent = building.num ?? building.symbol ?? (building.kind === "dorm" ? "⌂" : "•");
    badgeEl.setAttribute("aria-label", building.name);
    badgeEl.addEventListener("click", (event) => {
      event.stopPropagation();
      select(building.id, { focus: true });
    });
    const badge = new CSS2DObject(badgeEl);
    badge.position.set(0, top + 0.9, 0);
    group.add(badge);

    const labelEl = document.createElement("div");
    labelEl.className = "campus-label";
    labelEl.textContent = building.id === OUR_BUILDING ? `★ ${building.name}` : building.name;
    const label = new CSS2DObject(labelEl);
    label.position.set(0, top + 0.9, 0);
    label.center.set(0.5, -0.9);
    labelEl.hidden = building.id !== OUR_BUILDING;
    group.add(label);

    scene.add(group);
    entries.set(building.id, { building, group, meshes, badgeEl, labelEl, top });
  }

  // ---- Trees (instanced, deterministic) ----
  const random = seeded(7);
  const treeCount = 320;
  const tree = new THREE.InstancedMesh(
    track(new THREE.ConeGeometry(0.55, 1.6, 7)),
    track(new THREE.MeshStandardMaterial({ color: colors.tree, roughness: 0.9 })),
    treeCount
  );
  tree.castShadow = true;
  const matrix = new THREE.Matrix4();
  let placed = 0;
  for (let attempt = 0; attempt < 6000 && placed < treeCount; attempt += 1) {
    const x = -40 + random() * 92;
    const z = -55 + random() * 95;
    const nearBuilding = BUILDINGS.some((b) => Math.hypot(x - toX(b.px), z - toZ(b.py)) < Math.max(b.L ?? b.R * 2, b.W ?? b.R * 2) / 1.6 + 1.6);
    const nearPath = segments.some((s) => distanceToSegment(x, z, s.ax, s.az, s.bx, s.bz) < s.width / 2 + 0.7);
    const nearPool = POOLS.some((p) => Math.hypot(x - toX(p.px), z - toZ(p.py)) < 3);
    if (nearBuilding || nearPath || nearPool) continue;
    const scale = 0.7 + random() * 0.7;
    matrix.compose(new THREE.Vector3(x, 0.8 * scale, z), new THREE.Quaternion(), new THREE.Vector3(scale, scale, scale));
    tree.setMatrixAt(placed, matrix);
    placed += 1;
  }
  tree.count = placed;
  scene.add(tree);

  // ---- Selection & filter ----
  let selectedId = null;
  let filter = null;

  function paint() {
    for (const [id, entry] of entries) {
      const visible = !filter || filter(entry.building);
      const selected = id === selectedId;
      const ours = id === OUR_BUILDING;
      for (const mesh of entry.meshes) {
        const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        for (const material of materials) {
          if (!material.userData.base) material.userData.base = { opacity: material.opacity, transparent: material.transparent };
          material.transparent = !visible || material.userData.base.transparent;
          material.opacity = visible ? material.userData.base.opacity : 0.18;
          if ("emissive" in material && material !== waterMaterial) {
            material.emissive = selected ? ACCENT : ours ? ACCENT.clone().multiplyScalar(0.35) : new THREE.Color(0x000000);
            material.emissiveIntensity = selected ? 0.32 : 0.5;
          }
          material.needsUpdate = true;
        }
      }
      entry.badgeEl.classList.toggle("is-dim", !visible);
      entry.badgeEl.classList.toggle("is-selected", selected);
      entry.labelEl.hidden = !(selected || (ours && visible));
    }
  }

  // Shared materials (roof) must not tint every building: give selected/ours their own copies.
  for (const entry of entries.values()) {
    for (const mesh of entry.meshes) {
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map((m) => track(m.clone())) : track(mesh.material.clone());
    }
  }

  // ---- Camera fly-to ----
  let flight = null;
  function flyTo(target, distance = 34) {
    const offset = camera.position.clone().sub(controls.target).normalize().multiplyScalar(distance);
    flight = {
      start: performance.now(),
      fromTarget: controls.target.clone(),
      toTarget: target.clone(),
      fromPosition: camera.position.clone(),
      toPosition: target.clone().add(offset),
    };
  }

  function focus(id) {
    const entry = entries.get(id);
    if (!entry) return;
    // Close enough to see the building, far enough to keep its neighbours in view.
    const base = HOME.position.distanceTo(HOME.target);
    flyTo(new THREE.Vector3(entry.group.position.x, 0, entry.group.position.z), Math.max(46, base * 0.55) + (entry.building.floors >= 10 ? 8 : 0));
  }

  function select(id, { focus: andFocus = false } = {}) {
    selectedId = id && entries.has(id) ? id : null;
    paint();
    if (selectedId && andFocus) focus(selectedId);
    onSelect?.(selectedId);
  }

  function setFilter(fn) {
    filter = fn;
    paint();
  }

  function resetView() {
    flight = { start: performance.now(), fromTarget: controls.target.clone(), toTarget: HOME.target.clone(), fromPosition: camera.position.clone(), toPosition: HOME.position.clone() };
  }

  // ---- Picking (tap without dragging) ----
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let down = null;
  function onPointerDown(event) {
    down = { x: event.clientX, y: event.clientY, t: performance.now() };
  }
  function onPointerUp(event) {
    if (!down) return;
    const moved = Math.hypot(event.clientX - down.x, event.clientY - down.y);
    const quick = performance.now() - down.t < 450;
    down = null;
    if (moved > 6 || !quick) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(pickable, false)[0];
    select(hit ? hit.object.userData.id : null, { focus: Boolean(hit) });
  }
  renderer.domElement.addEventListener("pointerdown", onPointerDown);
  renderer.domElement.addEventListener("pointerup", onPointerUp);

  // ---- Size & loop ----
  let framed = false;
  function resize() {
    const { clientWidth: width, clientHeight: height } = container;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    labels.setSize(width, height);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    HOME.position.copy(homePosition(camera.aspect));
    if (!framed) {
      camera.position.copy(HOME.position);
      controls.target.copy(HOME.target);
      framed = true;
    }
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  const BOUNDS = 55;
  function tick(now) {
    if (flight) {
      const t = Math.min(1, (now - flight.start) / 750);
      const k = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      controls.target.lerpVectors(flight.fromTarget, flight.toTarget, k);
      camera.position.lerpVectors(flight.fromPosition, flight.toPosition, k);
      if (t >= 1) flight = null;
    }
    // Keep the campus on screen.
    const clampX = THREE.MathUtils.clamp(controls.target.x, -BOUNDS, BOUNDS) - controls.target.x;
    const clampZ = THREE.MathUtils.clamp(controls.target.z, -BOUNDS, BOUNDS) - controls.target.z;
    if (clampX || clampZ) {
      controls.target.x += clampX;
      controls.target.z += clampZ;
      camera.position.x += clampX;
      camera.position.z += clampZ;
    }
    controls.update();
    renderer.render(scene, camera);
    labels.render(scene, camera);
  }
  renderer.setAnimationLoop(tick);
  const onVisibility = () => renderer.setAnimationLoop(document.visibilityState === "visible" ? tick : null);
  document.addEventListener("visibilitychange", onVisibility);

  paint();

  return {
    select,
    focus,
    setFilter,
    resetView,
    dispose() {
      document.removeEventListener("visibilitychange", onVisibility);
      renderer.setAnimationLoop(null);
      observer.disconnect();
      renderer.domElement.removeEventListener("pointerdown", onPointerDown);
      renderer.domElement.removeEventListener("pointerup", onPointerUp);
      controls.dispose();
      for (const thing of disposables) thing.dispose?.();
      renderer.dispose();
      renderer.domElement.remove();
      labels.domElement.remove();
    },
  };
}

export { KINDS };
