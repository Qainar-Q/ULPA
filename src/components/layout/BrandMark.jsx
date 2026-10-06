/** ULPA logo mark: a small orbit with a satellite dot. Pure SVG, no image files. */
export default function BrandMark({ size = 34 }) {
  return (
    <svg
      className="brand-mark"
      width={size}
      height={size}
      viewBox="0 0 40 40"
      aria-hidden="true"
    >
      <rect x="0.5" y="0.5" width="39" height="39" rx="11" className="brand-mark__bg" />
      <ellipse cx="20" cy="20" rx="13" ry="6.5" transform="rotate(-28 20 20)" className="brand-mark__orbit" />
      <circle cx="20" cy="20" r="4.2" className="brand-mark__core" />
      <circle cx="30.2" cy="14.6" r="2.4" className="brand-mark__sat" />
    </svg>
  );
}
