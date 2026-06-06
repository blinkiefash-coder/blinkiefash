import React, { useState, useEffect, useMemo } from "react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import { useNavigate, useLocation } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";
import "./insideCatalog.css";
import "./shop.css";

const API_BASE = API_API_BASE_URL;

const normalizeText = (value) =>
  String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const normalizeDepartmentKey = (value) =>
  normalizeText(value).replace(/\s+/g, "-");

const toTitleCase = (value) =>
  String(value || "")
    .split(/[-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");

const CATEGORY_ALIASES = {
  ethnic: ["ethnic", "indian", "fusion", "kurta", "saree", "lehenga", "sherwani", "dupatta", "blouse"],
  footwear: ["footwear", "shoe", "shoes", "sneaker", "sneakers", "sandal", "sandals", "heel", "heels", "boot", "boots", "flipflop", "sock", "socks"],
  topwear: ["topwear", "top", "tops", "shirt", "shirts", "tshirt", "t shirts", "sweatshirt", "hoodie", "jacket", "blazer", "coat"],
  bottomwear: ["bottomwear", "bottom", "jeans", "trouser", "trousers", "shorts", "track pants", "trackpants", "skirt", "dhoti"],
  accessories: ["accessories", "watch", "watches", "handbag", "wallet", "belt", "cap", "hat", "jewellery", "sunglass"],
  beauty: ["beauty", "makeup", "lip", "kajal", "foundation", "concealer", "skincare", "skin care", "hair care", "shampoo", "conditioner", "serum", "sunscreen"],
  kids: ["kids", "boys", "girls", "infants", "infant", "toys", "games"],
  "home living": ["home", "living", "decor", "bedding", "furnishing", "storage", "gifting"],
};

const SIZE_OPTIONS = ["XS", "S", "M", "L", "XL", "XXL"];
const COLOR_OPTIONS = ["Black", "White", "Blue", "Green", "Red", "Grey"];
const PRICE_OPTIONS = [
  { value: "0-499", label: "Under ₹499" },
  { value: "500-999", label: "₹500 - ₹999" },
  { value: "1000-1999", label: "₹1,000 - ₹1,999" },
  { value: "2000-above", label: "₹2,000 & Above" },
];
const DISCOUNT_OPTIONS = [10, 20, 30, 40, 50];
const RATING_OPTIONS = [4, 3, 2];

export default function InsideCatalog() {
  const navigate = useNavigate();
  const location = useLocation();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [filters, setFilters] = useState({
    categories: [],
    brands: [],
    sizes: [],
    color: "",
    price: "",
    discount: "",
    rating: "",
  });
  const [searchBrand, setSearchBrand] = useState("");
  const [showFilters, setShowFilters] = useState(true);
  const [sortBy, setSortBy] = useState("popularity");
  const [loading, setLoading] = useState(true);
  const [selectedDepartment, setSelectedDepartment] = useState("");
  const [queryCategoryLabel, setQueryCategoryLabel] = useState("");
  const [searchCategory, setSearchCategory] = useState("");
  const [collapsed, setCollapsed] = useState({
    categories: false,
    brands: false,
    size: true,
    color: true,
    price: true,
    discount: true,
    rating: true,
  });

  const categoriesById = useMemo(() => {
    const map = {};
    categories.forEach((cat) => {
      map[cat.id] = cat;
    });
    return map;
  }, [categories]);

  const childrenByParent = useMemo(() => {
    const map = {};
    categories.forEach((cat) => {
      const parentKey = cat.parent_id || "ROOT";
      if (!map[parentKey]) map[parentKey] = [];
      map[parentKey].push(cat.id);
    });
    return map;
  }, [categories]);

  const getDescendantCategoryIds = (startIds) => {
    const queue = [...startIds];
    const visited = new Set();

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId || visited.has(currentId)) continue;

      visited.add(currentId);
      const children = childrenByParent[currentId] || [];
      children.forEach((childId) => {
        if (!visited.has(childId)) queue.push(childId);
      });
    }

    return Array.from(visited);
  };

  const getDepartmentRootId = (departmentKey) => {
    if (!departmentKey) return null;

    const normalizedKey = normalizeDepartmentKey(departmentKey);
    const rootCandidates = categories.filter((cat) => !cat.parent_id);

    const exactMatch = rootCandidates.find(
      (cat) => normalizeDepartmentKey(cat.name) === normalizedKey
    );
    if (exactMatch) return exactMatch.id;

    if (normalizedKey === "home-living") {
      const homeLiving = rootCandidates.find(
        (cat) => normalizeDepartmentKey(cat.name) === "home-living"
      );
      if (homeLiving) return homeLiving.id;
    }

    return null;
  };

  const getCategorySearchTerms = (label) => {
    const normalized = normalizeText(label);
    if (!normalized) return [];

    const directAlias = CATEGORY_ALIASES[normalized];
    if (directAlias) return directAlias;

    const matchingAliasKey = Object.keys(CATEGORY_ALIASES).find(
      (key) => normalized.includes(key) || key.includes(normalized)
    );

    if (matchingAliasKey) return CATEGORY_ALIASES[matchingAliasKey];

    return normalized.split(" ").filter(Boolean);
  };

  const findBestCategoryIdsByLabel = (label) => {
    const searchTerms = getCategorySearchTerms(label);
    if (searchTerms.length === 0) return [];

    const scored = categories
      .map((cat) => {
        const ownName = normalizeText(cat.name);
        const parentName = normalizeText(categoriesById[cat.parent_id]?.name || "");
        const context = `${ownName} ${parentName}`;

        let score = 0;
        searchTerms.forEach((term) => {
          if (context.includes(term)) score += 2;
          if (ownName === term) score += 3;
        });

        return { id: cat.id, score };
      })
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score);

    return scored.map((item) => item.id);
  };

  const findCategoryIdsByLabel = (label) => {
    const normalizedLabel = normalizeText(label);
    if (!normalizedLabel) return [];

    const queryWords = normalizedLabel.split(" ");

    return categories
      .filter((cat) => {
        const normalizedName = normalizeText(cat.name);
        if (!normalizedName) return false;
        if (normalizedName === normalizedLabel) return true;

        const nameWords = normalizedName.split(" ");
        const queryCovered = queryWords.every((word) => nameWords.includes(word));
        return queryCovered || normalizedName.includes(normalizedLabel) || normalizedLabel.includes(normalizedName);
      })
      .map((cat) => cat.id);
  };

  useEffect(() => {
    setLoading(true);
    fetch(`${API_BASE}/products`)
      .then(res => res.json())
      .then(data => setProducts(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
    fetch(`${API_BASE}/categories`)
      .then(res => res.json())
      .then(data => setCategories(Array.isArray(data) ? data : []));
    fetch(`${API_BASE}/brands`)
      .then(res => res.json())
      .then(data => setBrands(Array.isArray(data) ? data : []));
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const department = (params.get("department") || "").trim().toLowerCase();
    const rawCategory = (params.get("category") || "").trim();
    const category = rawCategory.toLowerCase();

    setSelectedDepartment(department);
    setQueryCategoryLabel(rawCategory);

    if (!category || categories.length === 0) {
      return;
    }

    const broadMatches = findCategoryIdsByLabel(rawCategory);
    const bestMatches = findBestCategoryIdsByLabel(rawCategory);
    const matchingCategoryIds = Array.from(new Set([...bestMatches, ...broadMatches]));

    const departmentRootId = getDepartmentRootId(department);
    const departmentScopedIds = departmentRootId
      ? new Set(getDescendantCategoryIds([departmentRootId]))
      : null;

    const scopedMatchingCategoryIds = departmentScopedIds
      ? matchingCategoryIds.filter((id) => departmentScopedIds.has(id))
      : matchingCategoryIds;

    if (scopedMatchingCategoryIds.length === 0) return;

    setFilters((prev) => ({
      ...prev,
      categories: scopedMatchingCategoryIds,
    }));
  }, [location.search, categories, categoriesById, childrenByParent]);

  const selectedCategories = categories.filter((cat) => filters.categories.includes(cat.id));
  const selectedCategoryGroups = selectedCategories.reduce((acc, cat) => {
    const normalized = normalizeText(cat.name);
    if (!normalized) return acc;

    const existing = acc.find((item) => item.normalized === normalized);
    if (existing) {
      existing.ids.push(cat.id);
      return acc;
    }

    acc.push({ normalized, label: cat.name, ids: [cat.id] });
    return acc;
  }, []);
  const visibleCategories = categories.filter((cat) =>
    cat.name.toLowerCase().includes(searchCategory.toLowerCase())
  );
  const visibleBrands = brands.filter((b) =>
    b.name.toLowerCase().includes(searchBrand.toLowerCase())
  );

  const availableSizes = useMemo(() => {
    const discovered = Array.from(new Set(
      products
        .map((p) => String(p.size || "").trim().toUpperCase())
        .filter(Boolean)
    ));
    return discovered.length ? discovered : SIZE_OPTIONS;
  }, [products]);

  const availableColors = useMemo(() => {
    const discovered = Array.from(new Set(
      products
        .map((p) => String(p.color || "").trim())
        .filter(Boolean)
    ));
    return discovered.length ? discovered : COLOR_OPTIONS;
  }, [products]);

  const pickFromHash = (input, options) => {
    const text = String(input || "");
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return options[Math.abs(hash) % options.length];
  };

  const getEffectiveSize = (product) => {
    const explicit = String(product.size || "").trim().toUpperCase();
    if (explicit) return explicit;
    return pickFromHash(`${product.id}-size`, availableSizes);
  };

  const getEffectiveColor = (product) => {
    const explicit = String(product.color || "").trim();
    if (explicit) return explicit;
    return pickFromHash(`${product.id}-color`, availableColors);
  };

  const getEffectivePrice = (product) => {
    const basePrice = Number(product.price || 0);
    const discountPrice = Number(product.discount_price || 0);
    return discountPrice > 0 && discountPrice < basePrice ? discountPrice : basePrice;
  };

  const isInPriceRange = (price, rangeValue) => {
    if (!rangeValue) return true;
    if (rangeValue === "0-499") return price <= 499;
    if (rangeValue === "500-999") return price >= 500 && price <= 999;
    if (rangeValue === "1000-1999") return price >= 1000 && price <= 1999;
    if (rangeValue === "2000-above") return price >= 2000;
    return true;
  };

  const toggleCollapse = (key) => {
    setCollapsed((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const removeCategoryByIds = (categoryIds) => {
    const idsToRemove = new Set(categoryIds);
    setFilters((prev) => ({
      ...prev,
      categories: prev.categories.filter((id) => !idsToRemove.has(id)),
    }));
  };

  const clearAllFilters = () => {
    setFilters({ categories: [], brands: [], sizes: [], color: "", price: "", discount: "", rating: "" });
    setSearchBrand("");
    setSearchCategory("");
  };

  const handleFilterChange = (type, value) => {
    setFilters(prev => {
      if (type === "categories" || type === "brands" || type === "sizes") {
        const arr = prev[type].includes(value)
          ? prev[type].filter(v => v !== value)
          : [...prev[type], value];
        return { ...prev, [type]: arr };
      }
      return { ...prev, [type]: value };
    });
  };

  const allowedCategoryIds = useMemo(() => {
    if (filters.categories.length === 0) return null;
    return new Set(getDescendantCategoryIds(filters.categories));
  }, [filters.categories, childrenByParent]);

  const selectedDepartmentCategoryIds = useMemo(() => {
    const rootId = getDepartmentRootId(selectedDepartment);
    if (!rootId) return null;
    return new Set(getDescendantCategoryIds([rootId]));
  }, [selectedDepartment, categories, childrenByParent]);

  const filteredProducts = products.filter(p => {
    if (selectedDepartment) {
      const gender = String(p.gender || "").trim().toLowerCase();
      const normalizedGender = gender.replace(/\s+/g, "-");

      const matchesGender = normalizedGender === selectedDepartment;
      const matchesDepartmentCategory = selectedDepartmentCategoryIds
        ? selectedDepartmentCategoryIds.has(p.category_id)
        : false;

      if (!matchesGender && !matchesDepartmentCategory) return false;
    }

    if (allowedCategoryIds && !allowedCategoryIds.has(p.category_id)) {
      return false;
    }

    if (filters.brands.length && !filters.brands.includes(p.brand)) return false;

    const productSize = getEffectiveSize(p);
    const productColor = getEffectiveColor(p);
    const finalPrice = getEffectivePrice(p);
    const originalPrice = Number(p.price || 0);
    const discountPercent = originalPrice > 0 && finalPrice < originalPrice
      ? Math.round(((originalPrice - finalPrice) / originalPrice) * 100)
      : 0;
    const hardcodedRating = 4.5;

    if (filters.sizes.length && !filters.sizes.includes(productSize)) return false;
    if (filters.color && normalizeText(productColor) !== normalizeText(filters.color)) return false;
    if (!isInPriceRange(finalPrice, filters.price)) return false;
    if (filters.discount && discountPercent < Number(filters.discount)) return false;
    if (filters.rating && hardcodedRating < Number(filters.rating)) return false;

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA = Number(a.discount_price || a.price || 0);
    const priceB = Number(b.discount_price || b.price || 0);
    const baseA = Number(a.price || 0);
    const baseB = Number(b.price || 0);

    if (sortBy === "price-low") return priceA - priceB;
    if (sortBy === "price-high") return priceB - priceA;

    if (sortBy === "discount") {
      const discountA = baseA > 0 && priceA < baseA ? ((baseA - priceA) / baseA) * 100 : 0;
      const discountB = baseB > 0 && priceB < baseB ? ((baseB - priceB) / baseB) * 100 : 0;
      return discountB - discountA;
    }

    if (sortBy === "name-asc") {
      return String(a.name || "").localeCompare(String(b.name || ""));
    }

    if (sortBy === "name-desc") {
      return String(b.name || "").localeCompare(String(a.name || ""));
    }

    return 0;
  });

  const breadcrumbDepartment = selectedDepartment
    ? toTitleCase(selectedDepartment)
    : "Clothing";

  const breadcrumbLeaf = queryCategoryLabel || (selectedDepartment ? `All ${toTitleCase(selectedDepartment)} Products` : "All Products");

  const pageTitle = queryCategoryLabel || (selectedDepartment ? toTitleCase(selectedDepartment) : "All Products");

  return (
    <div className="inside-catalog-shell">
      <Navbar />
      <div className={`inside-catalog-breadcrumbs ${showFilters ? "with-filters" : "without-filters"}`}>
        <span onClick={() => navigate("/")}>Home</span> &gt; <span>{breadcrumbDepartment}</span> &gt; <span>{breadcrumbLeaf}</span>
      </div>
      <div className={`inside-catalog-header-row ${showFilters ? "with-filters" : "without-filters"}`}>
        <div className="inside-catalog-title-wrap">
          <h1>
            {pageTitle}
            <span className="inside-catalog-count"> {sortedProducts.length} items</span>
          </h1>
        </div>
        <div className="inside-catalog-header-actions">
          <button onClick={() => setShowFilters(f => !f)}>{showFilters ? "Hide Filters" : "Show Filters"}</button>
          <select value={sortBy} onChange={e => setSortBy(e.target.value)}>
            <option value="popularity">Sort by: Popularity</option>
            <option value="price-low">Price: Low to High</option>
            <option value="price-high">Price: High to Low</option>
            <option value="discount">Discount: High to Low</option>
            <option value="name-asc">Name: A to Z</option>
            <option value="name-desc">Name: Z to A</option>
          </select>
        </div>
      </div>
      <div className="inside-catalog-main">
        {showFilters && (
          <aside className="inside-catalog-filters">
            <div className="inside-catalog-filters-head">
              <h3>Filters</h3>
              <button type="button" className="inside-catalog-clear-link" onClick={clearAllFilters}>Clear All</button>
            </div>

            <div className="inside-catalog-filter-group">
              <button type="button" className="inside-catalog-section-head" onClick={() => toggleCollapse("categories")}>
                <h4>Categories</h4>
                <span>{filters.categories.length} Selected {collapsed.categories ? "▾" : "▴"}</span>
              </button>

              {!collapsed.categories && (
                <>
                  <input
                    type="text"
                    placeholder="Search categories"
                    value={searchCategory}
                    onChange={(e) => setSearchCategory(e.target.value)}
                  />
                  <div className="inside-catalog-options-list">
                    {visibleCategories.map((cat) => (
                      <label key={cat.id}>
                        <input
                          type="checkbox"
                          checked={filters.categories.includes(cat.id)}
                          onChange={() => handleFilterChange("categories", cat.id)}
                        />
                        {cat.name}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="inside-catalog-filter-group">
              <button type="button" className="inside-catalog-section-head" onClick={() => toggleCollapse("brands")}>
                <h4>Brand</h4>
                <span>{filters.brands.length} Selected {collapsed.brands ? "▾" : "▴"}</span>
              </button>

              {!collapsed.brands && (
                <>
                  <input
                    type="text"
                    placeholder="Search brands"
                    value={searchBrand}
                    onChange={e => setSearchBrand(e.target.value)}
                  />
                  <div className="inside-catalog-options-list">
                    {visibleBrands.map((brand) => (
                      <label key={brand.id}>
                        <input
                          type="checkbox"
                          checked={filters.brands.includes(brand.name)}
                          onChange={() => handleFilterChange("brands", brand.name)}
                        />
                        {brand.name}
                      </label>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="inside-catalog-filter-group compact">
              <button type="button" className="inside-catalog-section-head" onClick={() => toggleCollapse("size")}>
                <h4>Size</h4>
                <span>{filters.sizes.length} Selected {collapsed.size ? "▾" : "▴"}</span>
              </button>
              {!collapsed.size && (
                <div className="inside-catalog-options-list">
                  {availableSizes.map((size) => (
                    <label key={size}>
                      <input
                        type="checkbox"
                        checked={filters.sizes.includes(size)}
                        onChange={() => handleFilterChange("sizes", size)}
                      />
                      {size}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="inside-catalog-filter-group compact">
              <button type="button" className="inside-catalog-section-head" onClick={() => toggleCollapse("color")}>
                <h4>Color</h4>
                <span>{filters.color ? "1 Selected" : "0 Selected"} {collapsed.color ? "▾" : "▴"}</span>
              </button>
              {!collapsed.color && (
                <div className="inside-catalog-options-list">
                  {availableColors.map((color) => (
                    <label key={color}>
                      <input
                        type="radio"
                        name="inside-catalog-color"
                        checked={filters.color === color}
                        onChange={() => handleFilterChange("color", color)}
                      />
                      {color}
                    </label>
                  ))}
                  {filters.color ? (
                    <button type="button" className="inside-catalog-clear-link" onClick={() => handleFilterChange("color", "")}>Clear Color</button>
                  ) : null}
                </div>
              )}
            </div>

            <div className="inside-catalog-filter-group compact">
              <button type="button" className="inside-catalog-section-head" onClick={() => toggleCollapse("price")}>
                <h4>Price Range</h4>
                <span>{filters.price ? "1 Selected" : "0 Selected"} {collapsed.price ? "▾" : "▴"}</span>
              </button>
              {!collapsed.price && (
                <div className="inside-catalog-options-list">
                  {PRICE_OPTIONS.map((option) => (
                    <label key={option.value}>
                      <input
                        type="radio"
                        name="inside-catalog-price"
                        checked={filters.price === option.value}
                        onChange={() => handleFilterChange("price", option.value)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="inside-catalog-filter-group compact">
              <button type="button" className="inside-catalog-section-head" onClick={() => toggleCollapse("discount")}>
                <h4>Discount</h4>
                <span>{filters.discount ? "1 Selected" : "0 Selected"} {collapsed.discount ? "▾" : "▴"}</span>
              </button>
              {!collapsed.discount && (
                <div className="inside-catalog-options-list">
                  {DISCOUNT_OPTIONS.map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="inside-catalog-discount"
                        checked={String(filters.discount) === String(value)}
                        onChange={() => handleFilterChange("discount", String(value))}
                      />
                      {value}% and above
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="inside-catalog-filter-group compact">
              <button type="button" className="inside-catalog-section-head" onClick={() => toggleCollapse("rating")}>
                <h4>Customer Rating</h4>
                <span>{filters.rating ? "1 Selected" : "0 Selected"} {collapsed.rating ? "▾" : "▴"}</span>
              </button>
              {!collapsed.rating && (
                <div className="inside-catalog-options-list">
                  {RATING_OPTIONS.map((value) => (
                    <label key={value}>
                      <input
                        type="radio"
                        name="inside-catalog-rating"
                        checked={String(filters.rating) === String(value)}
                        onChange={() => handleFilterChange("rating", String(value))}
                      />
                      {value}★ & above
                    </label>
                  ))}
                </div>
              )}
            </div>

            <button className="inside-catalog-apply-btn">Apply Filters</button>
            <button className="inside-catalog-clear-btn" onClick={clearAllFilters}>Clear All</button>
          </aside>
        )}
        <section className="inside-catalog-products">
          <div className="inside-catalog-toolbar">
            <div className="inside-catalog-chips-row">
              {selectedCategoryGroups.map((categoryGroup) => (
                <button
                  type="button"
                  key={`selected-category-${categoryGroup.normalized}`}
                  className="inside-catalog-chip removable"
                  onClick={() => removeCategoryByIds(categoryGroup.ids)}
                >
                  {categoryGroup.label}
                  <span className="inside-catalog-chip-cross">x</span>
                </button>
              ))}
            </div>
          </div>
          <div className="shop-products-grid">
            {loading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="shop-product-skeleton">
                  <div className="skeleton-image" />
                  <div className="skeleton-line skeleton-name" />
                  <div className="skeleton-line skeleton-brand" />
                  <div className="skeleton-line skeleton-price" />
                </div>
              ))
            ) : sortedProducts.length === 0 ? (
              <div style={{ gridColumn: "1/-1", textAlign: "center", padding: "60px 0", color: "#7b8390", fontSize: 22, fontWeight: 700 }}>
                <div style={{ fontSize: 54, marginBottom: 12 }}>🛒</div>
                No products found<br />
                <span style={{ fontSize: 15, fontWeight: 400, color: "#a0a7b3" }}>Try adjusting your filters or search terms.</span>
              </div>
            ) : (
              sortedProducts.map((p) => {
                const originalPrice = Number(p.price);
                const discountPrice = Number(p.discount_price);
                const hasDiscount = discountPrice && discountPrice < originalPrice;
                const offPercent = hasDiscount
                  ? Math.round(((originalPrice - discountPrice) / originalPrice) * 100)
                  : 0;
                const rating = "4.5";
                const reviews = "2.1k";

                return (
                  <div
                    key={`${p.id}-${p.name}-${p.brand}-${p.image}`}
                    className="shop-product-card"
                    onClick={() => navigate(`/product/${p.id}`)}
                    style={{ cursor: "pointer" }}
                  >
                    <div className="shop-product-image">
                      <button
                        type="button"
                        className="wishlist-btn"
                        onClick={e => e.stopPropagation()}
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
                        <span className="rating-count">({reviews})</span>
                      </div>

                      <div className="shop-card-actions">
                        <button
                          type="button"
                          className="shop-card-cart-btn"
                          onClick={e => e.stopPropagation()}
                        >
                          Add to Cart
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </div>
      <Footer />
    </div>
);
}
