import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmartBack } from '../utils/navigation';
import { MdArrowBack, MdSearch, MdFilterList } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { getOrders } from '../api';
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import './Orders.css';
import PageSEO from '../components/PageSEO';

/* ---------- status → visual treatment ---------- */
// category: 'active' (has a live tracking timeline) | 'delivered' | 'cancelled' | 'return'
const STATUS_META = {
  pending:            { label: 'Order Placed',     tone: 'amber',  category: 'active' },
  confirmed:          { label: 'Confirmed',        tone: 'amber',  category: 'active' },
  processing:         { label: 'Processing',       tone: 'amber',  category: 'active' },
  packed:             { label: 'Packed',           tone: 'amber',  category: 'active' },
  shipped:            { label: 'Shipped',          tone: 'info',   category: 'active' },
  out_for_delivery:   { label: 'Out for delivery', tone: 'info',   category: 'active' },
  delivered:          { label: 'Delivered',        tone: 'success', category: 'delivered' },
  cancelled:          { label: 'Cancelled',        tone: 'danger', category: 'cancelled' },
  return_requested:   { label: 'Return requested', tone: 'warning', category: 'return' },
  return_in_progress: { label: 'Return in progress', tone: 'warning', category: 'return' },
  returned:           { label: 'Returned',         tone: 'muted',  category: 'return' },
};

function statusMeta(raw) {
  const key = String(raw || '').toLowerCase().replace(/\s+/g, '_');
  return STATUS_META[key] || { label: raw || 'Order placed', tone: 'muted', category: 'active' };
}

// Steps shown in the active-order tracker
const STEPS = [
  { key: 'ordered', label: 'Ordered' },
  { key: 'packed', label: 'Packed' },
  { key: 'shipped', label: 'Shipped' },
  { key: 'out_for_delivery', label: 'Out for delivery' },
  { key: 'delivered', label: 'Delivered' },
];

// Map a live order status to how far along the tracker it is (index into STEPS, 0-3;
// 'delivered' orders are rendered by the separate delivered-card branch instead).
function currentStepIndex(status) {
  const key = String(status || '').toLowerCase().replace(/\s+/g, '_');
  if (['pending', 'confirmed'].includes(key)) return 0;
  if (['processing', 'packed'].includes(key)) return 1;
  if (key === 'shipped') return 2;
  if (key === 'out_for_delivery') return 3;
  return 0;
}

/* ---------- icons ---------- */
const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconBolt = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor" stroke="none">
    <path d="M13 2 3 14h7l-1 8 10-12h-7z" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3.5 2" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconReturnBox = () => (
  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.2">
    <path d="M21 8 12 3 3 8l9 5 9-5z" />
    <path d="M3 8v9l9 5 9-5V8" />
    <path d="M12 13v9M7.5 10.3 16.5 5.7" />
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
const IconStar = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m12 2 3.1 6.6 7.2.9-5.3 5 1.4 7.2L12 18.3 5.6 21.7 7 14.5l-5.3-5 7.2-.9z" />
  </svg>
);
const IconCart = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="9" cy="21" r="1.4" />
    <circle cx="18" cy="21" r="1.4" />
    <path d="M2.5 3h2l2.6 12.2a2 2 0 0 0 2 1.6h7.8a2 2 0 0 0 2-1.6L21 7H6" />
  </svg>
);
const IconTruck = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2.1">
    <path d="M2 8h11v9H2z" />
    <path d="M13 11h4l4 3v3h-8z" />
    <circle cx="6.5" cy="19" r="1.6" />
    <circle cx="17" cy="19" r="1.6" />
  </svg>
);
const IconHeadset = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
    <rect x="2.5" y="13" width="4.5" height="6" rx="1.4" />
    <rect x="17" y="13" width="4.5" height="6" rx="1.4" />
    <path d="M19.5 19v.5A3.5 3.5 0 0 1 16 23h-2" />
  </svg>
);

const BADGE_ICON = {
  active: null, // resolved per-status below
  delivered: <IconCheck />,
  cancelled: <IconX />,
  return: <IconReturnBox />,
};

function badgeIcon(status, category) {
  const key = String(status || '').toLowerCase().replace(/\s+/g, '_');
  if (category === 'active') return key === 'out_for_delivery' ? <IconBolt /> : <IconClock />;
  return BADGE_ICON[category];
}

