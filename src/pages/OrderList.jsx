import { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import { Package, ChevronRight, AlertTriangle, ArrowUpDown } from "lucide-react";

const GREEN = "#16a34a";
const RED = "#dc2626";

const STATUS_STYLE = {
  placed: { label: "Placed", color: "#2563eb", bg: "#eff6ff" },
  confirmed: { label: "Confirmed", color: "#2563eb", bg: "#eff6ff" },
  packed: { label: "Packed", color: "#7c3aed", bg: "#f5f3ff" },
  picked: { label: "Picked", color: "#7c3aed", bg: "#f5f3ff" },
  out_for_delivery: { label: "Out for delivery", color: GREEN, bg: "#f0fdf4" },
  delivered: { label: "Delivered", color: GREEN, bg: "#f0fdf4" },
  completed: { label: "Completed", color: GREEN, bg: "#f0fdf4" },
  cancelled: { label: "Cancelled", color: RED, bg: "#fef2f2" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active", statuses: ["placed", "confirmed", "packed", "picked", "out_for_delivery"] },
  { key: "delivered", label: "Delivered", statuses: ["delivered", "completed"] },
  { key: "cancelled", label: "Cancelled", statuses: ["cancelled"] },
];

/**
 * getUserOrders
 * ---------------
 * Fetches the order history for a given user from the backend.
 * Defined locally so this file has no external dependency on an
 * orderApi module. Adjust the URL / auth header below to match
 * your actual backend setup.
 */

async function getUserOrders(userId) {
  const res = await fetch(`/api/checkout/orders?userId=${encodeURIComponent(userId)}`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // Add auth header here if your API needs it, e.g.:
      // Authorization: `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch orders (status ${res.status})`);
  }

  return res.json();
}

function useUserOrders(userId) {
  const [orders, setOrders] = useState(null);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  // Tracks the key of the last fetch that finished (success or error).
  // Only ever written inside .then/.catch callbacks, never synchronously
  // in the effect body, so this satisfies react-hooks/set-state-in-effect.
  const [settledKey, setSettledKey] = useState(null);

  const currentKey = userId ? `${userId}:${reloadKey}` : null;
  const loading = Boolean(userId) && settledKey !== currentKey;

  useEffect(() => {
    if (!userId) return;

    let cancelled = false;
    const key = `${userId}:${reloadKey}`;

    getUserOrders(userId)
      .then((json) => {
        if (cancelled) return;
        setOrders(json.orders);
        setError(null);
        setSettledKey(key);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err);
        setSettledKey(key);
      });

    return () => {
      cancelled = true;
    };
  }, [userId, reloadKey]);

  const refetch = () => setReloadKey((k) => k + 1);

  return { orders, loading, error, refetch };
}

function OrderRow({ order }) {
  const style = STATUS_STYLE[order.status] || STATUS_STYLE.placed;
  const items = order.items || [];
  const thumb = items[0]?.image;
  const itemSummary =
    items.length === 1
      ? items[0].product_name
      : `${items[0]?.product_name || "Item"} + ${items.length - 1} more`;
  const date = order.created_at
    ? new Date(order.created_at).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })
    : "";

  return (
    <Link
      to={`/orders/${order.id}`}
      className="flex items-center gap-3 bg-white rounded-2xl p-4 border border-slate-100 shadow-sm hover:border-slate-200 transition-colors"
    >
      {thumb ? (
        <img src={thumb} alt="" className="w-14 h-14 rounded-xl object-cover bg-slate-100 flex-shrink-0" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-slate-100 flex items-center justify-center flex-shrink-0">
          <Package size={20} className="text-slate-400" />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="font-medium text-slate-900 text-sm truncate">{itemSummary}</p>
        <p className="text-xs text-slate-400 mt-0.5">{date}</p>
        <span
          className="inline-block mt-1.5 text-xs font-medium px-2 py-0.5 rounded-full"
          style={{ color: style.color, backgroundColor: style.bg }}
        >
          {style.label}
        </span>
      </div>
      <div className="text-right flex-shrink-0">
        <p className="font-semibold text-slate-900 text-sm">
          ₹{Number(order.final_amount).toLocaleString("en-IN")}
        </p>
      </div>
      <ChevronRight size={18} className="text-slate-300 flex-shrink-0" />
    </Link>
  );
}

function EmptyState({ filter }) {
  return (
    <div className="text-center py-16 px-4">
      <Package size={32} className="mx-auto mb-3 text-slate-300" />
      <p className="font-medium text-slate-700">
        {filter === "all" ? "No orders yet" : `No ${filter} orders`}
      </p>
      <p className="text-sm text-slate-400 mt-1">Orders you place will show up here.</p>
    </div>
  );
}

function ErrorState({ onRetry }) {
  return (
    <div className="text-center py-16 px-4">
      <AlertTriangle size={28} className="mx-auto mb-3" color={RED} />
      <p className="font-medium text-slate-900 mb-1">Couldn't load your orders</p>
      <button onClick={onRetry} className="mt-3 px-5 py-2 rounded-full font-medium text-white text-sm" style={{ backgroundColor: GREEN }}>
        Retry
      </button>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
      ))}
    </div>
  );
}

