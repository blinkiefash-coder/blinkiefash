import { useState, useEffect, useCallback, useRef } from "react";
import { API_BASE_URL } from "../apiBase";
import "./darkstore.css";

const STATUS_META = {
  placed:            { label: "Placed",           color: "#f59e0b", bg: "#fef9c3", text: "#92400e" },
  confirmed:         { label: "Confirmed",         color: "#3b82f6", bg: "#dbeafe", text: "#1e40af" },
  packed:            { label: "Packed",            color: "#8b5cf6", bg: "#ede9fe", text: "#5b21b6" },
  picked:            { label: "Picked",            color: "#06b6d4", bg: "#cffafe", text: "#0e7490" },
  out_for_delivery:  { label: "Out for Delivery",  color: "#f97316", bg: "#fff7ed", text: "#9a3412" },
  delivered:         { label: "Delivered",         color: "#16a34a", bg: "#dcfce7", text: "#166534" },
  trial_started:     { label: "Trial Started",     color: "#7c3aed", bg: "#f5f3ff", text: "#4c1d95" },
  trial_completed:   { label: "Trial Completed",   color: "#0891b2", bg: "#ecfeff", text: "#164e63" },
  completed:         { label: "Completed",         color: "#15803d", bg: "#f0fdf4", text: "#14532d" },
  cancelled:         { label: "Cancelled",         color: "#ef4444", bg: "#fee2e2", text: "#991b1b" },
};

const STATUS_FLOW = [
  { val: "confirmed",        label: "✓ Confirm"        },
  { val: "packed",           label: "📦 Pack"          },
  { val: "picked",           label: "🛒 Picked Up"     },
  { val: "out_for_delivery", label: "🛵 Out for Delivery" },
  // ✅ Delivered is intentionally removed — only riders can mark as delivered
  { val: "cancelled",        label: "✗ Cancel"         },
];

const TERMINAL_STATUSES = ["delivered", "completed", "cancelled"];
const FLOW_ORDER = ["placed", "confirmed", "packed", "picked", "out_for_delivery", "delivered"];

function getAvailableActions(currentStatus) {
  if (TERMINAL_STATUSES.includes(currentStatus)) return [];
  const curIdx = FLOW_ORDER.indexOf(currentStatus);
  return STATUS_FLOW.filter(s => {
    if (s.val === "cancelled") return !TERMINAL_STATUSES.includes(currentStatus);
    const sIdx = FLOW_ORDER.indexOf(s.val);
    return sIdx > curIdx;
  });
}

function timeAgo(iso) {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return new Date(iso).toLocaleTimeString();
}

