import { useEffect, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrderById, cancelOrder } from '../api';
import Loader from '../components/Loader';
import './OrderTracking.css';

const STEPS = [
  { key: 'placed', label: 'Order Placed', icon: '📋' },
  { key: 'packed', label: 'Packed', icon: '📦' },
  { key: 'shipped', label: 'Out for Delivery', icon: '🛵' },
  { key: 'delivered', label: 'Delivered', icon: '🏠' },
];

export default function OrderTracking() {
  const { orderId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { isLoggedIn } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);
  const [showPlacedBanner, setShowPlacedBanner] = useState(!!location.state?.fromCheckout);

  useEffect(() => {
    if (!isLoggedIn || !orderId) return;

    let cancelled = false;
    let intervalId = null;
    const TERMINAL = ['delivered', 'cancelled'];
    const POLL_MS = 20000;

    const load = async (bg = false) => {
      try {
        if (!bg) setLoading(true);
        setError('');
        const res = await getOrderById(orderId);
        if (cancelled) return;
        const next = res.order || res;
        setOrder(next);
        if (TERMINAL.includes((next.status || '').toLowerCase())) stop();
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load order');
      } finally {
        if (!cancelled && !bg) setLoading(false);
      }
    };

    const start = () => {
      if (!intervalId) intervalId = setInterval(() => load(true), POLL_MS);
    };
    const stop = () => {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };

    const onVis = () => {
      if (document.hidden) stop();
      else {
        load(true);
        start();
      }
    };

    load();
    start();
    document.addEventListener('visibilitychange', onVis);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener('visibilitychange', onVis);
    };
  }, [orderId, isLoggedIn]);

  useEffect(() => {
    if (!showPlacedBanner) return;
    const t = setTimeout(() => setShowPlacedBanner(false), 5000);
    return () => clearTimeout(t);
  }, [showPlacedBanner]);

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;
    setCancelling(true);
    try {
      const res = await cancelOrder(orderId);
      const updated = res.order || res;
      setOrder((prev) => ({ ...prev, ...updated, status: updated?.status || 'cancelled' }));
    } catch (err) {
      alert(err.message || 'Failed to cancel order. Please try again.');
    } finally {
      setCancelling(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="ot-page">
        <div className="ot-empty">
          <p>Log in to track this order.</p>
          <button className="ot-btn primary" onClick={() => navigate('/login')}>Log in</button>
        </div>
      </div>
    );
  }

  if (loading) return <Loader label="Loading order..." />;

  if (error || !order) {
    return (
      <div className="ot-page">
        <div className="ot-empty">
          <p>{error || 'Order not found'}</p>
          <button className="ot-btn primary" onClick={() => navigate('/orders')}>Back to orders</button>
        </div>
      </div>
    );
  }

  const status = (order.status || 'placed').toLowerCase();
  const isCancelled = status === 'cancelled';

  let activeIndex = 0;
  if (['placed', 'pending'].includes(status)) activeIndex = 0;
  else if (['confirmed', 'processing', 'packed'].includes(status)) activeIndex = 1;
  else if (['picked', 'shipped', 'out_for_delivery'].includes(status)) activeIndex = 2;
  else if (status === 'delivered') activeIndex = 3;

  const orderNumber = order.order_number || order.orderId || order.id || orderId;
  const shortId = String(orderNumber).slice(-12).toUpperCase();

  const placedAt = order.created_at || order.createdAt;
  const placedText = placedAt
    ? new Date(placedAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '';

  const addressName = order.address?.name || order.customer_name || order.name || 'Customer';
  const addressLine = order.address?.address_line || order.address_line || '';
  const city = order.address?.city || order.city || '';
  const pincode = order.address?.pincode || order.pincode || '';
  const items = order.items || [];

  const deliveryPromise =
    order.deliveryPromise ||
    order.delivery_promise ||
    (order.etaMinutes ? `Today · ~${order.etaMinutes} min` : 'Today');

  const distanceKm = order.distanceKm ?? order.distance_km ?? null;

  const statusLabel = isCancelled
    ? 'Cancelled'
    : status === 'out_for_delivery'
    ? 'Out for Delivery'
    : status.replace(/_/g, ' ');

  return (
    <div className="ot-page">
      <div className="ot-container">
        {/* Header */}
        <header className="ot-header">
          <button className="ot-back" onClick={() => navigate('/orders')} aria-label="Back">
            ←
          </button>
          <div className="ot-header-text">
            <h1>Track Order</h1>
            <p className="ot-order-id">#{shortId}</p>
          </div>
          {placedText && <div className="ot-placed">Placed on {placedText}</div>}
        </header>

        {showPlacedBanner && (
          <div className="ot-banner success" role="status">
            <span>🎉 Order placed successfully! Track its progress below.</span>
            <button type="button" onClick={() => setShowPlacedBanner(false)} aria-label="Dismiss">✕</button>
          </div>
        )}

        {/* Status Card */}
        <section className="ot-card">
          <div className="ot-card-head">
            <h2>Order Status</h2>
            <span className={`ot-badge ${isCancelled ? 'danger' : 'info'}`}>
              {statusLabel}
            </span>
          </div>

          {isCancelled ? (
            <div className="ot-cancelled-block">
              <div className="ot-cancel-icon">✕</div>
              <p>This order has been cancelled</p>
            </div>
          ) : (
            <ol className="ot-timeline">
              {STEPS.map((step, i) => (
                <li
                  key={step.key}
                  className={`ot-step ${i <= activeIndex ? 'done' : ''} ${i === activeIndex ? 'current' : ''}`}
                >
                  <div className="ot-step-icon">{step.icon}</div>
                  <div className="ot-step-label">{step.label}</div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {isCancelled && (
          <div className="ot-banner danger">
            <strong>Order Cancelled</strong>
            <span>This order has been cancelled by the store.</span>
          </div>
        )}

        {/* Main grid: ETA + Map */}
        {!isCancelled && (
          <div className="ot-grid">
            <section className="ot-card">
              <h2>Estimated Delivery</h2>
              <p className="ot-eta-main">{deliveryPromise}</p>
              {distanceKm != null && (
                <p className="ot-eta-sub">Distance: {Number(distanceKm).toFixed(1)} km</p>
              )}
              <span className="ot-badge info" style={{ marginTop: 12 }}>{statusLabel}</span>
            </section>

            <section className="ot-card ot-map-card">
              <div className="ot-map">
                <div className="ot-map-pill">
                  <span className="ot-dot" /> Preparing your order
                </div>
                <div className="ot-route">
                  <div className="ot-pin home">🏠</div>
                  <div className="ot-line" />
                  <div className="ot-pin store">🏪</div>
                </div>
              </div>
              <div className="ot-map-legend">
                <span>🏪 Dispatch Partner</span>
                <span>📍 Your Address</span>
              </div>
            </section>
          </div>
        )}

        {/* Shipping */}
        <section className="ot-card">
          <h2>📍 Shipping To</h2>
          <p className="ot-addr-name">{addressName}</p>
          <p className="ot-addr-line">
            {addressLine}{city ? `, ${city}` : ''}{pincode ? ` – ${pincode}` : ''}
          </p>
        </section>

        {/* Products */}
        <section className="ot-card">
          <div className="ot-card-head">
            <h2>🛒 Products Ordered</h2>
            <span className="ot-muted">{items.length} item{items.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="ot-products">
            {items.map((item, idx) => (
              <div className="ot-product" key={item.variant_id || item.variantId || idx}>
                {item.image || item.image_url ? (
                  <img src={item.image || item.image_url} alt="" />
                ) : (
                  <div className="ot-product-fallback" />
                )}
                <div className="ot-product-info">
                  <div className="ot-product-name">{item.product_name || item.name}</div>
                  <div className="ot-product-meta">
                    {[item.color, item.size].filter(Boolean).join(' · ')}
                    {(item.quantity || item.qty) ? ` · ×${item.quantity || item.qty}` : ''}
                  </div>
                </div>
                <div className="ot-product-price">₹{item.price}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Actions */}
        <div className="ot-actions">
          {!isCancelled && status !== 'delivered' && (
            <button
              className="ot-btn danger-outline"
              onClick={handleCancelOrder}
              disabled={cancelling}
            >
              {cancelling ? 'Cancelling...' : 'Cancel Order'}
            </button>
          )}
          <button className="ot-btn secondary" onClick={() => navigate('/orders')}>
            Back to Orders
          </button>
        </div>

        {isCancelled && (
          <div className="ot-cancelled-footer">Order cancelled</div>
        )}
      </div>
    </div>
  );
}