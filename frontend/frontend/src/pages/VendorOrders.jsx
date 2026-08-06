import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";
import { fetchVendorProfile } from "../utils/vendorSession";
import { isAdmin, adminHeaders } from "../utils/adminSession";
import "./VendorOrders.css";

const STATUS_LABELS = {
  placed:           { text: "New Order",        color: "#F97316", bg: "#FFF7ED" },
  confirmed:        { text: "Confirmed",         color: "#16A34A", bg: "#F0FDF4" },
  packed:           { text: "Packed",            color: "#2563EB", bg: "#EFF6FF" },
  out_for_delivery: { text: "Out for Delivery",  color: "#7C3AED", bg: "#F5F3FF" },
  delivered:        { text: "Delivered",         color: "#16A34A", bg: "#F0FDF4" },
  cancelled:        { text: "Cancelled",         color: "#DC2626", bg: "#FEF2F2" },
};

const POLL_INTERVAL_MS = 15_000;

// Play a simple beep using Web Audio API
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const times = [0, 0.35, 0.7];
    times.forEach((t) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.frequency.value = 880;
      osc.type = "sine";
      gain.gain.setValueAtTime(0, ctx.currentTime + t);
      gain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + t + 0.05);
      gain.gain.linearRampToValueAtTime(0, ctx.currentTime + t + 0.25);
      osc.start(ctx.currentTime + t);
      osc.stop(ctx.currentTime + t + 0.3);
    });
  } catch {
    // Web Audio API unavailable/blocked - alert sound is best-effort
  }
}

function requestNotificationPermission() {
  if ("Notification" in window && Notification.permission === "default") {
    Notification.requestPermission();
  }
}

function showBrowserNotification(title, body) {
  if ("Notification" in window && Notification.permission === "granted") {
    new Notification(title, {
      body,
      icon: "/favicon.ico",
      tag: "vendor-new-order",
    });
  }
}

function getItemImageUrl(item) {
  const candidates = [
    item?.product_image,
    item?.image_url,
    item?.imageUrl,
    item?.image,
    item?.product_image_url,
    item?.product?.image_url,
    item?.product?.imageUrl,
    item?.product?.image,
    item?.images?.[0],
    item?.image_urls?.[0],
  ];

  return candidates.find((value) => typeof value === "string" && value.trim());
}

