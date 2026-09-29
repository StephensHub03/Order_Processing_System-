import { useMemo, useState } from 'react';
import { BarChart3, CalendarDays, CheckCircle2, ShieldCheck, Users } from 'lucide-react';
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { money } from '../services/api';

export default function InsightCharts({ summary = {}, orders = [], customers = [], errors = [] }) {
  const [days, setDays] = useState('all');
  const valid = Number(summary.valid_orders || 0);
  const invalid = Number(summary.invalid_orders || 0);

  const { trend, spanDays } = useMemo(() => {
    const validDates = orders.map(o => parseDateKey(o.created_at)).filter(Boolean);
    const errorDates = errors.map(e => parseDateKey(e.created_at)).filter(Boolean);
    const allDates = [...new Set([...validDates, ...errorDates])].sort();

    let span = 1;
    if (allDates.length > 1) {
      const d1 = new Date(allDates[0] + 'T12:00:00');
      const d2 = new Date(allDates[allDates.length - 1] + 'T12:00:00');
      span = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
    }

    const trendData = buildTrend(orders, errors, invalid, days, allDates);
    return { trend: trendData, spanDays: span };
  }, [orders, errors, invalid, days]);

  const rate = Math.round(valid / Math.max(valid + invalid, 1) * 100);

  return <section className="glass-panel trend-panel" aria-label="Order processing trend">
    <div className="panel-title">
      <div className="insight-heading"><span className="insight-icon"><BarChart3 size={28} /></span><div><h2>Order Processing Trend</h2><p>Daily order volume and validation status</p></div></div>
      <div className="trend-controls">
        <div className="legend"><span className="legend-item"><i className="green-dot" />Valid Orders</span><span className="legend-item"><i className="red-dot" />Invalid Orders</span><span className="legend-item"><i className="gold-dot" />Revenue</span></div>
        <label className="trend-period">
          <CalendarDays size={19} />
          <select aria-label="Trend date range" value={days} onChange={event => setDays(event.target.value === 'all' ? 'all' : Number(event.target.value))}>
            <option value="all">Full Batch ({spanDays > 1 ? `${spanDays} Days` : 'All Dates'})</option>
            <option value={7}>Last 7 Days</option>
            <option value={14}>Last 14 Days</option>
            <option value={30}>Last 30 Days</option>
          </select>
        </label>
      </div>
    </div>
    <div className="chart-axis-labels"><span>Orders</span><span>Revenue</span></div>
    <div className="trend-chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={trend} margin={{ top: 12, right: 0, bottom: 0, left: -20 }}>
          <defs>
            <linearGradient id="validFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#46ed90" /><stop offset="100%" stopColor="#109253" /></linearGradient>
            <linearGradient id="invalidFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ff6d69" /><stop offset="100%" stopColor="#b63e3c" /></linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(160,140,120,.12)" />
          <XAxis dataKey="day" tickLine={false} axisLine={false} minTickGap={20} tick={{ fill: '#c4b9aa', fontSize: 12 }} />
          <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#c4b9aa', fontSize: 12 }} />
          <YAxis yAxisId="revenue" orientation="right" width={48} tickLine={false} axisLine={false} tick={{ fill: '#c4b9aa', fontSize: 12 }} tickFormatter={value => `₹${Number((value / 1000).toFixed(1))}K`} />
          <Tooltip cursor={{ fill: 'rgba(255,185,78,.06)' }} content={<TrendTooltip />} />
          <Bar dataKey="valid" stackId="orders" fill="url(#validFill)" radius={[7, 7, 0, 0]} maxBarSize={60} />
          <Bar dataKey="invalid" stackId="orders" fill="url(#invalidFill)" radius={[7, 7, 0, 0]} maxBarSize={60} />
          <Line yAxisId="revenue" type="monotone" dataKey="revenue" stroke="#ffc65b" strokeWidth={3} dot={{ r: 4, fill: '#ffbd59', stroke: '#fff0c8', strokeWidth: 2 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
    <p className="trend-data-note">Current saved batch only. Reflects dates from uploaded order data; previous batches are replaced.</p>
    <div className="trend-metrics">
      <div><span className="metric-icon green"><CheckCircle2 size={23} /></span><span><strong>{valid + invalid}</strong><small>Total Items Processed</small></span></div>
      <div><span className="metric-icon gold"><ShieldCheck size={23} /></span><span><strong>{rate}%</strong><small>Validation Pass Rate</small></span></div>
      <div><span className="metric-icon purple"><Users size={23} /></span><span><strong>{customers.length}</strong><small>Unique Customers</small></span></div>
    </div>
  </section>;
}

function parseDateKey(val) {
  if (!val) return null;
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}/.test(val)) {
    return val.slice(0, 10);
  }
  const d = new Date(val);
  if (Number.isNaN(d.getTime())) return null;
  return formatDateKey(d);
}

function formatDateKey(d) {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function buildTrend(orders, errors, invalidCount, days, allDates) {
  if (!orders.length && !errors.length) return [];

  const todayStr = formatDateKey(new Date());
  const latestStr = allDates.length ? allDates[allDates.length - 1] : todayStr;
  const earliestStr = allDates.length ? allDates[0] : latestStr;

  const endDate = new Date(latestStr + 'T12:00:00');
  const startDate = new Date(earliestStr + 'T12:00:00');

  let numDays = 7;
  if (days === 'all') {
    const span = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24)) + 1;
    numDays = Math.max(span, 7);
  } else {
    numDays = Number(days) || 7;
  }

  const validByDate = {};
  const revenueByDate = {};
  for (const order of orders) {
    const key = parseDateKey(order.created_at);
    if (!key) continue;
    validByDate[key] = (validByDate[key] || 0) + 1;
    revenueByDate[key] = (revenueByDate[key] || 0) + (Number(order.total) || 0);
  }

  const invalidByDate = {};
  for (const err of errors) {
    const key = parseDateKey(err.created_at);
    if (key) {
      invalidByDate[key] = (invalidByDate[key] || 0) + 1;
    }
  }

  const totalDatedErrors = Object.values(invalidByDate).reduce((s, c) => s + c, 0);
  const unassignedErrors = Math.max(0, invalidCount - totalDatedErrors);

  const dateList = [];
  for (let i = numDays - 1; i >= 0; i--) {
    const d = new Date(endDate);
    d.setDate(d.getDate() - i);
    const key = formatDateKey(d);

    let dayInvalid = invalidByDate[key] || 0;
    if (key === latestStr) {
      dayInvalid += unassignedErrors;
    }

    dateList.push({
      dateKey: key,
      day: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      valid: validByDate[key] || 0,
      invalid: dayInvalid,
      revenue: Math.round((revenueByDate[key] || 0) * 100) / 100,
    });
  }

  return dateList;
}

function TrendTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  const data = payload.reduce((acc, item) => ({ ...acc, [item.dataKey]: item.value }), {});
  return <div className="chart-tooltip"><strong>{label}</strong><span>Valid: {data.valid}</span><span>Invalid: {data.invalid}</span><span>Revenue: {money(data.revenue || 0)}</span></div>;
}
