import { useEffect, useRef } from 'react';
import { money } from '../services/api';

export default function OrderDetailsModal({ order, loading, error, onClose }) {
  const dialog = useRef(null);
  useEffect(() => {
    const element = dialog.current;
    const previous = document.activeElement;
    element.showModal();
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { element.close(); document.body.style.overflow = originalOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={dialog} className="order-dialog" aria-labelledby="order-title" onCancel={onClose} onClick={event => { if (event.target === dialog.current) onClose(); }}>
    <div className="modal-content"><div className="modal-heading"><div><p className="eyebrow">ORDER DETAILS</p><h2 id="order-title">{order ? `Order #${order.order_id}` : 'Order details'}</h2></div><button className="close-button" onClick={onClose} aria-label="Close order details">×</button></div>
      {loading ? <p role="status" className="empty">Loading order details…</p> : error ? <p role="alert" className="alert error">{error}</p> : order && <><div className="modal-customer"><span>Customer</span><strong>{order.customer}</strong><span className="badge valid">✓ VALID</span></div><div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable order table"><table><thead><tr><th>Product</th><th>Qty</th><th>Rate</th><th>Amount</th></tr></thead><tbody>{order.items.map((item, index) => <tr key={index}><td>{item.product}</td><td>{item.qty}</td><td>{money(item.rate)}</td><td>{money(item.amount)}</td></tr>)}</tbody></table></div><div className="modal-total"><span>Order total</span><strong>{money(order.total)}</strong></div></>}
      <div className="modal-actions"><button className="button secondary" onClick={onClose}>Close</button></div>
    </div>
  </dialog>;
}
