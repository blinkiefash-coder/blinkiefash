import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./Cart.css";
import { API_API_BASE_URL } from "../apiBase";

const OFFERS = [
  { code: "BLINK10", desc: "Get 10% instant discount on all orders" },
  { code: "FESTIVE20", desc: "Get flat 20% off on orders above ₹2999" },
];

export default function Cart() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userUuid");
  const [items, setItems] = useState([]);
  const [checked, setChecked] = useState([]);
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [priceOpen, setPriceOpen] = useState(true);

  const loadCart = async () => {
    if (!userId) {
      setItems([]);
      setChecked([]);
      return;
    }

    try {
      const response = await fetch(`${API_API_BASE_URL}/cart/${userId}`);
      const data = await response.json();
      const nextItems = data.success ? data.items || [] : [];

      setItems(nextItems);
      setChecked((prev) => {
        if (prev.length > 0) {
          return prev.filter((variantId) =>
            nextItems.some((entry) => String(entry.variant_id) === String(variantId))
          );
        }
        return nextItems.map((entry) => entry.variant_id);
      });
    } catch {
      setItems([]);
    }
  };

  useEffect(() => {
    loadCart();
  }, [userId]);

  const toggleCheck = (id) =>
    setChecked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const changeQty = (variantId, delta) => {
    const currentItem = items.find(
      (item) => String(item.variant_id) === String(variantId)
    );
    if (!currentItem) return;

    const nextQty = Math.max(1, Number(currentItem.quantity || 1) + delta);

    fetch(`${API_API_BASE_URL}/cart/quantity`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, variantId, quantity: nextQty }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.message || "Unable to update quantity");
        }
        window.dispatchEvent(new Event("cart:updated"));
        loadCart();
      })
      .catch(() => {
        alert("Unable to update quantity right now");
      });
  };

  const removeItem = (variantId) => {
    fetch(`${API_API_BASE_URL}/cart/remove`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, variantId }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.message || "Unable to remove item");
        }
        setChecked((prev) => prev.filter((x) => String(x) !== String(variantId)));
        window.dispatchEvent(new Event("cart:updated"));
        loadCart();
      })
      .catch(() => {
        alert("Unable to remove item right now");
      });
  };

  const selectedItems = items.filter((i) => checked.includes(i.variant_id));
  const totalMRP = selectedItems.reduce((s, i) => s + Number(i.price || 0) * Number(i.quantity || 1), 0);
  const totalPrice = selectedItems.reduce((s, i) => s + Number(i.discount_price || i.price || 0) * Number(i.quantity || 1), 0);
  const discount = totalMRP - totalPrice;
  const freeDeliveryThreshold = 999;
  const deliveryProgress = Math.min((totalPrice / freeDeliveryThreshold) * 100, 100);
  const isFreeDelivery = totalPrice >= freeDeliveryThreshold;

  return (
    <div className="cart-page">
      <Navbar />

      <div className="cart-content">
        {/* ═══════════ LEFT ═══════════ */}
        <div className="cart-left">
          <div className="cart-header">
            <div className="cart-title-row">
              <div className="cart-bag-icon">🛍️</div>
              <div>
                <h1 className="cart-title">My Cart ({items.length})</h1>
                <p className="cart-subtitle">Review your items before checkout.</p>
              </div>
            </div>
            <div className="cart-secure">
              <span className="secure-icon">✅</span> 100% Secure Checkout
            </div>
          </div>

          {/* ITEMS */}
          <div className="cart-items">
            {items.length === 0 ? (
              <div className="cart-empty">
                <span>🛒</span>
                <h3>Your cart is empty</h3>
                <p>Add items to get started.</p>
                <button className="cart-shop-btn" onClick={() => navigate("/shop")}>Start Shopping</button>
              </div>
            ) : (
              items.map((item) => (
                <div className="cart-item" key={item.variant_id}>
                  <input
                    type="checkbox"
                    className="cart-checkbox"
                    checked={checked.includes(item.variant_id)}
                    onChange={() => toggleCheck(item.variant_id)}
                  />

                  <div className="cart-item-img">
                    <img src={item.image} alt={item.name} />
                  </div>

                  <div className="cart-item-info">
                    <h3 className="ci-name">{item.name}</h3>
                    <p className="ci-brand">{item.brand}</p>
                    <div className="ci-meta">
                      <span>Size: {item.size}</span>
                      <span className="ci-sep">|</span>
                      <span>Color: {item.color}</span>
                    </div>
                    <div className="ci-badges">
                      {item.inStock && <span className="ci-stock">In Stock</span>}
                      <span className="ci-delivery">🚚 Delivery in 60 min</span>
                    </div>
                  </div>

                  <div className="cart-item-right">
                    <div className="ci-price-row">
                      <span className="ci-price">₹{Number(item.discount_price || item.price || 0).toLocaleString('en-IN')}</span>
                      <span className="ci-original">₹{Number(item.price || 0).toLocaleString('en-IN')}</span>
                      {Number(item.discount_price || 0) > 0 && Number(item.price || 0) > Number(item.discount_price || 0) ? (
                        <span className="ci-discount">
                          {Math.round(((Number(item.price) - Number(item.discount_price)) / Number(item.price)) * 100)}% OFF
                        </span>
                      ) : null}
                    </div>

                    <div className="ci-qty">
                      <button onClick={() => changeQty(item.variant_id, -1)}>−</button>
                      <span>{item.quantity}</span>
                      <button onClick={() => changeQty(item.variant_id, 1)}>+</button>
                    </div>
                  </div>

                  <button className="ci-delete" onClick={() => removeItem(item.variant_id)} title="Remove">
                    🗑️
                  </button>
                </div>
              ))
            )}
          </div>

          {/* SAFE PAYMENT */}
          <div className="cart-safe">
            <span>🔒</span>
            <div>
              <strong>Safe &amp; Secure Payments</strong>
              <p>Your payment details are protected with industry-leading security.</p>
            </div>
          </div>
        </div>

        {/* ═══════════ RIGHT — ORDER SUMMARY ═══════════ */}
        <div className="cart-right">
          <div className="order-card">
            <h2 className="order-title">Order Summary</h2>

            {/* PRICE DETAILS */}
            <div className="price-section">
              <button className="price-toggle" onClick={() => setPriceOpen(!priceOpen)}>
                <span>Price Details</span>
                <span className={`toggle-arrow ${priceOpen ? "open" : ""}`}>▾</span>
              </button>

              {priceOpen && (
                <div className="price-rows">
                  <div className="price-row">
                    <span>Total MRP</span>
                    <span>₹{totalMRP.toLocaleString()}</span>
                  </div>
                  <div className="price-row discount-row">
                    <span>Discount on MRP</span>
                    <span className="green-text">−₹{discount.toLocaleString()}</span>
                  </div>
                  <div className="price-row">
                    <span>Delivery Charges <span className="info-icon">ⓘ</span></span>
                    <span className="green-text">{isFreeDelivery ? "FREE" : `₹49`}</span>
                  </div>
                  <div className="price-divider" />
                  <div className="price-row total-row">
                    <span>Total Amount</span>
                    <span className="total-amount">₹{totalPrice.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="savings-banner">
              🎉 You save <strong>₹{discount.toLocaleString()}</strong> on this order!
            </div>

            {/* FREE DELIVERY PROGRESS */}
            {!isFreeDelivery && (
              <div className="delivery-progress">
                <p>🚚 Add items worth <strong>₹{(freeDeliveryThreshold - totalPrice).toLocaleString()}</strong> more to unlock FREE delivery</p>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${deliveryProgress}%` }} />
                </div>
                <div className="progress-labels">
                  <span>₹0</span><span>₹{freeDeliveryThreshold}</span>
                </div>
              </div>
            )}

            {/* COUPON */}
            <div className="coupon-section">
              <p className="coupon-label">Have a coupon?</p>
              <div className="coupon-input-row">
                <input
                  type="text"
                  placeholder="Enter coupon code"
                  value={coupon}
                  onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                  className="coupon-input"
                />
                <button
                  className="coupon-apply"
                  onClick={() => {
                    const found = OFFERS.find((o) => o.code === coupon);
                    if (found) { setAppliedCoupon(found); }
                    else { alert("Invalid coupon code"); }
                  }}
                >
                  Apply
                </button>
              </div>
              {appliedCoupon && (
                <div className="coupon-applied">
                  ✅ <strong>{appliedCoupon.code}</strong> applied — {appliedCoupon.desc}
                  <button onClick={() => { setAppliedCoupon(null); setCoupon(""); }}>✕</button>
                </div>
              )}
            </div>

            {/* OFFERS */}
            <div className="offers-section">
              <p className="offers-label">Offers for you</p>
              {OFFERS.map((offer) => (
                <div className="offer-row" key={offer.code}>
                  <div className="offer-info">
                    <span className="offer-tag">• {offer.code}</span>
                    <span className="offer-desc">{offer.desc}</span>
                  </div>
                  <button
                    className="offer-apply"
                    onClick={() => { setCoupon(offer.code); setAppliedCoupon(offer); }}
                  >
                    Apply
                  </button>
                </div>
              ))}
              <button className="view-more-offers">View More Offers →</button>
            </div>

            {/* CHECKOUT BUTTONS */}
            <button
              className="checkout-btn"
              disabled={selectedItems.length === 0}
              onClick={() => alert("Proceeding to checkout...")}
            >
              Proceed to Checkout →
            </button>
            <button className="continue-btn" onClick={() => navigate("/shop")}>
              Continue Shopping
            </button>

            <button
              className="continue-btn"
              onClick={() => {
                fetch(`${API_API_BASE_URL}/cart/clear/${userId}`, {
                  method: "DELETE",
                })
                  .then((res) => res.json())
                  .then((data) => {
                    if (!data.success) {
                      throw new Error(data.message || "Unable to clear cart");
                    }
                    setChecked([]);
                    window.dispatchEvent(new Event("cart:updated"));
                    loadCart();
                  })
                  .catch(() => {
                    alert("Unable to clear cart right now");
                  });
              }}
            >
              Clear Cart
            </button>

            {/* TRY & BUY */}
            <div className="try-buy-card">
              <div className="try-buy-header">
                <span>Try &amp; Buy with BlinkieFash</span>
                <span className="try-buy-badge">New</span>
              </div>
              <div className="try-buy-features">
                <div className="tbf">
                  <span>✅</span>
                  <p>Pay now &amp; hold securely</p>
                </div>
                <div className="tbf">
                  <span>👗</span>
                  <p>Try at home for 7 days</p>
                </div>
                <div className="tbf">
                  <span>↩️</span>
                  <p>Return easily, get fast refund</p>
                </div>
              </div>
              <button className="try-buy-btn">Know More About Try &amp; Buy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
