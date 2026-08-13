import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrders } from '../api';
import Loader from '../components/Loader';
import './Orders.css';
import PageSEO from '../components/PageSEO';

/* ---------- status → visual treatment ---------- */
const STATUS_MAP = {
  delivered: { label: 'Delivered', tone: 'success' },
  shipped: { label: 'Shipped', tone: 'info' },
  out_for_delivery: { label: 'Out for delivery', tone: 'info' },
  confirmed: { label: 'Confirmed', tone: 'amber' },
  processing: { label: 'Processing', tone: 'amber' },
  pending: { label: 'Pending', tone: 'amber' },
  cancelled: { label: 'Cancelled', tone: 'danger' },
  returned: { label: 'Returned', tone: 'muted' },
};

function statusInfo(raw) {
  const key = String(raw || '').toLowerCase().replace(/\s+/g, '_');
  return STATUS_MAP[key] || { label: raw || 'Order placed', tone: 'muted' };
}

const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconTruck = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M2 8h11v9H2z" />
    <path d="M13 11h4l4 3v3h-8z" />
    <circle cx="6.5" cy="19" r="1.6" />
    <circle cx="17" cy="19" r="1.6" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconBox = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 8 12 3 3 8l9 5 9-5z" />
    <path d="M3 8v9l9 5 9-5V8M12 13v9" />
  </svg>
);
const IconChevron = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m9 18 6-6-6-6" />
  </svg>
);
const IconEmptyBag = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 7h12l1 13H5z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);
const IconAlert = () => (
  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);

const TONE_ICON = {
  success: <IconCheck />,
  info: <IconTruck />,
  amber: <IconClock />,
  danger: <IconX />,
  muted: <IconBox />,
};

function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAmount(value) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function Orders() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }
    getOrders(user.id)
      .then((res) => setOrders(res.orders || []))
      .catch((err) => setError(err.message || 'Could not load orders'))
      .finally(() => setLoading(false));
  }, [isLoggedIn, user]);

  if (!isLoggedIn) {
    return (
      <div className="page orders-page">
        <PageSEO title="Your Orders" description="View your order history on Blinkiefash." path="/orders" noIndex />
        <div className="orders-inner">
          <div className="orders-empty">
            <div className="orders-empty-icon"><IconEmptyBag /></div>
            <h1 className="orders-title">Your orders</h1>
            <p className="orders-state-msg">Log in to view your orders.</p>
            <button type="button" className="primary-btn" onClick={() => navigate('/login')}>
              Log in
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page orders-page">
      <PageSEO title="Your Orders" description="View your order history on Blinkiefash." path="/orders" noIndex />

      <div className="orders-inner">
        <div className="orders-header">
          <h1 className="orders-title">My Orders</h1>
          <p className="orders-subtitle">Track deliveries, view items, or start a return.</p>
        </div>

        {loading && <Loader label="Loading orders..." />}

        {!loading && error && (
          <div className="orders-empty">
            <div className="orders-empty-icon danger"><IconAlert /></div>
            <p className="orders-state-msg">{error}</p>
          </div>
        )}

        {!loading && !error && orders.length === 0 && (
          <div className="orders-empty">
            <div className="orders-empty-icon"><IconEmptyBag /></div>
            <p className="orders-state-msg">No orders yet</p>
            <p className="orders-state-sub">Everything you order will show up here.</p>
            <button type="button" className="primary-btn" onClick={() => navigate('/')}>
              Start shopping
            </button>
          </div>
        )}

        {!loading && !error && orders.length > 0 && (
          <div className="orders-list">
            {orders.map((order) => {
              const { label, tone } = statusInfo(order.status);
              const itemCount = order.items?.length || 0;
              return (
                <div
                  className="order-card"
                  key={order.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate(`/orders/${order.id}`)}
                  onKeyDown={(e) => e.key === 'Enter' && navigate(`/orders/${order.id}`)}
                >
                  <span className={`order-status-icon tone-${tone}`}>{TONE_ICON[tone]}</span>

                  <div className="order-card-body">
                    <div className="order-card-top">
                      <span className={`order-status tone-${tone}`}>{label}</span>
                      <span className="order-amount">{formatAmount(order.final_amount ?? order.total_amount)}</span>
                    </div>
                    <p className="order-meta">
                      {itemCount} item{itemCount === 1 ? '' : 's'} &middot; {formatDate(order.created_at)}
                    </p>
                  </div>

                  <span className="order-chevron"><IconChevron /></span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}