/**
 * OrdersListPage
 * ---------------
 * Wired to the real GET /api/checkout/orders?userId=xxx endpoint.
 * Client-side filter (status bucket) and sort (date / amount) — the
 * endpoint doesn't support server-side filtering/sorting params today,
 * so this operates on the full returned list. If a user's order history
 * grows large, add ?status=&sort= support server-side and pass through
 * here instead of filtering client-side.
 */
export default function OrdersListPage({ userId }) {
  const { orders, loading, error, refetch } = useUserOrders(userId);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("date_desc");

  const filtered = useMemo(() => {
    if (!orders) return [];
    let list = orders;
    const activeFilter = FILTERS.find((f) => f.key === filter);
    if (activeFilter?.statuses) {
      list = list.filter((o) => activeFilter.statuses.includes(o.status));
    }
    list = [...list].sort((a, b) => {
      if (sort === "date_desc") return new Date(b.created_at) - new Date(a.created_at);
      if (sort === "date_asc") return new Date(a.created_at) - new Date(b.created_at);
      if (sort === "amount_desc") return b.final_amount - a.final_amount;
      if (sort === "amount_asc") return a.final_amount - b.final_amount;
      return 0;
    });
    return list;
  }, [orders, filter, sort]);

  return (
    <div className="min-h-screen bg-slate-50" style={{ fontFamily: "system-ui, -apple-system, sans-serif" }}>
      <header className="bg-white px-4 py-4 border-b border-slate-100 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-slate-900">My Orders</h1>
      </header>

      <div className="px-4 pt-4 flex items-center gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className="px-3.5 py-1.5 rounded-full text-sm font-medium flex-shrink-0 transition-colors"
            style={{
              backgroundColor: filter === f.key ? GREEN : "#fff",
              color: filter === f.key ? "#fff" : "#475569",
              border: filter === f.key ? "none" : "1px solid #e2e8f0",
            }}
          >
            {f.label}
          </button>
        ))}
        <button
          onClick={() =>
            setSort((s) => (s === "date_desc" ? "date_asc" : s === "date_asc" ? "amount_desc" : s === "amount_desc" ? "amount_asc" : "date_desc"))
          }
          className="ml-auto flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium text-slate-600 border border-slate-200 flex-shrink-0"
          aria-label="Change sort order"
        >
          <ArrowUpDown size={13} />
          {{ date_desc: "Newest", date_asc: "Oldest", amount_desc: "Highest", amount_asc: "Lowest" }[sort]}
        </button>
      </div>

      <main className="px-4 pt-3 pb-8 max-w-lg mx-auto">
        {loading && <Skeleton />}
        {!loading && error && <ErrorState onRetry={refetch} />}
        {!loading && !error && filtered.length === 0 && <EmptyState filter={filter} />}
        {!loading && !error && filtered.length > 0 && (
          <div className="space-y-3">
            {filtered.map((order) => (
              <OrderRow key={order.id} order={order} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}