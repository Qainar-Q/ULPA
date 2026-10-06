// Accent colors derived from a course's hue so every course looks consistent.
export function courseAccent(course) {
  const hue = course?.hue ?? 210;
  return {
    "--course-color": `hsl(${hue} 85% 70%)`,
    "--course-soft": `hsl(${hue} 85% 70% / 0.12)`,
    "--course-line": `hsl(${hue} 85% 70% / 0.28)`,
  };
}
