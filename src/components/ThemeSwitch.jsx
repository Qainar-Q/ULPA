import { useState } from "react";
import Segmented from "./ui/Segmented.jsx";
import { getThemePreference, setThemePreference } from "../lib/theme.js";

const OPTIONS = [
  { id: "dark", label: "Қараңғы" },
  { id: "light", label: "Ашық" },
  { id: "system", label: "Жүйе бойынша" },
];

export default function ThemeSwitch() {
  const [value, setValue] = useState(getThemePreference);
  return (
    <Segmented
      label="Тақырып"
      options={OPTIONS}
      value={value}
      onChange={(next) => {
        setValue(next);
        setThemePreference(next);
      }}
    />
  );
}
