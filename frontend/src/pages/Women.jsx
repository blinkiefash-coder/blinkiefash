import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import "./women.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";

const API_BASE = API_API_BASE_URL;

const SIDEBAR_CATEGORIES = [
  "All",
  "Dresses",
  "Tops",
  "T-Shirts",
  "Jeans",
  "Ethnic",
  "Co-ords",
  "Shrugs",
  "Jumpsuits",
  "Skirts",
  "Blazers",
  "Lingerie",
  "Accessories",
  "Footwear",
  "Sleepwear",
];

const PROMOS = [
  { title: "Summer Fresh", subtitle: "New Arrivals", image: "/images/Womenethnic.png" },
  { title: "Bestsellers", subtitle: "Loved by Thousands", image: "/images/womentopwear.png" },
  { title: "Trending Now", subtitle: "What’s Hot", image: "/images/beauty.png" },
  { title: "Top Fits for You", subtitle: "Handpicked Styles", image: "/images/dresses.png" },
];

const PRODUCTS = [
  { id: 1, name: "Floral Print Fit & Flare Dress", price: 1299, mrp: 1899, discount: 33, image: "/images/dresses.png", rating: 4.6 },
  { id: 2, name: "Women Puff Sleeve Top", price: 899, mrp: 1299, discount: 30, image: "/images/womentopwear.png", rating: 4.4 },
  { id: 3, name: "Embroidered A-Line Kurta Set", price: 1499, mrp: 1999, discount: 25, image: "/images/Womenethnic.png", rating: 4.5 },
  { id: 4, name: "Linen Co-ord Set", price: 1799, mrp: 2249, discount: 20, image: "/images/cloth.png", rating: 4.8 },
  { id: 5, name: "High Rise Straight Jeans", price: 1999, mrp: 2499, discount: 20, image: "/images/bottomwear.png", rating: 4.3 },
  { id: 6, name: "Everyday Shoulder Bag", price: 1199, mrp: 1599, discount: 25, image: "/images/handbag.png", rating: 4.7 },
  { id: 7, name: "Minimal Heel Sandals", price: 1499, mrp: 1799, discount: 17, image: "/images/shoes.png", rating: 4.2 },
  { id: 8, name: "Daily Wear Light Blazer", price: 2299, mrp: 2999, discount: 23, image: "/images/Men-section.png", rating: 4.4 },
];

const BENEFITS = [
  {
    title: "60 Min Delivery",
    text: "Fast delivery in your location",
    icon: "truck",
  },
  {
    title: "Try & Buy",
    text: "Try for 15 mins. Pay if you love it.",
    icon: "bag",
  },
  {
    title: "Easy Returns",
    text: "Hassle-free returns",
    icon: "returns",
  },
  {
    title: "100% Secure Payments",
    text: "Safe & trusted payments",
    icon: "lock",
  },
];

const HERO_CARDS = [
  { title: "Dress Bold. Move Light.", subtitle: "Flowy fits, soft layers, and fresh summer energy.", image: "/images/Women-section.png", accentImage: "/images/beauty-section.png", cta: "Shop Now" },
  { title: "Festive Looks, Elevated.", subtitle: "Celebrate in silhouettes that feel rich and effortless.", image: "/images/Womenethnic.png", accentImage: "/images/jwellery.png", cta: "Explore" },
  { title: "Everyday Chic, Refined.", subtitle: "Clean cuts, easy layers, and polished essentials.", image: "/images/womentopwear.png", accentImage: "/images/handbag.png", cta: "Shop Now" },
  { title: "Color Meets Confidence.", subtitle: "Fresh tones and bold moods for the season ahead.", image: "/images/dresses.png", accentImage: "/images/perfumes.png", cta: "View Styles" },
];

const iconPaths = {
  truck: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="1.5" y="7" width="11" height="8" rx="1.5" />
      <path d="M12.5 10H17l3.5 3.5V15h-8" />
      <circle cx="6" cy="17.5" r="1.8" />
      <circle cx="17" cy="17.5" r="1.8" />
    </svg>
  ),
  bag: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 8h12l-1 11H7L6 8Z" />
      <path d="M9 8a3 3 0 0 1 6 0" />
    </svg>
  ),
  returns: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7h8a6 6 0 1 1 0 12H6" />
      <path d="M6 4 2 8l4 4" />
    </svg>
  ),
  lock: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="10" width="16" height="10" rx="2" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
    </svg>
  ),
};

