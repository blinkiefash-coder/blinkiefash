import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useSmartBack } from '../utils/navigation';
import { MdArrowBack } from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { getOrderById } from '../api';                 // ← changed
import Navbar from '../components/Navbar';
import Loader from '../components/Loader';
import PageSEO from '../components/PageSEO';
import './Orderdetail.css';

/* =====================================================================
   Status → visual treatment
   ===================================================================== */
const STATUS_META = {
  pending:            { label: 'Order Placed',       tone: 'amber',   category: 'active' },
  confirmed:          { label: 'Confirmed',          tone: 'amber',   category: 'active' },
  processing:         { label: 'Processing',         tone: 'amber',   category: 'active' },
  packed:             { label: 'Confirmed',          tone: 'amber',   category: 'active' },
  shipped:            { label: 'Shipped',            tone: 'info',    category: 'active' },
  out_for_delivery:   { label: 'Out for delivery',   tone: 'info',    category: 'active' },
  delivered:          { label: 'Delivered',          tone: 'success', category: 'delivered' },
  cancelled:          { label: 'Cancelled',          tone: 'danger',  category: 'cancelled' },
  return_requested:   { label: 'Return requested',   tone: 'warning', category: 'return' },
  return_in_progress: { label: 'Return in progress', tone: 'warning', category: 'return' },
  returned:           { label: 'Returned',           tone: 'muted',   category: 'return' },
};

function statusMeta(raw) {
  const key = String(raw || '').toLowerCase().replace(/\s+/g, '_');
  return STATUS_META[key] || { label: raw || 'Order placed', tone: 'muted', category: 'active' };
}

const STEPS = [
  { key: 'ordered', label: 'Ordered', dateField: 'created_at' },
  { key: 'confirmed', label: 'Confirmed', dateField: 'confirmed_at' },
  { key: 'shipped', label: 'Shipped', dateField: 'shipped_at' },
  { key: 'out_for_delivery', label: 'Out for delivery', dateField: 'out_for_delivery_at' },
  { key: 'delivered', label: 'Delivered', dateField: 'delivered_at' },
];

function currentStepIndex(status) {
  const key = String(status || '').toLowerCase().replace(/\s+/g, '_');
  if (key === 'pending') return 0;
  if (['confirmed', 'processing', 'packed'].includes(key)) return 1;
  if (key === 'shipped') return 2;
  if (key === 'out_for_delivery') return 3;
  if (key === 'delivered') return 4;
  return 0;
}

/* ---------- icons ---------- */
const IconCheck = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="3">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);
const IconTruck = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.1">
    <path d="M2 8h11v9H2z" />
    <path d="M13 11h4l4 3v3h-8z" />
    <circle cx="6.5" cy="19" r="1.6" />
    <circle cx="17" cy="19" r="1.6" />
  </svg>
);
const IconHeadset = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
    <rect x="2.5" y="13" width="4.5" height="6" rx="1.4" />
    <rect x="17" y="13" width="4.5" height="6" rx="1.4" />
    <path d="M19.5 19v.5A3.5 3.5 0 0 1 16 23h-2" />
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
const IconPin = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M12 21s7-6.1 7-11.5A7 7 0 0 0 5 9.5C5 14.9 12 21 12 21z" />
    <circle cx="12" cy="9.5" r="2.4" />
  </svg>
);
const IconCard = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
    <rect x="2.5" y="5" width="19" height="14" rx="2" />
    <path d="M2.5 10h19" />
  </svg>
);
const IconReceipt = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M6 2h12v20l-3-2-3 2-3-2-3 2z" />
    <path d="M8.5 8h7M8.5 12h7" />
  </svg>
);
const IconFile = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8">
    <path d="M7 3h7l4 4v14H7z" />
    <path d="M14 3v4h4" />
  </svg>
);
const IconReturnBox = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.9">
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
const IconInfo = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 11v5M12 8h.01" />
  </svg>
);
const IconAlert = () => (
  <svg viewBox="0 0 24 24" width="36" height="36" fill="none" stroke="currentColor" strokeWidth="1.6">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 8v5M12 16h.01" />
  </svg>
);
const IconBag = () => (
  <svg viewBox="0 0 24 24" width="40" height="40" fill="none" stroke="currentColor" strokeWidth="1.6">
    <path d="M6 7h12l1 13H5z" />
    <path d="M9 7a3 3 0 0 1 6 0" />
  </svg>
);

/* ---------- helpers ---------- */
function formatDateTime(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;

  const date = d.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const time = d.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });

  return { date, time, full: `${date}, ${time}` };
}

function formatAmount(value) {
  const n = Number(value || 0);
  return `₹${n.toLocaleString('en-IN')}`;
}

