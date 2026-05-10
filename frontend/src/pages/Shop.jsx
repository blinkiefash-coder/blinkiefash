import Navbar from "../components/Navbar";
import "./shop.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";

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

const FEATURED_DEPARTMENTS = [
  { label: "Women", image: "/images/Women-section.png" },
  { label: "Men", image: "/images/Men-section.png" },
  { label: "Kids", image: "/images/kids-section.png" },
  { label: "Beauty", image: "/images/beauty-section.png" },
  { label: "Home & Living", image: "/images/home-section.png" },
  { label: "Bags & Accessories", image: "/images/backpack-section.png" },
];

const API_BASE = API_API_BASE_URL;

const buildChildrenMap = (data) => {
  const map = {};

  data.forEach((category) => {
    const parentKey = category.parent_id || "ROOT";
    if (!map[parentKey]) map[parentKey] = [];
    map[parentKey].push(category);
  });

  Object.keys(map).forEach((key) => {
    map[key].sort((a, b) => a.name.localeCompare(b.name));
  });

  return map;
};

export default function Shop() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userUuid");
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});
  const [productMetaById, setProductMetaById] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeBrand, setActiveBrand] = useState(null);
  const [activeColor, setActiveColor] = useState(null);
  const [brandSearch, setBrandSearch] = useState("");
  const [sortBy, setSortBy] = useState("popularity");
  const [visibleCount, setVisibleCount] = useState(20);
  const [loading, setLoading] = useState(true);
  const [expandedSections, setExpandedSections] = useState({
    categories: true,
    brands: true,
  });

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = previousBodyOverflow;
    };
  }, []);

  const getChildren = (parentId) => childrenByParent[parentId] || [];

  const getDescendantCategoryIds = (categoryId) => {
    const collectedIds = [];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;

      collectedIds.push(currentId);

      const children = getChildren(currentId);
      children.forEach((child) => {
        queue.push(child.id);
      });
    }

    return collectedIds;
  };

  const activeCategory =
    categories.find((item) => item.id === activeCategoryId) || null;

  const toggleCategoryExpansion = (categoryId) => {
    setExpandedCategories((prev) => ({
      ...prev,
      [categoryId]: !prev[categoryId],
    }));
  };

  const handleCategorySelect = (category, hasChildren) => {
    const isActive = activeCategoryId === category.id;
    setActiveCategoryId(isActive ? null : category.id);

    if (hasChildren && !expandedCategories[category.id]) {
      setExpandedCategories((prev) => ({
        ...prev,
        [category.id]: true,
      }));
    }
  };

  const toggleSection = (section) => {
    setExpandedSections((prev) => ({
      ...prev,
      [section]: !prev[section],
    }));
  };

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/categories`)
      .then((res) => res.json())
      .then((data) => {
        const safeCategories = Array.isArray(data) ? data : [];
        setCategories(safeCategories);
        setChildrenByParent(buildChildrenMap(safeCategories));
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/brands`)
      .then((res) => res.json())
      .then((data) => {
        setBrands(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err));
  }, []);

  useEffect(() => {
    if (products.length === 0) {
      setProductMetaById({});
      return;
    }

    let isCancelled = false;

    const loadProductMeta = async () => {
      const detailResults = await Promise.allSettled(
        products.map(async (product) => {
          const response = await fetch(`${API_BASE}/products/${product.id}`);
          if (!response.ok) return null;

          const detailData = await response.json();
          const categoryId = detailData?.product?.category_id || null;
          const gender = detailData?.product?.gender || null;

          return {
            productId: product.id,
            categoryId,
            gender,
          };
        })
      );

      if (isCancelled) return;

      const nextMeta = {};
      detailResults.forEach((result) => {
        if (result.status !== "fulfilled" || !result.value) return;

        const { productId, categoryId, gender } = result.value;
        nextMeta[productId] = { categoryId, gender };
      });

      setProductMetaById(nextMeta);
    };

    loadProductMeta().catch((err) => console.error(err));

    return () => {
      isCancelled = true;
    };
  }, [products]);

  const selectedCategoryIds = activeCategoryId
    ? new Set(getDescendantCategoryIds(activeCategoryId))
    : null;

  const filteredProducts = products.filter((product) => {
    if (activeBrand) {
      const productBrand = typeof product.brand === "string" ? product.brand : "";
      if (productBrand.trim().toLowerCase() !== activeBrand.trim().toLowerCase()) {
        return false;
      }
    }

    if (selectedCategoryIds) {
      const productCategoryId =
        productMetaById[product.id]?.categoryId || product.category_id || null;

      if (!productCategoryId || !selectedCategoryIds.has(productCategoryId)) {
        return false;
      }
    }

    if (activeColor) {
      const productColor = typeof product.color === "string" ? product.color : "";
      if (productColor && productColor.trim().toLowerCase() !== activeColor.toLowerCase()) {
        return false;
      }
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA = Number(a.discount_price) > 0 ? Number(a.discount_price) : Number(a.price);
    const priceB = Number(b.discount_price) > 0 ? Number(b.discount_price) : Number(b.price);

    if (sortBy === "price-low") return priceA - priceB;
    if (sortBy === "price-high") return priceB - priceA;
    if (sortBy === "discount") {
      const offA = Number(a.discount_price) > 0 && Number(a.price) > Number(a.discount_price)
        ? ((Number(a.price) - Number(a.discount_price)) / Number(a.price)) * 100
        : 0;
      const offB = Number(b.discount_price) > 0 && Number(b.price) > Number(b.discount_price)
        ? ((Number(b.price) - Number(b.discount_price)) / Number(b.price)) * 100
        : 0;
      return offB - offA;
    }
    return 0;
  });

  const visibleProducts = sortedProducts.slice(0, visibleCount);
  const visibleBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const renderCategoryTree = (parentId = "ROOT", depth = 0) => {
    const categoryList = getChildren(parentId);

    return categoryList.map((category) => {
      const isActive = activeCategoryId === category.id;
      const nestedChildren = getChildren(category.id);
      const hasChildren = nestedChildren.length > 0;
      const isExpanded = !!expandedCategories[category.id];

      return (
        <div key={category.id} className="category-node">
          <div className={`filter-option-row depth-${depth}`} style={{ paddingLeft: `${depth * 12}px` }}>
            {hasChildren ? (
              <button
                type="button"
                className="category-toggle"
                onClick={() => toggleCategoryExpansion(category.id)}
                aria-label={`${isExpanded ? "Collapse" : "Expand"} ${category.name}`}
              >
                {isExpanded ? "-" : "+"}
              </button>
            ) : (
              <span className="category-toggle-spacer" />
            )}

            <div
              className={`filter-option ${isActive ? "active" : ""}`}
              onClick={() => handleCategorySelect(category, hasChildren)}
            >
              <span>{category.name}</span>
              {hasChildren ? (
                <small className="children-count">{nestedChildren.length}</small>
              ) : null}
            </div>
          </div>

          {hasChildren && isExpanded ? renderCategoryTree(category.id, depth + 1) : null}
        </div>
      );
    });
  };

  const resolveAvailableVariantId = async (product) => {
    if (product?.variant_id) return product.variant_id;

    const response = await fetch(`${API_BASE}/products/${product.id}`);
    if (!response.ok) return "";

    const detail = await response.json();
    const availableVariant = (detail?.variants || []).find(
      (variant) =>
        Number(variant.available_stock || 0) > 0 || variant.available_stock === undefined
    );

    return availableVariant?.id || availableVariant?.variant_id || "";
  };

  const handleAddToWishlist = async (event, product) => {
    event.stopPropagation();

    if (!userId) {
      alert("Please login to add items to wishlist");
      navigate("/login");
      return;
    }

    try {
      const variantId = await resolveAvailableVariantId(product);
      if (!variantId) {
        alert("No available variant for this product");
        return;
      }

      const response = await fetch(`${API_BASE}/wishlist/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, variantId }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to add to wishlist");
      }

      window.dispatchEvent(new Event("wishlist:updated"));
      alert("Added to wishlist");
    } catch {
      alert("Unable to add to wishlist right now");
    }
  };

  const handleAddToCart = async (event, product) => {
    event.stopPropagation();

    if (!userId) {
      alert("Please login to add items to cart");
      navigate("/login");
      return;
    }

    try {
      const variantId = await resolveAvailableVariantId(product);
      if (!variantId) {
        alert("No available variant for this product");
        return;
      }

      const response = await fetch(`${API_BASE}/cart/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, variantId, quantity: 1 }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to add to cart");
      }

      window.dispatchEvent(new Event("cart:updated"));
      alert("Added to cart");
    } catch {
      alert("Unable to add to cart right now");
    }
  };

  return (
    <>
      <div className="shop-navbar-wrapper">
        <Navbar />
      </div>

      <div className="shop-page">
        <div className="shop-featured-row">
          {FEATURED_DEPARTMENTS.map((department) => (
            <div key={department.label} className="shop-featured-tile">
              <div className="shop-featured-image-wrap">
                <img src={department.image} alt={department.label} className="shop-featured-image" />
              </div>
              <div>
                <h4>{department.label}</h4>
                <p>Explore →</p>
              </div>
            </div>
          ))}
        </div>

        <div className="shop-layout">
          <aside className="shop-filters">
            <div className="shop-filters-inner">
              <h4 className="shop-filter-title">FILTERS</h4>

              <div className="shop-filter-group">
                <div className="filter-section-header">
                  <button
                    type="button"
                    className="section-toggle"
                    onClick={() => toggleSection('categories')}
                    aria-label="Toggle Categories"
                  >
                    {expandedSections.categories ? "-" : "+"}
                  </button>
                  <h5>Categories</h5>
                </div>
                {expandedSections.categories && renderCategoryTree()}
              </div>

              <div className="shop-filter-group">
                <div className="filter-section-header">
                  <button
                    type="button"
                    className="section-toggle"
                    onClick={() => toggleSection('brands')}
                    aria-label="Toggle Brands"
                  >
                    {expandedSections.brands ? "-" : "+"}
                  </button>
                  <h5>Brand</h5>
                </div>
                {expandedSections.brands && (
                  <>
                    <input
                      type="text"
                      className="brand-search"
                      placeholder="Search brand"
                      value={brandSearch}
                      onChange={(e) => setBrandSearch(e.target.value)}
                    />
                    {visibleBrands.map((brand) => {
                  const isActive = activeBrand === brand.name;
                  return (
                    <label
                      key={brand.id}
                      className={`brand-check-option ${isActive ? "active" : ""}`}
                      onClick={() =>
                        setActiveBrand(isActive ? null : brand.name)
                      }
                    >
                      <input type="checkbox" checked={isActive} readOnly />
                      <span>{brand.name}</span>
                    </label>
                  );
                    })}
                  </>
                )}
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
                <div className="price-range-text">₹100 - ₹10,100+</div>
                <div className="price-pill-grid">
                  <span className="price-pill">₹199 - ₹999</span>
                  <span className="price-pill">₹999 - ₹2999</span>
                  <span className="price-pill">₹2999 - ₹4999</span>
                  <span className="price-pill">₹4999+</span>
                </div>
              </div>

              <div className="shop-filter-group">
                <h5>Color</h5>
                <div className="color-grid">
                  {COLORS.map(([name, color]) => (
                    <div
                      key={name}
                      className={`color-option ${activeColor === name ? "active" : ""}`}
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

              <div className="shop-filter-group">
                <h5>Discount</h5>
                <div className="discount-list">
                  {["10% and above", "20% and above", "30% and above", "40% and above", "50% and above"].map((item) => (
                    <label key={item} className="discount-option">
                      <input type="checkbox" />
                      <span>{item}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </aside>

          <section className="shop-products">
            <div className="shop-products-header">
              <div>
                <h2 className="shop-title">All Products</h2>
                <p className="shop-count">
                  {activeCategory
                    ? `Selected: ${activeCategory.name} - Showing 1-${visibleProducts.length} of ${sortedProducts.length} products`
                    : `Showing 1-${visibleProducts.length} of ${sortedProducts.length} products`}
                </p>
              </div>

              <select className="shop-sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                <option value="popularity">Sort by: Popularity</option>
                <option value="price-low">Price: Low to High</option>
                <option value="price-high">Price: High to Low</option>
                <option value="discount">Discount</option>
              </select>
            </div>

            <div className="shop-chip-row">
              <button type="button" className={`shop-chip ${sortBy === "popularity" ? "active" : ""}`} onClick={() => setSortBy("popularity")}>Popular</button>
              <button type="button" className="shop-chip">New Arrivals</button>
              <button type="button" className={`shop-chip ${sortBy === "price-low" ? "active" : ""}`} onClick={() => setSortBy("price-low")}>Price: Low to High</button>
              <button type="button" className={`shop-chip ${sortBy === "price-high" ? "active" : ""}`} onClick={() => setSortBy("price-high")}>Price: High to Low</button>
              <button type="button" className={`shop-chip ${sortBy === "discount" ? "active" : ""}`} onClick={() => setSortBy("discount")}>Discount</button>
              <button type="button" className="shop-chip">Customer Rating</button>
            </div>

            <div className="shop-products-grid">
              {loading
                ? Array.from({ length: 8 }).map((_, i) => (
                    <div key={i} className="shop-product-skeleton">
                      <div className="skeleton-image" />
                      <div className="skeleton-line skeleton-name" />
                      <div className="skeleton-line skeleton-brand" />
                      <div className="skeleton-line skeleton-price" />
                    </div>
                  ))
                : visibleProducts.map((p) => {
                const originalPrice = Number(p.price);
                const discountPrice = Number(p.discount_price);

                const hasDiscount =
                  discountPrice && discountPrice < originalPrice;

                const offPercent = hasDiscount
                  ? Math.round(
                      ((originalPrice - discountPrice) / originalPrice) * 100
                    )
                  : 0;
                const rating = (4 + ((p.name?.length || 0) % 10) / 10).toFixed(1);
                const reviews = (p.name?.length || 10) * 110;

                return (
                  <div
                    key={p.id}
                    className="shop-product-card"
                    onClick={() => navigate(`/product/${p.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="shop-product-image">
                      <button
                        type="button"
                        className="wishlist-btn"
                        onClick={(e) => handleAddToWishlist(e, p)}
                      >
                        ♡
                      </button>
                      {p.image ? (
                        <img src={p.image} alt={p.name} />
                      ) : (
                        <div className="no-image">No Image</div>
                      )}
                      {hasDiscount && (
                        <span className="card-badge">{offPercent}% OFF</span>
                      )}
                    </div>

                    <div className="card-meta">
                      <span className="card-brand">{p.brand}</span>
                      <h4 className="card-name">{p.name}</h4>

                      <div className="shop-price-row">
                        {hasDiscount ? (
                          <>
                            <span className="shop-price-final">₹{discountPrice.toLocaleString('en-IN')}</span>
                            <span className="shop-price-original">₹{originalPrice.toLocaleString('en-IN')}</span>
                          </>
                        ) : (
                          <span className="shop-price-final">₹{originalPrice.toLocaleString('en-IN')}</span>
                        )}
                      </div>

                      <div className="rating-row">
                        <span className="rating-star">★</span>
                        <span>{rating}</span>
                        <span className="rating-count">({(reviews / 1000).toFixed(1)}k)</span>
                      </div>

                      <div className="shop-card-actions">
                        <button
                          type="button"
                          className="shop-card-cart-btn"
                          onClick={(e) => handleAddToCart(e, p)}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {!loading && visibleCount < sortedProducts.length && (
              <button
                type="button"
                className="view-more-btn"
                onClick={() => setVisibleCount((prev) => prev + 20)}
              >
                View More Products
              </button>
            )}

            <section className="shop-trust-strip">
              <div className="trust-item"><strong>60 MINUTE DELIVERY</strong><span>On all orders</span></div>
              <div className="trust-item"><strong>TRY BEFORE YOU BUY</strong><span>Only pay for what you keep</span></div>
              <div className="trust-item"><strong>100% SECURE PAYMENTS</strong><span>Safe and trusted</span></div>
              <div className="trust-item"><strong>EASY RETURNS & REFUNDS</strong><span>Hassle free returns</span></div>
              <div className="trust-item"><strong>NEED HELP?</strong><span>Chat with us</span></div>
            </section>

            <footer className="shop-bottom-bar">
              <div className="shop-bottom-content">
                <div className="footer-brand-col">
                  <h3>BLINKIEFASH</h3>
                  <p>Fashion at your doorstep, FAST.</p>
                </div>

                <div className="footer-col">
                  <h4>Company</h4>
                  <span>About Us</span>
                  <span>Careers</span>
                  <span>Blog</span>
                  <span>Press</span>
                </div>

                <div className="footer-col">
                  <h4>Customer Service</h4>
                  <span>Contact Us</span>
                  <span>FAQs</span>
                  <span>Shipping & Delivery</span>
                  <span>Returns & Refunds</span>
                </div>

                <div className="footer-col">
                  <h4>Policies</h4>
                  <span>Terms & Conditions</span>
                  <span>Privacy Policy</span>
                  <span>Cancellation Policy</span>
                  <span>E-Waste Policy</span>
                </div>

                <div className="footer-col">
                  <h4>Follow Us</h4>
                  <span>Instagram</span>
                  <span>Facebook</span>
                  <span>YouTube</span>
                  <span>WhatsApp</span>
                </div>
              </div>

              <div className="shop-bottom-copy">
                © 2026 BlinkieFash. All rights reserved.
              </div>
            </footer>
          </section>
        </div>
      </div>
    </>
  );
}
