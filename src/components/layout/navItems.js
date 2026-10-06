import { CalendarDays, Camera, ClipboardList, Calculator, House } from "lucide-react";

// Main navigation. Used by both the desktop sidebar and the mobile bottom bar.
export const NAV_ITEMS = [
  { to: "/", label: "Басты", title: "Басты бет", icon: House, end: true },
  { to: "/schedule", label: "Кесте", title: "Сабақ кестесі", icon: CalendarDays },
  { to: "/photos", label: "Фото", title: "EASYФОТО", icon: Camera },
  { to: "/tasks", label: "Тапсырма", title: "Тапсырмалар", icon: ClipboardList },
  { to: "/gpa", label: "GPA", title: "GPA калькуляторы", icon: Calculator },
];