/** Same field resolution OrderTracking uses + a few extra fallbacks */
function resolveAddress(order, user) {
  if (!order) return {};

  // Nested object first (what getOrderById returns)
  const nested =
    order.address ||
    order.shipping_address ||
    order.delivery_address ||
    null;

  if (nested && typeof nested === 'object' && Object.keys(nested).length > 0) {
    return {
      name: nested.name || order.customer_name || order.name || user?.name,
      address_line: nested.address_line || nested.line1 || '',
      line1: nested.address_line || nested.line1 || '',
      city: nested.city || '',
      state: nested.state || '',
      pincode: nested.pincode || nested.pin_code || '',
      phone: nested.phone || nested.mobile || order.phone || '',
    };
  }

  // Flattened fields on the order itself (fallback)
  return {
    name: order.customer_name || order.name || user?.name,
    address_line: order.address_line || order.line1 || '',
    line1: order.address_line || order.line1 || '',
    city: order.city || '',
    state: order.state || '',
    pincode: order.pincode || order.pin_code || '',
    phone: order.phone || order.mobile || '',
  };
}

function buildFullAddress(address = {}, fallbackName = '') {
  if (!address) return '';
  if (typeof address === 'string' && address.trim()) return address.trim();

  const parts = [];

  const name = address.name || address.full_name || address.recipient_name || fallbackName;
  if (name) parts.push(name);

  const line1 =
    address.address_line ||
    address.line1 ||
    address.address_line1 ||
    address.street ||
    address.address;
  if (line1) parts.push(line1);

  const line2 = address.line2 || address.landmark || address.area;
  if (line2) parts.push(line2);

  const cityStatePin = [address.city, address.state, address.pincode]
    .filter(Boolean)
    .join(', ');
  if (cityStatePin) parts.push(cityStatePin);

  return parts.filter(Boolean).join('\n');
}