export default function DarkStore() {
  const [stores, setStores]             = useState([]);
  const [selectedStore, setSelectedStore] = useState(null);
  const [manualId, setManualId]         = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [orders, setOrders]             = useState([]);
  const [loading, setLoading]           = useState(false);
  const [error, setError]               = useState(null);
  const [lastRefresh, setLastRefresh]   = useState(null);
  const [autoRefresh, setAutoRefresh]   = useState(false);
  const intervalRef = useRef(null);

  // Load store list
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/checkout/darkstores`)
      .then(r => r.json())
      .then(d => setStores(d.stores || []))
      .catch(() => {});
  }, []);

  const effectiveStoreId = manualId.trim() || selectedStore?.id || "";
  const effectiveStoreName = selectedStore?.name
    ? `${selectedStore.name} (${selectedStore.city})`
    : effectiveStoreId ? effectiveStoreId.substring(0, 8).toUpperCase() : "";

  const fetchOrders = useCallback(async () => {
    if (!effectiveStoreId) { setError("Please select or enter a store ID"); return; }
    setLoading(true);
    setError(null);
    try {
      let url = `${API_BASE_URL}/api/checkout/orders/darkstore/${effectiveStoreId}`;
      if (statusFilter) url += `?status=${statusFilter}`;
      const res  = await fetch(url);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Server error");
      setOrders(data.orders || []);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [effectiveStoreId, statusFilter]);

  // Auto-refresh
  useEffect(() => {
    if (autoRefresh) {
      fetchOrders();
      intervalRef.current = setInterval(fetchOrders, 15000);
    } else {
      clearInterval(intervalRef.current);
    }
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, fetchOrders]);

  const updateStatus = async (orderId, status) => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/checkout/orders/${orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json();
      if (data.success) {
        setOrders(prev => prev.map(o => o.id === orderId ? { ...o, status } : o));
      } else {
        alert(data.message || "Failed to update");
      }
    } catch {
      alert("Connection error");
    }
  };

  // Stats
  const stats = orders.reduce((acc, o) => {
    acc[o.status] = (acc[o.status] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="ds-page">
      {/* Header */}
      <div className="ds-header">
        <div>
          <h1>⚡ Dark Store Orders</h1>
          <p>BlinkieFash Order Management</p>
        </div>
        {lastRefresh && (
          <div className="ds-refresh-time">
            Updated {lastRefresh.toLocaleTimeString()}
          </div>
        )}
      </div>

      <div className="ds-container">
        {/* Controls */}
        <div className="ds-controls">
          <div className="ds-control-group">
            <label>Select Store</label>
            <select
              value={selectedStore?.id || ""}
              onChange={e => {
                const s = stores.find(x => x.id === e.target.value) || null;
                setSelectedStore(s);
                setManualId("");
              }}
            >
              <option value="">-- Choose a store --</option>
              {stores.map(s => (
                <option key={s.id} value={s.id}>{s.name} — {s.city}</option>
              ))}
            </select>
          </div>

          <div className="ds-control-group">
            <label>Or paste Store ID</label>
            <input
              type="text"
              value={manualId}
              onChange={e => { setManualId(e.target.value); setSelectedStore(null); }}
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
            />
          </div>

          <div className="ds-control-group">
            <label>Status Filter</label>
            <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
              <option value="">All Statuses</option>
              {Object.entries(STATUS_META).map(([val, m]) => (
                <option key={val} value={val}>{m.label}</option>
              ))}
            </select>
          </div>

          <button className="ds-btn ds-btn-primary" onClick={fetchOrders} disabled={loading}>
            {loading ? "Loading…" : "Load Orders"}
          </button>

          <button
            className={`ds-btn ${autoRefresh ? "ds-btn-active" : "ds-btn-outline"}`}
            onClick={() => setAutoRefresh(p => !p)}
          >
            {autoRefresh ? "⏸ Stop (15s)" : "▶ Auto Refresh"}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="ds-error">
            <span>⚠️ {error}</span>
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        {/* Stats */}
        {orders.length > 0 && (
          <div className="ds-stats">
            <div className="ds-stat-card">
              <div className="ds-stat-num">{orders.length}</div>
              <div className="ds-stat-lbl">Total</div>
            </div>
            {[["pending","#f59e0b"],["preparing","#8b5cf6"],["dispatched","#06b6d4"],["delivered","#16a34a"]].map(([s, c]) => (
              <div className="ds-stat-card" key={s}>
                <div className="ds-stat-num" style={{ color: c }}>{stats[s] || 0}</div>
                <div className="ds-stat-lbl">{STATUS_META[s]?.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Orders header */}
        {(orders.length > 0 || lastRefresh) && effectiveStoreName && (
          <div className="ds-orders-header">
            <h2>
              Orders
              <span className="ds-store-badge">{effectiveStoreName}</span>
            </h2>
            <span className="ds-order-count">{orders.length} order{orders.length !== 1 ? "s" : ""}</span>
          </div>
        )}

        {/* Loading */}
        {loading && (
          <div className="ds-loading">
            <div className="ds-spinner" />
            Fetching orders…
          </div>
        )}

        {/* Empty */}
        {!loading && lastRefresh && orders.length === 0 && (
          <div className="ds-empty">
            <div className="ds-empty-icon">📦</div>
            <p>No orders found for this store{statusFilter ? ` with status "${statusFilter}"` : ""}.</p>
          </div>
        )}

        {/* No search yet */}
        {!loading && !lastRefresh && !error && (
          <div className="ds-empty">
            <div className="ds-empty-icon">🏪</div>
            <p>Select a dark store and click <strong>Load Orders</strong></p>
          </div>
        )}

        {/* Order cards */}
        {!loading && orders.map(order => (
          <OrderCard key={order.id} order={order} onStatusChange={updateStatus} />
        ))}
      </div>
    </div>
  );
}

function OrderCard({ order, onStatusChange }) {
  const meta = STATUS_META[order.status] || STATUS_META.placed;
  const rider = order.rider;
  const [cancelConfirm, setCancelConfirm] = useState(false);

  const forwardActions = getAvailableActions(order.status).filter(s => s.val !== "cancelled");
  const canCancel = !TERMINAL_STATUSES.includes(order.status);

  // Store pickup OTP — show when rider has requested pickup and it's not yet verified
  const showPickupOtp = order.store_pickup_otp && !order.store_pickup_verified_at;

  return (
    <div className="ds-order-card" style={{ borderLeftColor: meta.color }}>
      {/* Top row */}
      <div className="ds-order-top">
        <div>
          <div className="ds-customer-name">{order.customer_name || "Customer"}</div>
          <div className="ds-customer-phone">📞 {order.customer_phone}</div>
          <div className="ds-order-id">#{order.id.substring(0, 8).toUpperCase()}</div>
        </div>
        <div className="ds-order-meta">
          <span
            className="ds-badge"
            style={{ background: meta.bg, color: meta.text }}
          >
            {meta.label}
          </span>
          <div className="ds-order-time">{timeAgo(order.created_at)}</div>
          <div className="ds-payment">{(order.payment_method || "cod").toUpperCase()}</div>
        </div>
      </div>

      {/* ── Store Pickup OTP — shown when rider arrives at store ── */}
      {showPickupOtp && (
        <div className="ds-pickup-otp-box">
          <div className="ds-pickup-otp-title">
            🛵 Rider is at your store — give this PIN
          </div>
          <div className="ds-pickup-otp-digits">
            {order.store_pickup_otp.split("").map((d, i) => (
              <span key={i} className="ds-otp-digit">{d}</span>
            ))}
          </div>
          <div className="ds-pickup-otp-hint">
            Tell the rider this 4-digit PIN to confirm pickup
          </div>
        </div>
      )}

      {/* Verified banner */}
      {order.store_pickup_otp && order.store_pickup_verified_at && (
        <div className="ds-pickup-verified">
          ✅ Pickup PIN verified — items handed over
        </div>
      )}

      {/* Address */}
      <div className="ds-address">
        📍 {order.address_line}, {order.city} – {order.pincode}
      </div>

      {/* Rider info (shown once a rider is assigned) */}
      {rider && (
        <div className="ds-rider-info">
          <span className="ds-rider-label">🚴 Rider:</span>
          <strong>{rider.name}</strong>
          {rider.phone && <span> &bull; 📞 {rider.phone}</span>}
          {rider.vehicle_type && <span> &bull; {rider.vehicle_type}</span>}
          {rider.vehicle_number && <span> ({rider.vehicle_number})</span>}
        </div>
      )}

      {/* Items */}
      <table className="ds-items-table">
        <thead>
          <tr>
            <th>Product</th>
            <th>Size</th>
            <th>Color</th>
            <th>Qty</th>
            <th>Price</th>
          </tr>
        </thead>
        <tbody>
          {(order.items || []).map((it, i) => (
            <tr key={i}>
              <td>{it.product_name || "—"}</td>
              <td>{it.size || "—"}</td>
              <td>{it.color || "—"}</td>
              <td>{it.quantity}</td>
              <td>₹{Number(it.price).toLocaleString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Footer */}
      <div className="ds-order-footer">
        <span className="ds-total">Total: ₹{Number(order.total_amount).toLocaleString("en-IN")}</span>
        <div className="ds-actions">
          {forwardActions.map(s => (
            <button
              key={s.val}
              className={`ds-action-btn ds-action-${s.val}`}
              onClick={() => onStatusChange(order.id, s.val)}
            >
              {s.label}
            </button>
          ))}
        </div>
        {canCancel && !cancelConfirm && (
          <div className="ds-cancel-row">
            <button
              className="ds-action-btn ds-action-cancelled ds-cancel-ghost"
              onClick={() => setCancelConfirm(true)}
            >
              ✗ Cancel Order
            </button>
          </div>
        )}
        {cancelConfirm && (
          <div className="ds-cancel-confirm">
            <span className="ds-cancel-prompt">Cancel this order?</span>
            <button
              className="ds-action-btn ds-action-cancelled"
              onClick={() => { onStatusChange(order.id, "cancelled"); setCancelConfirm(false); }}
            >
              Yes, Cancel
            </button>
            <button
              className="ds-action-btn ds-cancel-keep"
              onClick={() => setCancelConfirm(false)}
            >
              No, Keep
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
