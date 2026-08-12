import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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
import { getAddresses, addAddress, placeOrder } from '../api';
import './Checkout.css';

const FREE_DELIVERY_THRESHOLD = 999;
const PLATFORM_FEE = 0;
const HANDLING_FEE = 9;

export default function Checkout() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const cartCtx = useCart();
  const { items, subtotal, clearCart } = cartCtx;

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [addressPanelOpen, setAddressPanelOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address_line: '', city: '', pincode: '' });
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('cod');
  const [selectedOffer, setSelectedOffer] = useState('free-delivery');
  const [donatePrompted, setDonatePrompted] = useState(false);

  const estimatedDeliveryTime = useMemo(
    () =>
      new Date(Date.now() + 70 * 60000).toLocaleTimeString('en-IN', {
        hour: 'numeric',
        minute: '2-digit',
      }),
    []
  );

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
  const deliveryCharge = itemTotal > FREE_DELIVERY_THRESHOLD ? 0 : 49;
  const displayedOfferDiscount = Math.round(itemTotal * 0.05);
  const appliedOfferDiscount = Math.round(itemTotal * 0.02);
  const gstFee = HANDLING_FEE;
  const totalFees = PLATFORM_FEE + gstFee;
  const totalPayable = itemTotal - appliedOfferDiscount + totalFees + deliveryCharge;
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
    const dec = cartCtx.decrementQuantity || cartCtx.removeFromCart;
    if (typeof dec === 'function') {
      dec(item.variantId || item.productId);
    }
  };

  const handleAddAddress = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const res = await addAddress({ userId: user.id, ...form });
      if (!res.success) {
        setError(res.message || 'Could not save address');
        return;
      }
      setAddresses((prev) => [res.address, ...prev]);
      setSelectedAddressId(res.address.id);
      setShowForm(false);
      setAddressPanelOpen(false);
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
        totalAmount: totalPayable,
        paymentMethod,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.qty, price: i.price })),
      });
      if (!res.success) {
        setError(res.message || 'Could not place order');
        return;
      }
      clearCart();
      navigate('/orders');
    } catch (err) {
      setError(err.message || 'Could not place order');
    } finally {
      setPlacing(false);
    }
  };

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
          <span className="ckt-free">{deliveryCharge > 0 ? `₹${deliveryCharge}` : 'FREE'}</span>
        </div>
        <div className="ckt-bill-row">
          <span>Offer Discount (5%)</span>
          <span className="ckt-muted">-₹{displayedOfferDiscount.toLocaleString('en-IN')}</span>
        </div>
        {displayedOfferDiscount > appliedOfferDiscount && (
          <div className="ckt-bill-subrow">
            <span>&#8618; Launch adjustment</span>
            <span>+₹{(displayedOfferDiscount - appliedOfferDiscount).toLocaleString('en-IN')}</span>
          </div>
        )}
        <div className="ckt-bill-subrow">
          <span>&#8618; Applied discount (2%)</span>
          <span>-₹{appliedOfferDiscount.toLocaleString('en-IN')}</span>
        </div>
        <div className="ckt-bill-row ckt-bill-fees">
          <span>Total Fees</span>
          <span>₹{totalFees}</span>
        </div>
        <div className="ckt-bill-subrow">
          <span>&#8618; Platform Fee</span>
          <span>₹{PLATFORM_FEE}</span>
        </div>
        <div className="ckt-bill-subrow">
          <span>&#8618; Taxes (GST)</span>
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
      <div className="ckt-topbar">
        <button type="button" className="ckt-back" onClick={() => navigate(-1)} aria-label="Go back">
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
                <MdPayments />
                Cash on Delivery
                {paymentMethod === 'cod' && <MdCheckCircle className="ckt-payment-check" />}
              </button>
              <button
                type="button"
                className={`ckt-payment-option${paymentMethod === 'upi' ? ' active' : ''}`}
                onClick={() => setPaymentMethod('upi')}
              >
                <MdQrCode2 />
                UPI on Delivery
                {paymentMethod === 'upi' && <MdCheckCircle className="ckt-payment-check" />}
              </button>
            </div>
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
                <strong>Today - Delivered by {estimatedDeliveryTime}</strong>
                <small>53-80 min for 20.1 km from your nearest delivery partner.</small>
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
              <div className="ckt-address-card">
                <span className="ckt-address-icon"><MdHome /></span>
                <div className="ckt-address-body">
                  <div className="ckt-address-top">
                    <strong>{selectedAddress.name || 'Address'}</strong>
                    {selectedAddress.type && <span className="ckt-tag">{selectedAddress.type.toUpperCase()}</span>}
                  </div>
                  <p>{selectedAddress.address_line}, {selectedAddress.city} - {selectedAddress.pincode}</p>
                  {selectedAddress.phone && (
                    <p className="ckt-phone"><MdPhone /> {selectedAddress.phone}</p>
                  )}
                </div>
                <button type="button" className="ckt-change-btn" onClick={() => setAddressPanelOpen(true)}>
                  Change
                </button>
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
                  <button type="button" className="ckt-add-address-btn" onClick={() => setShowForm(true)}>
                    + Add new address
                  </button>
                )}

                {showForm && (
                  <form className="ckt-address-form" onSubmit={handleAddAddress}>
                    <input
                      placeholder="Full name"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      required
                    />
                    <input
                      placeholder="Phone"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      required
                    />
                    <input
                      placeholder="Address line"
                      value={form.address_line}
                      onChange={(e) => setForm({ ...form, address_line: e.target.value })}
                      required
                    />
                    <input
                      placeholder="City"
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      required
                    />
                    <input
                      placeholder="Pincode"
                      value={form.pincode}
                      onChange={(e) => setForm({ ...form, pincode: e.target.value })}
                      required
                    />
                    <button type="submit" className="ckt-save-address-btn">
                      Save address
                    </button>
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

          {error && <p className="auth-error">{error}</p>}
        </div>

        <aside className="ckt-sidebar">
          {billSummary}
          <button
            type="button"
            className="ckt-place-order-btn ckt-desktop-only"
            onClick={handlePlaceOrder}
            disabled={placing}
          >
            {!isLoggedIn ? (
              <><MdLogin /> Log in to Order</>
            ) : (
              <><MdArrowForward /> {placing ? 'Placing order...' : 'Place Order'}</>
            )}
          </button>
        </aside>
      </div>

      <div className="ckt-bottom-bar">
        <div className="ckt-bottom-price">
          <strong>₹{totalPayable.toLocaleString('en-IN')}</strong>
          <span>{totalQty} item{totalQty === 1 ? '' : 's'} • Total</span>
        </div>
        <button type="button" className="ckt-place-order-btn" onClick={handlePlaceOrder} disabled={placing}>
          {!isLoggedIn ? (
            <><MdLogin /> Log in to Order</>
          ) : (
            <><MdArrowForward /> {placing ? 'Placing order...' : 'Place Order'}</>
          )}
        </button>
      </div>
    </div>
  );
}