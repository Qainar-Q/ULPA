// Course catalog. In stage 4 this list moves into the Supabase `courses` table;
// the shape here (slug, name, teacher) is kept compatible with that table.

export const COURSES = [
  {
    slug: "space-systems-design-1",
    code: "ҒЖЖ",
    name: "Ғарыштық жүйелерді жобалау 1",
    teacher: "Калыбекова А.А.",
    hue: 214,
  },
  {
    slug: "satellite-communication",
    code: "СБЖ",
    name: "Серіктік байланыс жүйелері",
    teacher: "Минглибаев М.Д.",
    hue: 174,
  },
  {
    slug: "aerodynamics",
    code: "АД",
    name: "Аэродинамика",
    teacher: "Толеуханов А.Е.",
    hue: 32,
  },
  {
    slug: "programmable-logic-devices",
    code: "БЛҚ",
    name: "Бағдарламаланатын логикалық құрылғылар",
    teacher: "Калыбеков А.А.",
    hue: 262,
  },
  {
    slug: "rocket-dynamics",
    code: "РД",
    name: "Ракетодинамика",
    teacher: "Байсбаев О.Б.",
    hue: 350,
  },
  {
    slug: "applied-gyroscope-theory",
    code: "ГҚТ",
    name: "Гироскоптың қолданбалы теориясы",
    teacher: "Байсбаев О.Б.",
    hue: 196,
  },
];

export function findCourse(slug) {
  return COURSES.find((course) => course.slug === slug) ?? null;
}

// Accent colors derived from a hue so every course looks consistent.
export function courseAccent(course) {
  return {
    "--course-color": `hsl(${course.hue} 85% 70%)`,
    "--course-soft": `hsl(${course.hue} 85% 70% / 0.12)`,
    "--course-line": `hsl(${course.hue} 85% 70% / 0.28)`,
  };
}
