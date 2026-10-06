export default function SectionTitle({ title, meta, action }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      <div className="section-title__end">
        {meta && <span className="section-title__meta">{meta}</span>}
        {action}
      </div>
    </div>
  );
}
