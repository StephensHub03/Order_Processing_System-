import { useRef, useState } from 'react';
import { AlertTriangle, ChevronRight, Filter, Lightbulb, X } from 'lucide-react';

export default function ValidationErrors({ errors }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [query, setQuery] = useState('');
  const filterInput = useRef(null);
  const visibleErrors = errors.filter(error => `${error.order_id ?? ''} ${error.message}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <section className="panel validation-panel" aria-label="Validation errors">
    <div className="validation-heading">
      <span className="validation-icon" aria-hidden="true"><AlertTriangle size={30} fill="currentColor" /></span>
      <div className="validation-heading-copy">
        <h2>Validation Errors <span className="validation-count">{errors.length}</span></h2>
        <p>Skipped orders that need your attention</p>
      </div>
      <button className="validation-filter" aria-label="Filter validation errors" aria-expanded={filterOpen} onClick={() => { setFilterOpen(!filterOpen); setQuery(''); if (!filterOpen) requestAnimationFrame(() => filterInput.current?.focus()); }}><Filter size={20} /></button>
    </div>
    {filterOpen && <div className="validation-search"><input ref={filterInput} aria-label="Filter by order ID or error" placeholder="Filter by order ID or error..." value={query} onChange={event => setQuery(event.target.value)} /></div>}
    {visibleErrors.length ? <ul className="validation-list">{visibleErrors.map((error, index) => <li key={`${error.order_id}-${error.message}-${index}`}>
      <details className="validation-item">
        <summary>
          <span className="validation-cross" aria-hidden="true"><X size={23} strokeWidth={3} /></span>
          <span className="validation-message"><strong>Order {error.order_id == null ? '(missing ID)' : `#${String(error.order_id)}`}</strong><span>{error.message}</span></span>
          <span className="validation-badge">INVALID</span>
          <ChevronRight className="validation-chevron" size={20} aria-hidden="true" />
        </summary>
        <div className="validation-detail">This order was skipped and was not saved. Fix the issue above in the source JSON, then upload the corrected file or process the updated source again.</div>
      </details>
    </li>)}</ul> : <p className="empty">{errors.length ? 'No errors match your filter.' : 'No validation errors in the latest batch.'}</p>}
    <div className="validation-guidance"><Lightbulb size={22} fill="currentColor" aria-hidden="true" /><span>Correct the source file, then process orders again.</span></div>
  </section>;
}
