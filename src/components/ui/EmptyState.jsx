/**
 * Clearly labelled "no data yet" block. Used everywhere real data is not connected,
 * so nothing on the page is invented.
 */
export default function EmptyState({ icon: Icon, title, children, tag, action, compact = false }) {
  return (
    <div className={`empty-state${compact ? " empty-state--compact" : ""}`}>
      {Icon && (
        <span className="empty-state__icon" aria-hidden="true">
          <Icon size={compact ? 20 : 24} strokeWidth={1.6} />
        </span>
      )}
      <h3 className="empty-state__title">{title}</h3>
      {children && <p className="empty-state__text">{children}</p>}
      {tag && <span className="tag tag--pending">{tag}</span>}
      {action && <div className="empty-state__action">{action}</div>}
    </div>
  );
}
