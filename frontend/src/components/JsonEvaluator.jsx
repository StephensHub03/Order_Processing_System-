import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  Box,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Code2,
  Copy,
  Database,
  FileCode2,
  IndianRupee,
  Play,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Users,
} from 'lucide-react';
import * as api from '../services/api';

const SAMPLE_PRESETS = {
  activeWeek: `[
  {
    "order_id": 501,
    "date": "2026-09-20",
    "customer": "Metro Supermarket",
    "items": [
      { "product": "Rice", "qty": 15, "rate": 80 },
      { "product": "Cooking Oil", "qty": 5, "rate": 160 }
    ]
  },
  {
    "order_id": 502,
    "date": "2026-09-20",
    "customer": "",
    "items": [
      { "product": "Sugar", "qty": 5, "rate": 42 }
    ]
  },
  {
    "order_id": 503,
    "date": "2026-09-21",
    "customer": "Sunrise Stores",
    "items": [
      { "product": "Milk", "qty": 20, "rate": 48 },
      { "product": "Bread", "qty": 8, "rate": 40 }
    ]
  },
  {
    "order_id": 504,
    "date": "2026-09-21",
    "customer": "City Shop",
    "items": [
      { "product": "Tea", "qty": "invalid", "rate": 120 }
    ]
  },
  {
    "order_id": 505,
    "date": "2026-09-22",
    "customer": "Fresh Mart",
    "items": [
      { "product": "Soap", "qty": 10, "rate": 35 }
    ]
  }
]`,
  edgeCases: `[
  {
    "order_id": 901,
    "date": "2026-09-26",
    "customer": "Daily Needs",
    "items": [
      { "product": "Butter", "qty": 4, "rate": 115 }
    ]
  },
  {
    "order_id": "not_an_int",
    "date": "2026-09-26",
    "customer": "Corner Shop",
    "items": [
      { "product": "Bread", "qty": 2, "rate": 40 }
    ]
  },
  {
    "customer": "Missing ID Store",
    "items": [
      { "product": "Salt", "qty": 5, "rate": 20 }
    ]
  },
  {
    "order_id": 902,
    "customer": "Empty Items Store",
    "items": []
  },
  {
    "order_id": 903,
    "customer": "Negative Qty Mart",
    "items": [
      { "product": "Oil", "qty": -5, "rate": 150 }
    ]
  },
  {
    "order_id": 904,
    "customer": "Missing Rate Store",
    "items": [
      { "product": "Sugar", "qty": 10 }
    ]
  },
  {
    "order_id": 905,
    "date": "2026-09-26",
    "customer": "Valid High Value Mart",
    "items": [
      { "product": "Basmati Rice 25kg", "qty": 10, "rate": 2400 },
      { "product": "Pure Ghee 5L", "qty": 4, "rate": 3200 }
    ]
  }
]`,
};

