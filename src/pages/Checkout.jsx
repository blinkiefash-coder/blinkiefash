import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { getAddresses, addAddress, placeOrder } from '../api';
import './Checkout.css';

export default function Checkout() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { items, subtotal, clearCart } = useCart();

  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', phone: '', address_line: '', city: '', pincode: '' });
  const [error, setError] = useState('');
  const [placing, setPlacing] = useState(false);

  useEffect(() => {
    if (!isLoggedIn) return;
    getAddresses(user.id)
      .then((res) => {
        const list = res.addresses || [];
        setAddresses(list);
        if (list.length) setSelectedAddressId(list[0].id);
        else setShowForm(true);
      })
      .catch(() => setShowForm(true));
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

  if (!isLoggedIn) {
    return (
      <div className="page">
        <h1 className="cart-title">Checkout</h1>
        <p className="state-msg">Please log in to place your order.</p>
        <button type="button" className="primary-btn" onClick={() => navigate('/login')}>
          Log in
        </button>
      </div>
    );
  }

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
    } catch (err) {
      setError(err.message || 'Could not save address');
    }
  };

  const handlePlaceOrder = async () => {
    if (!selectedAddressId) {
      setError('Please select or add a delivery address');
      return;
    }
    setError('');
    setPlacing(true);
    try {
      const res = await placeOrder({
        userId: user.id,
        addressId: selectedAddressId,
        totalAmount: subtotal,
        items: items.map((i) => ({ variantId: i.variantId, quantity: i.qty, price: i.price })),
      });
      if (!res.success) {
        const errorMsg = res.message || 'Could not place order';
        console.error('❌ Order placement failed:', errorMsg);
        console.error('Full response:', res);
        setError(errorMsg);
        return;
      }
      clearCart();
      navigate('/orders');
    } catch (err) {
      const errorMsg = err.message || 'Could not place order';
      console.error('❌ Order placement error:', errorMsg);
      console.error('Full error object:', err);
      console.error('Error stack:', err.stack);
      setError(errorMsg);
    } finally {
      setPlacing(false);
    }
  };

  return (
    <div className="page checkout-page">
      <h1 className="cart-title">Checkout</h1>

      <section className="checkout-section">
        <h2>Delivery address</h2>
        {addresses.map((addr) => (
          <label className="address-option" key={addr.id}>
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
          </label>
        ))}
        {!showForm && (
          <button type="button" className="secondary-btn" onClick={() => setShowForm(true)}>
            + Add new address
          </button>
        )}
        {showForm && (
          <form className="address-form" onSubmit={handleAddAddress}>
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
            <button type="submit" className="primary-btn">
              Save address
            </button>
          </form>
        )}
      </section>

      <section className="checkout-section">
        <h2>Order summary</h2>
        {items.map((item) => (
          <div className="checkout-item" key={item.variantId || item.productId}>
            <span>
              {item.name} x{item.qty}
            </span>
            <span>₹{item.price * item.qty}</span>
          </div>
        ))}
        <div className="checkout-item checkout-total">
          <span>Total</span>
          <strong>₹{subtotal}</strong>
        </div>
      </section>

      {error && (
        <div 
          className="auth-error" 
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: '#fee',
            border: '1px solid #f88',
            borderRadius: '6px',
            marginBottom: '12px',
            fontSize: '14px',
            lineHeight: '1.5',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontFamily: 'monospace',
            userSelect: 'text',
            cursor: 'text'
          }}
        >
          <strong>❌ Order Error:</strong><br />
          {error}
        </div>
      )}

      <button type="button" className="primary-btn checkout-place-btn" onClick={handlePlaceOrder} disabled={placing}>
        {placing ? 'Placing order...' : 'Place order'}
      </button>
    </div>
  );
}
