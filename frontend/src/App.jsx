import { useEffect, useRef, useState } from 'react';
import { FileText, BarChart3, Box, CheckCircle2, ChevronRight, Code2, Database, Home, IndianRupee, Play, Settings, ShieldCheck, Tag, Upload, Users, AlertTriangle } from 'lucide-react';
import Header from './components/Header';
import OrderDetailsModal from './components/OrderDetailsModal';
import ValidationErrors from './components/ValidationErrors';
import CustomerSummary from './components/CustomerSummary';
import InsightCharts from './components/InsightCharts';
import GeographicDistribution from './components/GeographicDistribution';
import OrderCalendar from './components/OrderCalendar';
import OrdersByCategory from './components/OrdersByCategory';
import OrdersTable from './components/OrdersTable';
import JsonEvaluator from './components/JsonEvaluator';
import * as api from './services/api';

const nav = [
  [Home, 'Dashboard'],
  [Code2, 'Evaluator'],
  [Tag, 'Orders'],
  [ShieldCheck, 'Validation'],
  [Users, 'Customers'],
  [BarChart3, 'Analytics'],
  [Database, 'Database'],
  [Settings, 'Settings'],
];

function currentPage() {
  const page = window.location.hash.slice(1).toLowerCase();
  return nav.some(([, label]) => label.toLowerCase() === page) ? page : 'dashboard';
}

