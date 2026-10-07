// al-Farabi KazNU campus (Al-Farabi Ave 71, Almaty).
// Every position below is the real point of that place on 2GIS (2gis.kz, firm / building
// pages), not an estimate. The admin can still nudge a marker on the map; corrections are
// saved in the database (campus_markers) and override these points for everyone.

export const KINDS = {
  faculty: { label: "Факультеттер", color: "#ff6b8a" },
  facility: { label: "Кітапхана, спорт, қызметтер", color: "#5b94ff" },
  dorm: { label: "Жатақханалар (ДС)", color: "#ffb547" },
};

// Rooms from our timetable → building. Change here if a room is elsewhere.
export const ROOM_BUILDINGS = {
  114: "mechmath",
  115: "mechmath",
  105: "mechmath",
  131: "mechmath",
};
export const OUR_BUILDING = "mechmath";

// gis: path on 2gis.kz/almaty/ (opens that exact place in 2GIS).
export const BUILDINGS = [
  // ---- Faculties ----
  { id: "mechmath", num: 1, kind: "faculty", name: "Механика-математика факультеті", short: "Мехмат", note: "Біздің факультет — ҒТТ мамандығы осында.", address: "әл-Фараби даң., 71/23", lat: 43.223897, lng: 76.92405, gis: "firm/70000001029709246" },
  { id: "physics", num: 2, kind: "faculty", name: "Физика-техникалық факультет", short: "Физтех", address: "әл-Фараби даң., 71/23", lat: 43.223816, lng: 76.923854, gis: "firm/70000001029709791" },
  { id: "chemistry", num: 3, kind: "faculty", name: "Химия және химиялық технология факультеті", short: "Химия", address: "әл-Фараби даң., 71/23", lat: 43.223525, lng: 76.923165, gis: "firm/70000001029709773" },
  { id: "it", num: 4, kind: "faculty", name: "Ақпараттық технологиялар факультеті", short: "IT", address: "әл-Фараби даң., 71/23", lat: 43.224536, lng: 76.923846, gis: "firm/70000001036024575" },
  { id: "biology", num: 5, kind: "faculty", name: "Биология және биотехнология факультеті", short: "Биология", address: "әл-Фараби даң., 71/19", lat: 43.223608, lng: 76.920755, gis: "firm/9429940001276173" },
  { id: "geography", num: 6, kind: "faculty", name: "География және табиғатты пайдалану факультеті", short: "География", address: "әл-Фараби даң., 71/19", lat: 43.223291, lng: 76.92199, gis: "firm/70000001029709286" },
  { id: "main", num: 7, kind: "faculty", name: "Бас ғимарат: ректорат, заң, экономика (ЖМЭБ)", short: "Бас ғимарат", note: "Ректорат, Заң факультеті және Экономика және бизнес жоғары мектебі осы ғимаратта.", address: "әл-Фараби даң., 71", lat: 43.2253, lng: 76.920366, gis: "firm/9429940000796144" },
  { id: "medicine", num: 8, kind: "faculty", name: "Медицина және денсаулық сақтау факультеті", short: "Медицина", address: "әл-Фараби даң., 71", lat: 43.225642, lng: 76.920878, gis: "firm/70000001052334508" },
  { id: "philology", num: 9, kind: "faculty", name: "Филология, журналистика, тарих", short: "Филология", note: "Филология және әлем тілдері, Журналистика, Тарих, археология және этнология факультеттері осы ғимаратта.", address: "әл-Фараби даң., 71", lat: 43.224877, lng: 76.920733, gis: "firm/70000001029709390" },

  // ---- Facilities ----
  { id: "palace", num: 10, kind: "facility", name: "Студенттер сарайы (Жолдасбеков атындағы)", short: "Студенттер сарайы", note: "2GIS бойынша қазір жөндеуде.", address: "әл-Фараби даң., 71/24", lat: 43.225301, lng: 76.923846, gis: "geo/9430047375049063" },
  { id: "library", num: 11, kind: "facility", name: "әл-Фараби атындағы кітапхана", short: "Кітапхана", note: "1-қабатта асхана-кофейня бар.", address: "әл-Фараби даң., 71/27", lat: 43.222096, lng: 76.923904, gis: "firm/70000001035164324" },
  { id: "keremet", num: 12, kind: "facility", name: "«Керемет» студенттерге қызмет көрсету орталығы", short: "Керемет (ЦОС)", note: "Анықтамалар, құжаттар, қабылдау комиссиясы.", address: "әл-Фараби даң., 71/21", lat: 43.21999, lng: 76.921635, gis: "firm/70000001039049777" },
  { id: "stadium", num: 13, kind: "facility", name: "Стадион", short: "Стадион", address: "Кампус ішінде", lat: 43.221272, lng: 76.926202, gis: "firm/70000001112788999" },
  { id: "pe", num: 14, kind: "facility", name: "Дене шынықтыру кафедрасы", short: "Дене шынықтыру", address: "әл-Фараби даң., 71 к10", lat: 43.22044, lng: 76.92547, gis: "firm/70000001033431749" },
  { id: "pool", num: 15, kind: "facility", name: "Бассейн", short: "Бассейн", address: "әл-Фараби даң., 71/30", lat: 43.219224, lng: 76.925928, gis: "geo/70030076126075901" },
  { id: "internet", num: 16, kind: "facility", name: "Оқу интернет орталығы", short: "Интернет орталығы", note: "3-қабат.", address: "әл-Фараби даң., 71/22", lat: 43.219931, lng: 76.922944, gis: "firm/70000001033987219" },
  { id: "technopark", num: 17, kind: "facility", name: "ҚазҰУ Технопаркі", short: "Технопарк", address: "әл-Фараби даң., 71 к2", lat: 43.222997, lng: 76.91919, gis: "firm/9429940001163570" },
  { id: "young-scientists", num: 18, kind: "facility", name: "Жас ғалымдар үйі", short: "Жас ғалымдар үйі", address: "әл-Фараби даң., 71/28", lat: 43.221845, lng: 76.925356, gis: "geo/9430047375049001" },
  { id: "shops", num: 19, kind: "facility", name: "Дүкендер", short: "Дүкендер", address: "әл-Фараби даң., 71/10", lat: 43.21938, lng: 76.919484, gis: "geo/9430047375049896" },
  { id: "medical", num: 20, kind: "facility", symbol: "+", name: "ҚазҰУ емханасы (МСАК орталығы)", short: "Емхана", address: "әл-Фараби даң., 71/4", lat: 43.218222, lng: 76.923971, gis: "firm/70000001077489435" },

  // ---- Dormitories: Дом студентов (ДС) ----
  ...[
    [1, 43.219322, 76.92513, "71/1", "9429940001377124"],
    [4, 43.21844, 76.923212, "71/5", "9429940001377127"],
    [5, 43.21835, 76.921933, "71/6", "9429940001377128"],
    [6, 43.217858, 76.921612, "71/7", "9429940001377129"],
    [7, 43.218023, 76.920992, "71/8", "9429940001377130"],
    [8, 43.218474, 76.920508, "71/9", "9429940001377131"],
    [9, 43.218691, 76.924015, "71/3", "9429940001377125"],
    [10, 43.21817, 76.923556, "71/4", "9429940001377126"],
    [13, 43.21888, 76.924902, "71/2", "9429940001377132"],
    [15, 43.221678, 76.920063, "71/15", "9429940001377133"],
    [16, 43.221367, 76.919723, "71/14", "9429940001377134"],
    [17, 43.220603, 76.919113, "71/12", "9429940001377135"],
    [18, 43.219722, 76.91925, "71/11", "9429940001377136"],
  ].map(([n, lat, lng, address, firm]) => ({
    id: `ds-${n}`,
    kind: "dorm",
    symbol: `${n}`,
    name: `${n}-жатақхана (ДС-${n})`,
    short: `ДС-${n}`,
    address: `әл-Фараби даң., ${address}`,
    lat,
    lng,
    gis: `firm/${firm}`,
  })),
];