function formatLastUpdated(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

export default function VendorOrders() {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState(
    () => localStorage.getItem("store_name") || "My Store"
  );
  const [vendorId] = useState(() => localStorage.getItem("vendor_id") || "");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [statusFilter, setStatusFilter] = useState("placed");
  const [actionLoading, setActionLoading] = useState(null);
  const [lastUpdatedAt, setLastUpdatedAt] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const knownOrderIds = useRef(new Set());
  const isFirstPoll = useRef(true);

  const menuItems = [
    { key: "orders",    label: "Orders",            icon: "\u25cd" },
    { key: "products",  label: "Add Product",       icon: "\u25a1" },
    { key: "edit",      label: "Edit Products",      icon: "\u270f" },
    { key: "stock",     label: "Stock Monitoring",  icon: "\ud83d\udce6" },
    { key: "analytics", label: "Product Analytics", icon: "\ud83d\udcca" },
  ];

  const handleMenuClick = (item) => {
    if (item.key === "products")  navigate("/vendor/add-product");
    if (item.key === "edit")      navigate("/vendor/edit-product");
    if (item.key === "analytics") navigate("/vendor/product-analytics");
    if (item.key === "stock")     navigate("/vendor/stock-monitoring");
  };

  const fetchOrders = useCallback(async () => {
    if (!vendorId && !isAdmin()) return;
    setRefreshing(true);
    try {
      let list = [];
      if (isAdmin()) {
        // Admin sees all orders across all vendors
        const url = statusFilter !== "all"
          ? `${API_API_BASE_URL}/admin/orders?status=${statusFilter}&limit=300`
          : `${API_API_BASE_URL}/admin/orders?limit=300`;
        const res = await fetch(url, { headers: adminHeaders() });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        list = data.orders || [];
      } else {
        const res = await fetch(`${API_API_BASE_URL}/vendor/${vendorId}/orders`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        list = Array.isArray(data) ? data : [];
      }

      // Debug: Log first order to check OTP field
      if (list.length > 0) {
        console.log("📦 First order data:", {
          id: list[0].id,
          delivery_otp: list[0].delivery_otp,
          otp_verified_at: list[0].otp_verified_at,
          status: list[0].status,
          all_keys: Object.keys(list[0])
        });
      }

      // Detect genuinely new orders (not on first load)
      if (!isFirstPoll.current) {
        const newOnes = list.filter(
          (o) =>
            o.status === "placed" && !knownOrderIds.current.has(o.id)
        );
        if (newOnes.length > 0) {
          playAlertSound();
          showBrowserNotification(
            `🛒 ${newOnes.length} New Order${newOnes.length > 1 ? "s" : ""}!`,
            `You have ${newOnes.length} new order${newOnes.length > 1 ? "s" : ""} waiting for confirmation.`
          );
        }
      }

      // Track all current order ids
      list.forEach((o) => knownOrderIds.current.add(o.id));
      isFirstPoll.current = false;

      setOrders(list);
      setError("");
      setLastUpdatedAt(formatLastUpdated());
    } catch (err) {
      setError("Could not load orders. Retrying...");
      console.error("[VendorOrders] poll error:", err.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [vendorId, statusFilter]);

  useEffect(() => {
    if (!vendorId && !isAdmin()) {
      window.location.href = "/vendor";
      return;
    }
    requestNotificationPermission();

    // Load vendor profile
    fetchVendorProfile(vendorId).then((v) => {
      if (v?.store_name) {
        setStoreName(v.store_name);
        localStorage.setItem("store_name", v.store_name);
      }
    });

    // Initial fetch + start polling
    // eslint-disable-next-line react-hooks/set-state-in-effect -- intentional fetch-on-mount
    fetchOrders();
    const timer = setInterval(fetchOrders, POLL_INTERVAL_MS);
    return () => clearInterval(timer);
  }, [vendorId, statusFilter, fetchOrders]);

  const updateStatus = async (orderId, newStatus, cancelReason = "") => {
    setActionLoading(orderId + newStatus);
    try {
      const body = { status: newStatus };
      if (cancelReason) body.cancelReason = cancelReason;
      const res = await fetch(
        `${API_API_BASE_URL}/vendor/${vendorId}/orders/${orderId}/status`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Update failed");
      await fetchOrders();
    } catch (err) {
      alert(`Failed: ${err.message}`);
    } finally {
      setActionLoading(null);
    }
  };

  const confirmReject = (orderId) => {
    const reason = window.prompt(
      "Reason for rejection (leave blank for default):"
    );
    if (reason === null) return; // cancelled
    updateStatus(orderId, "cancelled", reason || "Rejected by store");
  };

  const ACTIVE_TABS = ["placed", "confirmed", "packed", "out_for_delivery"];
  const filtered = orders.filter((o) => {
    // Once delivered or the delivery OTP is verified, drop it out of the active-tracking tabs
    if (ACTIVE_TABS.includes(statusFilter) && (o.status === "delivered" || o.otp_verified_at)) {
      return false;
    }
    return statusFilter === "all" ? true : o.status === statusFilter;
  });

  const newCount = orders.filter((o) => o.status === "placed").length;
  const inProgressCount = orders.filter(
    (o) => ["confirmed", "packed", "out_for_delivery"].includes(o.status) && !o.otp_verified_at
  ).length;
  const deliveredCount = orders.filter((o) => o.status === "delivered").length;
  const totalRevenue = orders
    .filter((o) => ["delivered", "completed"].includes(o.status))
    .reduce((sum, order) => {
      // Vendor revenue = only their own item prices, excluding delivery/platform/handling fees
      const itemsTotal = (order.items || []).reduce(
        (s, it) => s + Number(it.price || 0) * Number(it.quantity || 0),
        0
      );
      return sum + itemsTotal;
    }, 0);
  const metrics = [
    { label: "New orders", value: newCount, tone: "accent" },
    { label: "In progress", value: inProgressCount, tone: "blue" },
    { label: "Delivered", value: deliveredCount, tone: "green" },
    { label: "Revenue", value: `₹${totalRevenue.toLocaleString("en-IN")}`, tone: "neutral" },
  ];

  return (
    <VendorLayout
      activeKey="orders"
      storeName={storeName}
      menuItems={menuItems}
      onMenuClick={handleMenuClick}
    >
      <div className="vo-page">
        <div className="vo-hero">
          <div className="vo-hero-copy">
            <p className="vo-eyebrow">Vendor dashboard</p>
            <h2 className="vo-title">
              Orders
              {newCount > 0 && (
                <span className="vo-badge">{newCount} new</span>
              )}
            </h2>
            <p className="vo-subtitle">
              Incoming orders stay synced live, so you can move through requests without leaving the page.
            </p>
          </div>
          <div className="vo-hero-actions">
            <div className={`vo-live-pill ${refreshing ? "busy" : "online"}`}>
              <span className="vo-live-dot" />
              {refreshing ? "Syncing…" : `Updated ${lastUpdatedAt || "just now"}`}
            </div>
            <button
              className="vo-refresh-btn"
              onClick={() => fetchOrders()}
              disabled={loading || refreshing}
            >
              {refreshing ? "Refreshing…" : "Refresh"}
            </button>
          </div>
        </div>

        <div className="vo-metrics">
          {metrics.map((metric) => (
            <div key={metric.label} className={`vo-metric-card ${metric.tone}`}>
              <span className="vo-metric-label">{metric.label}</span>
              <strong className="vo-metric-value">{metric.value}</strong>
            </div>
          ))}
        </div>

        <div className="vo-tabs">
          {["placed", "confirmed", "packed", "out_for_delivery", "delivered", "cancelled", "all"].map(
            (s) => (
              <button
                key={s}
                className={`vo-tab ${statusFilter === s ? "active" : ""}`}
                onClick={() => setStatusFilter(s)}
              >
                {s === "all"
                  ? "All"
                  : s === "out_for_delivery"
                  ? "Delivery"
                  : s.charAt(0).toUpperCase() + s.slice(1)}
                {s === "placed" && newCount > 0 && (
                  <span className="vo-tab-dot" />
                )}
              </button>
            )
          )}
        </div>

        {loading ? (
          <div className="vo-loading">Loading orders…</div>
        ) : error ? (
          <div className="vo-error">{error}</div>
        ) : filtered.length === 0 ? (
          <div className="vo-empty">
            <div className="vo-empty-icon">📭</div>
            <p>No {statusFilter === "all" ? "" : statusFilter} orders</p>
          </div>
        ) : (
          <div className="vo-list">
            {filtered.map((order) => {
              const sl = STATUS_LABELS[order.status] || {
                text: order.status,
                color: "#374151",
                bg: "#F3F4F6",
              };
              const isNew = order.status === "placed";
              const busy = actionLoading?.startsWith(order.id);
              return (
                <div key={order.id} className={`vo-card ${isNew ? "vo-card-new" : ""}`}>
                  {/* Card header */}
                  <div className="vo-card-head">
                    <div>
                      <span className="vo-order-id">
                        #{order.id.slice(-8).toUpperCase()}
                      </span>
                      <span
                        className="vo-status-badge"
                        style={{ color: sl.color, background: sl.bg }}
                      >
                        {sl.text}
                      </span>
                    </div>
                    <div className="vo-meta">
                      <span>
                        {new Date(order.created_at).toLocaleString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                      <span className="vo-amount">₹{Number(order.final_amount || order.total_amount).toFixed(0)}</span>
                    </div>
                  </div>

                  {/* Customer */}
                  <div className="vo-customer">
                    👤 {order.customer_name || "Customer"}{" "}
                    {order.customer_phone && (
                      <a href={`tel:${order.customer_phone}`} className="vo-phone">
                        📞 {order.customer_phone}
                      </a>
                    )}
                  </div>

                  {/* Store Pickup OTP Section - for rider to pick up from store; hide once order is done */}
                  {order.store_pickup_otp && order.status !== "delivered" && !order.otp_verified_at && (
                    <div className="vo-otp-section" style={{ background: '#E0E7FF', borderLeft: '4px solid #4F46E5' }}>
                      <div className="vo-otp-label">
                        🏪 Store Pickup OTP
                        {order.store_pickup_verified_at && (
                          <span className="vo-otp-verified">✓ Verified</span>
                        )}
                      </div>
                      <div className="vo-otp-code">{order.store_pickup_otp}</div>
                      {order.store_pickup_verified_at && (
                        <div className="vo-otp-time">
                          Verified at {new Date(order.store_pickup_verified_at).toLocaleString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Vendor tag for admin view */}
                  {isAdmin() && order.items?.[0]?.vendor_name && (
                    <div className="vo-vendor-tag">
                      🏪 {order.items[0].vendor_name}
                    </div>
                  )}

                  {/* Items */}
                  <div className="vo-items">
                    {(order.items || []).map((item, idx) => {
                      const imageUrl = getItemImageUrl(item);
                      return (
                        <div key={idx} className="vo-item">
                          <div className="vo-item-main">
                            <div className="vo-item-media">
                              {imageUrl ? (
                                <img src={imageUrl} alt={item.product_name || "Product"} />
                              ) : (
                                <span>🛍️</span>
                              )}
                            </div>
                            <div className="vo-item-copy">
                              <span className="vo-item-name">{item.product_name}</span>
                              <span className="vo-item-detail">
                                {[item.size, item.color].filter(Boolean).join(" · ")} × {item.quantity}
                              </span>
                              {item.barcode && (
                                <span className="vo-item-barcode">🏷️ {item.barcode}</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  {isNew && (
                    <div className="vo-actions">
                      <button
                        className="vo-btn vo-btn-accept"
                        disabled={busy}
                        onClick={() => updateStatus(order.id, "confirmed")}
                      >
                        {busy ? "…" : "✅ Accept"}
                      </button>
                      <button
                        className="vo-btn vo-btn-reject"
                        disabled={busy}
                        onClick={() => confirmReject(order.id)}
                      >
                        {busy ? "…" : "❌ Reject"}
                      </button>
                    </div>
                  )}
                  {order.status === "confirmed" && (
                    <div className="vo-actions">
                      <button
                        className="vo-btn vo-btn-accept"
                        disabled={busy}
                        onClick={() => updateStatus(order.id, "packed")}
                      >
                        {busy ? "…" : "📦 Mark Packed"}
                      </button>
                    </div>
                  )}
                  {order.status === "packed" && (
                    <div className="vo-actions">
                      <button
                        className="vo-btn vo-btn-accept"
                        disabled={busy}
                        onClick={() => updateStatus(order.id, "out_for_delivery")}
                      >
                        {busy ? "…" : "🛵 Out for Delivery"}
                      </button>
                    </div>
                  )}

                  {/* Invoice / packing slip — vendor's own items only, no fees */}
                  {!isAdmin() && vendorId && (
                    <div className="vo-actions">
                      <button
                        className="vo-btn vo-btn-invoice"
                        onClick={() =>
                          window.open(
                            `${API_API_BASE_URL}/vendor/${vendorId}/orders/${order.id}/invoice`,
                            "_blank"
                          )
                        }
                      >
                        🧾 Download Invoice
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
