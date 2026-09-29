export default function StatCard({ label, value, note, tone, icon }) {
  return <article className="stat-card"><div className="stat-top"><h2>{label}</h2><span className={`stat-icon ${tone}`} aria-hidden="true">{icon}</span></div><p className="stat-value">{value}</p><p className="stat-note">{note}</p></article>;
}
