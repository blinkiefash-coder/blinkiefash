import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import { API_API_BASE_URL } from "../apiBase";
import "../styles/featurePages.css";

const STATUS_CLASSES = {
  placed: "bf-status-placed",
  confirmed: "bf-status-confirmed",
  packed: "bf-status-packed",
  picked: "bf-status-picked",
  out_for_delivery: "bf-status-out",
  trial_started: "bf-status-trial",
  trial_completed: "bf-status-trial",
  delivered: "bf-status-delivered",
  completed: "bf-status-completed",
  cancelled: "bf-status-cancelled",
};

const STATUS_LABEL = {
  placed: "Placed",
  confirmed: "Confirmed",
  packed: "Packed",
  picked: "Picked up",
  out_for_delivery: "Out for delivery",
  trial_started: "Trial started",
  trial_completed: "Trial completed",
  delivered: "Delivered",
  completed: "Completed",
  cancelled: "Cancelled",
};

export default function Orders() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userUuid");
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_API_BASE_URL}/checkout/orders?userId=${userId}`);
        const data = await res.json();
        setOrders(data.orders || []);
      } catch {
        setError("Could not load your orders");
      } finally {
        setLoading(false);
      }
    })();
  }, [userId, navigate]);

  return (
    <div className="bf-feature-page">
      <Navbar />
      <div className="bf-feature-shell">
        <div>
          <h1 className="bf-section-title">My Orders</h1>
          <p className="bf-section-subtitle">Track your past and ongoing orders.</p>
        </div>

        {error && <div className="bf-notice error">{error}</div>}

        {loading ? (
          <div className="bf-empty">Loading orders…</div>
        ) : orders.length === 0 ? (
          <div className="bf-empty">
            <div className="bf-empty-icon">📦</div>
            <h3>No orders yet</h3>
            <p>When you place your first order, it'll show up here.</p>
            <button className="bf-btn-primary" onClick={() => navigate("/shop")}>
              Start shopping
            </button>
          </div>
        ) : (
          orders.map((order) => {
            const status = order.status || "placed";
            const statusCls = STATUS_CLASSES[status] || "bf-status-placed";
            return (
              <div
                key={order.id}
                className="bf-order-row"
                onClick={() => navigate(`/orders/${order.id}`)}
              >
                <div className="bf-order-row-head">
                  <div>
                    <div className="bf-order-row-id">
                      Order #{String(order.id).slice(0, 8).toUpperCase()}
                    </div>
                    <div className="bf-order-row-meta">
                      <span>{new Date(order.created_at).toLocaleString()}</span>
                      {order.is_try_order ? <span>• Try & Buy</span> : null}
                    </div>
                  </div>
                  <span className={`bf-status-badge ${statusCls}`}>
                    {STATUS_LABEL[status] || status}
                  </span>
                </div>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    marginTop: 6,
                  }}
                >
                  <div className="bf-order-row-meta">
                    {order.item_count ? `${order.item_count} item(s)` : ""}
                  </div>
                  <div className="bf-order-row-amt">
                    ₹{Number(order.final_amount || order.total_amount || 0).toFixed(0)}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
