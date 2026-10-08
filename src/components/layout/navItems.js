import {
  CalendarCheck,
  CalendarDays,
  Camera,
  ClipboardList,
  Calculator,
  Dices,
  FolderOpen,
  GraduationCap,
  House,
  Languages,
  Mail,
  Map,
  Megaphone,
  NotebookPen,
  Vote,
} from "lucide-react";

// Main navigation. Used by both the desktop sidebar and the mobile bottom bar.
export const NAV_ITEMS = [
  { to: "/", label: "Басты", title: "Басты бет", icon: House, end: true },
  { to: "/schedule", label: "Кесте", title: "Сабақ кестесі", icon: CalendarDays },
  { to: "/photos", label: "Фото", title: "EASYФОТО", icon: Camera },
  { to: "/tasks", label: "Тапсырма", title: "Тапсырмалар", icon: ClipboardList },
  { to: "/gpa", label: "GPA", title: "GPA калькуляторы", icon: Calculator },
];

// Everything else: sidebar (computers) and the home page grid (phones).
// `unread` names a counter from UnreadContext.
export const MORE_LINKS = [
  { to: "/notes", title: "Конспектілер", short: "Конспект", icon: NotebookPen },
  { to: "/translate", title: "Аудармашы", short: "Аударма", icon: Languages },
  { to: "/materials", title: "Материалдар", short: "Материал", icon: FolderOpen, unread: "materials" },
  { to: "/announcements", title: "Хабарландырулар", short: "Хабарлама", icon: Megaphone, unread: "announcements" },
  { to: "/polls", title: "Дауыс беру", short: "Дауыс беру", icon: Vote, unread: "polls" },
  { to: "/draw", title: "Жеребе · топқа бөлу", short: "Жеребе", icon: Dices },
  { to: "/teachers", title: "Оқытушылар", short: "Оқытушы", icon: GraduationCap },
  { to: "/attendance", title: "Қатысу", short: "Қатысуым", icon: CalendarCheck },
  { to: "/campus", title: "Кампус картасы", short: "Кампус", icon: Map },
  { to: "/suggestions", title: "Ұсыныс жәшігі", short: "Ұсыныс", icon: Mail },
];
