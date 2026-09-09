import "./Shop.css";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PageSEO from "../components/PageSEO";
import Navbar from "../components/Navbar";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";

import {
  MdGridView,
  MdKeyboardArrowDown,
  MdTune,
  MdChevronRight,
} from "react-icons/md";
import { API_API_BASE_URL, API_BASE_URL } from "../apiBase";
import { getCategoryImage } from "../utils/categoryImages";
import "./Home.css";

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

const DISCOUNT_BUCKETS = [10, 20, 30, 40, 50, 60, 70];

// Desired display order for top-level ("root") category chips.
const CATEGORY_ORDER = [
  "MEN",
  "WOMEN",
  "KIDS",
  "FOOTWEAR",
  "ELECTRONICS",
  "TRAVEL AND BACKPACK",
];

function getCategoryRank(name) {
  const normalized = String(name || "").trim().toUpperCase();
  const idx = CATEGORY_ORDER.indexOf(normalized);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

const API_BASE = API_API_BASE_URL;

const resolveImageUrl = (raw) => {
  const value = (raw ?? "").toString().trim();
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
};

const buildChildrenMap = (data) => {
  const map = {};

  data.forEach((category) => {
    const parentKey =
      category.parent_id != null && category.parent_id !== ""
        ? String(category.parent_id)
        : "ROOT";
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
  const location = useLocation();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});
  const [productMetaById, setProductMetaById] = useState({});
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeBrand, setActiveBrand] = useState([]);
  const [activeColor, setActiveColor] = useState([]);
  const [activeGender, setActiveGender] = useState([]);
  const [minDiscount, setMinDiscount] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [brandSearch, setBrandSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(24);
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [loading, setLoading] = useState(true);

  // Explicit user expand/collapse action on the category tree (replaces the
  // old side drawer). `null` means "no manual override yet" — in that case
  // the tree falls back to whatever activeCategoryId implies (see below).
  const [manualExpand, setManualExpand] = useState(null);

  const getChildren = useCallback(
    (parentId) => {
      if (parentId === null || parentId === undefined) return [];
      const key = parentId === "ROOT" ? "ROOT" : String(parentId);
      return childrenByParent[key] || childrenByParent[parentId] || [];
    },
    [childrenByParent]
  );

  const toCategoryKey = (value) =>
    value === null || value === undefined ? null : String(value);

  const getDescendantCategoryIds = (categoryId) => {
    const collectedIds = [];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      if (!currentId) continue;

      collectedIds.push(toCategoryKey(currentId));

      const children = getChildren(currentId);
      children.forEach((child) => {
        queue.push(child.id);
      });
    }

    return collectedIds;
  };

  const categoryById = useMemo(() => {
    const map = {};
    categories.forEach((c) => {
      map[String(c.id)] = c;
    });
    return map;
  }, [categories]);

  const getRootCategoryName = useCallback(
    (categoryId) => {
      let current = categoryById[String(categoryId)];
      const seen = new Set();
      while (current && current.parent_id) {
        const key = String(current.id);
        if (seen.has(key)) break;
        seen.add(key);
        current = categoryById[String(current.parent_id)];
      }
      return current?.name || null;
    },
    [categoryById]
  );

  const resolveProductGender = useCallback(
    (product) => {
      const explicit = String(
        productMetaById[product.id]?.gender || product.gender || ""
      ).trim();
      if (explicit) return explicit;

      const categoryId =
        productMetaById[product.id]?.categoryId || product.category_id;
      if (!categoryId) return null;

      const rootName = String(getRootCategoryName(categoryId) || "")
        .trim()
        .toLowerCase();
      if (!rootName) return null;
      if (rootName === "men") return "Men";
      if (rootName === "women") return "Women";
      if (rootName === "kids") return "Kids";
      return null;
    },
    [productMetaById, getRootCategoryName]
  );

  const normalizeText = (value) => String(value || "").trim().toLowerCase();

  const normalizeSearchText = (value) =>
    normalizeText(value).replace(/[^a-z0-9]+/g, "");

  const extractProducts = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.products)) return payload.products;
    return [];
  };

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextSearch = (params.get("search") || "").trim();
    const nextCategoryId = params.get("category_id");

    const id = setTimeout(() => {
      setSearchTerm(nextSearch);
      setActiveCategoryId(nextCategoryId ? String(nextCategoryId) : null);
      setVisibleCount(24);
      // A fresh navigation should clear any manual expand/collapse override
      // so the tree re-derives itself from the new activeCategoryId.
      setManualExpand(null);
    }, 0);

    return () => clearTimeout(id);
  }, [location.search]);

  useEffect(() => {
    let isCancelled = false;

    const fetchAllProducts = async () => {
      const pageSize = 100;
      let offset = 0;
      const all = [];

      while (true) {
        const response = await fetch(
          `${API_BASE}/products?limit=${pageSize}&offset=${offset}`
        );
        const data = await response.json();
        const pageItems = extractProducts(data);
        all.push(...pageItems);

        if (pageItems.length < pageSize) break;
        offset += pageSize;
      }

      return all;
    };

    const startId = setTimeout(() => setLoading(true), 0);
    fetchAllProducts()
      .then((data) => {
        if (!isCancelled) setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("[Shop] Error fetching products:", err);
      })
      .finally(() => {
        if (!isCancelled) setLoading(false);
      });

    return () => {
      isCancelled = true;
      clearTimeout(startId);
    };
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
      const id = setTimeout(() => setProductMetaById({}), 0);
      return () => clearTimeout(id);
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
          const variants = Array.isArray(detailData?.variants)
            ? detailData.variants
            : [];
          const inStock =
            variants.length === 0 ||
            variants.some(
              (variant) =>
                Number(variant.available_stock || 0) > 0 ||
                variant.available_stock === undefined
            );

          return {
            productId: product.id,
            categoryId,
            gender,
            inStock,
          };
        })
      );

      if (isCancelled) return;

      const nextMeta = {};
      detailResults.forEach((result) => {
        if (result.status !== "fulfilled" || !result.value) return;

        const { productId, categoryId, gender, inStock } = result.value;
        nextMeta[productId] = { categoryId, gender, inStock };
      });

      setProductMetaById(nextMeta);
    };

    loadProductMeta().catch((err) => console.error(err));

    return () => {
      isCancelled = true;
    };
  }, [products]);

  // Where the currently active category sits in the tree — derived purely
  // from render-time data (no effect/setState needed). This is the
  // "default" expand state whenever the user hasn't manually toggled a row.
  const derivedExpand = useMemo(() => {
    if (!activeCategoryId || categories.length === 0) {
      return { rootId: null, subId: null };
    }
    const current = categoryById[String(activeCategoryId)];
    if (!current) return { rootId: null, subId: null };

    if (!current.parent_id) {
      // Selected category is itself a root (Men/Women/Kids/etc).
      return { rootId: current.id, subId: null };
    }

    const parent = categoryById[String(current.parent_id)];
    if (parent && !parent.parent_id) {
      // Selected category is a sub-category directly under a root.
      return { rootId: parent.id, subId: current.id };
    }

    if (parent && parent.parent_id) {
      // Selected category is a sub-sub-category.
      const grandparent = categoryById[String(parent.parent_id)];
      return { rootId: grandparent ? grandparent.id : null, subId: parent.id };
    }

    return { rootId: null, subId: null };
  }, [activeCategoryId, categoryById, categories.length]);

  const expandedRootId = manualExpand ? manualExpand.rootId : derivedExpand.rootId;
  const expandedSubId = manualExpand ? manualExpand.subId : derivedExpand.subId;

  const selectedCategoryIds = activeCategoryId
    ? new Set(getDescendantCategoryIds(activeCategoryId))
    : null;

  const filteredProducts = products.filter((product) => {
    if (activeBrand.length > 0) {
      const productBrand = normalizeText(product.brand || product.brand_name);
      if (!activeBrand.map(normalizeText).includes(productBrand)) {
        return false;
      }
    }

    if (selectedCategoryIds) {
      const productCategoryId =
        productMetaById[product.id]?.categoryId || product.category_id || null;

      if (
        !productCategoryId ||
        !selectedCategoryIds.has(toCategoryKey(productCategoryId))
      ) {
        return false;
      }
    }

    if (activeColor.length > 0) {
      const productColor =
        typeof product.color === "string" ? product.color : "";
      if (
        productColor &&
        !activeColor
          .map(normalizeText)
          .includes(productColor.trim().toLowerCase())
      ) {
        return false;
      }
    }

    if (activeGender.length > 0) {
      const productGender = normalizeText(resolveProductGender(product));
      if (
        !productGender ||
        !activeGender.map(normalizeText).includes(productGender)
      ) {
        return false;
      }
    }

    if (minDiscount > 0) {
      const basePrice = Number(product.price || 0);
      const discountedPrice =
        Number(product.discount_price) > 0
          ? Number(product.discount_price)
          : basePrice;
      const offPercent =
        basePrice > 0 && discountedPrice < basePrice
          ? Math.round(((basePrice - discountedPrice) / basePrice) * 100)
          : 0;
      if (offPercent < minDiscount) {
        return false;
      }
    }

    if (inStockOnly) {
      const meta = productMetaById[product.id];
      if (meta && meta.inStock === false) {
        return false;
      }
    }

    if (searchTerm.trim()) {
      const haystackRaw = [
        product.name,
        product.brand,
        product.brand_name,
        product.color,
        product.gender,
        product.description,
        product.category_name,
      ]
        .filter(Boolean)
        .join(" ");

      const haystack = normalizeSearchText(haystackRaw);
      const query = normalizeSearchText(searchTerm);

      if (!haystack.includes(query)) {
        return false;
      }
    }

    const finalPrice =
      Number(product.discount_price) > 0
        ? Number(product.discount_price)
        : Number(product.price || 0);
    if (finalPrice > maxPrice) {
      return false;
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA =
      Number(a.discount_price) > 0
        ? Number(a.discount_price)
        : Number(a.price);
    const priceB =
      Number(b.discount_price) > 0
        ? Number(b.discount_price)
        : Number(b.price);

    if (sortBy === "price_low") return priceA - priceB;
    if (sortBy === "price_high") return priceB - priceA;
    if (sortBy === "newest") {
      const createdA = new Date(a.created_at || 0).getTime();
      const createdB = new Date(b.created_at || 0).getTime();
      return createdB - createdA;
    }
    if (sortBy === "discount") {
      const offA =
        Number(a.discount_price) > 0 &&
        Number(a.price) > Number(a.discount_price)
          ? ((Number(a.price) - Number(a.discount_price)) / Number(a.price)) *
            100
          : 0;
      const offB =
        Number(b.discount_price) > 0 &&
        Number(b.price) > Number(b.discount_price)
          ? ((Number(b.price) - Number(b.discount_price)) / Number(b.price)) *
            100
          : 0;
      return offB - offA;
    }
    return 0;
  });

  const visibleProducts = sortedProducts.slice(0, visibleCount);
  const visibleBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const availableGenders = useMemo(() => {
    const seen = new Map();
    products.forEach((product) => {
      const clean = String(resolveProductGender(product) || "").trim();
      if (!clean) return;
      const key = clean.toLowerCase();
      if (!seen.has(key)) seen.set(key, clean);
    });

    if (seen.size === 0) {
      return ["Men", "Women", "Kids"];
    }
    return Array.from(seen.values()).sort();
  }, [products, resolveProductGender]);

  // Root category chips ordered per CATEGORY_ORDER
  // (Men, Women, Kids, Footwear, Electronics, Travel and Backpack),
  // with "All" pinned first and any unmatched categories at the end.
  const topCategoryStrip = useMemo(() => {
    const roots = [...getChildren("ROOT")].sort((a, b) => {
      const rankA = getCategoryRank(a.name);
      const rankB = getCategoryRank(b.name);
      if (rankA !== rankB) return rankA - rankB;
      return String(a.name).localeCompare(String(b.name));
    });
    return [{ id: null, name: "All" }, ...roots];
  }, [getChildren]);

  // Sub-categories of whichever root category is currently expanded.
  const rootSubcategories = useMemo(
    () => (expandedRootId ? getChildren(expandedRootId) : []),
    [expandedRootId, getChildren]
  );

  // Sub-sub-categories of whichever sub-category is currently expanded.
  const subSubcategories = useMemo(
    () => (expandedSubId ? getChildren(expandedSubId) : []),
    [expandedSubId, getChildren]
  );

  const navigateWithFilters = ({
    nextSearch = searchTerm,
    nextCategoryId = activeCategoryId,
  } = {}) => {
    const params = new URLSearchParams();
    const cleanSearch = String(nextSearch || "").trim();
    const cleanCategoryId = nextCategoryId ? String(nextCategoryId) : "";

    if (cleanSearch) params.set("search", cleanSearch);
    if (cleanCategoryId) params.set("category_id", cleanCategoryId);

    navigate(params.toString() ? `/shop?${params.toString()}` : "/shop");
  };

  const toggleBrandFilter = (name) => {
    setActiveBrand((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  const toggleColorFilter = (name) => {
    setActiveColor((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  const toggleGenderFilter = (name) => {
    setActiveGender((prev) =>
      prev.includes(name)
        ? prev.filter((item) => item !== name)
        : [...prev, name]
    );
  };

  const selectMinDiscount = (value) => {
    setMinDiscount((prev) => (prev === value ? 0 : value));
  };

  const activeFilterCount =
    activeBrand.length +
    activeColor.length +
    activeGender.length +
    (minDiscount > 0 ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (maxPrice < 10000 ? 1 : 0);

  const clearAllFilters = () => {
    setActiveBrand([]);
    setActiveColor([]);
    setActiveGender([]);
    setMinDiscount(0);
    setInStockOnly(false);
    setMaxPrice(10000);
    setBrandSearch("");
  };

  // --- Inline category tree handlers (replaces the old side drawer) ---

  const handleRootCategoryClick = (category) => {
    if (!category.id) {
      // "All" chip clears everything.
      setManualExpand({ rootId: null, subId: null });
      setActiveCategoryId(null);
      navigateWithFilters({ nextCategoryId: null });
      return;
    }

    setActiveCategoryId(String(category.id));
    navigateWithFilters({ nextCategoryId: category.id });

    // Toggle the sub-category row open/closed when tapping the same root again.
    const isSameExpanded = toCategoryKey(expandedRootId) === toCategoryKey(category.id);
    setManualExpand({ rootId: isSameExpanded ? null : category.id, subId: null });
  };

  const handleSubCategoryClick = (category) => {
    setActiveCategoryId(String(category.id));
    navigateWithFilters({ nextCategoryId: category.id });

    const isSameExpanded = toCategoryKey(expandedSubId) === toCategoryKey(category.id);
    setManualExpand({
      rootId: expandedRootId,
      subId: isSameExpanded ? null : category.id,
    });
  };

  const handleSubSubCategoryClick = (category) => {
    setActiveCategoryId(String(category.id));
    navigateWithFilters({ nextCategoryId: category.id });
  };

  return (
    <div className="catalog-page">
      <PageSEO
        title="Shop Fashion Online — Clothing, Footwear & More"
        description="Browse thousands of products across Men, Women, Kids, Electronics & Footwear. Filter by brand, price and colour. Express 60-minute delivery in Odisha."
        path="/shop"
      />

      <Navbar />

      <main className="catalog-main">
        <div className="catalog-headline-row">
          <div>
            <h2>All Products</h2>
            <p>
              Showing 1 - {Math.min(visibleCount, sortedProducts.length)} of{" "}
              {sortedProducts.length} products
            </p>
          </div>
          <div className="catalog-controls">
            <div className="catalog-select-wrap">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
              >
                <option value="newest">Sort by: Newest First</option>
                <option value="price_low">Sort by: Price Low to High</option>
                <option value="price_high">Sort by: Price High to Low</option>
                <option value="discount">Sort by: Highest Discount</option>
              </select>
              <MdKeyboardArrowDown className="catalog-select-caret" />
            </div>
            <button
              type="button"
              className={`catalog-filter-toggle ${showFilters ? "active" : ""}`}
              onClick={() => setShowFilters((prev) => !prev)}
            >
              <MdTune /> Filter
              {activeFilterCount > 0 ? (
                <span className="catalog-filter-count">{activeFilterCount}</span>
              ) : null}
            </button>
          </div>
        </div>

        <div className="catalog-category-strip">
          <div className="catalog-round-list">
            {topCategoryStrip.map((category) => {
              const dbImage = resolveImageUrl(
                category.category_url ?? category.image
              );
              const image = dbImage || getCategoryImage(category.name) || "";
              const hasImage = Boolean(image);
              const isActive =
                toCategoryKey(category.id) === toCategoryKey(activeCategoryId);
              const hasChildren = category.id
                ? getChildren(category.id).length > 0
                : false;
              const isExpanded =
                category.id &&
                toCategoryKey(expandedRootId) === toCategoryKey(category.id);

              return (
                <button
                  key={category.id || "all-round"}
                  type="button"
                  className={`catalog-round-item ${isActive ? "active" : ""}`}
                  aria-expanded={hasChildren ? isExpanded : undefined}
                  onClick={() => handleRootCategoryClick(category)}
                >
                  <span className="catalog-round-image-wrap">
                    {hasImage ? (
                      <img
                        src={image}
                        alt={category.name}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          const fallback =
                            event.currentTarget.parentElement?.querySelector(
                              ".catalog-round-fallback-icon"
                            );
                          if (fallback) fallback.style.display = "inline-flex";
                        }}
                      />
                    ) : null}
                    <span
                      className="catalog-round-fallback-icon"
                      style={hasImage ? { display: "none" } : undefined}
                      aria-hidden="true"
                    >
                      <MdGridView />
                    </span>
                  </span>
                  <span>{category.name}</span>
                </button>
              );
            })}
          </div>

          {expandedRootId && rootSubcategories.length > 0 ? (
            <div className="catalog-subtree">
              <div className="catalog-subcat-row" role="list">
                {rootSubcategories.map((sub) => {
                  const isActive =
                    toCategoryKey(sub.id) === toCategoryKey(activeCategoryId);
                  const isExpanded =
                    toCategoryKey(expandedSubId) === toCategoryKey(sub.id);
                  const hasChildren = getChildren(sub.id).length > 0;

                  return (
                    <button
                      key={sub.id}
                      type="button"
                      role="listitem"
                      className={`catalog-subcat-chip ${isActive ? "active" : ""}`}
                      aria-expanded={hasChildren ? isExpanded : undefined}
                      onClick={() => handleSubCategoryClick(sub)}
                    >
                      {sub.name}
                      {hasChildren ? (
                        <MdChevronRight
                          className={`catalog-subcat-caret ${
                            isExpanded ? "open" : ""
                          }`}
                        />
                      ) : null}
                    </button>
                  );
                })}
              </div>

              {expandedSubId && subSubcategories.length > 0 ? (
                <div className="catalog-subsubcat-row" role="list">
                  {subSubcategories.map((subsub) => {
                    const isActive =
                      toCategoryKey(subsub.id) === toCategoryKey(activeCategoryId);

                    return (
                      <button
                        key={subsub.id}
                        type="button"
                        role="listitem"
                        className={`catalog-subsubcat-chip ${
                          isActive ? "active" : ""
                        }`}
                        onClick={() => handleSubSubCategoryClick(subsub)}
                      >
                        {subsub.name}
                      </button>
                    );
                  })}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>

        {showFilters ? (
          <section className="catalog-filters-panel">
            <div className="catalog-filters-panel-header">
              <h3>Filters</h3>
              {activeFilterCount > 0 ? (
                <button
                  type="button"
                  className="catalog-filters-clear"
                  onClick={clearAllFilters}
                >
                  Clear All
                </button>
              ) : null}
            </div>

            <div className="catalog-filter-col">
              <h4>Brand</h4>
              <input
                className="catalog-filter-search"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Search brand"
              />
              <div className="catalog-filter-list">
                {visibleBrands.slice(0, 15).map((brand) => (
                  <label key={brand.id}>
                    <input
                      type="checkbox"
                      checked={activeBrand.includes(brand.name)}
                      onChange={() => toggleBrandFilter(brand.name)}
                    />
                    <span>{brand.name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="catalog-filter-col">
              <h4>Color</h4>
              <div className="catalog-filter-list catalog-filter-swatches">
                {COLORS.map(([name, hex]) => {
                  const checked =
                    activeColor.includes(name.toLowerCase()) ||
                    activeColor.includes(name);
                  return (
                    <label
                      key={name}
                      className={`catalog-swatch-label ${checked ? "checked" : ""}`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColorFilter(name)}
                      />
                      <span
                        className="catalog-swatch-dot"
                        style={{ background: hex }}
                      />
                      <span>{name}</span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="catalog-filter-col">
              <h4>Price</h4>
              <input
                type="range"
                min="500"
                max="12000"
                step="100"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
              />
              <p>Up to Rs. {maxPrice.toLocaleString("en-IN")}</p>
            </div>

            <div className="catalog-filter-col">
              <h4>Gender</h4>
              <div className="catalog-filter-list">
                {availableGenders.map((name) => (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={activeGender.includes(name)}
                      onChange={() => toggleGenderFilter(name)}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="catalog-filter-col">
              <h4>Discount Range</h4>
              <div className="catalog-filter-chips">
                {DISCOUNT_BUCKETS.map((value) => (
                  <button
                    key={value}
                    type="button"
                    className={`catalog-filter-chip ${minDiscount === value ? "active" : ""}`}
                    onClick={() => selectMinDiscount(value)}
                  >
                    {value}% and above
                  </button>
                ))}
              </div>
            </div>

            <div className="catalog-filter-col">
              <h4>Availability</h4>
              <div className="catalog-filter-list">
                <label>
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                  />
                  <span>In stock only</span>
                </label>
              </div>
            </div>
          </section>
        ) : null}

        <div className="catalog-products-scroll">
          <section className="catalog-products-grid">
            {loading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <ProductCardSkeleton key={`skeleton-${index}`} />
                ))
              : visibleProducts.map((product) => (
                  <ProductCard
                    key={`${product.id}-${product.variant_id || ""}-${product.image || ""}`}
                    product={product}
                  />
                ))}

            {!loading && visibleProducts.length === 0 ? (
              <div className="catalog-empty-state">
                <h3>No products found</h3>
                <p>Try clearing filters or searching another term.</p>
              </div>
            ) : null}
          </section>

          {!loading && visibleCount < sortedProducts.length ? (
            <button
              type="button"
              className="catalog-load-more"
              onClick={() => setVisibleCount((prev) => prev + 24)}
            >
              Load more products
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}