export default function JsonEvaluator({ onApplyBatch }) {
  const [jsonText, setJsonText] = useState(SAMPLE_PRESETS.activeWeek);
  const [evaluating, setEvaluating] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [activeTab, setActiveTab] = useState('valid');
  const [copied, setCopied] = useState(false);
  const [expandedOrders, setExpandedOrders] = useState({});

  // Client-side instant JSON syntax check
  const syntaxState = useMemo(() => {
    if (!jsonText.trim()) return { empty: true };
    try {
      const parsed = JSON.parse(jsonText);
      if (!Array.isArray(parsed)) {
        return { valid: false, error: 'Top-level value must be a JSON array [ ... ]' };
      }
      return { valid: true, count: parsed.length };
    } catch (err) {
      return { valid: false, error: err.message };
    }
  }, [jsonText]);

  async function handleEvaluate() {
    if (!jsonText.trim()) {
      setError('Please provide JSON text to evaluate.');
      return;
    }
    setError('');
    setNotice('');
    setEvaluating(true);
    try {
      const data = await api.evaluateOrders(jsonText);
      setResult(data);
      if (data.invalid_orders > 0 && data.valid_orders === 0) {
        setActiveTab('invalid');
      } else {
        setActiveTab('valid');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setEvaluating(false);
    }
  }

  async function handleCommit() {
    if (!result || !result.total_orders) return;
    setCommitting(true);
    setError('');
    setNotice('');
    try {
      const commitRes = await api.commitRawOrders(jsonText);
      setNotice(`${commitRes.message} (${commitRes.valid_orders} valid, ${commitRes.invalid_orders} invalid). Live dashboard is updated!`);
      if (onApplyBatch) onApplyBatch();
    } catch (err) {
      setError(err.message);
    } finally {
      setCommitting(false);
    }
  }

  function handleFileUpload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result;
      if (typeof text === 'string') {
        setJsonText(text);
        setError('');
        setNotice(`Uploaded "${file.name}" (${(file.size / 1024).toFixed(1)} KB) into workspace.`);
      }
    };
    reader.readAsText(file);
  }

  function handleFormat() {
    try {
      const parsed = JSON.parse(jsonText);
      setJsonText(JSON.stringify(parsed, null, 2));
      setError('');
    } catch (err) {
      setError(`Cannot format: ${err.message}`);
    }
  }

  function handleCopyResult() {
    if (!result) return;
    navigator.clipboard.writeText(JSON.stringify(result, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function toggleExpand(id) {
    setExpandedOrders(prev => ({ ...prev, [id]: !prev[id] }));
  }

  return (
    <section className="evaluator-container" aria-label="JSON Order Evaluator">
      {/* Top Header Card */}
      <div className="glass-panel evaluator-header-panel">
        <div className="evaluator-header-copy">
          <div className="evaluator-badge">
            <Code2 size={16} />
            <span>INTERACTIVE JSON WORKSPACE</span>
          </div>
          <h2>Order Data <span>Evaluator</span></h2>
          <p>
            Paste or upload JSON order text to instantly inspect field validation,
            calculate order totals, review customer sales, and evaluate batch health in a sandbox.
          </p>
        </div>
        <div className="evaluator-quick-presets">
          <span className="preset-label">Quick Presets:</span>
          <button
            type="button"
            className="preset-pill"
            onClick={() => { setJsonText(SAMPLE_PRESETS.activeWeek); setResult(null); setError(''); }}
          >
            Weekly Batch
          </button>
          <button
            type="button"
            className="preset-pill"
            onClick={() => { setJsonText(SAMPLE_PRESETS.edgeCases); setResult(null); setError(''); }}
          >
            Edge Cases
          </button>
          <label className="preset-pill upload-pill">
            <Upload size={14} /> Upload JSON
            <input type="file" accept=".json,application/json" onChange={handleFileUpload} />
          </label>
        </div>
      </div>

      {error && <div role="alert" className="alert error">{error}</div>}
      {notice && <div role="status" className="alert success">{notice}</div>}

      {/* Main Dual Workspace */}
      <div className="evaluator-grid">
        {/* Left Column: Code Workspace */}
        <div className="glass-panel editor-panel">
          <div className="editor-toolbar">
            <div className="editor-status">
              <span className="editor-file-badge"><FileCode2 size={16} /> orders.json</span>
              {syntaxState.empty ? (
                <span className="syntax-badge neutral">Empty</span>
              ) : syntaxState.valid ? (
                <span className="syntax-badge valid"><CheckCircle2 size={14} /> Valid JSON ({syntaxState.count} orders)</span>
              ) : (
                <span className="syntax-badge invalid" title={syntaxState.error}><AlertTriangle size={14} /> Syntax Error</span>
              )}
            </div>

            <div className="editor-actions">
              <button
                type="button"
                className="button-icon-text"
                title="Format JSON"
                onClick={handleFormat}
                disabled={!syntaxState.valid}
              >
                <Sparkles size={15} /> Format
              </button>
              <button
                type="button"
                className="button-icon-text danger"
                title="Clear Workspace"
                onClick={() => { setJsonText(''); setResult(null); setError(''); }}
              >
                <Trash2 size={15} /> Clear
              </button>
            </div>
          </div>

          <div className="editor-textarea-wrapper">
            <textarea
              className="evaluator-textarea"
              value={jsonText}
              onChange={(e) => setJsonText(e.target.value)}
              placeholder='Paste or write JSON array here, e.g.:&#10;[&#10;  {&#10;    "order_id": 101,&#10;    "date": "2026-09-26",&#10;    "customer": "Acme Mart",&#10;    "items": [{ "product": "Soap", "qty": 10, "rate": 25 }]&#10;  }&#10;]'
              rows={22}
              spellCheck="false"
            />
          </div>

          <div className="editor-footer">
            <div className="editor-meta">
              <span>{jsonText.length.toLocaleString()} chars</span>
              <span>•</span>
              <span>{jsonText.split('\n').length} lines</span>
            </div>
            <button
              type="button"
              className="button primary compact evaluate-btn"
              disabled={evaluating || !jsonText.trim()}
              onClick={handleEvaluate}
            >
              <Play size={16} /> {evaluating ? 'Evaluating...' : 'Evaluate JSON'}
            </button>
          </div>
        </div>

        {/* Right Column: Evaluation Results */}
        <div className="glass-panel results-panel">
          <div className="results-toolbar">
            <div className="results-heading">
              <h3>Evaluation Result</h3>
              <p>Validation engine diagnostics & calculations</p>
            </div>
            {result && (
              <div className="results-actions">
                <button
                  type="button"
                  className="button secondary compact copy-btn"
                  onClick={handleCopyResult}
                  title="Copy full evaluation JSON"
                >
                  {copied ? <><Check size={15} /> Copied</> : <><Copy size={15} /> Copy JSON</>}
                </button>
                <button
                  type="button"
                  className="button primary compact commit-btn"
                  disabled={committing || !result.valid_orders}
                  onClick={handleCommit}
                  title="Save evaluated orders to system SQLite database"
                >
                  <Database size={15} /> {committing ? 'Saving...' : 'Apply to Live DB'}
                </button>
              </div>
            )}
          </div>

          {!result ? (
            <div className="evaluator-empty-state">
              <div className="empty-icon-ring">
                <Sparkles size={36} />
              </div>
              <h4>Workspace Ready</h4>
              <p>
                Enter or upload JSON on the left, then click <strong>Evaluate JSON</strong>.
                The engine will evaluate each order, detect schema/type violations, calculate line totals,
                and summarize customer revenue.
              </p>
              <button
                type="button"
                className="button primary"
                onClick={handleEvaluate}
                disabled={evaluating || !jsonText.trim()}
              >
                <Play size={16} /> Evaluate Current Code
              </button>
            </div>
          ) : (
            <div className="evaluation-content">
              {/* Stat Cards */}
              <div className="eval-stats-row">
                <div className="eval-stat-card">
                  <span className="eval-stat-icon gold"><Box size={20} /></span>
                  <div>
                    <small>Total Input</small>
                    <strong>{result.total_orders}</strong>
                  </div>
                </div>
                <div className="eval-stat-card">
                  <span className="eval-stat-icon green"><CheckCircle2 size={20} /></span>
                  <div>
                    <small>Valid Orders</small>
                    <strong>{result.valid_orders}</strong>
                    <em>{result.pass_rate}% Pass</em>
                  </div>
                </div>
                <div className="eval-stat-card">
                  <span className="eval-stat-icon red"><AlertTriangle size={20} /></span>
                  <div>
                    <small>Invalid Orders</small>
                    <strong>{result.invalid_orders}</strong>
                    <em>{Math.round((result.invalid_orders / Math.max(result.total_orders, 1)) * 100)}% Fail</em>
                  </div>
                </div>
                <div className="eval-stat-card">
                  <span className="eval-stat-icon blue"><IndianRupee size={20} /></span>
                  <div>
                    <small>Total Value</small>
                    <strong>{api.money(result.total_sales)}</strong>
                  </div>
                </div>
              </div>

              {/* Tabs */}
              <div className="eval-tabs-bar">
                <button
                  type="button"
                  className={`eval-tab ${activeTab === 'valid' ? 'active' : ''}`}
                  onClick={() => setActiveTab('valid')}
                >
                  Valid Orders <span className="tab-pill green">{result.valid.length}</span>
                </button>
                <button
                  type="button"
                  className={`eval-tab ${activeTab === 'invalid' ? 'active' : ''}`}
                  onClick={() => setActiveTab('invalid')}
                >
                  Validation Issues <span className="tab-pill red">{result.invalid.length}</span>
                </button>
                <button
                  type="button"
                  className={`eval-tab ${activeTab === 'customers' ? 'active' : ''}`}
                  onClick={() => setActiveTab('customers')}
                >
                  Customers <span className="tab-pill">{result.customers.length}</span>
                </button>
                <button
                  type="button"
                  className={`eval-tab ${activeTab === 'raw' ? 'active' : ''}`}
                  onClick={() => setActiveTab('raw')}
                >
                  JSON Tree
                </button>
              </div>

              {/* Tab 1: Valid Orders */}
              {activeTab === 'valid' && (
                <div className="tab-pane">
                  {result.valid.length === 0 ? (
                    <p className="empty-sub">No valid orders passed in this batch.</p>
                  ) : (
                    <div className="eval-orders-list">
                      {result.valid.map((order) => {
                        const isExpanded = expandedOrders[order.order_id];
                        return (
                          <div className="eval-order-card" key={order.order_id}>
                            <div className="eval-order-header" onClick={() => toggleExpand(order.order_id)}>
                              <div className="eval-order-title">
                                <span className="order-chip valid">#{order.order_id}</span>
                                <strong>{order.customer}</strong>
                                {order.created_at && (
                                  <span className="date-tag">{order.created_at.slice(0, 10)}</span>
                                )}
                              </div>
                              <div className="eval-order-right">
                                <span className="order-items-badge">{order.items.length} items</span>
                                <strong className="order-amount">{api.money(order.total)}</strong>
                                <button type="button" className="expand-chevron" aria-label="Expand order details">
                                  {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
                                </button>
                              </div>
                            </div>

                            {isExpanded && (
                              <div className="eval-order-items-drawer">
                                <table className="items-mini-table">
                                  <thead>
                                    <tr>
                                      <th>Product</th>
                                      <th className="num">Qty</th>
                                      <th className="num">Rate</th>
                                      <th className="num">Amount</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {order.items.map((item, idx) => (
                                      <tr key={idx}>
                                        <td>{item.product}</td>
                                        <td className="num">{item.qty}</td>
                                        <td className="num">{api.money(item.rate)}</td>
                                        <td className="num highlight">{api.money(item.amount)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Invalid Orders */}
              {activeTab === 'invalid' && (
                <div className="tab-pane">
                  {result.invalid.length === 0 ? (
                    <div className="all-clean-notice">
                      <CheckCircle2 size={24} />
                      <div>
                        <strong>100% Validation Passed!</strong>
                        <p>No schema or logical validation issues found in this dataset.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="eval-errors-list">
                      {result.invalid.map((err, idx) => (
                        <div className="eval-error-card" key={idx}>
                          <div className="eval-error-head">
                            <span className="error-index-chip">Order #{err.order_id ?? `[Index ${err.index}]`}</span>
                            {err.customer && <span className="error-customer">{err.customer}</span>}
                            <span className="badge invalid">REJECTED</span>
                          </div>

                          <div className="error-reasons-block">
                            {err.reasons && err.reasons.length > 0 ? (
                              err.reasons.map((reason, rIdx) => (
                                <div className="reason-row" key={rIdx}>
                                  <AlertTriangle size={15} />
                                  <span>{reason}</span>
                                </div>
                              ))
                            ) : (
                              <div className="reason-row">
                                <AlertTriangle size={15} />
                                <span>{err.message}</span>
                              </div>
                            )}
                          </div>

                          {err.order_preview && (
                            <details className="error-snippet-drawer">
                              <summary>View submitted JSON snippet</summary>
                              <pre>{JSON.stringify(err.order_preview, null, 2)}</pre>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 3: Customer Sales */}
              {activeTab === 'customers' && (
                <div className="tab-pane">
                  {result.customers.length === 0 ? (
                    <p className="empty-sub">No customers found.</p>
                  ) : (
                    <div className="eval-customers-list">
                      {result.customers.map((cust, idx) => (
                        <div className="eval-customer-row" key={idx}>
                          <div className="eval-cust-info">
                            <span className="customer-avatar">{cust.customer.slice(0, 1)}</span>
                            <div>
                              <strong>{cust.customer}</strong>
                              <small>{((cust.total / Math.max(result.total_sales, 1)) * 100).toFixed(1)}% of total</small>
                            </div>
                          </div>
                          <strong className="eval-cust-amount">{api.money(cust.total)}</strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Tab 4: Raw JSON Result */}
              {activeTab === 'raw' && (
                <div className="tab-pane">
                  <div className="raw-json-box">
                    <pre>{JSON.stringify(result, null, 2)}</pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
