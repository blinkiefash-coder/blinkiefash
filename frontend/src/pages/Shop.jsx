import Navbar from "../components/Navbar";
import "./shop.css";
import { useState, useEffect } from "react";

const CATEGORIES = [
  "Women",
  "Men",
  "Kids",
  "Beauty",
  "Home & Living",
  "Footwear",
  "Accessories",
  "Gifting",
];

const COLORS = [
  ["Pink", "#ec4899"],
  ["Blue", "#2563eb"],
  ["Black", "#111827"],
  ["Green", "#22c55e"],
  ["Purple", "#7c3aed"],
  ["Red", "#ef4444"],
  ["Yellow", "#facc15"],
  ["White", "#ffffff"],
  ["Grey", "#9ca3af"],
];

export default function Shop() {

  const [products, setProducts] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [activeColor, setActiveColor] = useState(null);

  /* ✅ FETCH REAL PRODUCTS */
  useEffect(() => {
    fetch("https://blinkiefash.onrender.com/api/products")
      .then(res => res.json())
      .then(data => {
        console.log("Products:", data);
        setProducts(data);
      })
      .catch(err => console.error(err));
  }, []);

  return (
    <>
      <div className="shop-navbar-wrapper">
        <Navbar />
      </div>

      <div className="shop-page">
        <div className="shop-layout">

          {/* ✅ FILTERS (UI ONLY FOR NOW) */}
          <aside className="shop-filters">
            <div className="shop-filters-inner">

              <h4 className="shop-filter-title">FILTERS</h4>

              <div className="shop-filter-group">
                <h5>Categories</h5>
                {CATEGORIES.map((cat) => (
                  <div
                    key={cat}
                    className={`filter-option ${
                      activeCategory === cat ? "active" : ""
                    }`}
                    onClick={() =>
                      setActiveCategory(activeCategory === cat ? null : cat)
                    }
                  >
                    {cat}
                  </div>
                ))}
              </div>

              <div className="shop-filter-group">
                <h5>Price Range</h5>
                <input
                  type="range"
                  min="100"
                  max="10100"
                  step="100"
                  defaultValue="10100"
                  className="price-slider"
                />
                <div className="price-range-text">
                  ₹100 – ₹10,100+
                </div>
              </div>

              <div className="shop-filter-group">
                <h5>Color</h5>
                <div className="color-grid">
                  {COLORS.map(([name, color]) => (
                    <div
                      key={name}
                      className={`color-option ${
                        activeColor === name ? "active" : ""
                      }`}
                      onClick={() =>
                        setActiveColor(activeColor === name ? null : name)
                      }
                    >
                      <span
                        className="color-dot"
                        style={{ background: color }}
                      />
                      <span>{name}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </aside>

          {/* ✅ PRODUCTS */}
          <section className="shop-products">

            <div className="shop-products-header">
              <div>
                <h2 className="shop-title">All Products</h2>
                <p className="shop-count">
                  Showing {products.length} products
                </p>
              </div>

              <select className="shop-sort">
                <option>Sort by: Popularity</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
              </select>
            </div>

            {/* ✅ PRODUCT GRID */}
            <div className="shop-products-grid">

              {products.map((p) => (
                <div key={p.id} className="shop-product-card">

                  {/* ✅ IMAGE */}
                  
              <div className="shop-product-image">
                <img
                  src={p.image}
                  alt={p.name}
                />
              </div>


                  {/* ✅ NAME */}
                  <h4>{p.name}</h4>

                  {/* ✅ BRAND (fallback) */}
                  <span className="shop-product-brand">
                    {p.brand || "Blinkiefash"}
                  </span>

                  {/* ✅ PRICE */}
                  <span className="shop-product-price">
                    ₹{p.price}
                  </span>

                </div>
              ))}

            </div>

          </section>

        </div>
      </div>

      {/* ✅ FOOTER */}
      <footer className="shop-bottom-bar">
        <div className="shop-bottom-content">
          <span>✅ Try & Buy</span>
          <span>⚡ 60‑min Delivery</span>
          <span>🔒 Secure Payments</span>
          <span>↩ Easy Returns</span>
        </div>

        <div className="shop-bottom-copy">
          © 2026 BlinkieFash · Fashion delivered in a Blink
        </div>
      </footer>
    </>
  );
}