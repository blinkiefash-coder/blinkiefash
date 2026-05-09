import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./Cart.css";

const sampleCart = [
  { id: 1, name: "CIDER Dress", brand: "CIDER", price: 1499, originalPrice: 1999, discount: 25, size: "M", color: "Purple", inStock: true, image: "/images/dresses.png", qty: 1 },
  { id: 2, name: "Traditional Necklace Set", brand: "Jewels", price: 599, originalPrice: 1999, discount: 70, size: "One Size", color: "Green", inStock: true, image: "/images/J.png", qty: 1 },
  { id: 3, name: "Nike Low Vision Shoes", brand: "Nike", price: 5499, originalPrice: 6499, discount: 15, size: "8", color: "Brown", inStock: true, image: "/images/shoes.png", qty: 1 },
  { id: 4, name: "Black Shirt", brand: "FOREVER 21", price: 1299, originalPrice: 1499, discount: 13, size: "L", color: "Black", inStock: true, image: "/images/Menstopwear.png", qty: 1 },
  { id: 5, name: "Beige Shoulder Bag", brand: "Mochi", price: 1299, originalPrice: 2999, discount: 57, size: "One Size", color: "Beige", inStock: true, image: "/images/handbag.png", qty: 1 },
  { id: 6, name: "Floral Maxi Dress", brand: "W for Woman", price: 1899, originalPrice: 2599, discount: 27, size: "M", color: "White", inStock: true, image: "/images/womentopwear.png", qty: 1 },
];

const OFFERS = [
  { code: "BLINK10", desc: "Get 10% instant discount on all orders" },
  { code: "FESTIVE20", desc: "Get flat 20% off on orders above ₹2999" },
];

export default function Cart() {
  const navigate = useNavigate();
  const [items, setItems] = useState(sampleCart);
  const [checked, setChecked] = useState(sampleCart.map((i) => i.id));
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState(null);
  const [priceOpen, setPriceOpen] = useState(true);

  const toggleCheck = (id) =>
    setChecked((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);

  const changeQty = (id, delta) =>
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, qty: Math.max(1, item.qty + delta) } : item
      )
    );

  const removeItem = (id) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    setChecked((prev) => prev.filter((x) => x !== id));
  };

  const selectedItems = items.filter((i) => checked.includes(i.id));
  const totalMRP = selectedItems.reduce((s, i) => s + i.originalPrice * i.qty, 0);
  const totalPrice = selectedItems.reduce((s, i) => s + i.price * i.qty, 0);
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
                <div className="cart-item" key={item.id}>
                  <input
                    type="checkbox"
                    className="cart-checkbox"
                    checked={checked.includes(item.id)}
                    onChange={() => toggleCheck(item.id)}
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
                      <span className="ci-price">₹{item.price.toLocaleString()}</span>
                      <span className="ci-original">₹{item.originalPrice.toLocaleString()}</span>
                      <span className="ci-discount">{item.discount}% OFF</span>
                    </div>

                    <div className="ci-qty">
                      <button onClick={() => changeQty(item.id, -1)}>−</button>
                      <span>{item.qty}</span>
                      <button onClick={() => changeQty(item.id, 1)}>+</button>
                    </div>
                  </div>

                  <button className="ci-delete" onClick={() => removeItem(item.id)} title="Remove">
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