export default function App() {
  const [page, setPage] = useState(currentPage);
  useEffect(() => {
    const onNavigate = () => {
      setPage(currentPage());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onNavigate);
    return () => window.removeEventListener('hashchange', onNavigate);
  }, []);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [updated, setUpdated] = useState(null);
  const [modal, setModal] = useState(null);
  const [view, setView] = useState('all');
  const [query, setQuery] = useState('');
  const detailRequest = useRef(0);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const [summary, orders, errors, customers] = await Promise.all([api.getSummary(), api.getOrders(), api.getErrors(), api.getCustomerSummary()]);
      setData({ summary, orders, errors, customers });
      setUpdated(new Date());
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  }
  useEffect(() => { refresh(); }, []);

  async function process() {
    setProcessing(true);
    setError('');
    setNotice('');
    try {
      const result = await api.processOrders();
      setNotice(`${result.message}. ${result.valid_orders} valid · ${result.invalid_orders} invalid.`);
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setProcessing(false); }
  }

  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError('');
    setNotice('');
    try {
      const result = await api.uploadOrders(file);
      setNotice(`${result.message}. ${result.valid_orders} valid · ${result.invalid_orders} invalid.`);
      await refresh();
    } catch (err) { setError(err.message); }
    finally { setUploading(false); }
  }

  async function viewOrder(id) {
    const requestId = ++detailRequest.current;
    setModal({ loading: true });
    try {
      const order = await api.getOrder(id);
      if (detailRequest.current === requestId) setModal({ order });
    } catch (err) {
      if (detailRequest.current === requestId) setModal({ error: err.message });
    }
  }

  const busy = loading || processing || uploading;
  const filteredOrders = data?.orders.filter((order) => {
    const matchesQuery = `${order.order_id} ${order.customer}`.toLowerCase().includes(query.toLowerCase());
    if (view === 'high') return matchesQuery && order.total >= 500;
    return matchesQuery;
  }) || [];
  const totalCustomers = data?.customers.length || 0;
  const valid = data?.summary.valid_orders || 0;
  const invalid = data?.summary.invalid_orders || 0;
  const total = data?.summary.total_orders || 0;

  return (
    <div className="app-shell">
      <Sidebar page={page} />
      <div className="workspace">
        <Header query={query} data={data} error={error} notice={notice} onQueryChange={value => {
          setQuery(value);
          setView('all');
          if (value.trim()) window.location.hash = page === 'customers' ? 'customers' : 'orders';
        }} />
        <main>
          {page !== 'dashboard' && page !== 'evaluator' && <div className="panel-heading"><h1>{nav.find(([, label]) => label.toLowerCase() === page)?.[1]}</h1><button className="button secondary compact" disabled={busy} onClick={refresh}>Refresh</button></div>}
          {error && <div role="alert" className="alert error">{error}{data && ' Showing the last loaded data.'}</div>}
          {notice && <div role="status" className="alert success">{notice}</div>}
          {loading && <p className="loading" role="status">Loading dashboard...</p>}
          {data && <>
            {page === 'dashboard' && <section className="hero-panel">
              <div className="hero-copy">
                <p className="eyebrow">ORDER PROCESSING SYSTEM</p>
                <h1>Turn Orders into <span>Business Insights</span></h1>
                <p className="subtitle">Validate, process, and analyze your orders with intelligent automation and real-time insights.</p>
                <div className="hero-actions">
                  <button className="button primary" disabled={busy} onClick={process}><Play size={18} /> {processing ? 'Processing...' : 'Process Orders'}</button>
                  <label className={`button upload ${busy ? 'disabled' : ''}`}><Upload size={18} />{uploading ? 'Uploading...' : 'Upload JSON'}<input type="file" accept=".json,application/json" disabled={busy} onChange={upload} /></label>
                  <button className="button secondary" onClick={() => { window.location.hash = 'evaluator'; }}><Code2 size={18} /> JSON Evaluator</button>
                  <button className="button secondary" onClick={() => { window.location.hash = 'orders'; }}>View Orders <ChevronRight size={18} /></button>
                </div>
              </div>
              <div className="package-card">
                <img className="package-visual" src="/images/stacked-parcels.png" alt="Two stacked cardboard shipping boxes" />
                <div className="package-caption">
                  <h2>Process orders<br />faster and smarter</h2>
                  <p>Validate <span>·</span> Store <span>·</span> Analyse</p>
                  <svg className="package-arrow" viewBox="0 0 110 34" fill="none" aria-hidden="true">
                    <path d="M5 29C36 28 64 18 92 7M72 7L94 6L81 21" />
                    <path d="M42 8C50 8 57 7 63 5" />
                  </svg>
                </div>
              </div>
            </section>}
            {['dashboard', 'analytics', 'database'].includes(page) && <section className="stats-grid" aria-label="Order statistics">
              <KpiCard icon={Box} label="Total Orders" value={total} note="Latest batch" tone="gold"  />
              <KpiCard icon={CheckCircle2} label="Valid Orders" value={valid} note="Validation passed" tone="green" change={`${Math.round((valid / Math.max(total, 1)) * 100)}%`} />
              <KpiCard icon={AlertTriangle} label="Invalid Orders" value={invalid} note="Validation failed" tone="red" change={`${Math.round((invalid / Math.max(total, 1)) * 100)}%`} />
              <KpiCard icon={Users} label="Total Customers" value={totalCustomers} note="Unique customers" tone="blue"  />
              <KpiCard icon={IndianRupee} label="Total Revenue" value={api.money(data.summary.total_sales)} note="From valid orders" tone="gold"  />
            </section>}
            {['dashboard', 'analytics'].includes(page) && <>
              {/* Executive Showcase Row 1: Geographic Distribution & Order Calendar (matches Screenshot 1) */}
              <section className="insights-showcase-grid" aria-label="Geographic Distribution and Calendar">
                <GeographicDistribution
                  orders={data.orders}
                  errors={data.errors}
                  onCitySelect={(city) => {
                    setQuery(city === 'Others' ? '' : city);
                    window.location.hash = 'orders';
                  }}
                />
                <OrderCalendar
                  orders={data.orders}
                  errors={data.errors}
                  onSelectDate={(date) => {
                    setQuery(date);
                    window.location.hash = 'orders';
                  }}
                />
              </section>

              {/* Executive Showcase Row 2: Orders by Category & Processing Trend (matches Screenshot 2) */}
              <section className="insights-secondary-grid" aria-label="Category Distribution and Trends">
                <OrdersByCategory
                  orders={data.orders}
                  onCategoryFilter={(catId) => {
                    if (catId !== 'all') {
                      setNotice(`Filtering by ${catId.replace('_', ' ')}`);
                    }
                  }}
                />
                <InsightCharts summary={data.summary} customers={data.customers} orders={data.orders} errors={data.errors} />
              </section>

              {page === 'dashboard' && <RecentOrders orders={data.orders} errors={data.errors} onView={viewOrder} />}
            </>}
            {page === 'database' && <section className="panel"><div className="panel-heading"><div><h2>Stored orders</h2><p>{data.orders.length} validated orders stored in SQLite. Select View to inspect an order and its items.</p></div></div></section>}
            {['dashboard', 'orders', 'database'].includes(page) && <>
            <section className="control-strip" aria-label="Order controls">
              <div className="segmented">
                <button className={view === 'all' ? 'active' : ''} onClick={() => setView('all')}>All Valid</button>
                <button className={view === 'high' ? 'active' : ''} onClick={() => setView('high')}>High Value</button>
              </div>
              <button className="button secondary compact" disabled={busy} onClick={() => { setNotice(''); refresh(); }}>Refresh</button>
            </section>

            <div id="orders">
              <OrdersTable orders={filteredOrders} onView={viewOrder} busy={busy} />
            </div>
            </>}
            {page === 'dashboard' && <div className="bottom-grid"><ValidationErrors errors={data.errors} /><CustomerSummary customers={data.customers} /></div>}
            {page === 'evaluator' && (
              <JsonEvaluator
                onApplyBatch={async () => {
                  await refresh();
                  window.location.hash = 'dashboard';
                }}
              />
            )}
            {page === 'validation' && <ValidationErrors errors={data.errors} />}
            {page === 'customers' && <CustomerSummary customers={data.customers.filter(customer => customer.customer.toLowerCase().includes(query.toLowerCase()))} />}
            {page === 'settings' && <section className="panel"><div className="panel-heading"><div><h2>Application settings</h2><p>Current application configuration</p></div></div><dl className="settings-details"><dt>Currency</dt><dd>INR (₹)</dd><dt>Order input</dt><dd>JSON upload or the configured backend orders file</dd><dt>Storage</dt><dd>SQLite</dd></dl></section>}
          </>}
          <footer><span>Order Processing System</span><span>{updated ? `Last refreshed ${updated.toLocaleTimeString()}` : 'Waiting for backend'}</span></footer>
        </main>
      </div>
      {modal && <OrderDetailsModal {...modal} onClose={() => { ++detailRequest.current; setModal(null); }} />}
    </div>
  );
}

