import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams } from "react-router-dom";
import {
  ArrowLeft,
  MapPin,
  Package,
  Bike,
  Home,
  ClipboardList,
  XCircle,
  Clock,
  AlertTriangle,
} from "lucide-react";

const GREEN = "#16a34a";
const RED = "#dc2626";
const RED_SOFT = "#fef2f2";
const INK = "#0f172a";

// ════════════════════════════════════════════════════════════════════════
// SERVICE LAYER — thin wrapper over the real /api/checkout/orders/* routes
// defined in checkout.js. No mocks — every function here hits the actual
// backend.
//
// AUTH NOTE: none of these routes currently check that the caller owns
// the order — they trust the orderId alone. `authToken` is threaded
// through here so it's a one-line change once you add a middleware check
// server-side; until then it's a no-op extra header.
// ════════════════════════════════════════════════════════════════════════

const API_BASE = import.meta.env?.VITE_API_BASE || "http://localhost:5000";

class ApiError extends Error {
  constructor(message, status, body) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.body = body;
  }
}

async function request(path, { method = "GET", body, authToken } = {}) {
  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError(`Network error calling ${path}`, 0, null);
  }

  let json;
  try {
    json = await res.json();
  } catch {
    throw new ApiError(`Invalid JSON response from ${path}`, res.status, null);
  }

  if (!res.ok) {
    throw new ApiError(json?.message || `Request failed (${res.status})`, res.status, json);
  }
  return json;
}

/** GET /api/checkout/orders/:orderId — full order, items, delivery info */
function getOrder(orderId, opts) {
  return request(`/api/checkout/orders/${orderId}`, opts);
}

/** GET /api/checkout/orders/:orderId/delivery-status — lightweight poll target.
 *  NOTE: response field is `data.order_status`, not `status`. */
function getDeliveryStatus(orderId, opts) {
  return request(`/api/checkout/orders/${orderId}/delivery-status`, opts);
}

/** GET /api/checkout/orders/:orderId/rider — {success:false} if unassigned (not an error) */
function getRider(orderId, opts) {
  return request(`/api/checkout/orders/${orderId}/rider`, opts);
}

/** GET /api/checkout/orders/:orderId/location — {success:false} if no ping yet (not an error) */
function getLocation(orderId, opts) {
  return request(`/api/checkout/orders/${orderId}/location`, opts);
}

/** PATCH /api/checkout/orders/:orderId/status — cancel (or any valid transition) */
function updateOrderStatus(orderId, status, cancelReason, opts) {
  return request(`/api/checkout/orders/${orderId}/status`, {
    ...opts,
    method: "PATCH",
    body: { status, cancelReason },
  });
}

// ════════════════════════════════════════════════════════════════════════
// DATA HOOK — real-API polling, no mocks. Initial fetch with retry/backoff,
// then polls delivery-status while the order is non-terminal. Once a
// delivery exists, also polls rider + location. Pauses when the tab is
// hidden and refetches immediately on focus.
// ════════════════════════════════════════════════════════════════════════

