import { useNavigate } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './Cart.css';
import PageSEO from '../components/PageSEO';

export default function Cart() {
  const navigate = useNavigate();
  const { items, updateQty, removeFromCart, subtotal, count } = useCart();

  if (items.length === 0) {
    return (
      <div className="page cart-page">
        <PageSEO title="Your Cart" description="Review your cart items and proceed to checkout." path="/cart" noIndex />
        <h1 className="cart-title">Your cart</h1>
        <p className="state-msg">Your cart is empty.</p>
        <button type="button" className="primary-btn" onClick={() => navigate('/shop')}>
          Start shopping
        </button>
      </div>
    );
  }

  return (
    <div className="page cart-page">
      <PageSEO title="Your Cart" description="Review your cart items and proceed to checkout." path="/cart" noIndex />
      <h1 className="cart-title">Your cart ({count})</h1>
      <div className="cart-list">
        {items.map((item) => {
          const key = item.variantId || item.productId;
          return (
            <div className="cart-item" key={key}>
              <div className="cart-item-media">
                {item.image ? <img src={item.image} alt={item.name} /> : null}
              </div>
              <div className="cart-item-body">
                <p className="cart-item-name">{item.name}</p>
                {(item.size || item.color) && (
                  <p className="cart-item-variant">
                    {[item.size, item.color].filter(Boolean).join(' / ')}
                  </p>
                )}
                <p className="cart-item-price">₹{item.price}</p>
                <div className="cart-item-qty">
                  <button type="button" onClick={() => updateQty(key, item.qty - 1)}>
                    -
                  </button>
                  <span>{item.qty}</span>
                  <button type="button" onClick={() => updateQty(key, item.qty + 1)}>
                    +
                  </button>
                </div>
              </div>
              <button type="button" className="cart-item-remove" onClick={() => removeFromCart(key)}>
                Remove
              </button>
            </div>
          );
        })}
      </div>

      <div className="cart-summary">
        <div className="cart-summary-row">
          <span>Subtotal</span>
          <strong>₹{subtotal}</strong>
        </div>
        <button type="button" className="primary-btn cart-checkout-btn" onClick={() => navigate('/checkout')}>
          Proceed to checkout
        </button>
      </div>
    </div>
  );
}