function Sidebar({ page }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Box size={28} /></span>
        <div><strong>Order Processing</strong><small>SYSTEM</small></div>
      </div>
      <nav aria-label="Main navigation">
        {nav.map(([Icon, label]) => <a className={page === label.toLowerCase() ? 'active' : ''} aria-current={page === label.toLowerCase() ? 'page' : undefined} href={`#${label.toLowerCase()}`} key={label}><Icon size={22} /> {label}</a>)}
      </nav>
      <div className="status-card">
        <div className="status-head"><span /><div><strong>System Status</strong><small>All Systems Operational</small></div></div>
        <p><span>Backend API</span><strong>Online</strong></p>
        <p><span>Database</span><strong>Connected</strong></p>
        <p><span>Validation Engine</span><strong>Active</strong></p>
      </div>
    </aside>
  );
}

function KpiCard({ icon: Icon, label, value, note, tone, change }) {
  return (
    <article className={`stat-card ${tone}`}>
      <span className="stat-icon"><Icon size={25} /></span>
      <div>
        <p>{label}</p>
        <strong>{value}</strong>
        <small>{note}</small>
      </div>
      {change && <em>{change}</em>}
      <svg className="kpi-sparkline" viewBox="0 0 280 48" preserveAspectRatio="none" aria-hidden="true">
        <defs><linearGradient id={`spark-${label.replaceAll(' ', '-')}`} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="currentColor" stopOpacity=".4" /><stop offset="100%" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        <path d="M0 36 Q28 4 55 21 T105 30 T145 24 T190 27 T235 17 T280 10 V48 H0Z" fill={`url(#spark-${label.replaceAll(' ', '-')})`} />
        <path d="M0 36 Q28 4 55 21 T105 30 T145 24 T190 27 T235 17 T280 10" fill="none" stroke="currentColor" strokeWidth="2.4" />
      </svg>
    </article>
  );
}

function formatOrderTime(createdAt) {
  if (!createdAt) return '—';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '—';
  if (typeof createdAt === 'string' && (createdAt.length <= 10 || createdAt.includes('T00:00:00'))) {
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function RecentOrders({ orders, errors, onView }) {
  const rows = [
    ...orders.slice(0, 4).map(order => ({ ...order, status: 'Valid' })),
    ...errors.slice(0, 1).map(error => ({ order_id: error.order_id ?? 'Missing ID', customer: '—', total: null, status: 'Invalid', created_at: error.created_at })),
  ];
  return <section className="glass-panel recent-panel">
    <div className="panel-title">
      <div className="insight-heading"><span className="insight-icon"><FileText size={25} /></span><div><h2>Recent Orders</h2><p>Latest order processing activity</p></div></div>
      <button onClick={() => { window.location.hash = 'orders'; }}>View All <ChevronRight size={16} /></button>
    </div>
    <div className="recent-table-wrap" tabIndex={0} role="region" aria-label="Recent orders">
      <table className="recent-table">
        <thead><tr><th>Order ID</th><th>Customer</th><th>Amount</th><th>Status</th><th>Time</th><th><span className="sr-only">Details</span></th></tr></thead>
        <tbody>{rows.map((order, index) => <tr key={`${order.order_id}-${index}`}>
          <td><span className={`recent-order-id ${order.status.toLowerCase()}`}><span className="recent-icon"><Box size={21} /></span><strong>#{order.order_id}</strong></span></td>
          <td>{order.customer}</td><td className="amount">{order.total == null ? '—' : api.money(order.total)}</td>
          <td><span className={`recent-status ${order.status.toLowerCase()}`}>{order.status === 'Valid' ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}{order.status}</span></td>
          <td className="recent-time">{formatOrderTime(order.created_at)}</td>
          <td><button className="recent-details" aria-label={`View ${order.status === 'Valid' ? 'order' : 'validation issue'} ${order.order_id}`} onClick={() => order.status === 'Valid' ? onView(order.order_id) : (window.location.hash = 'validation')}><ChevronRight size={20} /></button></td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="empty">No orders yet. Process a batch to get started.</p>}
    </div>
  </section>;
}
