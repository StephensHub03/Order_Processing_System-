import { money } from '../services/api';

export default function CustomerSummary({ customers }) {
  const total = customers.reduce((sum, customer) => sum + customer.total, 0);
  return <section className="panel customer-panel"><div className="panel-heading"><div><h2>Sales by Customer</h2><p>Revenue from valid orders</p></div><span className="chart-symbol" aria-hidden="true">▥</span></div>
    {customers.length ? <div className="customer-list">{customers.map((customer, index) => <div className="customer-row" key={customer.customer}><div className="customer-row-label"><span>{customer.customer}</span><strong>{money(customer.total)}</strong></div><div className="bar-track"><div className={index % 2 ? 'bar blue-light' : 'bar'} style={{ width: `${total ? customer.total / total * 100 : 0}%` }} /></div><p>{total ? (customer.total / total * 100).toFixed(1) : 0}% of total sales</p></div>)}<div className="customer-total"><span>Total sales</span><strong>{money(total)}</strong></div></div> : <p className="empty">Customer totals will appear after processing.</p>}
  </section>;
}