export default function OrderDetails() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const goBack = useSmartBack('/orders');
  const { openAuthModal } = useAuthModal();
  const { user, isLoggedIn } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(isLoggedIn);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isLoggedIn || !orderId) return;

    let cancelled = false;

    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError('');

    // ← same API OrderTracking uses – returns full address
    getOrderById(orderId)
      .then((res) => {
        if (cancelled) return;
        const found = res.order || res;
        if (!found || !(found.id || found.order_id || found.orderId)) {
          setError('We couldn’t find this order.');
        } else {
          setOrder(found);
        }
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this order');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, orderId]);

  const meta = useMemo(() => (order ? statusMeta(order.status) : null), [order]);
  const stepIndex = useMemo(() => (order ? currentStepIndex(order.status) : 0), [order]);

  const rawAddress = resolveAddress(order, user);

  const payment = order?.payment || {};
  const priceDetails = {
    itemTotal: order?.item_total ?? order?.total_amount ?? 0,
    discount: order?.discount ?? 0,
    delivery: order?.delivery_charge ?? 0,
    total: order?.final_amount ?? order?.total_amount ?? 0,
  };

  const goToReview = () => navigate(`/orders/${order.id}/review`);
  const goToBuyAgain = () => {
    const item = order.items?.[0];
    const productId = item?.product_id || item?.id;
    navigate(productId ? `/product/${productId}` : '/');
  };
  const goToNeedHelp = () => navigate(`/complain?orderId=${encodeURIComponent(order.id)}`);
  const goToTrack = () => navigate(`/orders/${order.id}/track`);

  const canReturnExchange =
    meta?.category === 'delivered' && !order?.try_and_buy && !order?.return_disabled;

  const displayOrderId = order?.order_number || order?.order_id || order?.id;

  if (!isLoggedIn) {
    return (
      <>
        <Navbar />
        <div className="page order-details-page">
          <PageSEO
            title="Order Details"
            description="View your order details on Blinkiefash."
            path={`/orders/${orderId}`}
            noIndex
          />
          <div className="od-empty">
            <button type="button" className="od-back" onClick={goBack} aria-label="Go back">
              <MdArrowBack />
            </button>
            <div className="od-empty-icon">
              <IconBag />
            </div>
            <p className="od-state-msg">Log in to view this order.</p>
            <button
              type="button"
              className="od-primary-btn"
              onClick={() => openAuthModal('login')}
            >
              Log in
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page order-details-page">
        <PageSEO
          title="Order Details"
          description="Track and manage your Blinkiefash order."
          path={`/orders/${orderId}`}
          noIndex
        />

        <div className="od-inner">
          {loading && <Loader label="Loading order..." />}

          {!loading && error && (
            <div className="od-empty">
              <button type="button" className="od-back" onClick={goBack} aria-label="Go back">
                <MdArrowBack />
              </button>
              <div className="od-empty-icon danger">
                <IconAlert />
              </div>
              <p className="od-state-msg">{error}</p>
              <button
                type="button"
                className="od-primary-btn"
                onClick={() => navigate('/orders')}
              >
                Back to orders
              </button>
            </div>
          )}

          {!loading && !error && order && (
            <>
              {/* ---------- HEADER ---------- */}
              <div className="od-header">
                <div className="od-header-top">
                  <button type="button" className="od-back" onClick={goBack} aria-label="Go back">
                    <MdArrowBack />
                    <span>Back</span>
                  </button>
                  <button type="button" className="od-need-help-link" onClick={goToNeedHelp}>
                    <IconHeadset /> <span>Need Help?</span>
                  </button>
                </div>
                <div className="od-title-block">
                  <h1 className="od-title">Order Details</h1>
                  <p className="od-subtitle">
                    Order ID: <strong>{displayOrderId}</strong>
                    {formatDateTime(order.created_at) && (
                      <> &nbsp;|&nbsp; Placed on {formatDateTime(order.created_at).full}</>
                    )}
                  </p>
                </div>
              </div>

              <div className="od-grid">
                {/* ---------- LEFT COLUMN ---------- */}
                <div className="od-main-col">
                  {/* Status banner */}
                  <div className={`od-status-banner tone-${meta.tone}`}>
                    <div className="od-status-banner-left">
                      <span className="od-status-icon">
                        <IconCheck />
                      </span>
                      <div>
                        <h2>{meta.label}</h2>
                        <p>
                          {meta.category === 'delivered' &&
                            formatDateTime(order.delivered_at) && (
                              <>
                                Your order was delivered on{' '}
                                <strong>{formatDateTime(order.delivered_at).full}</strong>
                              </>
                            )}
                          {meta.category === 'cancelled' &&
                            formatDateTime(order.cancelled_at) && (
                              <>
                                Your order was cancelled on{' '}
                                <strong>{formatDateTime(order.cancelled_at).full}</strong>
                              </>
                            )}
                          {meta.category === 'return' &&
                            (order.return_note || 'Your return is being processed.')}
                          {meta.category === 'active' &&
                            (order.eta_text || 'We’ll notify you as your order progresses.')}
                        </p>
                      </div>
                    </div>
                    {meta.category !== 'cancelled' && (
                      <button type="button" className="od-outline-btn" onClick={goToTrack}>
                        <IconTruck />{' '}
                        {meta.category === 'active' ? 'Track Order' : 'Track Again'}
                      </button>
                    )}
                  </div>

                  {/* Step tracker */}
                  {meta.category !== 'cancelled' && (
                    <div className="od-tracker" id="od-tracker">
                      {STEPS.map((step, i) => {
                        const done = i <= stepIndex;
                        const dt = formatDateTime(order[step.dateField]);
                        return (
                          <div className={`od-step${done ? ' done' : ''}`} key={step.key}>
                            <div className="od-step-line-wrap">
                              {i > 0 && (
                                <span
                                  className={`od-step-line${i <= stepIndex ? ' done' : ''}`}
                                />
                              )}
                              <span className="od-step-dot">{done && <IconCheck />}</span>
                            </div>
                            <span className="od-step-label">{step.label}</span>
                            {dt && (
                              <span className="od-step-date">
                                {dt.date}
                                <br />
                                {dt.time}
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Items */}
                  <div className="od-card od-items-card">
                    <h3 className="od-card-title">
                      Item(s) ({order.items?.length || 0})
                    </h3>

                    {(order.items || []).map((item, idx) => (
                      <div className="od-item-row" key={item.id || idx}>
                        {item.image || item.image_url ? (
                          <img
                            className="od-item-image"
                            src={item.image || item.image_url}
                            alt=""
                          />
                        ) : (
                          <div className="od-item-image placeholder" />
                        )}
                        <div className="od-item-info">
                          <h4>{item.name || item.title}</h4>
                          <p className="od-item-meta">
                            {[item.color, item.size].filter(Boolean).join(' · ')}
                            {item.color || item.size ? ' · ' : ''}
                            Qty: {item.qty || item.quantity || 1}
                          </p>
                          <p className="od-item-price">
                            {formatAmount(item.price ?? priceDetails.itemTotal)}
                          </p>

                          {idx === 0 && meta.category === 'delivered' && (
                            <div className="od-item-actions">
                              <button
                                type="button"
                                className="od-outline-btn"
                                onClick={goToReview}
                              >
                                <IconStar /> Rate &amp; Review
                              </button>
                              <button
                                type="button"
                                className="od-filled-btn"
                                onClick={goToBuyAgain}
                              >
                                <IconCart /> Buy Again
                              </button>
                            </div>
                          )}
                        </div>
                      </div>
                    ))}

                    {order.try_and_buy && (
                      <div className="od-tryandbuy-note">
                        <span className="od-tryandbuy-icon">
                          <IconBag />
                        </span>
                        <div>
                          <h4>Try and Buy Order</h4>
                          <p>
                            This order was placed using Try and Buy. Since payment was
                            made after trying the product,{' '}
                            <strong>Return/Exchange is not applicable for this order.</strong>
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="od-item-links">
                      <button
                        type="button"
                        className="od-link-row"
                        onClick={() => window.open(order.invoice_url || '#', '_blank')}
                      >
                        <span>
                          <IconFile /> Download Invoice
                        </span>
                        <IconChevron />
                      </button>

                      <button
                        type="button"
                        className={`od-link-row${canReturnExchange ? '' : ' disabled'}`}
                        disabled={!canReturnExchange}
                        onClick={() =>
                          canReturnExchange && navigate(`/orders/${order.id}/return`)
                        }
                      >
                        <span>
                          <IconReturnBox /> Return / Exchange
                          {!canReturnExchange && <em>Not available for this order</em>}
                        </span>
                        {!canReturnExchange ? <IconInfo /> : <IconChevron />}
                      </button>

                      <button type="button" className="od-link-row" onClick={goToNeedHelp}>
                        <span>
                          <IconHeadset /> Need help with this item?
                        </span>
                        <IconChevron />
                      </button>
                    </div>
                  </div>
                </div>

                {/* ---------- RIGHT COLUMN ---------- */}
                <div className="od-side-col">
                  {/* Delivery Address */}
                  <div className="od-card">
                    <div className="od-card-head">
                      <h3 className="od-card-title">
                        <IconPin /> Delivery Address
                      </h3>
                      <button
                        type="button"
                        className="od-edit-link"
                        onClick={() => navigate('/addresses')}
                      >
                        Edit
                      </button>
                    </div>

                    {(() => {
                      const full = buildFullAddress(rawAddress, user?.name);
                      const lines = full ? full.split('\n').filter(Boolean) : [];

                      const nameLine =
                        lines[0] ||
                        rawAddress.name ||
                        user?.name ||
                        '—';

                      const addressLines = lines.length > 1 ? lines.slice(1) : [];

                      const phone = rawAddress.phone || rawAddress.mobile;

                      return (
                        <>
                          <p className="od-address-name">{nameLine}</p>

                          {addressLines.length > 0 ? (
                            <p className="od-address-text">
                              {addressLines.map((line, i) => (
                                <span key={i}>
                                  {line}
                                  {i < addressLines.length - 1 && <br />}
                                </span>
                              ))}
                            </p>
                          ) : (
                            <p className="od-address-text">
                              {[
                                rawAddress.address_line,
                                rawAddress.line1,
                                rawAddress.city,
                                rawAddress.pincode,
                              ]
                                .filter(Boolean)
                                .join(', ') || 'Address details not available'}
                            </p>
                          )}

                          {phone && (
                            <p className="od-address-phone">+91 {phone}</p>
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Payment */}
                  <div className="od-card">
                    <h3 className="od-card-title">
                      <IconCard /> Payment Details
                    </h3>
                    <p className="od-payment-line">
                      Paid via {payment.method || 'Online Payment'}
                      {payment.transaction_id && (
                        <>
                          <br />
                          Transaction ID: {payment.transaction_id}
                        </>
                      )}
                    </p>
                    <span className="od-payment-amount">
                      {formatAmount(priceDetails.total)}
                    </span>
                  </div>

                  {/* Price details */}
                  <div className="od-card">
                    <h3 className="od-card-title">
                      <IconReceipt /> Price Details
                    </h3>
                    <div className="od-price-row">
                      <span>Item Total</span>
                      <span>{formatAmount(priceDetails.itemTotal)}</span>
                    </div>
                    <div className="od-price-row">
                      <span>Discount</span>
                      <span className="discount">
                        {priceDetails.discount
                          ? `- ${formatAmount(priceDetails.discount)}`
                          : formatAmount(0)}
                      </span>
                    </div>
                    <div className="od-price-row">
                      <span>Delivery Charges</span>
                      <span>
                        {priceDetails.delivery
                          ? formatAmount(priceDetails.delivery)
                          : 'Free'}
                      </span>
                    </div>
                    <div className="od-price-divider" />
                    <div className="od-price-row total">
                      <span>Total Paid</span>
                      <span>{formatAmount(priceDetails.total)}</span>
                    </div>
                  </div>

                  {/* Help card */}
                  <div className="od-help-card">
                    <span className="od-help-icon">
                      <IconHeadset />
                    </span>
                    <div className="od-help-text">
                      <h4>Need more help?</h4>
                      <p>Our support team is here for you.</p>
                    </div>
                    <button
                      type="button"
                      className="od-outline-btn full"
                      onClick={goToNeedHelp}
                    >
                      Contact Support
                    </button>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}