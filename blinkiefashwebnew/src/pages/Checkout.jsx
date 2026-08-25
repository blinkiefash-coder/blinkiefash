import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSmartBack } from '../utils/navigation';
import {
  MdArrowBack,
  MdArrowForward,
  MdCheckCircle,
  MdChevronRight,
  MdHome,
  MdLocalOffer,
  MdLocationOn,
  MdLogin,
  MdPayments,
  MdPhone,
  MdQrCode2,
  MdReceiptLong,
  MdRecycling,
  MdSchedule,
  MdShoppingBag,
} from 'react-icons/md';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getAddresses, addAddress, getDeliveryFee, placeOrder } from '../api';
import './Checkout.css';
import PageSEO from '../components/PageSEO';

const FREE_DELIVERY_THRESHOLD = 999;
const PLATFORM_FEE = 0;
const HANDLING_FEE = 9;

const AVAILABLE_COUPONS = {};

export default function Checkout() {
  const navigate = useNavigate();
  const goBack = useSmartBack('/cart');
  const { user, isLoggedIn } = useAuth();
  const cartCtx = useCart();
  const { items, subtotal, clearCart } = cartCtx;

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressPanelOpen, setAddressPanelOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    phone: '',
    address_line: '',
    city: '',
    pincode: '',
    lat: null,
    lng: null,
  });
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [selectedOffer, setSelectedOffer] = useState('free-delivery');
  const [donatePrompted, setDonatePrompted] = useState(false);

  const [couponCode, setCouponCode] = useState('');
  // manualCoupon: user-chosen coupon (null = none / use auto promo)
  // couponDismissed: user explicitly removed the auto promo
  const [manualCoupon, setManualCoupon] = useState(null);
  const [couponDismissed, setCouponDismissed] = useState(false);
  const [couponError, setCouponError] = useState('');
  const [couponModalOpen, setCouponModalOpen] = useState(false);

  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  const [deliveryQuote, setDeliveryQuote] = useState(null);

  useEffect(() => {
    if (!isLoggedIn) return;
    getAddresses(user.id)
      .then((res) => {
        const list = res.addresses || [];
        setAddresses(list);
        if (list.length) setSelectedAddressId(list[0].id);
        else {
          setShowForm(true);
          setAddressPanelOpen(true);
        }
      })
      .catch(() => {
        setShowForm(true);
        setAddressPanelOpen(true);
      });
  }, [isLoggedIn, user]);

  useEffect(() => {
    if (!selectedAddressId || !items.length) return;
    getDeliveryFee({
      addressId: selectedAddressId,
      subtotal,
      variantIds: items.map((item) => item.variantId),
    }).then(setDeliveryQuote).catch(() => setDeliveryQuote(null));
  }, [selectedAddressId, subtotal, items]);

  // Derive applied coupon during render (no setState-in-effect).
  const appliedCoupon = useMemo(() => {
    if (manualCoupon) {
      const coupon = AVAILABLE_COUPONS[manualCoupon.code];
      if (!coupon) return manualCoupon;
      return {
        ...manualCoupon,
        displayPercent: coupon.displayPercent,
        discountPercent: coupon.actualPercent,
        discountAmount: Math.round(subtotal * (coupon.actualPercent / 100)),
      };
    }
    if (!couponDismissed && items.length > 0) {
      const coupon = AVAILABLE_COUPONS['INDEPENDENCE5'];
      if (coupon) {
        return {
          code: 'INDEPENDENCE5',
          displayPercent: coupon.displayPercent,
          discountPercent: coupon.actualPercent,
          discountAmount: Math.round(subtotal * (coupon.actualPercent / 100)),
        };
      }
    }
    return null;
  }, [manualCoupon, couponDismissed, items.length, subtotal]);

  if (items.length === 0) {
    return (
      <div className="page">
        <h1 className="cart-title">Checkout</h1>
        <p className="state-msg">Your cart is empty.</p>
        <button type="button" className="primary-btn" onClick={() => navigate('/shop')}>
          Start shopping
        </button>
      </div>
    );
  }

  const totalQty = items.reduce((sum, i) => sum + Number(i.qty || 1), 0);
  const itemTotal = subtotal;
  const deliveryCharge = deliveryQuote?.fee ?? (itemTotal >= FREE_DELIVERY_THRESHOLD ? 0 : 49);
  const couponDiscount = appliedCoupon ? appliedCoupon.discountAmount : 0;
  const gstFee = HANDLING_FEE;
  const totalFees = PLATFORM_FEE + gstFee;
  const totalPayable = Math.max(0, itemTotal - couponDiscount + totalFees + deliveryCharge);
  const selectedAddress = addresses.find((a) => String(a.id) === String(selectedAddressId));

  const handleIncrement = (item) => {
    if (typeof cartCtx.addToCart === 'function') {
      cartCtx.addToCart({
        productId: item.productId,
        variantId: item.variantId,
        name: item.name,
        image: item.image,
        price: item.price,
        size: item.size,
        color: item.color,
      });
    }
  };

  const handleDecrement = (item) => {
  const key = item.variantId || item.productId;
  const currentQty = Number(item.qty || 1);
  // Decrease by 1; updateQty removes the line only when qty reaches 0
  if (typeof cartCtx.updateQty === 'function') {
    cartCtx.updateQty(key, currentQty - 1);
    return;
  }
  // Fallback: only remove when already at 1
  if (currentQty <= 1 && typeof cartCtx.removeFromCart === 'function') {
    cartCtx.removeFromCart(key);
  }
};

  const applyCoupon = (code) => {
    const normalized = String(code || '').trim().toUpperCase();
    setCouponError('');
    if (appliedCoupon && appliedCoupon.code === normalized) {
      setCouponError('Coupon already applied');
      return;
    }
    const coupon = AVAILABLE_COUPONS[normalized];
    if (!coupon) {
      setCouponError('Invalid coupon code');
      return;
    }
    // Calculate discount using actualPercent, but display shows displayPercent
    const discountAmount = Math.round(itemTotal * (coupon.actualPercent / 100));
    setManualCoupon({
      code: normalized,
      displayPercent: coupon.displayPercent,
      discountPercent: coupon.actualPercent,
      discountAmount,
    });
    setCouponDismissed(false);
    setCouponCode(normalized);
    setCouponModalOpen(false);
  };

  const removeCoupon = () => {
    setManualCoupon(null);
    setCouponDismissed(true); // prevent auto promo from coming back
    setCouponCode('');
    setCouponError('');
  };

  const fillAddressFromLocation = () => {
    setGeoError('');
    setGeoLoading(true);

    if (!navigator.geolocation) {
      setGeoError('Your browser does not support location services.');
      setGeoLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en',
                'User-Agent': 'BlinkieFash-Checkout/1.0',
              },
            }
          );
          if (!res.ok) throw new Error('Could not fetch address');
          const data = await res.json();
          const addr = data.address || {};
          const streetParts = [
            addr.house_number,
            addr.road || addr.pedestrian || addr.footway,
          ].filter(Boolean);
          const addressLine =
            streetParts.length > 0
              ? streetParts.join(' ')
              : data.display_name?.split(',').slice(0, 2).join(',').trim() || '';

          setForm((prev) => ({
            ...prev,
            address_line: addressLine || prev.address_line,
            city:
              addr.city ||
              addr.town ||
              addr.village ||
              addr.suburb ||
              addr.county ||
              prev.city,
            pincode: addr.postcode || prev.pincode,
            lat: latitude,
            lng: longitude,
          }));
          setShowForm(true);
          setAddressPanelOpen(true);
        } catch (err) {
          console.error(err);
          setGeoError('Could not convert location to address. Please enter it manually.');
          setShowForm(true);
          setAddressPanelOpen(true);
        } finally {
          setGeoLoading(false);
        }
      },
      (error) => {
        let message = 'Unable to get your location.';
        if (error.code === error.PERMISSION_DENIED) {
          message = 'Location permission denied. Please allow access or enter address manually.';
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = 'Location unavailable. Please enter address manually.';
        } else if (error.code === error.TIMEOUT) {
          message = 'Location request timed out. Please try again or enter manually.';
        }
        setGeoError(message);
        setGeoLoading(false);
        setShowForm(true);
        setAddressPanelOpen(true);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await addAddress({
        userId: user.id,
        name: form.name,
        phone: form.phone,
        address_line: form.address_line,
        city: form.city,
        pincode: form.pincode,
        lat: form.lat,
        lng: form.lng,
      });
      if (!res.success) {
        setError(res.message || 'Could not save address');
        return;
      }
      setAddresses((prev) => [res.address, ...prev]);
      setSelectedAddressId(res.address.id);
      setShowForm(false);
      setAddressPanelOpen(false);
      setForm((prev) => ({ ...prev, lat: null, lng: null }));
    } catch (err) {
      setError(err.message || 'Could not save address');
    }
  };

  const handlePlaceOrder = async () => {
    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/checkout' } });
      return;
    }
    if (!selectedAddressId) {
      setError('Please select or add a delivery address');
      setAddressPanelOpen(true);
      return;
    }
    setError('');
    setPlacing(true);
    try {
      const res = await placeOrder({
        userId: user.id,
        addressId: selectedAddressId,
        totalAmount: itemTotal,
        paymentMethod,
        items: items.map((i) => ({
          variantId: i.variantId,
          quantity: i.qty,
          price: i.price,
        })),
        couponCode: appliedCoupon ? appliedCoupon.code : null,
      });
      if (!res.success) {
        setError(res.message || 'Could not place order');
        return;
      }
      if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
        window.gtag('event', 'place_order', {
          order_id: res.orderId,
          value: res.finalAmount ?? totalPayable,
          currency: 'INR',
        });
      }
      clearCart();
      navigate(`/orders/${res.orderId}`, {
        replace: true,
        state: { fromCheckout: true },
      });
    } catch (err) {
      setError(err.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

  const googleMapsNavUrl = selectedAddress
    ? `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
        `${selectedAddress.address_line}, ${selectedAddress.city} - ${selectedAddress.pincode}`
      )}`
    : null;

  const billSummary = (
    <section className="ckt-card">
      <div className="ckt-card-head">
        <span className="ckt-icon-badge"><MdReceiptLong /></span>
        <h2>Bill Summary</h2>
      </div>
      <p className="ckt-gstin">GSTIN: 21AAOCB8427B1ZY</p>
      <div className="ckt-bill-rows">
        <div className="ckt-bill-row">
          <span>Item Total</span>
          <span>₹{itemTotal.toLocaleString('en-IN')}</span>
        </div>
        <div className="ckt-bill-row">
          <span>Delivery Charges</span>
          <span className={deliveryCharge === 0 ? 'ckt-free' : ''}>
            {deliveryCharge > 0 ? `₹${deliveryCharge}` : 'FREE'}
          </span>
        </div>
        {appliedCoupon && (
          <div className="ckt-bill-row">
            <span>Coupon ({appliedCoupon.code})</span>
            <span className="ckt-free">−₹{appliedCoupon.discountAmount.toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="ckt-bill-row ckt-bill-fees">
          <span>Total Fees</span>
          <span>₹{totalFees}</span>
        </div>
        <div className="ckt-bill-subrow">
          <span>↪ Platform Fee</span>
          <span>₹{PLATFORM_FEE}</span>
        </div>
        <div className="ckt-bill-subrow">
          <span>↪ Taxes (GST)</span>
          <span>₹{gstFee}</span>
        </div>
        <div className="ckt-bill-row ckt-bill-total">
          <span>Total Payable</span>
          <strong>₹{totalPayable.toLocaleString('en-IN')}</strong>
        </div>
      </div>
    </section>
  );

  return (
    <div className="ckt-page">
      <PageSEO
        title="Checkout"
        description="Complete your order for fast 60-minute fashion delivery across Odisha."
        path="/checkout"
        noIndex
      />

      <div className="ckt-topbar">
        <button type="button" className="ckt-back" onClick={goBack} aria-label="Go back">
          <MdArrowBack />
        </button>
        <h1>Checkout</h1>
      </div>

      {!isLoggedIn && (
        <div className="ckt-login-banner">
          <span>Log in to save your address and place this order</span>
          <button
            type="button"
            className="ckt-login-banner-btn"
            onClick={() => navigate('/login', { state: { from: '/checkout' } })}
          >
            <MdLogin /> Log in
          </button>
        </div>
      )}

      <div className="ckt-content">
        <div className="ckt-main">
          <section className="ckt-card">
            <div className="ckt-card-head">
              <span className="ckt-icon-badge"><MdShoppingBag /></span>
              <h2>Order Summary ({totalQty} item{totalQty === 1 ? '' : 's'})</h2>
            </div>
            <div className="ckt-items">
              {items.map((item) => (
                <div className="ckt-item-row" key={item.variantId || item.productId}>
                  <div className="ckt-item-media">
                    {item.image ? <img src={item.image} alt={item.name} /> : <div className="ckt-item-fallback" />}
                  </div>
                  <div className="ckt-item-info">
                    <p className="ckt-item-name">{item.name}</p>
                    <p className="ckt-item-meta">
                      {[item.color, item.size].filter(Boolean).join(' · ') || 'Standard'}
                    </p>
                  </div>
                  <div className="ckt-item-right">
                    <span className="ckt-item-price">₹{(item.price * item.qty).toLocaleString('en-IN')}</span>
                    <div className="ckt-qty-stepper">
                      <button type="button" onClick={() => handleDecrement(item)} aria-label="Decrease quantity">−</button>
                      <span>{item.qty}</span>
                      <button type="button" onClick={() => handleIncrement(item)} aria-label="Increase quantity">+</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="ckt-card">
            <div className="ckt-card-head">
              <span className="ckt-icon-badge"><MdPayments /></span>
              <h2>Payment Method</h2>
            </div>
            <div className="ckt-payment-options">
              <button
                type="button"
                className={`ckt-payment-option${paymentMethod === 'cod' ? ' active' : ''}`}
                onClick={() => setPaymentMethod('cod')}
              >
                <MdPayments /> Cash on Delivery
                {paymentMethod === 'cod' && <MdCheckCircle className="ckt-payment-check" />}
              </button>
              <button
                type="button"
                className={`ckt-payment-option${paymentMethod === 'upi' ? ' active' : ''}`}
                onClick={() => setPaymentMethod('upi')}
              >
                <MdQrCode2 /> UPI on Delivery
                {paymentMethod === 'upi' && <MdCheckCircle className="ckt-payment-check" />}
              </button>
            </div>
          </section>

          <section className="ckt-card">
            <div className="ckt-card-head">
              <span className="ckt-icon-badge"><MdLocalOffer /></span>
              <h2>Apply Coupon</h2>
            </div>
            {appliedCoupon ? (
              <div className="ckt-applied-coupon">
                <span>
                  <strong>{appliedCoupon.code}</strong> – {appliedCoupon.discountPercent}% OFF (−₹
                  {appliedCoupon.discountAmount.toLocaleString('en-IN')})
                </span>
                <button type="button" className="ckt-change-btn" onClick={removeCoupon}>Remove</button>
              </div>
            ) : (
              <button
                type="button"
                className="ckt-add-address-btn"
                onClick={() => { setCouponError(''); setCouponModalOpen(true); }}
              >
                + Apply Coupon
              </button>
            )}
            {couponError && <p className="auth-error" role="alert" style={{ marginTop: 8 }}>{couponError}</p>}
          </section>

          <div className="ckt-mobile-bill-wrap">{billSummary}</div>

          <section className="ckt-card">
            <div className="ckt-card-head">
              <span className="ckt-icon-badge"><MdLocalOffer /></span>
              <h2>Offers &amp; Discounts</h2>
            </div>
            <div className="ckt-offers-row">
              <button
                type="button"
                className={`ckt-offer-chip${selectedOffer === 'free-delivery' ? ' active' : ''}`}
                onClick={() => setSelectedOffer('free-delivery')}
              >
                <span className="ckt-offer-top">
                  Free Delivery
                  {selectedOffer === 'free-delivery' && <MdCheckCircle />}
                </span>
                <span className="ckt-offer-sub">Orders above ₹999</span>
              </button>
              <button type="button" className="ckt-offer-chip locked" disabled>
                <span className="ckt-offer-top">Spin &amp; Win</span>
                <span className="ckt-offer-sub">Play to unlock</span>
              </button>
              <button type="button" className="ckt-offer-chip locked" disabled>
                <span className="ckt-offer-top">Play &amp; Win</span>
                <span className="ckt-offer-sub">Play to unlock</span>
              </button>
            </div>
          </section>

          <section className="ckt-card">
            <div className="ckt-card-head">
              <span className="ckt-icon-badge"><MdSchedule /></span>
              <h2>Delivery Time</h2>
            </div>
            <label className="ckt-time-option active">
              <input type="radio" checked readOnly />
              <span>
                <strong>{deliveryQuote?.deliveryPromise || 'Select an address for your delivery promise'}</strong>
                <small>Up to 15 km: 60 minutes. Up to 45 km: 1 day. Beyond 45 km: 1-3 days.</small>
              </span>
            </label>
          </section>

          <section className="ckt-donate-banner">
            <p className="ckt-donate-title"><MdRecycling /> Are you willing to donate clothes?</p>
            <p className="ckt-donate-sub">Get up to 5% discount on this order after collection</p>
            <button type="button" className="ckt-donate-btn" onClick={() => setDonatePrompted(true)}>
              {donatePrompted ? "We'll reach out to schedule your pickup" : 'Schedule Pickup'}
            </button>
          </section>

          <section className="ckt-card">
            <div className="ckt-card-head">
              <span className="ckt-icon-badge"><MdLocationOn /></span>
              <h2>Delivery Address</h2>
            </div>

            {!isLoggedIn ? (
              <div className="ckt-login-prompt">
                <p>Log in to select a saved address or add a new one for delivery.</p>
                <button
                  type="button"
                  className="ckt-login-prompt-btn"
                  onClick={() => navigate('/login', { state: { from: '/checkout' } })}
                >
                  <MdLogin /> Log in to continue
                </button>
              </div>
            ) : selectedAddress && !addressPanelOpen ? (
              <div>
                <div className="ckt-address-card">
                  <span className="ckt-address-icon"><MdHome /></span>
                  <div className="ckt-address-body">
                    <div className="ckt-address-top">
                      <strong>{selectedAddress.name || 'Address'}</strong>
                      {selectedAddress.type && (
                        <span className="ckt-tag">{selectedAddress.type.toUpperCase()}</span>
                      )}
                    </div>
                    <p>
                      {selectedAddress.address_line}, {selectedAddress.city} - {selectedAddress.pincode}
                    </p>
                    {selectedAddress.phone && (
                      <p className="ckt-phone"><MdPhone /> {selectedAddress.phone}</p>
                    )}
                  </div>
                  <button type="button" className="ckt-change-btn" onClick={() => setAddressPanelOpen(true)}>
                    Change
                  </button>
                </div>
                {googleMapsNavUrl && (
                  <a
                    href={googleMapsNavUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ckt-change-btn"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, marginTop: 10 }}
                  >
                    Navigate with Google Maps
                  </a>
                )}
              </div>
            ) : (
              <div className="ckt-address-panel">
                {addresses.map((addr) => (
                  <label className="ckt-address-option" key={addr.id}>
                    <input
                      type="radio"
                      name="address"
                      checked={String(selectedAddressId) === String(addr.id)}
                      onChange={() => setSelectedAddressId(addr.id)}
                    />
                    <span>
                      <strong>{addr.name || 'Address'}</strong>
                      <br />
                      {addr.address_line}, {addr.city} - {addr.pincode}
                    </span>
                    <MdChevronRight className="ckt-address-chevron" />
                  </label>
                ))}

                {!showForm && (
                  <>
                    <button type="button" className="ckt-add-address-btn" onClick={() => setShowForm(true)}>
                      + Add new address
                    </button>
                    <button
                      type="button"
                      className="ckt-add-address-btn"
                      onClick={fillAddressFromLocation}
                      disabled={geoLoading}
                      aria-busy={geoLoading}
                      style={{ marginTop: 8 }}
                    >
                      {geoLoading ? 'Getting location…' : 'Use my current location'}
                    </button>
                    {geoError && (
                      <p className="auth-error" role="alert" style={{ marginTop: 8 }}>{geoError}</p>
                    )}
                  </>
                )}

                {showForm && (
                  <form className="ckt-address-form" onSubmit={handleAddAddress}>
                    <input placeholder="Full name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                    <input placeholder="Phone" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} required />
                    <input placeholder="Address line" value={form.address_line} onChange={(e) => setForm({ ...form, address_line: e.target.value })} required />
                    <input placeholder="City" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} required />
                    <input placeholder="Pincode" value={form.pincode} onChange={(e) => setForm({ ...form, pincode: e.target.value })} required />
                    <button
                      type="button"
                      className="ckt-add-address-btn"
                      onClick={fillAddressFromLocation}
                      disabled={geoLoading}
                      aria-busy={geoLoading}
                    >
                      {geoLoading ? 'Getting location…' : 'Use my current location'}
                    </button>
                    {geoError && <p className="auth-error" role="alert">{geoError}</p>}
                    <button type="submit" className="ckt-save-address-btn">Save address</button>
                  </form>
                )}

                {!showForm && selectedAddressId && (
                  <button type="button" className="ckt-use-address-btn" onClick={() => setAddressPanelOpen(false)}>
                    Use this address
                  </button>
                )}
              </div>
            )}
          </section>

          {error && <p className="auth-error" role="alert">{error}</p>}
        </div>

        <aside className="ckt-sidebar">
          {billSummary}
          <button
            type="button"
            className="ckt-place-order-btn ckt-desktop-only"
            onClick={handlePlaceOrder}
            disabled={placing}
          >
            {!isLoggedIn ? (<><MdLogin /> Log in to Order</>) : (<><MdArrowForward /> {placing ? 'Placing order...' : 'Place Order'}</>)}
          </button>
        </aside>
      </div>

      <div className="ckt-bottom-bar">
        <div className="ckt-bottom-price">
          <strong>₹{totalPayable.toLocaleString('en-IN')}</strong>
          <span>{totalQty} item{totalQty === 1 ? '' : 's'} • Total</span>
        </div>
        <button type="button" className="ckt-place-order-btn" onClick={handlePlaceOrder} disabled={placing}>
          {!isLoggedIn ? (<><MdLogin /> Log in to Order</>) : (<><MdArrowForward /> {placing ? 'Placing order...' : 'Place Order'}</>)}
        </button>
      </div>

      {couponModalOpen && (
        <div
          className="ckt-modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="coupon-modal-title"
          onClick={() => setCouponModalOpen(false)}
        >
          <div className="ckt-modal" onClick={(e) => e.stopPropagation()}>
            <h3 id="coupon-modal-title" style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 800 }}>
              Available Coupons
            </h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <input
                placeholder="Or enter coupon code"
                value={couponCode}
                onChange={(e) => setCouponCode(e.target.value)}
                aria-label="Coupon code"
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, border: '1px solid #e2e8f0', fontSize: 13 }}
              />
              <button type="button" className="ckt-use-address-btn" onClick={() => applyCoupon(couponCode)}>
                Apply Code
              </button>
            </div>
            <button type="button" className="ckt-change-btn" style={{ marginTop: 14, display: 'block' }} onClick={() => setCouponModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}