const TERMINAL_STATUSES = new Set(["delivered", "cancelled", "completed"]);
const POLL_INTERVAL_MS = 8000;
const MAX_BACKOFF_MS = 30000;
const INITIAL_FETCH_RETRIES = 3;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function useOrderTracking(orderId, { authToken } = {}) {
  const [order, setOrder] = useState(null);
  const [status, setStatus] = useState(null); // normalized live status
  const [rider, setRider] = useState(null);
  const [location, setLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState(null);

  const pollTimerRef = useRef(null);
  const stoppedRef = useRef(false);

  // ── Initial fetch with retry/backoff ──────────────────────────────────
  const fetchOrder = useCallback(async () => {
    setLoading(true);
    setError(null);
    let lastErr;
    for (let attempt = 0; attempt < INITIAL_FETCH_RETRIES; attempt++) {
      try {
        const json = await getOrder(orderId, { authToken });
        if (stoppedRef.current) return;
        setOrder(json.order);
        setStatus(json.order.status);
        setLoading(false);
        return json.order;
      } catch (err) {
        lastErr = err;
        if (err instanceof ApiError && err.status === 404) break; // don't retry a real 404
        await sleep(300 * 2 ** attempt);
      }
    }
    if (stoppedRef.current) return;
    setError(lastErr);
    setLoading(false);
  }, [orderId, authToken]);

  // ── Poll delivery-status while non-terminal ───────────────────────────
  useEffect(() => {
    stoppedRef.current = false;
    fetchOrder();
    return () => {
      stoppedRef.current = true;
      clearTimeout(pollTimerRef.current);
    };
  }, [fetchOrder]);

  useEffect(() => {
    if (!order) return;
    if (TERMINAL_STATUSES.has(status)) return;

    let failCount = 0;

    async function tick() {
      try {
        const json = await getDeliveryStatus(orderId, { authToken });
        if (stoppedRef.current) return;
        const liveStatus = json.data.order_status; // field name differs from GET /orders/:id
        setStatus(liveStatus);
        failCount = 0;

        if (!TERMINAL_STATUSES.has(liveStatus)) {
          pollTimerRef.current = setTimeout(tick, POLL_INTERVAL_MS);
        }
      } catch {
        if (stoppedRef.current) return;
        failCount += 1;
        const backoff = Math.min(POLL_INTERVAL_MS * 2 ** failCount, MAX_BACKOFF_MS);
        pollTimerRef.current = setTimeout(tick, backoff);
      }
    }

    function onVisibility() {
      if (document.visibilityState === "visible") {
        clearTimeout(pollTimerRef.current);
        tick();
      }
    }

    tick();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      clearTimeout(pollTimerRef.current);
      document.removeEventListener("visibilitychange", onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order, orderId, authToken]);

  // ── Rider + location, only once dispatched ────────────────────────────
  useEffect(() => {
    if (!order) return;
    if (!["out_for_delivery", "picked"].includes(status)) return;

    let cancelled = false;
    let timer;

    async function tick() {
      try {
        const [riderRes, locRes] = await Promise.all([
          getRider(orderId, { authToken }),
          getLocation(orderId, { authToken }),
        ]);
        if (cancelled) return;
        setRider(riderRes.success ? riderRes.rider : null);
        setLocation(locRes.success ? locRes.location : null);
      } catch {
        // best-effort; rider/location tracking failing shouldn't break the page
      }
      if (!cancelled) timer = setTimeout(tick, POLL_INTERVAL_MS);
    }

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [order, status, orderId, authToken]);

  // ── Cancel ─────────────────────────────────────────────────────────────
  const cancelOrder = useCallback(
    async (reason) => {
      setCancelling(true);
      setCancelError(null);
      const prevStatus = status;
      setStatus("cancelled"); // optimistic
      try {
        await updateOrderStatus(orderId, "cancelled", reason, { authToken });
        setOrder((prev) => (prev ? { ...prev, status: "cancelled", cancel_reason: reason } : prev));
        return true;
      } catch (err) {
        setStatus(prevStatus); // rollback
        setCancelError(err);
        return false;
      } finally {
        setCancelling(false);
      }
    },
    [orderId, status, authToken]
  );

  return {
    order,
    status,
    rider,
    location,
    loading,
    error,
    refetch: fetchOrder,
    cancelOrder,
    cancelling,
    cancelError,
  };
}

// ════════════════════════════════════════════════════════════════════════
// UI COMPONENTS
// ════════════════════════════════════════════════════════════════════════

const STEPS = [
  { key: "placed", label: "Order Placed", icon: ClipboardList },
  { key: "packed", label: "Packed", icon: Package },
  { key: "out_for_delivery", label: "Out for Delivery", icon: Bike },
  { key: "delivered", label: "Delivered", icon: Home },
];

// Your backend's real status enum is finer-grained than the 4-step UI.
// Bucket real statuses into the visible steps honestly instead of
// inventing states the backend doesn't have.
function statusToStepIndex(status) {
  switch (status) {
    case "placed":
      return 0;
    case "confirmed":
    case "packed":
    case "picked":
      return 1;
    case "out_for_delivery":
      return 2;
    case "delivered":
    case "completed":
    case "trial_started":
    case "trial_completed":
      return 3;
    default:
      return 0;
  }
}

const CANCELLABLE_STATUSES = new Set(["placed", "confirmed"]);

function StatusStepper({ status }) {
  const active = statusToStepIndex(status);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-5">
        <h2 className="font-semibold text-slate-900">Order Status</h2>
        <span
          className="text-sm font-medium px-3 py-1 rounded-full"
          style={{ color: "#2563eb", backgroundColor: "#eff6ff" }}
        >
          {STEPS[active].label}
        </span>
      </div>
      <ol className="flex items-start justify-between">
        {STEPS.map((step, i) => {
          const Icon = step.icon;
          const isDone = i <= active;
          const isCurrent = i === active;
          return (
            <li key={step.key} className="flex-1 flex flex-col items-center relative">
              {i > 0 && (
                <div
                  className="absolute top-5 right-1/2 w-full h-0.5 -z-0"
                  style={{ backgroundColor: i <= active ? GREEN : "#e5e7eb" }}
                  aria-hidden="true"
                />
              )}
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center relative z-10"
                style={{
                  backgroundColor: isDone ? GREEN : "#fff",
                  border: isDone ? "none" : "2px solid #e5e7eb",
                }}
                aria-current={isCurrent ? "step" : undefined}
              >
                <Icon size={16} color={isDone ? "#fff" : "#9ca3af"} strokeWidth={2.2} />
              </div>
              <span
                className="mt-2 text-xs text-center leading-tight"
                style={{ color: isDone ? INK : "#9ca3af", fontWeight: isCurrent ? 600 : 400 }}
              >
                {step.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function CancelledStatus() {
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-semibold text-slate-900">Order Status</h2>
        <span className="text-sm font-medium px-3 py-1 rounded-full" style={{ color: RED, backgroundColor: RED_SOFT }}>
          Cancelled
        </span>
      </div>
      <div className="flex flex-col items-center py-2">
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: RED }}>
          <XCircle size={26} color="#fff" strokeWidth={2} />
        </div>
        <span className="font-medium text-slate-900">Cancelled</span>
      </div>
    </div>
  );
}

function DeliveryEstimateCard({ order }) {
  if (!order.deliveryPromise) return null;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <p className="text-sm text-slate-500 mb-1">Estimated Delivery</p>
      <p className="text-lg font-bold text-slate-900">{order.deliveryPromise}</p>
      {order.distanceKm != null && (
        <p className="text-sm text-slate-500 mt-1">Distance: {Number(order.distanceKm).toFixed(1)} km</p>
      )}
      {order.deliveryEtaMinutes != null && (
        <div className="mt-4 flex items-center gap-1.5 text-sm text-slate-600">
          <Clock size={14} /> ~{order.deliveryEtaMinutes} min remaining
        </div>
      )}
    </div>
  );
}

function RiderCard({ rider }) {
  if (!rider) return null;
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100 flex items-center gap-3">
      <div className="w-11 h-11 rounded-full flex items-center justify-center" style={{ backgroundColor: "#f0fdf4" }}>
        <Bike size={20} color={GREEN} />
      </div>
      <div>
        <p className="font-medium text-slate-900 text-sm">{rider.name}</p>
        <p className="text-sm text-slate-500">
          {rider.vehicle_type} {rider.vehicle_number ? `· ${rider.vehicle_number}` : ""}
        </p>
      </div>
    </div>
  );
}

function CancelledBanner({ reason }) {
  return (
    <div className="rounded-2xl p-4 flex items-start gap-3 border" style={{ backgroundColor: RED_SOFT, borderColor: "#fecaca" }}>
      <XCircle size={20} color={RED} className="mt-0.5 flex-shrink-0" />
      <div>
        <p className="font-semibold" style={{ color: RED }}>Order Cancelled</p>
        {reason && (
          <p className="text-sm mt-0.5" style={{ color: "#b91c1c" }}>
            {reason}
          </p>
        )}
      </div>
    </div>
  );
}

function AddressCard({ order }) {
  // Recipient name: GET /orders/:orderId currently only selects u.name (account
  // holder) as customer_name, not a.name (the per-address recipient). If you
  // want the actual "K Medha Rani"-style recipient on the address rather than
  // the account name, add `a.name AS recipient_name` to that query.
  const name = order.recipient_name || order.customer_name || "Customer";
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-start gap-3">
        <MapPin size={18} color={GREEN} className="mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm text-slate-500 mb-1">Shipping To</p>
          <p className="font-semibold text-slate-900">{name}</p>
          <p className="text-sm text-slate-600 mt-0.5">{order.address_line}</p>
          <p className="text-sm text-slate-600">
            {order.city} - {order.pincode}
          </p>
        </div>
      </div>
    </div>
  );
}

function ProductsCard({ items }) {
  const count = items.reduce((s, it) => s + it.quantity, 0);
  return (
    <div className="bg-white rounded-2xl p-5 shadow-sm border border-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900 flex items-center gap-2">
          <Package size={17} /> Products Ordered
        </h2>
        <span className="text-sm text-slate-400">
          {count} item{count !== 1 ? "s" : ""}
        </span>
      </div>
      <ul className="space-y-3">
        {items.map((item) => (
          <li key={item.variant_id} className="flex items-center gap-3">
            {item.image && (
              <img src={item.image} alt="" className="w-16 h-16 rounded-xl object-cover bg-slate-100 flex-shrink-0" />
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-slate-900 text-sm leading-snug truncate">{item.product_name}</p>
              <p className="text-sm text-slate-500 mt-0.5">
                {[item.color, item.size].filter(Boolean).join(" · ")} · ×{item.quantity}
              </p>
            </div>
            <span className="font-semibold text-slate-900 text-sm whitespace-nowrap">
              ₹{Number(item.price).toLocaleString("en-IN")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function CancelDialog({ onConfirm, onDismiss, busy, error }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-4" onClick={onDismiss}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="cancel-dialog-title"
        className="bg-white rounded-2xl w-full max-w-sm p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="cancel-dialog-title" className="font-semibold text-lg text-slate-900 mb-2">
          Cancel this order?
        </h3>
        <p className="text-sm text-slate-500 mb-4">This can't be undone.</p>
        {error && (
          <p className="text-sm mb-4 flex items-center gap-1.5" style={{ color: RED }}>
            <AlertTriangle size={14} /> Couldn't cancel — please try again.
          </p>
        )}
        <div className="flex gap-3">
          <button onClick={onDismiss} className="flex-1 py-2.5 rounded-xl font-medium text-slate-700 bg-slate-100 hover:bg-slate-200">
            Keep Order
          </button>
          <button
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 py-2.5 rounded-xl font-medium text-white disabled:opacity-60"
            style={{ backgroundColor: RED }}
          >
            {busy ? "Cancelling…" : "Cancel Order"}
          </button>
        </div>
      </div>
    </div>
  );
}

function Toast({ message }) {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 px-5 py-4 text-white font-medium text-sm" style={{ backgroundColor: RED }} role="status" aria-live="polite">
      {message}
    </div>
  );
}

function Skeleton() {
  return (
    <div className="max-w-lg mx-auto px-4 pt-4 space-y-4 animate-pulse">
      {[140, 90, 220, 100, 160].map((h, i) => (
        <div key={i} className="bg-slate-100 rounded-2xl" style={{ height: h }} />
      ))}
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="max-w-lg mx-auto px-4 pt-16 text-center">
      <AlertTriangle size={28} color={RED} className="mx-auto mb-3" />
      <p className="font-medium text-slate-900 mb-1">Couldn't load this order</p>
      <p className="text-sm text-slate-500 mb-5">Check your connection and try again.</p>
      <button onClick={onRetry} className="px-5 py-2.5 rounded-full font-medium text-white" style={{ backgroundColor: GREEN }}>
        Retry
      </button>
    </div>
  );
}

export default function OrderTrackingPageLive() {
  const { orderId } = useParams();
  const { order, status, rider, loading, error, refetch, cancelOrder, cancelling, cancelError } =
    useOrderTracking(orderId);
  const [confirming, setConfirming] = useState(false);
  const [toast, setToast] = useState(null);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white px-4 py-4 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900">Track Order</h1>
        </header>
        <Skeleton />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen bg-slate-50">
        <header className="bg-white px-4 py-4 border-b border-slate-100">
          <h1 className="text-lg font-bold text-slate-900">Track Order</h1>
        </header>
        <ErrorState onRetry={refetch} />
      </div>
    );
  }

  const isCancelled = status === "cancelled";
  const cancellable = CANCELLABLE_STATUSES.has(status);
  const shortId = order.id?.toString().slice(-11).toUpperCase();
  const placedAt = order.created_at
    ? new Date(order.created_at).toLocaleString("en-IN", {
        day: "2-digit",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : null;

  async function handleConfirmCancel() {
    const ok = await cancelOrder("Cancelled by customer");
    setConfirming(false);
    setToast(ok ? "Order cancelled" : "Couldn't cancel order");
    setTimeout(() => setToast(null), 3000);
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-28" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header className="bg-white px-4 py-4 flex items-center gap-4 border-b border-slate-100 sticky top-0 z-30">
        <button aria-label="Go back" className="text-slate-700 hover:text-slate-900" onClick={() => window.history.back()}>
          <ArrowLeft size={22} />
        </button>
        <div>
          <h1 className="text-lg font-bold text-slate-900 leading-tight">Track Order</h1>
          <p className="text-xs text-slate-400 tracking-wide">#{shortId}</p>
        </div>
      </header>

      {placedAt && <p className="text-sm text-slate-400 px-4 pt-4">Placed on {placedAt}</p>}

      <main className="px-4 pt-3 space-y-4 max-w-lg mx-auto">
        {isCancelled ? (
          <>
            <CancelledStatus />
            <CancelledBanner reason={order.cancel_reason} />
          </>
        ) : (
          <>
            <StatusStepper status={status} />
            <DeliveryEstimateCard order={order} />
            <RiderCard rider={rider} />
          </>
        )}

        <AddressCard order={order} />
        <ProductsCard items={order.items || []} />
      </main>

      {!isCancelled && cancellable && (
        <div className="fixed bottom-0 left-0 right-0 bg-slate-50/95 backdrop-blur px-4 py-4 border-t border-slate-100 z-20">
          <div className="max-w-lg mx-auto">
            <button
              onClick={() => setConfirming(true)}
              className="w-full py-3.5 rounded-full font-semibold border-2 flex items-center justify-center gap-2"
              style={{ borderColor: RED, color: RED }}
            >
              <XCircle size={18} /> Cancel Order
            </button>
          </div>
        </div>
      )}

      {confirming && (
        <CancelDialog
          onConfirm={handleConfirmCancel}
          onDismiss={() => setConfirming(false)}
          busy={cancelling}
          error={cancelError}
        />
      )}

      {toast && <Toast message={toast} />}
    </div>
  );
}