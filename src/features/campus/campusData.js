// al-Farabi KazNU campus, modelled from the official campus illustration.
// The illustration is not to scale: positions and sizes are approximate, but
// neighbours and relative placement match. Coordinates are pixels on that image
// (px, py); campusScene.js turns them into a top-down plan.
//   L / W  — length / width in plan units, orient — long side along the main
//   boulevard ("u") or across it ("v"), floors — storeys (height).

export const KINDS = {
  faculty: { label: "Факультеттер", color: "#ff6b8a" },
  facility: { label: "Кітапхана, тамақ, спорт", color: "#5b94ff" },
  dorm: { label: "Жатақханалар", color: "#ffb547" },
  service: { label: "Медпункт, тұрақ", color: "#9aa7bd" },
};

// Rooms from our timetable → building. Change here if a room is elsewhere.
export const ROOM_BUILDINGS = {
  114: "mechmath",
  115: "mechmath",
  105: "mechmath",
  131: "mechmath",
};
export const OUR_BUILDING = "mechmath";

export const BUILDINGS = [
  // ---- Faculties (numbers as on the official map) ----
  { id: "rectorate", num: 1, kind: "faculty", name: "Ректорат", px: 568, py: 382, L: 4.5, W: 3.4, orient: "u", floors: 16 },
  { id: "philology", num: 2, kind: "faculty", name: "Филология факультеті", px: 612, py: 404, L: 7.5, W: 4, orient: "v", floors: 5 },
  { id: "law", num: 3, kind: "faculty", name: "Заң факультеті", px: 522, py: 470, L: 11, W: 4.5, orient: "v", floors: 4 },
  { id: "economics", num: 4, kind: "faculty", name: "Экономика және бизнес жоғары мектебі", px: 684, py: 488, L: 7, W: 5.5, orient: "u", floors: 4 },
  {
    id: "mechmath",
    num: 5,
    kind: "faculty",
    name: "Механика-математика факультеті",
    note: "Біздің факультет — ҒТТ мамандығы осында.",
    px: 515,
    py: 312,
    L: 18,
    W: 5,
    orient: "v",
    floors: 5,
  },
  { id: "biology", num: 6, kind: "faculty", name: "Биология және биотехнология факультеті", px: 800, py: 366, L: 12, W: 5, orient: "v", floors: 5 },
  { id: "physics", num: 7, kind: "faculty", name: "Физика-техникалық факультет", px: 548, py: 272, L: 19, W: 5, orient: "v", floors: 5 },
  { id: "chemistry", num: 8, kind: "faculty", name: "Химия және химиялық технология факультеті", px: 590, py: 236, L: 19, W: 5, orient: "v", floors: 5 },
  { id: "pe", num: 9, kind: "faculty", name: "Дене шынықтыру кафедрасы", px: 688, py: 126, L: 7, W: 3.2, orient: "u", floors: 2 },
  { id: "military", num: 10, kind: "faculty", name: "Әскери кафедра", px: 596, py: 510, L: 5, W: 4, orient: "v", floors: 4 },
  { id: "journalism", num: 11, kind: "faculty", name: "Журналистика факультеті", px: 668, py: 430, L: 6, W: 4, orient: "v", floors: 5 },
  { id: "geography", num: 12, kind: "faculty", name: "География және табиғатты пайдалану факультеті", px: 724, py: 326, L: 6, W: 4.5, orient: "v", floors: 5 },
  { id: "intl", num: 13, kind: "faculty", name: "Халықаралық қатынастар факультеті", px: 988, py: 268, L: 7, W: 4, orient: "u", floors: 7 },
  { id: "history", num: 14, kind: "faculty", name: "Тарих, археология және этнология факультеті", px: 708, py: 454, L: 4.5, W: 4, orient: "v", floors: 4 },

  // ---- Facilities (blue numbers on the official map) ----
  { id: "palace", num: 1, kind: "facility", name: "Студенттер сарайы", px: 405, py: 352, R: 4.6, floors: 4, shape: "round" },
  { id: "biomuseum", num: 2, kind: "facility", name: "Биология музейі", px: 766, py: 404, L: 6, W: 4, orient: "u", floors: 3 },
  { id: "biolibrary", num: 3, kind: "facility", name: "Биология факультетінің кітапханасы", px: 756, py: 312, L: 5, W: 3, orient: "u", floors: 3 },
  { id: "library", num: 4, kind: "facility", name: "ҚазҰУ кітапханасы", px: 678, py: 198, L: 7, W: 5, orient: "u", floors: 4 },
  { id: "canteen", num: 5, kind: "facility", name: "Тамақтану комбинаты, ЖМО", px: 853, py: 150, L: 6, W: 4, orient: "u", floors: 2 },
  { id: "cinema", num: 6, kind: "facility", name: "Кинотеатр, дүкен", px: 920, py: 166, L: 5, W: 4, orient: "u", floors: 2 },
  { id: "stadium", num: 7, kind: "facility", name: "ҚазҰУ стадионы", px: 565, py: 136, L: 15, W: 9, orient: "u", floors: 0, shape: "stadium" },
  { id: "museum", num: 8, kind: "facility", name: "ҚазҰУ орталық музейі", px: 620, py: 468, R: 1.8, floors: 2, shape: "round", glass: true },
  { id: "sports", num: null, kind: "facility", name: "Спорт кешені", px: 752, py: 190, L: 7, W: 6, orient: "u", floors: 3, glass: true },

  // ---- Dormitories (orange) ----
  ...[
    [776, 96, 5], [808, 88, 5], [856, 96, 5], [902, 102, 5], [935, 98, 5],
    [1004, 112, 5], [1040, 124, 5], [1082, 138, 5], [1124, 206, 6], [1132, 246, 6], [1040, 282, 6], [902, 42, 12],
  ].map(([px, py, floors], index) => ({
    id: `dorm-${index + 1}`,
    num: null,
    kind: "dorm",
    name: `Студенттер жатақханасы`,
    px,
    py,
    L: floors > 10 ? 6 : 4,
    W: floors > 10 ? 5 : 3.6,
    orient: "u",
    floors,
  })),

  // ---- Services ----
  { id: "medical", num: null, kind: "service", name: "Медициналық пункт", px: 886, py: 82, L: 3, W: 3, orient: "u", floors: 2, symbol: "+" },
  { id: "parking-1", num: null, kind: "service", name: "Көлік тұрағы", px: 352, py: 312, L: 4, W: 3, orient: "u", floors: 0, shape: "flat", symbol: "P" },
  { id: "parking-2", num: null, kind: "service", name: "Көлік тұрағы", px: 498, py: 536, L: 5, W: 3, orient: "u", floors: 0, shape: "flat", symbol: "P" },
  { id: "parking-3", num: null, kind: "service", name: "Көлік тұрағы", px: 765, py: 570, L: 5, W: 3, orient: "u", floors: 0, shape: "flat", symbol: "P" },
];

// Walkways (polylines in image pixels) and the two pools by the Students' Palace.
export const PATHS = [
  { width: 3.2, points: [[400, 400], [560, 300], [700, 210], [850, 120], [975, 58]] }, // main boulevard
  { width: 1.6, points: [[440, 420], [560, 470], [700, 540], [760, 575]] },
  { width: 1.6, points: [[640, 360], [760, 300], [900, 200], [1000, 140]] },
  { width: 1.4, points: [[700, 210], [820, 260], [960, 300], [1060, 300]] },
  { width: 1.2, points: [[560, 300], [640, 360], [700, 400]] },
];
export const POOLS = [
  { px: 432, py: 402, L: 3.6, W: 2.2 },
  { px: 478, py: 396, L: 3.6, W: 2.2 },
];

export function buildingForRoom(room) {
  if (!room) return null;
  const key = String(room).trim();
  const id = ROOM_BUILDINGS[key];
  return id ? BUILDINGS.find((building) => building.id === id) ?? null : null;
}
