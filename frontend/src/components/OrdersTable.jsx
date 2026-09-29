import { money } from '../services/api';

export default function OrdersTable({ orders, onView, busy }) {
  return <section className="panel orders-panel"><div className="panel-heading"><div><h2>Processed orders <span className="count">{orders.length}</span></h2><p>Validated and saved to your database</p></div><span className="small-label"><span className="dot" /> Valid orders</span></div>
    {orders.length ? <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable order table"><table><thead><tr><th>Order ID</th><th>Customer</th><th>Total</th><th>Status</th><th><span className="sr-only">Action</span></th></tr></thead><tbody>{orders.map(order => <tr key={order.order_id}><td className="order-id">#{order.order_id}</td><td><span className="customer-avatar" aria-hidden="true">{order.customer.slice(0, 1)}</span>{order.customer}</td><td className="amount">{money(order.total)}</td><td><span className="badge valid">✓ VALID</span></td><td><button className="view-button" disabled={busy} aria-label={`View order ${order.order_id}`} onClick={() => onView(order.order_id)}>View <span aria-hidden="true">↗</span></button></td></tr>)}</tbody></table></div> : <p className="empty">No orders yet. Select Process Orders to get started.</p>}
    <div className="panel-footer">Only orders that pass every validation check are saved.</div>
  </section>;
}