export default function Women() {
  const navigate = useNavigate();
  const location = useLocation();
  const [activeCategory, setActiveCategory] = useState("All");
  const [sortBy, setSortBy] = useState("popularity");
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [activeHeroIndex, setActiveHeroIndex] = useState(0);
  const [categoriesVisible, setCategoriesVisible] = useState(true);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const response = await fetch(`${API_BASE}/categories`);
        const data = await response.json();
        setCategories(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load categories for Women page:", error);
        setCategories([]);
      }
    };

    loadCategories();
  }, []);

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const response = await fetch(`${API_BASE}/products`);
        const data = await response.json();
        setProducts(Array.isArray(data) ? data : []);
      } catch (error) {
        console.error("Failed to load products for Women page:", error);
        setProducts([]);
      }
    };

    loadProducts();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroIndex((current) => (current + 1) % HERO_CARDS.length);
    }, 4500);

    return () => window.clearInterval(timer);
  }, []);

  const childrenByParent = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => {
      const parentKey = category.parent_id || "ROOT";
      if (!map.has(parentKey)) map.set(parentKey, []);
      map.get(parentKey).push(category);
    });

    map.forEach((items) => items.sort((a, b) => a.name.localeCompare(b.name)));
    return map;
  }, [categories]);

  const womenRoot = useMemo(
    () => categories.find((category) => category.name?.toLowerCase() === "women") || null,
    [categories]
  );

  const womenSidebarTree = useMemo(() => {
    if (!womenRoot) {
      return SIDEBAR_CATEGORIES.slice(1).map((name, index) => ({
        id: `fallback-${index}`,
        name,
        children: [],
      }));
    }

    const buildTree = (parentId) => {
      const items = childrenByParent.get(parentId) || [];
      return items.map((category) => ({
        id: category.id,
        name: category.name,
        children: buildTree(category.id),
      }));
    };

    return buildTree(womenRoot.id);
  }, [childrenByParent, womenRoot]);

  const renderCategoryTree = (items, depth = 0) => (
    <ul className={`women-sidebar-tree depth-${depth}`}>
      {items.map((item) => (
        <li key={item.id}>
          <button
            type="button"
            className={`women-sidebar-node ${activeCategory === item.name ? "active" : ""}`}
            onClick={() => setActiveCategory(item.name)}
          >
            {item.children.length > 0 ? <span className="women-sidebar-node-marker">▾</span> : <span className="women-sidebar-node-marker">•</span>}
            <span>{item.name}</span>
          </button>
          {item.children.length > 0 ? renderCategoryTree(item.children, depth + 1) : null}
        </li>
      ))}
    </ul>
  );

  const selectedCategoryNode = useMemo(() => {
    if (activeCategory === "All") return null;

    const queue = [...womenSidebarTree];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current.name === activeCategory) return current;
      current.children.forEach((child) => queue.push(child));
    }

    return null;
  }, [activeCategory, womenSidebarTree]);

  useEffect(() => {
    const queryCategory = new URLSearchParams(location.search).get("category");
    if (!queryCategory) return;

    const normalizedQuery = queryCategory.trim().toLowerCase();

    if (normalizedQuery === "all") {
      setActiveCategory("All");
      return;
    }

    const queue = [...womenSidebarTree];
    while (queue.length > 0) {
      const current = queue.shift();
      if (current.name?.trim().toLowerCase() === normalizedQuery) {
        setActiveCategory(current.name);
        return;
      }
      current.children.forEach((child) => queue.push(child));
    }

    const fallbackMatch = SIDEBAR_CATEGORIES.find(
      (categoryName) => categoryName.trim().toLowerCase() === normalizedQuery
    );

    if (fallbackMatch) {
      setActiveCategory(fallbackMatch);
    }
  }, [location.search, womenSidebarTree]);

  const selectedCategoryIds = useMemo(() => {
    if (!selectedCategoryNode) return null;

    const ids = new Set();
    const queue = [selectedCategoryNode];

    while (queue.length > 0) {
      const current = queue.shift();
      ids.add(current.id);
      current.children.forEach((child) => queue.push(child));
    }

    return ids;
  }, [selectedCategoryNode]);

  const womenCategoryIds = useMemo(() => {
    if (!womenRoot) return null;

    const ids = new Set([womenRoot.id]);
    const queue = [...womenSidebarTree];

    while (queue.length > 0) {
      const current = queue.shift();
      ids.add(current.id);
      current.children.forEach((child) => queue.push(child));
    }

    return ids;
  }, [womenRoot, womenSidebarTree]);

  const visibleProducts = useMemo(() => {
    const sourceProducts = products.length > 0 ? products : PRODUCTS;
    const items = sourceProducts
      .filter((product) => {
        if (products.length === 0) return true;

        const categoryIdsToMatch = selectedCategoryIds || womenCategoryIds;
        const gender = String(product.gender || "").toLowerCase();
        const matchesCategory = !categoryIdsToMatch || (product.category_id && categoryIdsToMatch.has(product.category_id));
        const matchesGenderFallback = !womenCategoryIds && (gender === "women" || gender === "female");

        return matchesCategory || matchesGenderFallback;
      })
      .map((product, index) => {
        if (products.length === 0) return product;

        const basePrice = Number(product.price || 0);
        const salePrice = Number(product.discount_price || product.price || 0);
        const discount = basePrice > salePrice && basePrice > 0
          ? Math.round(((basePrice - salePrice) / basePrice) * 100)
          : 0;

        return {
          id: product.id,
          name: product.name,
          price: salePrice,
          mrp: basePrice,
          discount,
          image: product.image || "/images/dresses.png",
          rating: 4.2 + ((index % 5) * 0.1),
        };
      });

    if (sortBy === "price-low") {
      items.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price-high") {
      items.sort((a, b) => b.price - a.price);
    } else if (sortBy === "discount") {
      items.sort((a, b) => b.discount - a.discount);
    }

    if (products.length === 0 && activeCategory !== "All") {
      return items.filter((item) => {
        const name = item.name.toLowerCase();
        const category = activeCategory.toLowerCase();
        if (category === "dresses") return name.includes("dress");
        if (category === "tops") return name.includes("top") || name.includes("shirt");
        if (category === "t-shirts") return name.includes("tee") || name.includes("shirt");
        if (category === "jeans") return name.includes("jeans");
        if (category === "ethnic") return name.includes("kurta") || name.includes("ethnic");
        if (category === "co-ords") return name.includes("coord") || name.includes("co-ord");
        if (category === "shrugs") return name.includes("blazer") || name.includes("shrug");
        if (category === "jumpsuits") return name.includes("jumpsuit");
        if (category === "skirts") return name.includes("skirt");
        if (category === "blazers") return name.includes("blazer");
        if (category === "lingerie") return name.includes("lingerie") || name.includes("bra");
        return true;
      });
    }

    return items.slice(0, 8);
  }, [activeCategory, products, selectedCategoryIds, sortBy, womenCategoryIds]);

  return (
    <div className="women-shell">
      <Navbar active="WOMEN" />

      <div className={`women-page-wrap ${categoriesVisible ? "" : "sidebar-collapsed"}`}>
        {categoriesVisible ? (
        <aside className="women-sidebar">
          <div className="women-sidebar-card">
            <div className="women-sidebar-head">
              <div className="women-sidebar-title">Categories</div>
              <button
                type="button"
                className="women-sidebar-toggle"
                onClick={() => setCategoriesVisible(false)}
              >
                Hide
              </button>
            </div>
            <button
              type="button"
              className={`women-sidebar-node women-sidebar-node-root ${activeCategory === "All" ? "active" : ""}`}
              onClick={() => setActiveCategory("All")}
            >
              <span className="women-sidebar-node-marker">▾</span>
              <span>All</span>
            </button>
            {renderCategoryTree(womenSidebarTree)}
          </div>
        </aside>
        ) : null}

        <main className="women-main">
          <div className="women-breadcrumbs">
            <span>Home</span>
            <span>›</span>
            <span>Women</span>
          </div>

          <div className="women-title-row">
            <div>
              <h1>WOMEN</h1>
              <p>Trendy styles for every occasion</p>
            </div>
            <div className="women-title-actions">
              <button
                type="button"
                className="women-sidebar-toggle women-sidebar-toggle-main"
                onClick={() => setCategoriesVisible((current) => !current)}
              >
                {categoriesVisible ? "Hide Categories" : "Show Categories"}
              </button>
            </div>
          </div>

          <section className="women-hero">
            <article className="women-hero-card">
              <div className="women-hero-copy">
                <span className="women-hero-kicker">New Season</span>
                <h2>{HERO_CARDS[activeHeroIndex].title}</h2>
                <p>{HERO_CARDS[activeHeroIndex].subtitle}</p>
                <button className="women-hero-btn" type="button">{HERO_CARDS[activeHeroIndex].cta} →</button>
              </div>
              <div className="women-hero-visual">
                <img src={HERO_CARDS[activeHeroIndex].image} alt={HERO_CARDS[activeHeroIndex].title} />
                <img
                  className="women-hero-accent"
                  src={HERO_CARDS[activeHeroIndex].accentImage}
                  alt=""
                  aria-hidden="true"
                />
                <div className="women-hero-flower">✿</div>
              </div>
            </article>

            <div className="women-hero-dots" aria-label="Women hero carousel pagination">
              {HERO_CARDS.map((card, index) => (
                <button
                  key={card.title}
                  type="button"
                  className={`women-hero-dot ${activeHeroIndex === index ? "active" : ""}`}
                  onClick={() => setActiveHeroIndex(index)}
                  aria-label={`Show hero card ${index + 1}`}
                />
              ))}
            </div>
          </section>

          <section className="women-promo-grid">
            {PROMOS.map((promo) => (
              <article key={promo.title} className="women-promo-card">
                <div className="women-promo-copy">
                  <h3>{promo.title}</h3>
                  <p>{promo.subtitle}</p>
                  <span>Shop now →</span>
                </div>
                <img src={promo.image} alt={promo.title} />
              </article>
            ))}
          </section>

          <section className="women-products-section">
            <div className="women-section-head">
              <h2>Top Picks For You</h2>
              <button type="button">View All →</button>
            </div>

            <div className="women-sorting-row">
              <span>{visibleProducts.length} products found</span>
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="popularity">Sort by: Popularity</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="discount">Top Discount</option>
              </select>
            </div>

            <div className="women-product-grid">
              {visibleProducts.map((product) => (
                <article
                  key={product.id}
                  className="women-product-card"
                  onClick={() => navigate(`/product/${product.id}`)}
                >
                  {product.discount > 0 ? <div className="women-product-badge">{product.discount}% OFF</div> : null}
                  <button className="women-product-heart" type="button" aria-label="Add to wishlist">♡</button>
                  <div className="women-product-image-wrap">
                    <img src={product.image} alt={product.name} />
                  </div>
                  <h3>{product.name}</h3>
                  <div className="women-product-price-row">
                    <strong>₹{product.price.toLocaleString("en-IN")}</strong>
                    {product.mrp > product.price ? <span>₹{product.mrp.toLocaleString("en-IN")}</span> : null}
                  </div>
                  <div className="women-product-rating">★ {product.rating} (128)</div>
                  <div className="women-product-delivery">60 MIN DELIVERY</div>
                </article>
              ))}
            </div>
          </section>

          <section className="women-benefits-strip">
            {BENEFITS.map((item) => (
              <div key={item.title} className="women-benefit-card">
                <div className="women-benefit-icon">{iconPaths[item.icon]}</div>
                <div>
                  <strong>{item.title}</strong>
                  <span>{item.text}</span>
                </div>
              </div>
            ))}
          </section>
        </main>
      </div>

      <div className="women-footer-wrap">
        <Footer />
      </div>
    </div>
  );
}