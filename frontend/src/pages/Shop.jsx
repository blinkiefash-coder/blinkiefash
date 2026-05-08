import Navbar from "../components/Navbar";
import "./shop.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

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

const API_BASE = "https://blinkiefash.onrender.com/api";

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
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});
  const [productMetaById, setProductMetaById] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeBrand, setActiveBrand] = useState(null);
  const [activeColor, setActiveColor] = useState(null);
  const [expandedSections, setExpandedSections] = useState({
    categories: false,
    brands: false,
  });

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
    fetch(`${API_BASE}/products`)
      .then((res) => res.json())
      .then((data) => {
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => console.error(err));
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

    return true;
  });

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

  return (
    <>
      <div className="shop-navbar-wrapper">
        <Navbar />
      </div>

      <div className="shop-page">
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
                {expandedSections.brands && brands.map((brand) => {
                  const isActive = activeBrand === brand.name;
                  return (
                    <div
                      key={brand.id}
                      className={`filter-option ${isActive ? "active" : ""}`}
                      onClick={() =>
                        setActiveBrand(isActive ? null : brand.name)
                      }
                    >
                      <span>{brand.name}</span>
                    </div>
                  );
                })}
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
            </div>
          </aside>

          <section className="shop-products">
            <div className="shop-products-header">
              <div>
                <h2 className="shop-title">All Products</h2>
                <p className="shop-count">
                  {activeCategory
                    ? `Selected: ${activeCategory.name} - Showing ${filteredProducts.length} products`
                    : `Showing ${filteredProducts.length} products`}
                </p>
              </div>

              <select className="shop-sort">
                <option>Sort by: Popularity</option>
                <option>Price: Low to High</option>
                <option>Price: High to Low</option>
              </select>
            </div>

            <div className="shop-products-grid">
              {filteredProducts.map((p) => {
                const originalPrice = Number(p.price);
                const discountPrice = Number(p.discount_price);

                const hasDiscount =
                  discountPrice && discountPrice < originalPrice;

                const offPercent = hasDiscount
                  ? Math.round(
                      ((originalPrice - discountPrice) / originalPrice) * 100
                    )
                  : 0;

                return (
                  <div
                    key={p.id}
                    className="shop-product-card"
                    onClick={() => navigate(`/product/${p.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="shop-product-image">
                      {p.image ? (
                        <img src={p.image} alt={p.name} />
                      ) : (
                        <div className="no-image">No Image</div>
                      )}
                    </div>

                    <h4>{p.name}</h4>
                    <span>{p.brand}</span>

                    <div className="price-section">
                      {hasDiscount ? (
                        <>
                          <span className="price-final">₹{discountPrice}</span>
                          <span className="price-original">₹{originalPrice}</span>
                          <span className="price-off">{offPercent}% OFF</span>
                        </>
                      ) : (
                        <span className="price-final">₹{originalPrice}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        </div>
      </div>

      <footer className="shop-bottom-bar">
        <div className="shop-bottom-content">
          <span>Try & Buy</span>
          <span>60-min Delivery</span>
          <span>Secure Payments</span>
          <span>Easy Returns</span>
        </div>

        <div className="shop-bottom-copy">
          © 2026 BlinkieFash · Fashion delivered in a Blink
        </div>
      </footer>
    </>
  );
}
