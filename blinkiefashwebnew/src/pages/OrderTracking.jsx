import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOrderById } from '../api';
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
  const { isLoggedIn } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [cancelling, setCancelling] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) {
      setLoading(false);
      return;
    }
    if (!orderId) {
      setLoading(false);
      setError('Invalid order ID');
      return;
    }

    let cancelled = false;
    let intervalId = null;
    const TERMINAL_STATUSES = ['delivered', 'cancelled'];
    const POLL_INTERVAL_MS = 20000;

    const load = async (isBackground = false) => {
      try {
        if (!isBackground) setLoading(true);
        setError('');
        const res = await getOrderById(orderId);
        if (cancelled) return;
        const nextOrder = res.order || res;
        setOrder(nextOrder);

        const status = (nextOrder.status || '').toLowerCase();
        if (TERMINAL_STATUSES.includes(status)) stopPolling();
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load order');
      } finally {
        if (!cancelled && !isBackground) setLoading(false);
      }
    };

    function startPolling() {
      if (intervalId) return;
      intervalId = setInterval(() => load(true), POLL_INTERVAL_MS);
    }
    function stopPolling() {
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    }

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        load(true);
        startPolling();
      }
    };

    load();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [orderId, isLoggedIn]);

  const handleCancelOrder = async () => {
    if (!window.confirm('Are you sure you want to cancel this order?')) return;

    setCancelling(true);
    try {
      // Call your cancel API here when ready
      // await cancelOrder(orderId);

      // Temporary: just update local state
      setOrder((prev) => ({ ...prev, status: 'cancelled' }));
      alert('Order cancelled successfully');
    } catch (err) {
      alert(err.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="track-page">
        <p className="state-msg">Log in to track this order.</p>
        <button className="btn-primary" onClick={() => navigate('/login')}>Log in</button>
      </div>
    );
  }

  if (loading) return <Loader label="Loading order..." />;

  if (error || !order) {
    return (
      <div className="track-page">
        <p className="state-msg">{error || 'Order not found'}</p>
        <button className="btn-primary" onClick={() => navigate('/orders')}>Back to orders</button>
      </div>
    );
  }

  const status = (order.status || 'placed').toLowerCase();
  const isCancelled = status === 'cancelled';

  let activeIndex = 0;
  if (['placed', 'pending'].includes(status)) activeIndex = 0;
  else if (['confirmed', 'processing', 'packed'].includes(status)) activeIndex = 1;
  else if (['shipped', 'out_for_delivery'].includes(status)) activeIndex = 2;
  else if (status === 'delivered') activeIndex = 3;

  const orderNumber = order.order_number || order.orderId || order.id || orderId;
  const placedAt = order.created_at || order.createdAt;
  const placedText = placedAt
    ? new Date(placedAt).toLocaleString('en-IN', {
        day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true,
      })
    : '';

  const addressName = order.address?.name || order.customer_name || order.name || 'Customer';
  const addressLine = order.address?.address_line || order.address_line || '';
  const city = order.address?.city || order.city || '';
  const pincode = order.address?.pincode || order.pincode || '';
  const items = order.items || [];

  return (
    <div className="track-page">
      {/* Header */}
      <div className="track-header">
        <button className="back-btn" onClick={() => navigate('/orders')} aria-label="Back to orders">←</button>
        <div>
          <div className="track-title">Track Order</div>
          <div className="track-id">#{orderNumber}</div>
        </div>
      </div>

      {placedText && <div className="placed-on">Placed on {placedText}</div>}

      {/* Order Status */}
      <div className="card" role="status" aria-live="polite" aria-atomic="true">
        <div className="card-row">
          <span className="card-title">Order Status</span>
          <span className={`status-pill ${isCancelled ? 'red' : 'blue'}`}>
            {isCancelled ? 'Cancelled' : status.replace(/_/g, ' ')}
          </span>
        </div>

        {isCancelled ? (
          <div className="cancelled-center">
            <div className="cancel-circle" aria-hidden="true">✕</div>
            <div>Cancelled</div>
          </div>
        ) : (
          <ol className="timeline">
            {STEPS.map((step, i) => (
              <li
                key={step.key}
                className={`timeline-item ${i <= activeIndex ? 'active' : ''}`}
                aria-current={i === activeIndex ? 'step' : undefined}
              >
                <div className="timeline-icon" aria-hidden="true">{step.icon}</div>
                <div className="timeline-label">{step.label}</div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {/* Cancelled Banner */}
      {isCancelled && (
        <div className="cancel-alert">
          <span>✕</span>
          <div>
            <strong>Order Cancelled</strong>
            <p>This order has been cancelled by the store.</p>
          </div>
        </div>
      )}

      {/* Estimated Delivery */}
      {!isCancelled && (
        <div className="card">
          <div className="card-title">Estimated Delivery</div>
          <div className="eta-text">
            {order.deliveryPromise || 'Today'}
          </div>
          {order.distanceKm && (
            <div className="eta-sub">Distance: {order.distanceKm} km</div>
          )}
          <span className="status-pill blue" style={{ marginTop: 8 }}>
            {['placed', 'pending'].includes(status) ? 'Order Placed' : status}
          </span>
        </div>
      )}

      {/* Map */}
      {!isCancelled && (
        <div className="card map-card" role="img" aria-label="Map showing route from dispatch partner to your address. Status: preparing your order.">
          <div className="map-box" aria-hidden="true">
            <div className="map-pill">
              <span className="dot"></span> Preparing your order
            </div>
            <div className="route">
              <div className="pin">🏪</div>
              <div className="line"></div>
              <div className="pin">📍</div>
            </div>
          </div>
          <div className="map-legend" aria-hidden="true">
            <span>🏪 Dispatch Partner</span>
            <span>📍 Your Address</span>
          </div>
        </div>
      )}

      {/* Shipping Address */}
      <div className="card">
        <div className="card-title"><span aria-hidden="true">📍</span> Shipping To</div>
        <div className="addr-name">{addressName}</div>
        <div className="addr-line">
          {addressLine}{city ? `, ${city}` : ''}{pincode ? ` - ${pincode}` : ''}
        </div>
      </div>

      {/* Products */}
      <div className="card">
        <div className="card-row">
          <span className="card-title"><span aria-hidden="true">🛒</span> Products Ordered</span>
          <span className="item-count">{items.length} item{items.length !== 1 ? 's' : ''}</span>
        </div>

        {items.map((item, idx) => (
          <div className="product" key={item.variant_id || idx}>
            {item.image && <img src={item.image} alt="" />}
            <div className="product-detail">
              <div className="product-name">{item.product_name || item.name}</div>
              <div className="product-meta">
                {[item.color, item.size].filter(Boolean).join(' · ')}
                {(item.quantity || item.qty) ? ` · ×${item.quantity || item.qty}` : ''}
              </div>
            </div>
            <div className="product-price">₹{item.price}</div>
          </div>
        ))}
      </div>

      {/* Cancel Button */}
      {!isCancelled && status !== 'delivered' && (
        <button
          className="cancel-order-btn"
          onClick={handleCancelOrder}
          disabled={cancelling}
          aria-busy={cancelling}
        >
          {cancelling ? 'Cancelling...' : <><span aria-hidden="true">✕</span> Cancel Order</>}
        </button>
      )}

      {isCancelled && (
        <div className="cancelled-footer">Order cancelled</div>
      )}
    </div>
  );
}