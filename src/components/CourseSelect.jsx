import { useCatalog } from "../features/catalog/CatalogContext.jsx";

/** Course filter dropdown. Empty value = all courses. */
export default function CourseSelect({ id, value, onChange, allLabel = "Барлық пәндер" }) {
  const { courses } = useCatalog();

  return (
    <div className="select-wrap">
      <select id={id} className="input" value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">{allLabel}</option>
        {courses.map((course) => (
          <option key={course.slug} value={course.slug}>
            {course.name}
          </option>
        ))}
      </select>
    </div>
  );
}
