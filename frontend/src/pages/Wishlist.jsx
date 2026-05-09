import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import "./Wishlist.css";

const sampleWishlist = [
  {
    id: 1,
    name: "CIDER Dress",
    brand: "CIDER",
    price: 1499,
    originalPrice: 1999,
    discount: 25,
    size: "M",
    color: "Purple",
    inStock: true,
    image: "/images/dresses.png",
  },
  {
    id: 2,
    name: "Traditional Necklace Set",
    brand: "Jewels",
    price: 599,
    originalPrice: 1999,
    discount: 70,
    size: "One Size",
    color: "Green",
    inStock: true,
    image: "/images/J.png",
  },
  {
    id: 3,
    name: "Nike Low Vision Shoes",
    brand: "Nike",
    price: 5499,
    originalPrice: 6499,
    discount: 15,
    size: "8",
    color: "Brown",
    inStock: true,
    image: "/images/shoes.png",
  },
  {
    id: 4,
    name: "Black Shirt",
    brand: "FOREVER 21",
    price: 1299,
    originalPrice: 1499,
    discount: 13,
    size: "L",
    color: "Black",
    inStock: true,
    image: "/images/Menstopwear.png",
  },
  {
    id: 5,
    name: "Beige Shoulder Bag",
    brand: "Mochi",
    price: 1299,
    originalPrice: 2999,
    discount: 57,
    size: "One Size",
    color: "Beige",
    inStock: true,
    image: "/images/handbag.png",
  },
  {
    id: 6,
    name: "Floral Maxi Dress",
    brand: "W for Woman",
    price: 1899,
    originalPrice: 2599,
    discount: 27,
    size: "M",
    color: "White",
    inStock: true,
    image: "/images/womentopwear.png",
  },
];

export default function Wishlist() {
  const navigate = useNavigate();
  const [items, setItems] = useState(sampleWishlist);

  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearWishlist = () => {
    if (window.confirm("Clear all items from your wishlist?")) {
      setItems([]);
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
            <button className="wl-btn-outline" onClick={() => alert("Share link copied!")}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" />
                <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" /><line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
              </svg>
              Share Wishlist
            </button>
            <button className="wl-btn-outline wl-btn-danger" onClick={clearWishlist}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16">
                <polyline points="3 6 5 6 21 6" /><path d="M19 6l-1 14H6L5 6" /><path d="M10 11v6" /><path d="M14 11v6" /><path d="M9 6V4h6v2" />
              </svg>
              Clear Wishlist
            </button>
          </div>
        </div>

        {/* ── GRID ── */}
        {items.length === 0 ? (
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
                <button className="wl-remove" onClick={() => removeItem(item.id)}>✕</button>

                {/* Image */}
                <div className="wl-card-img">
                  <img src={item.image} alt={item.name} />
                </div>

                {/* Info */}
                <div className="wl-card-info">
                  <h3 className="wl-product-name">{item.name}</h3>
                  <p className="wl-brand">{item.brand}</p>

                  <div className="wl-price-row">
                    <span className="wl-price">₹{item.price.toLocaleString()}</span>
                    <span className="wl-original-price">₹{item.originalPrice.toLocaleString()}</span>
                    <span className="wl-discount">{item.discount}% OFF</span>
                  </div>

                  <div className="wl-meta">
                    <span>Size: {item.size}</span>
                    <span className="wl-divider">|</span>
                    <span>Color: {item.color}</span>
                  </div>

                  {item.inStock && <span className="wl-stock">In Stock</span>}

                  <div className="wl-card-actions">
                    <button className="wl-heart-btn" title="Remove from wishlist" onClick={() => removeItem(item.id)}>
                      <svg viewBox="0 0 24 24" fill="#22c55e" stroke="#22c55e" strokeWidth="2" width="18" height="18">
                        <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                      </svg>
                    </button>
                    <button className="wl-cart-btn">Add to Cart</button>
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