// KazNU places that are NOT on this campus (shown in the list only).
export const OFF_CAMPUS = [
  { name: "Халықаралық қатынастар және шығыстану факультеті", address: "Қарасай батыр к-сі, 95", gis: "firm/9429940001113867" },
  { name: "Философия және саясаттану факультеті", address: "Масанчи к-сі, 39", gis: "firm/70000001025544692" },
  { name: "Әскери кафедра", address: "1-шағынаудан, 36", gis: "firm/70000001075860019" },
  { name: "14-жатақхана (ДС-14)", address: "Бөгенбай батыр к-сі, 174", gis: "firm/9429940001113862" },
];

// Campus area (all points above fit inside, with a small margin).
export const CAMPUS_BOUNDS = { south: 43.2162, north: 43.2266, west: 76.9178, east: 76.9278 };
export const CAMPUS_CENTER = { lat: (CAMPUS_BOUNDS.south + CAMPUS_BOUNDS.north) / 2, lng: (CAMPUS_BOUNDS.west + CAMPUS_BOUNDS.east) / 2 };

export function buildingForRoom(room) {
  if (!room) return null;
  const key = String(room).trim();
  const id = ROOM_BUILDINGS[key];
  return id ? BUILDINGS.find((building) => building.id === id) ?? null : null;
}

/** Link that opens the place in the 2GIS app (or on 2gis.kz), with routes from there. */
export function twoGisUrl({ gis, lat, lng }) {
  if (gis) return `https://2gis.kz/almaty/${gis}`;
  return `https://2gis.kz/almaty?m=${lng.toFixed(6)}%2C${lat.toFixed(6)}%2F18`;
}
