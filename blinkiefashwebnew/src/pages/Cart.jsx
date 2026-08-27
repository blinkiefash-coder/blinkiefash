import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdClose,
  MdDeleteOutline,
  MdSaveAlt,
  MdFavoriteBorder,
  MdBolt,
  MdCheckCircleOutline,
  MdLocalShipping,
  MdAutorenew,
  MdKeyboardArrowDown,
  MdArrowForward,
} from "react-icons/md";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import "./Cart.css";
import PageSEO from "../components/PageSEO";
import fastDeliveryIcon from "../assets/fastdelivery.png";

const SAVED_FOR_LATER_KEY = "bfw_saved_for_later";
const FREE_DELIVERY_THRESHOLD = 999;

export default function Cart() {
  const navigate = useNavigate();
  const { items, updateQty, removeFromCart, addToCart, subtotal, count } =
    useCart();
  const { toggleWishlist } = useWishlist();

  const [savedItems, setSavedItems] = useState(() => {
    try {
      const stored = JSON.parse(
        localStorage.getItem(SAVED_FOR_LATER_KEY) || "[]"
      );
      return Array.isArray(stored) ? stored : [];
    } catch {
      return [];
    }
  });
  const [priceDetailsOpen, setPriceDetailsOpen] = useState(false);

  const persistSaved = (next) => {
    setSavedItems(next);
    try {
      localStorage.setItem(SAVED_FOR_LATER_KEY, JSON.stringify(next));
    } catch {
      // ignore storage errors
    }
  };

  const keyOf = (item) => item.variantId || item.productId;

  const handleSaveForLater = (item, key) => {
    const next = [item, ...savedItems.filter((saved) => keyOf(saved) !== key)];
    persistSaved(next);
    removeFromCart(key);
  };

  const handleMoveToWishlist = (item, key) => {
    toggleWishlist({
      productId: item.productId,
      name: item.name,
      image: item.image,
      price: item.price,
    });
    removeFromCart(key);
  };

  const handleRemoveSaved = (item) => {
    persistSaved(savedItems.filter((saved) => keyOf(saved) !== keyOf(item)));
  };

  const handleMoveBackToCart = (item) => {
    handleRemoveSaved(item);
    addToCart(item);
  };

  if (items.length === 0 && savedItems.length === 0) {
    return (
      <div className="page cart-page">
        <PageSEO
          title="Your Cart"
          description="Review your cart items and proceed to checkout."
          path="/cart"
          noIndex
        />
        <h1 className="cart-title">Your cart</h1>
        <p className="state-msg">Your cart is empty.</p>
        <button
          type="button"
          className="primary-btn"
          onClick={() => navigate("/shop")}
        >
          Start shopping
        </button>
      </div>
    );
  }

  const totalMrp = items.reduce(
    (sum, item) =>
      sum + Number(item.mrp ?? item.price ?? 0) * Number(item.qty || 1),
    0
  );
  const totalSavings = Math.max(0, totalMrp - subtotal);

  const amountToFreeDelivery = Math.max(0, FREE_DELIVERY_THRESHOLD - subtotal);
  const freeDeliveryProgress = Math.min(
    100,
    Math.round((subtotal / FREE_DELIVERY_THRESHOLD) * 100)
  );

  return (
    <div className="page cart-page">
      <PageSEO
        title="Your Cart"
        description="Review your cart items and proceed to checkout."
        path="/cart"
        noIndex
      />

      <div className="cart-header-row">
        <div>
          <h1 className="cart-title">My Cart ({items.length})</h1>
          <p className="cart-subtitle">
            {items.length} {items.length === 1 ? "item" : "items"} • Total{" "}
            {count} {count === 1 ? "item" : "items"}
          </p>
        </div>
        <span className="cart-secure-badge">
          <MdCheckCircleOutline size={16} /> Secure Checkout
        </span>
      </div>

      {items.length > 0 ? (
        <div className="cart-list">
          {items.map((item) => {
            const key = keyOf(item);
            const lineTotal = Number(item.price || 0) * Number(item.qty || 1);
            return (
              <article className="cart-item-card" key={key}>
                <div className="cart-item-top">
                  <div className="cart-item-media">
                    {item.image ? (
                      <img src={item.image} alt={item.name} />
                    ) : null}
                  </div>

                  <div className="cart-item-info">
                    <p className="cart-item-name">{item.name}</p>
                    {(item.color || item.size) && (
                      <p className="cart-item-variant">
                        {item.color ? <span>Color: {item.color}</span> : null}
                        {item.color && item.size ? (
                          <span className="cart-item-variant-sep" />
                        ) : null}
                        {item.size ? <span>Size: {item.size}</span> : null}
                      </p>
                    )}
                    <p className="cart-item-price">
                      ₹{Number(item.price).toLocaleString("en-IN")}
                    </p>

                    <div className="cart-item-qty">
                      <button
                        type="button"
                        onClick={() =>
                          updateQty(key, Math.max(1, item.qty - 1))
                        }
                        aria-label="Decrease quantity"
                      >
                        −
                      </button>
                      <span>{item.qty}</span>
                      <button
                        type="button"
                        onClick={() => updateQty(key, item.qty + 1)}
                        aria-label="Increase quantity"
                      >
                        +
                      </button>
                    </div>

                    <p className="cart-item-stock">In stock</p>
                  </div>

                  <div className="cart-item-side">
                    <button
                      type="button"
                      className="cart-item-close"
                      onClick={() => removeFromCart(key)}
                      aria-label="Remove item"
                    >
                      <MdClose />
                    </button>
                    <span className="cart-item-delivery">
                      <MdBolt size={13} /> 60-min delivery
                    </span>
                    <strong className="cart-item-linetotal">
                      ₹{lineTotal.toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>

                <div className="cart-item-actions">
                  <button
                    type="button"
                    className="cart-action"
                    onClick={() => removeFromCart(key)}
                  >
                    <MdDeleteOutline /> Remove
                  </button>
                  <button
                    type="button"
                    className="cart-action"
                    onClick={() => handleSaveForLater(item, key)}
                  >
                    <MdSaveAlt /> Save for later
                  </button>
                  <button
                    type="button"
                    className="cart-action cart-action-wishlist"
                    onClick={() => handleMoveToWishlist(item, key)}
                  >
                    <MdFavoriteBorder /> Move to wishlist
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="state-msg">Your cart is empty.</p>
      )}

      {savedItems.length > 0 && (
        <section className="cart-saved-section">
          <h2 className="cart-saved-title">
            Saved for later ({savedItems.length})
          </h2>
          <div className="cart-list">
            {savedItems.map((item) => {
              const key = keyOf(item);
              return (
                <article
                  className="cart-item-card cart-item-card-saved"
                  key={key}
                >
                  <div className="cart-item-top">
                    <div className="cart-item-media">
                      {item.image ? (
                        <img src={item.image} alt={item.name} />
                      ) : null}
                    </div>
                    <div className="cart-item-info">
                      <p className="cart-item-name">{item.name}</p>
                      <p className="cart-item-price">
                        ₹{Number(item.price).toLocaleString("en-IN")}
                      </p>
                    </div>
                  </div>
                  <div className="cart-item-actions">
                    <button
                      type="button"
                      className="cart-action"
                      onClick={() => handleRemoveSaved(item)}
                    >
                      <MdDeleteOutline /> Remove
                    </button>
                    <button
                      type="button"
                      className="cart-action cart-action-primary"
                      onClick={() => handleMoveBackToCart(item)}
                    >
                      Move to cart
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      )}

      {items.length > 0 && (
        <div className="cart-checkout-footer">
          <div className="cart-checkout-footer-inner">
            {amountToFreeDelivery > 0 ? (
              <button
                type="button"
                className="cart-delivery-progress"
                onClick={() => navigate("/shop")}
                aria-label="Add another item to get free delivery"
              >
                <span className="cart-delivery-icon">
                  <MdLocalShipping />
                </span>

                <div className="cart-delivery-progress-body">
                  <p>Add 1 more item to get FREE delivery</p>
                  <div className="cart-progress-track">
                    <div
                      className="cart-progress-fill"
                      style={{ width: `${freeDeliveryProgress}%` }}
                    />
                  </div>
                </div>

                <span className="cart-delivery-remaining">
                  ₹{amountToFreeDelivery.toLocaleString("en-IN")} more to go
                </span>
              </button>
            ) : (
              <div className="cart-delivery-progress cart-delivery-complete">
                <span className="cart-delivery-icon">
                  <img
                    src={fastDeliveryIcon}
                    alt="Fast delivery"
                    className="cart-delivery-icon-img"
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      e.currentTarget.parentElement.dataset.fallback = "true";
                    }}
                  />
                </span>

                <div className="cart-delivery-progress-body">
                  <p>FREE delivery unlocked!</p>
                  <div className="cart-progress-track">
                    <div
                      className="cart-progress-fill"
                      style={{ width: "100%" }}
                    />
                  </div>
                </div>

                <span className="cart-delivery-remaining">FREE delivery</span>
              </div>
            )}

            <div className="cart-summary">
              <div className="cart-summary-left">
                <p className="cart-savings-line">
                  <MdAutorenew size={15} /> You will save ₹
                  {totalSavings.toLocaleString("en-IN")} on this order
                </p>
                <button
                  type="button"
                  className="cart-price-details-toggle"
                  onClick={() => setPriceDetailsOpen((prev) => !prev)}
                >
                  View price details
                  <MdKeyboardArrowDown
                    className={priceDetailsOpen ? "open" : ""}
                  />
                </button>
                {priceDetailsOpen && (
                  <div className="cart-price-details">
                    <div>
                      <span>Total MRP</span>
                      <span>₹{totalMrp.toLocaleString("en-IN")}</span>
                    </div>
                    <div>
                      <span>Discount on MRP</span>
                      <span>−₹{totalSavings.toLocaleString("en-IN")}</span>
                    </div>
                    <div>
                      <span>Delivery</span>
                      <span>
                        {amountToFreeDelivery > 0
                          ? "Calculated at checkout"
                          : "FREE"}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              <div className="cart-summary-right">
                <div className="cart-summary-total">
                  <span>Total Amount</span>
                  <strong>₹{subtotal.toLocaleString("en-IN")}</strong>
                </div>
                <button
                  type="button"
                  className="cart-checkout-btn"
                  onClick={() => navigate("/checkout")}
                >
                  Proceed to Checkout <MdArrowForward size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}