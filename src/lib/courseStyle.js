// Accent colors derived from a course's hue so every course looks consistent.
export function courseAccent(course) {
  const hue = course?.hue ?? 210;
  return {
    // Lightness comes from the theme (--course-l): bright on dark, deeper on light.
    "--course-color": `hsl(${hue} 85% var(--course-l, 70%))`,
    "--course-soft": `hsl(${hue} 85% var(--course-l, 70%) / 0.12)`,
    "--course-line": `hsl(${hue} 85% var(--course-l, 70%) / 0.3)`,
  };
}
