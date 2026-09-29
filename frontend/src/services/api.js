const BASE = import.meta.env.VITE_API_URL || '/api';

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}${path}`, { ...options, signal: AbortSignal.timeout(20000) });
  } catch {
    throw new Error('Unable to connect to backend. Please start the Flask server.');
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Unable to connect to backend. Please start the Flask server.');
  }
  if (!response.ok) throw new Error(data.error || 'The request failed. Please try again.');
  return data;
}

export const getSummary = () => request('/summary');
export const getOrders = () => request('/orders');
export const getOrder = (id) => request(`/orders/${encodeURIComponent(id)}`);
export const getErrors = () => request('/errors');
export const getCustomerSummary = () => request('/customers/summary');
export const processOrders = () => request('/process', { method: 'POST' });
export const uploadOrders = (file) => {
  const formData = new FormData();
  formData.append('file', file);
  return request('/process/upload', { method: 'POST', body: formData });
};
export const evaluateOrders = (text) => request('/evaluate', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});
export const commitRawOrders = (text) => request('/process/raw', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ text }),
});
export const money = (value) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2 }).format(value);
