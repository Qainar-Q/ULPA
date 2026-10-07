// al-Farabi KazNU campus — the official campus map picture (public/campus/kaznu-campus.webp)
// with tappable numbers. x / y are the centre of each printed number on that picture
// (890 × 592 px), so a marker can never be "wrong": it sits on the university's own label.
// For walking directions each place opens in 2GIS or Google Maps.

export const MAP_IMAGE = { src: "/campus/kaznu-campus.webp", width: 890, height: 592 };

export const KINDS = {
  faculty: { label: "Факультеттер", color: "#9b1c33" },
  facility: { label: "Сарай, кітапхана, спорт, тамақ", color: "#2b3a8f" },
  dorm: { label: "Жатақханалар және медпункт", color: "#f0912a" },
  parking: { label: "Көлік тұрағы", color: "#111" },
};

// Rooms from our timetable → place. Change here if a room is elsewhere.
export const ROOM_BUILDINGS = {
  114: "mechmath",
  115: "mechmath",
  105: "mechmath",
  131: "mechmath",
};
export const OUR_BUILDING = "mechmath";

// gis: path on 2gis.kz/almaty/ when 2GIS has the exact place; otherwise `search` is used.
export const PLACES = [
  { id: "rectorate", num: 1, kind: "faculty", name: "Ректорат (бас ғимарат)", search: "КазНУ им. аль-Фараби ректорат", gis: "firm/9429940000796144", x: 267, y: 373 },
  { id: "philology", num: 2, kind: "faculty", name: "Филология факультеті", search: "КазНУ факультет филологии", gis: "firm/70000001029709390", x: 330, y: 410 },
  { id: "law", num: 3, kind: "faculty", name: "Заң факультеті", search: "КазНУ юридический факультет", gis: "firm/70000001029709816", x: 238, y: 476 },
  { id: "economics", num: 4, kind: "faculty", name: "Экономика және бизнес жоғары мектебі", search: "КазНУ высшая школа экономики и бизнеса", gis: "firm/70000001029709184", x: 377, y: 483 },
  {
    id: "mechmath",
    num: 5,
    kind: "faculty",
    name: "Механика-математика факультеті",
    note: "Біздің факультет — ҒТТ мамандығы осында. Ақпараттық технологиялар факультеті де осы кешенде (71/23).",
    search: "КазНУ механико-математический факультет",
    gis: "firm/70000001029709246",
    x: 229,
    y: 309,
  },
  { id: "biology", num: 6, kind: "faculty", name: "Биология және биотехнология факультеті", search: "КазНУ факультет биологии", gis: "firm/9429940001276173", x: 471, y: 350 },
  { id: "physics", num: 7, kind: "faculty", name: "Физика-техникалық факультет", search: "КазНУ физико-технический факультет", gis: "firm/70000001029709791", x: 286, y: 274 },
  { id: "chemistry", num: 8, kind: "faculty", name: "Химия және химиялық технология факультеті", search: "КазНУ факультет химии", gis: "firm/70000001029709773", x: 337, y: 253 },
  { id: "pe", num: 9, kind: "faculty", name: "Дене шынықтыру кафедрасы", search: "КазНУ кафедра физического воспитания", gis: "firm/70000001033431749", x: 389, y: 125 },
  { id: "military", num: 10, kind: "faculty", name: "Әскери кафедра", note: "2GIS бойынша әскери кафедра қазір кампустан тыс: 1-шағынаудан, 36.", search: "КазНУ военная кафедра", gis: "firm/70000001075860019", x: 292, y: 506 },
  { id: "journalism", num: 11, kind: "faculty", name: "Журналистика факультеті", search: "КазНУ факультет журналистики", gis: "firm/70000001029709216", x: 366, y: 430 },
  { id: "geography", num: 12, kind: "faculty", name: "География және табиғатты пайдалану факультеті", search: "КазНУ факультет географии", gis: "firm/70000001029709286", x: 422, y: 327 },
  { id: "intl", num: 13, kind: "faculty", name: "Халықаралық қатынастар факультеті", note: "2GIS бойынша бұл факультет қазір кампустан тыс: Қарасай батыр к-сі, 95.", search: "КазНУ факультет международных отношений", gis: "firm/9429940001113867", x: 688, y: 265 },
  { id: "history", num: 14, kind: "faculty", name: "Тарих, археология және этнология факультеті", search: "КазНУ факультет истории", gis: "firm/70000001029709351", x: 408, y: 452 },

  { id: "palace", num: 1, kind: "facility", name: "Студенттер сарайы", search: "Дворец студентов КазНУ", gis: "geo/9430047375049063", x: 104, y: 346 },
  { id: "biomuseum", num: 2, kind: "facility", name: "Биология музейі", search: "КазНУ музей биологии", x: 467, y: 403 },
  { id: "biolibrary", num: 3, kind: "facility", name: "Биология факультетінің кітапханасы", search: "КазНУ библиотека биологического факультета", x: 456, y: 316 },
  { id: "library", num: 4, kind: "facility", name: "ҚазҰУ кітапханасы", search: "Научная библиотека КазНУ", gis: "firm/70000001035164324", x: 378, y: 195 },
  { id: "canteen", num: 5, kind: "facility", name: "Тамақтану комбинаты, МИЦ", search: "КазНУ комбинат питания", x: 553, y: 146 },
  { id: "cinema", num: 6, kind: "facility", name: "Кинотеатр, дүкен", search: "КазНУ кинотеатр", x: 628, y: 162 },
  { id: "stadium", num: 7, kind: "facility", name: "ҚазҰУ стадионы", search: "Стадион КазНУ", gis: "firm/70000001112788999", x: 265, y: 135 },
  { id: "museum", num: 8, kind: "facility", name: "ҚазҰУ орталық музейі", search: "Музей КазНУ аль-Фараби", x: 320, y: 469 },

  ...[
    [475, 89], [507, 82], [565, 89], [611, 85], [634, 100], [701, 107],
    [737, 107], [765, 121], [793, 136], [837, 198], [823, 242], [740, 261],
  ].map(([x, y], index) => ({ id: `dorm-${index + 1}`, kind: "dorm", group: "dorms", name: "Студенттер жатақханасы (ДС)", search: "Дом студентов КазНУ", x, y })),
  { id: "medical", num: 1, kind: "dorm", name: "Медициналық көмек пункті", symbol: "+", search: "Центр ПМСП КазНУ", gis: "firm/70000001077489435", x: 586, y: 83 },

  { id: "parking-1", kind: "parking", group: "parking", name: "Көлік тұрағы", search: "КазНУ парковка", x: 54, y: 311 },
  { id: "parking-2", kind: "parking", group: "parking", name: "Көлік тұрағы", search: "КазНУ парковка", x: 199, y: 534 },
  { id: "parking-3", kind: "parking", group: "parking", name: "Көлік тұрағы", search: "КазНУ парковка", x: 463, y: 568 },
];

export function buildingForRoom(room) {
  if (!room) return null;
  const id = ROOM_BUILDINGS[String(room).trim()];
  return id ? PLACES.find((place) => place.id === id) ?? null : null;
}

/** Open in 2GIS: the exact place if 2GIS has it, otherwise a 2GIS search in Almaty. */
export function twoGisUrl(place) {
  if (place.gis) return `https://2gis.kz/almaty/${place.gis}`;
  return `https://2gis.kz/almaty/search/${encodeURIComponent(place.search)}`;
}

/** Open in Google Maps (search by name, works in the app and the browser). */
export function googleMapsUrl(place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place.search}, Алматы`)}`;
}
