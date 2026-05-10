import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./Wishlist.css";
import { API_API_BASE_URL } from "../apiBase";

export default function Wishlist() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userUuid");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchWishlist = async () => {
    if (!userId) {
      setItems([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`${API_API_BASE_URL}/wishlist/${userId}`);
      const data = await response.json();
      setItems(data.success ? data.items || [] : []);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWishlist();
  }, [userId]);

  const removeItem = async (variantId) => {
    if (!userId) return;

    try {
      await fetch(`${API_API_BASE_URL}/wishlist/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, variantId }),
      });
      window.dispatchEvent(new Event("wishlist:updated"));
      fetchWishlist();
    } catch {
      alert("Unable to remove item right now");
    }
  };

  const clearWishlist = async () => {
    if (!userId) return;

    if (window.confirm("Clear all items from your wishlist?")) {
      try {
        await fetch(`${API_API_BASE_URL}/wishlist/clear/${userId}`, {
          method: "DELETE",
        });
        window.dispatchEvent(new Event("wishlist:updated"));
        setItems([]);
      } catch {
        alert("Unable to clear wishlist right now");
      }
    }
  };

  const moveToCart = async (item) => {
    if (!userId) {
      alert("Please login first");
      return;
    }

    try {
      const addRes = await fetch(`${API_API_BASE_URL}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          variantId: item.variant_id,
          quantity: 1,
        }),
      });
      const addData = await addRes.json();

      if (!addData.success) {
        throw new Error(addData.message || "Unable to move item to cart");
      }

      await fetch(`${API_API_BASE_URL}/wishlist/remove`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, variantId: item.variant_id }),
      });

      window.dispatchEvent(new Event("cart:updated"));
      window.dispatchEvent(new Event("wishlist:updated"));
      fetchWishlist();
      alert("Moved to cart");
    } catch {
      alert("Unable to move to cart right now");
    }
  };

  return (
    <div className="wishlist-page">
      <Navbar />

      <div className="wishlist-content">
        {/* ── HEADER ── */}
        <div className="wl-header">
          <div className="wl-header-left">
            <div className="wl-heart-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </div>
            <div>
              <h1 className="wl-title">My Wishlist ({items.length})</h1>
              <p className="wl-subtitle">Items you love, saved for later.</p>
            </div>
          </div>
          <div className="wl-header-actions">
            <button className="wl-btn-outline wl-btn-danger" onClick={clearWishlist}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              Clear Wishlist
            </button>
          </div>
        </div>

        {/* ── GRID ── */}
        {loading ? (
          <div className="wl-empty">
            <h3>Loading wishlist...</h3>
          </div>
        ) : items.length === 0 ? (
          <div className="wl-empty">
            <svg viewBox="0 0 24 24" fill="none" stroke="#d1d5db" strokeWidth="1.5" width="64" height="64">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            <h3>Your wishlist is empty</h3>
            <p>Save items you love to your wishlist.</p>
            <button className="wl-shop-btn" onClick={() => navigate("/shop")}>Start Shopping</button>
          </div>
        ) : (
          <div className="wl-grid">
            {items.map((item) => (
              <div className="wl-card" key={item.id}>
                {/* Remove button */}
                <button className="wl-remove" onClick={() => removeItem(item.variant_id)}>✕</button>

                {/* Image */}
                <div className="wl-card-img">
                  <img src={item.image} alt={item.name} />
                </div>

                {/* Info */}
                <div className="wl-card-info">
                  <h3 className="wl-product-name">{item.name}</h3>
                  <p className="wl-brand">{item.brand}</p>

                  <div className="wl-price-row">
                    <span className="wl-price">₹{Number(item.discount_price || item.price || 0).toLocaleString("en-IN")}</span>
                    <span className="wl-original-price">₹{Number(item.price || 0).toLocaleString("en-IN")}</span>
                    {Number(item.discount_price || 0) > 0 && Number(item.price || 0) > Number(item.discount_price || 0) ? (
                      <span className="wl-discount">
                        {Math.round(((Number(item.price) - Number(item.discount_price)) / Number(item.price)) * 100)}% OFF
                      </span>
                    ) : null}
                  </div>

                  <div className="wl-meta">
                    <span>Size: {item.size}</span>
                    <span className="wl-divider">|</span>
                    <span>Color: {item.color}</span>
                  </div>

                  {Number(item.available_stock || 0) > 0 && <span className="wl-stock">In Stock</span>}

                  <div className="wl-card-actions">
                    <button className="wl-heart-btn" title="Remove from wishlist" onClick={() => removeItem(item.variant_id)}>
                      <svg viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" strokeWidth="2" width="18" height="18">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                    <button className="wl-cart-btn" onClick={() => moveToCart(item)}>Add to Cart</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── STILL THINKING BANNER ── */}
        {items.length > 0 && (
          <div className="wl-bottom-banner">
            <div className="wl-banner-left">
              <div className="wl-banner-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" strokeWidth="2" width="22" height="22">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
              <div>
                <strong>Still thinking?</strong>
                <p>Move items to cart and make them yours before they're gone.</p>
              </div>
            </div>
            <button className="wl-shop-btn" onClick={() => navigate("/shop")}>
              Continue Shopping →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
