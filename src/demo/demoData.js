// Made-up class data for demo mode. Names, courses, teachers and content are invented.
import { DEMO_USER_ID } from "./demoMode.js";

const id = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
const DAY = 86400000;

function almatyToday() {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Almaty", year: "numeric", month: "numeric", day: "numeric" })
      .formatToParts(new Date())
      .map((p) => [p.type, Number(p.value)])
  );
  return parts;
}

/** ISO time `days` from now at Almaty hour `hour` (UTC+5). */
function at(days, hour = 12, minute = 0) {
  const { year, month, day } = almatyToday();
  return new Date(Date.UTC(year, month - 1, day, hour - 5, minute) + days * DAY).toISOString();
}

export const DEMO_NAME = "Қонақ";

export function buildDemoStore() {
  const today = almatyToday();
  const soon = new Date(Date.now() + 4 * DAY);

  const names = [
    DEMO_NAME, "Аружан", "Нұрлан", "Айдана", "Ерасыл", "Дильназ", "Санжар", "Мөлдір", "Әлихан",
    "Жансая", "Бекзат", "Томирис", "Арман", "Інжу", "Дәулет", "Камила", "Ернұр", "Аяулым",
  ];
  const students = names.map((full_name, index) => ({
    id: index === 0 ? id(1000) : id(1000 + index),
    code: String(index + 1).padStart(2, "0"),
    full_name,
    group_no: index % 2 === 0 ? 1 : 2,
    role: index === 0 ? "admin" : "student",
    is_monitor: index === 0 || index === 5,
    birth_month: index === 1 ? today.month : index === 3 ? soon.getUTCMonth() + 1 : ((index * 5) % 12) + 1,
    birth_day: index === 1 ? today.day : index === 3 ? soon.getUTCDate() : ((index * 7) % 27) + 1,
    avatar_path: null,
    activated_at: index % 6 === 5 ? null : at(-30 + index),
    user_id: index === 0 ? DEMO_USER_ID : index % 6 === 5 ? null : id(5000 + index),
  }));
  const me = students[0];
  const s = (i) => students[i];

  const courses = [
    { slug: "theoretical-mechanics", code: "ТМ", name: "Теориялық механика", teacher: "Серікбаев Е. Т.", hue: 214 },
    { slug: "calculus", code: "МТ", name: "Математикалық талдау", teacher: "Ахметова Г. Б.", hue: 152 },
    { slug: "spacecraft-dynamics", code: "ҒАД", name: "Ғарыш аппараттарының динамикасы", teacher: "Тұрсынов Б. Қ.", hue: 268 },
    { slug: "python", code: "PY", name: "Python бағдарламалау", teacher: "Омарова Д. С.", hue: 32 },
    { slug: "physics", code: "ФИЗ", name: "Жалпы физика", teacher: "Қасымов Н. А.", hue: 350 },
    { slug: "english", code: "EN", name: "Кәсіби ағылшын тілі", teacher: "Smith J.", hue: 190 },
  ].map((course, index) => ({
    ...course,
    id: id(100 + index),
    description: index === 2 ? "Орбиталық механика, маневрлер және аппараттың бағдарын басқару негіздері." : null,
    sort_order: index + 1,
    created_at: at(-40),
    updated_at: at(-40),
  }));
  const c = (i) => courses[i].id;

  const slots = [
    // [course, weekday, start, end, room, type, group]
    [0, 1, "08:00", "08:50", "114", "lecture", null], [1, 1, "09:00", "09:50", "115", "lecture", null], [3, 1, "11:00", "12:40", "131", "lab", 1],
    [2, 2, "08:00", "08:50", "105", "lecture", null], [4, 2, "09:00", "09:50", "114", "lecture", null], [3, 2, "11:00", "12:40", "131", "lab", 2],
    [1, 3, "08:00", "09:40", "115", "lab", 1], [1, 3, "10:00", "11:40", "115", "lab", 2], [5, 3, "12:00", "12:50", "206", "lecture", null],
    [0, 4, "08:00", "09:40", "114", "lab", 1], [0, 4, "10:00", "11:40", "114", "lab", 2], [2, 4, "12:00", "12:50", "105", "lecture", null],
    [4, 5, "09:00", "10:40", "Физ-3", "lab", 1], [4, 5, "11:00", "12:40", "Физ-3", "lab", 2], [5, 5, "13:00", "13:50", "206", "lecture", null],
    [2, 6, "10:00", "11:40", "105", "lab", 1],
  ];
  const schedule_entries = slots.map(([course, weekday, start, end, room, session_type, group_no], index) => ({
    id: id(200 + index),
    course_id: c(course),
    weekday,
    start_time: `${start}:00`,
    end_time: `${end}:00`,
    room,
    session_type,
    group_no,
    note: null,
    created_at: at(-40),
    updated_at: at(-40),
  }));

  const teachers = courses.map((course, index) => ({
    id: id(300 + index),
    full_name: ["Серікбаев Ерлан Талғатұлы", "Ахметова Гүлнар Бекқызы", "Тұрсынов Бауыржан Қайратұлы", "Омарова Динара Сәкенқызы", "Қасымов Нұржан Асқарұлы", "John Smith"][index],
    position: ["Доцент, PhD", "Профессор", "Аға оқытушы", "Оқытушы", "Доцент", "Senior lecturer"][index],
    phone: index === 5 ? null : `+7 700 000 0${index}${index}`,
    email: `teacher${index + 1}@example.edu`,
    office: ["5-корпус, 312", "5-корпус, 208", "7-корпус, 101", "5-корпус, 131", "Физ-3", "Кітапхана, 4-қабат"][index],
    office_hours: index % 2 ? "Сәрсенбі 15:00–16:00" : "Дүйсенбі 14:00–15:00",
    note: index === 2 ? "Сұрақтарды поштаға жазған дұрыс." : null,
    photo_path: null,
    sort_order: index,
    created_at: at(-40),
    updated_at: at(-40),
  }));
  const course_teachers = teachers.map((teacher, index) => ({ course_id: c(index), teacher_id: teacher.id }));

  const assignments = [
    [3, "Python: орбита периодын есептейтін функция", "orbit(r, v) функциясын жаз, 3 мысалмен тексер. Кодты PDF не скриншот етіп жүкте.", at(1, 23, 59), null, s(5)],
    [1, "Туындылар: №4 үй жұмысы", "Оқулық 112-бет, 1–15 есептер. Суреттегі 3 есепті міндетті түрде шығар.", at(0, 23, 59), null, s(2)],
    [0, "Теориялық механика: реферат", "Тақырып: Кориолис күші және оның ғарыштық техникадағы рөлі. 5–7 бет.", at(6, 18, 0), null, me],
    [2, "ҒАД: Хоман маневрі есебі", "LEO → GEO ауысуы үшін Δv-ны есепте. Формулалар конспектіде бар.", at(3, 12, 0), 1, s(4)],
    [4, "Физика: зертханалық жұмыс есебі", "Маятник тәжірибесінің кестесі мен қорытындысы.", at(-2, 18, 0), null, s(6)],
  ].map(([course, title, description, due_at, group_no, author], index) => ({
    id: id(400 + index),
    course_id: c(course),
    title,
    description,
    due_at,
    group_no,
    created_by: author.id,
    creator_name: author.full_name,
    created_at: at(-5 + index),
    updated_at: at(-5 + index),
  }));
  const assignment_attachments = [
    { id: id(450), assignment_id: assignments[1].id, file_name: "uy-zhumysy-4.jpg", mime_type: "image/jpeg", size_bytes: 39288, storage_path: "demo/hw1.jpg", uploaded: true, created_at: at(-4) },
  ];
  const assignment_status = [{ assignment_id: assignments[4].id, student_id: me.id, completed_at: at(-3) }];

  const announcements = [
    { title: "Ертең 1-пара болмайды", body: "Серікбаев Е. Т. конференцияда. Теориялық механика сабағы сенбіге ауыстырылды, аудитория кейін хабарланады.", pinned: true, author: me, days: -1 },
    { title: "Стипендия туралы", body: "Стипендия 25-күні түседі. Карта ауыстырған болсаң, деканатқа өтініш жаз.", pinned: false, author: s(5), days: -3 },
    { title: "Ғарыш апталығы 🚀", body: "Келесі аптада студенттер сарайында ғарыш апталығы өтеді. Қатысқысы келетіндер сауалнамаға дауыс беріңдер.", pinned: false, author: me, days: -6 },
  ].map((item, index) => ({
    id: id(500 + index),
    title: item.title,
    body: item.body,
    group_no: null,
    pinned: item.pinned,
    author_id: item.author.id,
    author_name: item.author.full_name,
    author_role: item.author.role,
    created_at: at(item.days, 10 + index),
    updated_at: at(item.days, 10 + index),
  }));

  const photoSpecs = [
    ["p1.jpg", 1, "lecture", "Туынды — негізгі формулалар", s(2), -1],
    ["p2.jpg", 0, "lecture", "Ньютон заңдары, мысал есеп", s(4), -2],
    ["p3.jpg", 2, "lecture", "Кеплер заңдары", me, -2],
    ["p4.jpg", 3, "lab", "Python: орбита периоды", s(7), -3],
    ["p5.jpg", 1, "lab", "Интеграл, практика", s(9), -5],
    ["p6.jpg", 4, "lab", "Маятник зертханасы", s(6), -6],
  ];
  const course_photos = photoSpecs.map(([file, course, photo_type, caption, author, days], index) => ({
    id: id(600 + index),
    course_id: c(course),
    photo_type,
    group_no: photo_type === "lab" ? author.group_no : null,
    caption,
    storage_path: `demo/${file}`,
    thumb_path: `demo/${file}`,
    width: 1200,
    height: 900,
    uploaded: true,
    uploaded_by: author.id,
    uploader_name: author.full_name,
    created_at: at(days, 9 + index),
  }));
  const reactionPlan = [[0, ["❤️", "🔥", "👏", "❤️", "😮"]], [1, ["👍", "❤️"]], [2, ["🔥", "🔥", "❤️", "👏"]], [3, ["😂", "👍"]], [4, ["❤️"]]];
  const photo_reactions = reactionPlan.flatMap(([photo, emojis]) =>
    emojis.map((emoji, n) => ({ photo_id: course_photos[photo].id, student_id: s(n + 3).id, student_name: s(n + 3).full_name, emoji, created_at: at(-1) }))
  );
  const photo_comments = [
    [0, s(5), "Рақмет! Мен осы жерін жаза алмай қалдым 🙏"],
    [0, s(8), "Екінші формулада x² емес пе?"],
    [2, s(3), "Емтиханда осы болады деді"],
  ].map(([photo, author, body], index) => ({ id: id(650 + index), photo_id: course_photos[photo].id, student_id: author.id, author_name: author.full_name, body, created_at: at(-1, 14 + index) }));

  const course_materials = [
    [2, "Орбиталық механика — дәріс слайдтары", "1–4 дәрістер бір файлда", "orbital-mechanics.pdf", s(4)],
    [1, "Туындылар кестесі", null, "derivatives-table.pdf", me],
    [3, "Python шпаргалка", "Негізгі командалар мен мысалдар", "python-cheatsheet.pdf", s(7)],
  ].map(([course, title, description, file_name, author], index) => ({
    id: id(700 + index),
    course_id: c(course),
    title,
    description,
    group_no: null,
    file_name,
    mime_type: "application/pdf",
    size_bytes: 83208,
    storage_path: "demo/sample.pdf",
    uploaded: true,
    uploaded_by: author.id,
    uploader_name: author.full_name,
    created_at: at(-2 - index * 3),
  }));

  const polls = [
    { question: "Ғарыш апталығына қатысамыз ба?", details: "Сенбі, студенттер сарайы, 14:00", anonymous: false, multiple: false, options: ["Иә, барамын 🚀", "Мүмкін", "Бара алмаймын"], votes: [0, 0, 0, 1, 0, 2, 1, 0] },
    { question: "Сынып кешін қашан өткіземіз?", details: null, anonymous: true, multiple: true, options: ["Жұма кеші", "Сенбі түсте", "Жексенбі"], votes: [0, 1, 1, 0, 2, 0] },
  ];
  const pollRows = [];
  const poll_options = [];
  const poll_votes = [];
  polls.forEach((poll, p) => {
    const pollId = id(800 + p);
    pollRows.push({ id: pollId, question: poll.question, details: poll.details, group_no: null, multiple: poll.multiple, anonymous: poll.anonymous, closes_at: at(5, 20), closed: false, created_by: me.id, creator_name: me.full_name, created_at: at(-2 - p) });
    poll.options.forEach((label, position) => poll_options.push({ id: id(820 + p * 10 + position), poll_id: pollId, label, position }));
    poll.votes.forEach((option, voter) => poll_votes.push({ poll_id: pollId, option_id: id(820 + p * 10 + option), student_id: s(voter + 2).id, created_at: at(-1) }));
  });

  const notes = [
    {
      course: 2,
      title: "3-дәріс. Хоман маневрі",
      date: -2,
      author: s(4),
      editor: s(3),
      body: "## Негізгі идея\nЕкі дөңгелек орбита арасындағы ең **үнемді** ауысу — эллипс бойымен.\n\n## Формулалар\n- Бірінші импульс: `Δv₁ = √(μ/r₁)·(√(2r₂/(r₁+r₂)) − 1)`\n- Екінші импульс: `Δv₂ = √(μ/r₂)·(1 − √(2r₁/(r₁+r₂)))`\n- Ауысу уақыты: `t = π·√((r₁+r₂)³/(8μ))`\n\n## Мысал\nLEO (r₁ = 6 678 км) → GEO (r₂ = 42 164 км):\n1. `Δv₁ ≈ 2.42 км/с`\n2. `Δv₂ ≈ 1.46 км/с`\n3. Барлығы `≈ 3.88 км/с`, уақыты `≈ 5.3 сағ`\n\n> Емтиханда осы есептің нұсқасы болады деді.",
    },
    {
      course: 1,
      title: "Туындылар: ережелер",
      date: -4,
      author: me,
      editor: s(2),
      body: "## Ережелер\n- `(u + v)' = u' + v'`\n- `(u·v)' = u'v + uv'`\n- `(u/v)' = (u'v − uv')/v²`\n- Күрделі функция: `f(g(x))' = f'(g(x))·g'(x)`\n\n## Кесте\n1. `(xⁿ)' = n·xⁿ⁻¹`\n2. `(sin x)' = cos x`\n3. `(eˣ)' = eˣ`",
    },
    { course: 3, title: "Python: тізімдер мен циклдер", date: -6, author: s(7), editor: s(7), body: "## for циклі\n```\nfor r in [6678, 7000, 42164]:\n    print(orbit_period(r))\n```\n\n**Кеңес:** функцияға docstring жаз." },
  ].map((note, index) => ({
    id: id(900 + index),
    course_id: c(note.course),
    title: note.title,
    body: note.body,
    lesson_date: at(note.date).slice(0, 10),
    version: note.author === note.editor ? 1 : 2,
    created_by: note.author.id,
    creator_name: note.author.full_name,
    updated_by: note.editor.id,
    updated_by_name: note.editor.full_name,
    created_at: at(note.date, 18),
    updated_at: at(note.date + 1, 20),
  }));
  const note_revisions = notes.flatMap((note) => {
    const rows = [{ id: Number(note.id.slice(-4)) * 10 + 1, note_id: note.id, version: 1, title: note.title, body: note.body.split("\n\n")[0], edited_by: note.created_by, editor_name: note.creator_name, created_at: note.created_at }];
    if (note.version > 1) rows.push({ id: Number(note.id.slice(-4)) * 10 + 2, note_id: note.id, version: 2, title: note.title, body: note.body, edited_by: note.updated_by, editor_name: note.updated_by_name, created_at: note.updated_at });
    return rows;
  });

  const draws = [
    {
      id: id(950),
      title: "ҒАД жобасы: топтар",
      mode: "groups",
      amount: 3,
      pool: [],
      result: [[s(2).full_name, s(5).full_name, s(9).full_name], [s(3).full_name, s(6).full_name, me.full_name], [s(4).full_name, s(7).full_name, s(8).full_name]],
      created_by: s(5).id,
      creator_name: s(5).full_name,
      created_at: at(-2, 12),
    },
  ];

  const suggestions = [
    { id: id(960), author_id: s(6).id, category: "site", body: "Сайтқа емтихан кестесін де қоссаңдар жақсы болар еді.", status: "new", reply: null, replied_at: null, created_at: at(-1, 21) },
    { id: id(961), author_id: me.id, category: "class", body: "Сенбідегі зертхананы түстен кейінге ауыстыруды сұрап көрейікші.", status: "done", reply: "Деканатпен сөйлестім — келесі аптадан 14:00-де.", replied_at: at(-1), created_at: at(-4, 19) },
  ];

  const birthday_wishes = [
    { id: id(970), student_id: s(1).id, wish_year: today.year, author_id: s(5).id, author_name: s(5).full_name, emoji: "🎉", body: "Туған күніңмен! Бақытты бол, сессияны үздік тапсыр! 🎓", created_at: at(0, 8) },
    { id: id(971), student_id: s(1).id, wish_year: today.year, author_id: s(8).id, author_name: s(8).full_name, emoji: "💐", body: "Барлық арманың орындалсын!", created_at: at(0, 9) },
  ];

  const student_grades = [
    { student_id: me.id, course_id: c(0), ab1: 88, ab2: 91, exam: null },
    { student_id: me.id, course_id: c(1), ab1: 94, ab2: 90, exam: null },
    { student_id: me.id, course_id: c(3), ab1: 100, ab2: 97, exam: null },
  ];

  const translations = [
    { id: id(980), student_id: me.id, source_kind: "text", result: "# Ньютонның бірінші заңы\n\nДенеге басқа денелер әсер етпесе, ол **тыныштық** күйін немесе **бірқалыпты түзу сызықты** қозғалысын сақтайды.", created_at: at(-1, 20) },
  ];

  return {
    students,
    courses,
    schedule_entries,
    teachers,
    course_teachers,
    assignments,
    assignment_attachments,
    assignment_status,
    announcements,
    course_photos,
    photo_reactions,
    photo_comments,
    course_materials,
    polls: pollRows,
    poll_options,
    poll_votes,
    notes,
    note_revisions,
    draws,
    suggestions,
    birthday_wishes,
    student_grades,
    translations,
    attendance_marks: [],
    onboarding_done: [],
    notification_prefs: [{ student_id: me.id, tasks: true, announcements: true, polls: true, comments: true, deadlines: true, updated_at: at(-10) }],
    push_subscriptions: [],
    campus_markers: [],
    seen: { photos: 2, materials: 1, announcements: 1, tasks: 1 },
  };
}
