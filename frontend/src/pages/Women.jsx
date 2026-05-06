import Navbar from "../components/Navbar";
import "./women.css";
import { useState } from "react";

const WOMEN_SUB_CATEGORIES = [
  "Top Wear",
  "Dresses",
  "Bottom Wear",
  "Ethnic Wear",
  "Inner Wear",
  "Sleep Wear",
  "Footwear",
  "Accessories",
];

const WOMEN_PRODUCTS = [
  { id: 1, name: "Floral Print Dress", price: 1299 },
  { id: 2, name: "Bodycon Dress", price: 899 },
  { id: 3, name: "Linen Co‑ord Set", price: 1499 },
  { id: 4, name: "Oversized Shirt", price: 799 },
  { id: 5, name: "Straight Fit Jeans", price: 1399 },
  { id: 6, name: "Crop Top", price: 499 },
  { id: 7, name: "Ethnic Kurta Set", price: 1599 },
  { id: 8, name: "Heels", price: 999 },
];

export default function Women() {
  const [activeSub, setActiveSub] = useState("Top Wear");

  return (
    <>
      {/* Navbar with WOMEN active */}
      <Navbar active="WOMEN" />

      {/* Women sub-category strip */}
      <div className="women-subcategory-strip">
        {WOMEN_SUB_CATEGORIES.map((cat) => (
          <div
            key={cat}
            className={`women-subcategory ${activeSub === cat ? "active" : ""}`}
            onClick={() => setActiveSub(cat)}
          >
            {cat}
          </div>
        ))}
      </div>

      {/* Main layout */}
      <div className="women-page">
        <div className="women-layout">

          {/* LEFT FILTERS */}
          <aside className="women-filters">
            <div className="women-filters-inner">

              <h4>FILTERS</h4>

              {/* WOMEN CATEGORIES */}
              <div className="filter-group">
                <h5>Dresses</h5>
                <span>Casual Dresses</span>
                <span>Party Dresses</span>
                <span>Ethnic Dresses</span>
                <span>Maxi Dresses</span>
              </div>

              <div className="filter-group">
                <h5>Accessories</h5>
                <span>Handbags</span>
                <span>Jewellery</span>
                <span>Watches</span>
                <span>Sunglasses</span>
              </div>

              {/* PRICE */}
              <div className="filter-group">
                <h5>Price Range</h5>
                <input type="range" min="200" max="5000" />
                <span className="price-range">₹200 – ₹5000+</span>
              </div>

              {/* SIZE */}
              <div className="filter-group">
                <h5>Size</h5>
                <div className="size-grid">
                  {["XS","S","M","L","XL"].map(size => (
                    <span key={size} className="size-pill">{size}</span>
                  ))}
                </div>
              </div>

            </div>
          </aside>

          {/* RIGHT PRODUCTS */}
          <section className="women-products">
            <div className="women-header">
              <div>
                <h2>Women</h2>
                <p>Showing 1 – {WOMEN_PRODUCTS.length} of 1232 products</p>
              </div>

              <select>
                <option>Sort by Popularity</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
              </select>
            </div>

            <div className="women-product-grid">
              {WOMEN_PRODUCTS.map((p) => (
                <div key={p.id} className="women-product-card">
                  <div className="women-product-image">Image</div>
                  <h4>{p.name}</h4>
                  <strong>₹{p.price}</strong>
                </div>
              ))}
            </div>
          </section>

        </div>
      </div>
    </>
  );
}