/* ---------- formatting helpers ---------- */
function formatDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const datePart = d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  const timePart = d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${datePart} · ${timePart}`;
}

function formatAmount(value) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

function itemMetaLine(order) {
  const items = order.items || [];
  const first = items[0] || {};
  const count = items.length;
  const parts = [first.color, first.size].filter(Boolean);
  parts.push(`${count} item${count === 1 ? '' : 's'}`);
  return parts.join(' · ');
}

/* ---------- filters ---------- */
const FILTERS = [
  { key: 'all', label: 'All orders' },
  { key: 'active', label: 'Ordered / Shipped' },
  { key: 'delivered', label: 'Delivered' },
  { key: 'cancelled', label: 'Cancelled' },
  { key: 'return', label: 'Returns' },
];

export default function Orders() {
  const navigate = useNavigate();
  const goBack = useSmartBack('/');
  const { openAuthModal } = useAuthModal();
  const { user, isLoggedIn } = useAuth();
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [filterOpen, setFilterOpen] = useState(false);

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

  const visibleOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    return orders.filter((order) => {
      const category = statusMeta(order.status).category;
      if (filter !== 'all' && category !== filter) return false;
      if (!term) return true;
      const firstItemName = order.items?.[0]?.name || order.items?.[0]?.title || '';
      const haystack = `${order.id} ${firstItemName}`.toLowerCase();
      return haystack.includes(term);
    });
  }, [orders, search, filter]);

  /* ---------- actions ---------- */
  const goToDetails = (order) => navigate(`/orders/${order.id}`);
  const goToTrack = (order) => navigate(`/orders/${order.id}`);
  const goToReview = (order, e) => {
    e.stopPropagation();
    navigate(`/orders/${order.id}/review`);
  };
  const goToBuyAgain = (order, e) => {
    e.stopPropagation();
    const item = order.items?.[0];
    const productId = item?.product_id || item?.id;
    navigate(productId ? `/product/${productId}` : '/');
  };
  const goToNeedHelp = (order, e) => {
    e.stopPropagation();
    navigate(`/complain?orderId=${encodeURIComponent(order.id)}`);
  };
  const goToTrackReturn = (order, e) => {
    e.stopPropagation();
    navigate(`/orders/${order.id}`);
  };
  const goToDetailsBtn = (order, e) => {
    e.stopPropagation();
    navigate(`/orders/${order.id}`);
  };

  if (!isLoggedIn) {
    return (
      <>
        <Navbar />
        <div className="page orders-page">
          <PageSEO title="Your Orders" description="View your order history on Blinkiefash." path="/orders" noIndex />
          <div className="orders-inner">
            <div className="orders-empty">
              <button type="button" className="orders-back" onClick={goBack} aria-label="Go back">
                <MdArrowBack />
              </button>
              <div className="orders-empty-icon"><IconEmptyBag /></div>
              <h1 className="orders-title">Your orders</h1>
              <p className="orders-state-msg">Log in to view your orders.</p>
              <button type="button" className="primary-btn" onClick={() => openAuthModal('login')}>
                Log in
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page orders-page">
        <PageSEO title="Your Orders" description="View your order history on Blinkiefash." path="/orders" noIndex />

        <div className="orders-inner">
          <div className="orders-header">
            <div className="orders-title-row">
              <button type="button" className="orders-back" onClick={goBack} aria-label="Go back">
                <MdArrowBack />
              </button>
              <div>
                <h1 className="orders-title">My Orders</h1>
                <p className="orders-subtitle">Track, manage and shop again.</p>
              </div>
            </div>

            <div className="orders-toolbar">
              <div className="orders-search">
                <MdSearch className="orders-search-icon" />
                <input
                  type="text"
                  placeholder="Search orders, products or order ID"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <div className="orders-filter-wrap">
                <button
                  type="button"
                  className={`orders-filter-btn${filter !== 'all' ? ' active' : ''}`}
                  onClick={() => setFilterOpen((v) => !v)}
                >
                  <MdFilterList />
                  Filter
                </button>
                {filterOpen && (
                  <div className="orders-filter-menu" onMouseLeave={() => setFilterOpen(false)}>
                    {FILTERS.map((f) => (
                      <button
                        type="button"
                        key={f.key}
                        className={`orders-filter-option${filter === f.key ? ' selected' : ''}`}
                        onClick={() => {
                          setFilter(f.key);
                          setFilterOpen(false);
                        }}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
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

          {!loading && !error && orders.length > 0 && visibleOrders.length === 0 && (
            <div className="orders-empty">
              <div className="orders-empty-icon"><IconEmptyBag /></div>
              <p className="orders-state-msg">No matching orders</p>
              <p className="orders-state-sub">Try a different search term or filter.</p>
            </div>
          )}

          {!loading && !error && visibleOrders.length > 0 && (
            <div className="orders-list">
              {visibleOrders.map((order) => {
                const { label, tone, category } = statusMeta(order.status);
                const firstItem = order.items?.[0];
                const firstImage = firstItem?.image || firstItem?.image_url;
                const stepIdx = category === 'active' ? currentStepIndex(order.status) : null;

                return (
                  <div
                    className="order-card"
                    key={order.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => goToDetails(order)}
                    onKeyDown={(e) => e.key === 'Enter' && goToDetails(order)}
                  >
                    <div className="order-card-top-row">
                      {firstImage ? (
                        <img className="order-card-image" src={firstImage} alt="" />
                      ) : (
                        <div className="order-card-image placeholder" />
                      )}

                      <div className="order-card-main">
                        <div className="order-card-badges">
                          <span className={`order-status-badge tone-${tone}`}>
                            {badgeIcon(order.status, category)}
                            {label}
                          </span>
                          {order.express && <span className="order-express-tag">Blinkie Express</span>}
                        </div>

                        <h3 className="order-item-name">
                          {firstItem?.name || firstItem?.title || 'Order'}
                        </h3>
                        <p className="order-meta">{itemMetaLine(order)}</p>

                        {category === 'delivered' && (
                          <p className="order-substatus success">Delivered on {formatDate(order.delivered_at || order.updated_at || order.created_at)}</p>
                        )}
                        {category === 'cancelled' && (
                          <p className="order-substatus danger">Cancelled on {formatDate(order.cancelled_at || order.updated_at || order.created_at)}</p>
                        )}
                        {category === 'return' && (
                          <p className="order-substatus warning">{order.return_note || 'Return pickup scheduled'}</p>
                        )}
                        {category === 'active' && order.eta_text && (
                          <p className="order-substatus success">{order.eta_text}</p>
                        )}
                      </div>

                      <div className="order-card-price-col">
                        <span className="order-amount">{formatAmount(order.final_amount ?? order.total_amount)}</span>
                        <span className="order-chevron"><IconChevron /></span>
                      </div>
                    </div>

                    {category === 'active' && (
                      <div className="order-tracker">
                        {STEPS.map((step, i) => {
                          const done = i <= stepIdx;
                          const isCurrent = i === stepIdx;
                          const dateKey = order.timeline?.[step.key];
                          return (
                            <div className="order-tracker-step" key={step.key}>
                              <div className="order-tracker-line-wrap">
                                {i > 0 && <span className={`order-tracker-line${i <= stepIdx ? ' done' : ''}`} />}
                                <span className={`order-tracker-dot${done ? ' done' : ''}${isCurrent ? ' current' : ''}`}>
                                  {done && <IconCheck />}
                                </span>
                              </div>
                              <span className={`order-tracker-label${isCurrent ? ' current' : ''}`}>{step.label}</span>
                              {dateKey && <span className="order-tracker-date">{formatDateTime(dateKey)}</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    <div className="order-card-actions">
                      {category === 'active' && (
                        <button type="button" className="order-btn filled" onClick={(e) => { e.stopPropagation(); goToTrack(order); }}>
                          <IconTruck /> Track Order
                        </button>
                      )}
                      {category === 'delivered' && (
                        <>
                          <button type="button" className="order-btn outline" onClick={(e) => goToReview(order, e)}>
                            <IconStar /> Rate &amp; Review
                          </button>
                          <button type="button" className="order-btn filled" onClick={(e) => goToBuyAgain(order, e)}>
                            <IconCart /> Buy Again
                          </button>
                        </>
                      )}
                      {category === 'cancelled' && (
                        <>
                          <button type="button" className="order-btn outline" onClick={(e) => goToDetailsBtn(order, e)}>
                            View Details
                          </button>
                          <button type="button" className="order-btn outline" onClick={(e) => goToNeedHelp(order, e)}>
                            <IconHeadset /> Need Help?
                          </button>
                        </>
                      )}
                      {category === 'return' && (
                        <>
                          <button type="button" className="order-btn outline" onClick={(e) => goToTrackReturn(order, e)}>
                            <IconReturnBox /> Track Return
                          </button>
                          <button type="button" className="order-btn outline" onClick={(e) => goToDetailsBtn(order, e)}>
                            View Details
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
}