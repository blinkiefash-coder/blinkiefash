import "./Shop.css";
import { useState, useEffect, useMemo, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import PageSEO from "../components/PageSEO";

import {
  MdClose,
  MdFavoriteBorder,
  MdGridView,
  MdKeyboardArrowDown,
  MdLocationOn,
  MdOutlineShoppingCart,
  MdPersonOutline,
  MdSearch,
  MdCheckroom,
  MdTune,
} from "react-icons/md";
import { API_API_BASE_URL, API_BASE_URL } from "../apiBase";
import { getCategoryImage } from "../utils/categoryImages";
import { productImageUrlContain, productImageSrcSetContain } from "../utils/cloudinaryImage";
import { useAuth } from "../context/AuthContext";
import { hasVendorPasswordAuth } from "../utils/vendorSession";
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

const API_BASE = API_API_BASE_URL;
const RECENT_SEARCH_KEY = "bfw_recent_searches";

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
    const parentKey = category.parent_id != null && category.parent_id !== "" ? String(category.parent_id) : "ROOT";
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
  const { user, isLoggedIn: authLoggedIn } = useAuth();
  const userId = localStorage.getItem("userUuid");
  const city =
    localStorage.getItem("bfw_city") ||
    localStorage.getItem("selectedCity") ||
    "Cuttack";
  const isLoggedIn = authLoggedIn || Boolean(localStorage.getItem("userUuid") || localStorage.getItem("token"));
  const canSwitchToVendor = user?.role === "vendor" && hasVendorPasswordAuth();
  const headerUserName = String(user?.name || localStorage.getItem("userName") || "").trim();
  const headerFirstName = headerUserName ? headerUserName.split(/\s+/)[0] : "";
  const accountLabel = isLoggedIn ? (headerFirstName ? `Hi, ${headerFirstName}` : "My Account") : "Login / Signup";
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});
  const [productMetaById, setProductMetaById] = useState({});
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeBrand, setActiveBrand] = useState([]);
  const [activeColor, setActiveColor] = useState([]);
  const [brandSearch, setBrandSearch] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || "[]");
      return Array.isArray(stored) ? stored.filter(Boolean).slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(24);
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [loading, setLoading] = useState(true);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const searchBlurTimerRef = useRef(null);
  const searchSuggestTimerRef = useRef(null);

  const getChildren = useCallback((parentId) => {
    if (parentId === null || parentId === undefined) return [];
    const key = parentId === "ROOT" ? "ROOT" : String(parentId);
    return childrenByParent[key] || childrenByParent[parentId] || [];
  }, [childrenByParent]);

  const toCategoryKey = (value) => (value === null || value === undefined ? null : String(value));

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

  

  const normalizeText = (value) =>
    String(value || "").trim().toLowerCase();

  const normalizeSearchText = (value) =>
    normalizeText(value).replace(/[^a-z0-9]/g, "");

  const rankedMatches = (items, query, limit, getter) => {
    const prefix = [];
    const contains = [];
    const lower = normalizeText(query);

    for (const item of items) {
      const text = normalizeText(getter(item));
      if (!text) continue;
      if (text.startsWith(lower)) {
        prefix.push(item);
      } else if (text.includes(lower)) {
        contains.push(item);
      }
      if (prefix.length >= limit) break;
    }

    return [...prefix, ...contains].slice(0, limit);
  };

  const extractProducts = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.products)) return payload.products;
    return [];
  };


  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const nextSearch = (params.get("search") || "").trim();
    const nextCategoryId = params.get("category_id");

    // Defer state updates to avoid synchronous setState within effect
    const id = setTimeout(() => {
      setSearchTerm(nextSearch);
      setSearchInput(nextSearch);
      setActiveCategoryId(nextCategoryId ? String(nextCategoryId) : null);
      setVisibleCount(24);
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
        const response = await fetch(`${API_BASE}/products?limit=${pageSize}&offset=${offset}`);
        const data = await response.json();
        const pageItems = extractProducts(data);
        all.push(...pageItems);

        if (pageItems.length < pageSize) break;
        offset += pageSize;
      }

      return all;
    };

    // Defer to avoid synchronous setState inside effect
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
    if (!userId) {
      // defer to avoid synchronous setState inside effect
      const id = setTimeout(() => {
        setWishlistCount(0);
        setCartCount(0);
      }, 0);
      return () => clearTimeout(id);
    }

    const loadCounts = async () => {
      try {
        const [wishlistRes, cartRes] = await Promise.all([
          fetch(`${API_BASE}/wishlist/${userId}`),
          fetch(`${API_BASE}/cart/${userId}`),
        ]);
        const [wishlistData, cartData] = await Promise.all([
          wishlistRes.json(),
          cartRes.json(),
        ]);

        setWishlistCount(Array.isArray(wishlistData.items) ? wishlistData.items.length : 0);
        setCartCount(
          Array.isArray(cartData.items)
            ? cartData.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
            : 0
        );
      } catch {
        setWishlistCount(0);
        setCartCount(0);
      }
    };

    loadCounts();
  }, [userId]);

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
    if (activeBrand.length > 0) {
      const productBrand = normalizeText(product.brand || product.brand_name);
      if (!activeBrand.map(normalizeText).includes(productBrand)) {
        return false;
      }
    }

    if (selectedCategoryIds) {
      const productCategoryId =
        productMetaById[product.id]?.categoryId || product.category_id || null;

      if (!productCategoryId || !selectedCategoryIds.has(toCategoryKey(productCategoryId))) {
        return false;
      }
    }

    if (activeColor.length > 0) {
      const productColor = typeof product.color === "string" ? product.color : "";
      if (productColor && !activeColor.map(normalizeText).includes(productColor.trim().toLowerCase())) {
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

    const finalPrice = Number(product.discount_price) > 0 ? Number(product.discount_price) : Number(product.price || 0);
    if (finalPrice > maxPrice) {
      return false;
    }

    return true;
  });

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    const priceA = Number(a.discount_price) > 0 ? Number(a.discount_price) : Number(a.price);
    const priceB = Number(b.discount_price) > 0 ? Number(b.discount_price) : Number(b.price);

    if (sortBy === "price_low") return priceA - priceB;
    if (sortBy === "price_high") return priceB - priceA;
    if (sortBy === "newest") {
      const createdA = new Date(a.created_at || 0).getTime();
      const createdB = new Date(b.created_at || 0).getTime();
      return createdB - createdA;
    }
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

  const topCategoryStrip = useMemo(() => {
    const roots = getChildren("ROOT");
    return [{ id: null, name: "All" }, ...roots];
  }, [getChildren]);

  const navigateWithFilters = ({ nextSearch = searchTerm, nextCategoryId = activeCategoryId } = {}) => {
    const params = new URLSearchParams();
    const cleanSearch = String(nextSearch || "").trim();
    const cleanCategoryId = nextCategoryId ? String(nextCategoryId) : "";

    if (cleanSearch) params.set("search", cleanSearch);
    if (cleanCategoryId) params.set("category_id", cleanCategoryId);

    navigate(params.toString() ? `/shop?${params.toString()}` : "/shop");
  };

  const saveRecentSearch = (rawValue) => {
    const value = String(rawValue || "").trim();
    if (!value) return;

    const deduped = [value, ...recentSearches.filter((item) => normalizeText(item) !== normalizeText(value))].slice(0, 8);
    setRecentSearches(deduped);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(deduped));
  };

  const updateSearchSuggestions = (value) => {
    if (searchSuggestTimerRef.current) {
      clearTimeout(searchSuggestTimerRef.current);
      searchSuggestTimerRef.current = null;
    }

    const query = String(value || "").trim();
    if (!query) {
      searchSuggestTimerRef.current = setTimeout(async () => {
        const recentsFallback = recentSearches.map((item) => ({ text: item, type: "search", subtitle: "Recent search" }));
        try {
          const userIdParam = localStorage.getItem("userUuid") || "";
          const response = await fetch(
            `${API_BASE}/analytics/suggestions?user_id=${encodeURIComponent(userIdParam)}&limit=5`
          );
          const data = await response.json();

          const results = [];
          const seen = new Set();
          const pushResult = (text, subtitle) => {
            const clean = String(text || "").trim();
            if (!clean) return;
            const key = clean.toLowerCase();
            if (seen.has(key)) return;
            seen.add(key);
            results.push({ text: clean, type: "search", subtitle });
          };

          (Array.isArray(data?.recentSearches) ? data.recentSearches : []).forEach((text) => pushResult(text, "Recent search"));
          (Array.isArray(data?.trendingSearches) ? data.trendingSearches : []).forEach((text) => pushResult(text, "Trending"));

          if (results.length === 0) {
            setSearchSuggestions(recentsFallback.slice(0, 8));
          } else {
            setSearchSuggestions(results.slice(0, 8));
          }
        } catch {
          setSearchSuggestions(recentsFallback.slice(0, 8));
        }
      }, 50);
      return;
    }

    searchSuggestTimerRef.current = setTimeout(() => {
      const q = normalizeText(query);
      const seen = new Set();
      const ranked = [];

      const pushCandidate = (entry) => {
        const clean = String(entry?.text || "").trim();
        if (!clean) return;
        const key = `${entry.type}:${clean.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        ranked.push(entry);
      };

      // 0) Same as mobile: explicit search query first.
      pushCandidate({ text: query, type: "search" });

      // 1) Categories max 2, prefix first.
      rankedMatches(categories, q, 2, (item) => item.name).forEach((item) => {
        pushCandidate({ text: item.name, type: "category", id: item.id ? String(item.id) : "" });
      });

      // 2) Brands max 2, fallback top 2 when no matches.
      const matchingBrands = rankedMatches(brands, q, 2, (item) => item.name);
      const brandsToShow = matchingBrands.length > 0 ? matchingBrands : brands.slice(0, 2);
      brandsToShow.forEach((item) => {
        pushCandidate({
          text: item.name,
          type: "brand",
          id: item.id ? String(item.id) : "",
          subtitle: matchingBrands.length === 0 ? "Popular brand" : "",
        });
      });

      // 3) Product names max 4, prefix first.
      rankedMatches(products, q, 4, (item) => item.name).forEach((item) => {
        pushCandidate({ text: item.name, type: "product" });
      });

      setSearchSuggestions(ranked.slice(0, 8));
    }, 150);
  };

  const handleTopSearch = (event) => {
    event.preventDefault();
    const value = String(searchInput || "").trim();
    saveRecentSearch(value);
    setShowSearchSuggestions(false);
    navigateWithFilters({ nextSearch: value });
  };

  const handleSearchInputFocus = () => {
    if (searchBlurTimerRef.current) {
      clearTimeout(searchBlurTimerRef.current);
      searchBlurTimerRef.current = null;
    }
    updateSearchSuggestions(searchInput);
    setShowSearchSuggestions(true);
  };

  const handleSearchInputBlur = () => {
    searchBlurTimerRef.current = setTimeout(() => {
      setShowSearchSuggestions(false);
    }, 120);
  };

  const applySuggestion = (item) => {
    const type = item?.type || "product";
    const text = String(item?.text || "").trim();
    const id = String(item?.id || "").trim();

    if (!text) return;

    setShowSearchSuggestions(false);

    if (type === "category") {
      setSearchInput("");
      setSearchTerm("");
      setActiveBrand([]);
      setActiveCategoryId(id || null);
      navigateWithFilters({ nextSearch: "", nextCategoryId: id || null });
      return;
    }

    if (type === "brand") {
      setSearchInput("");
      setSearchTerm("");
      setActiveCategoryId(null);
      setActiveBrand([text]);
      navigateWithFilters({ nextSearch: "", nextCategoryId: null });
      return;
    }

    setSearchInput(text);
    saveRecentSearch(text);
    navigateWithFilters({ nextSearch: text });
  };

  const toggleBrandFilter = (name) => {
    setActiveBrand((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const toggleColorFilter = (name) => {
    setActiveColor((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const formatPrice = (value) => `₹${Number(value || 0).toLocaleString("en-IN")}`;

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
      setWishlistCount((count) => count + 1);
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
      setCartCount((count) => count + 1);
      alert("Added to cart");
    } catch {
      alert("Unable to add to cart right now");
    }
  };

  return (
    <div className="catalog-page">
      <PageSEO
        title="Shop Fashion Online — Clothing, Footwear & More"
        description="Browse thousands of products across Men, Women, Kids, Electronics & Footwear. Filter by brand, price and colour. Express 60-minute delivery in Odisha."
        path="/shop"
      />
      <div className="hp-sticky-head catalog-home-topbar">
        <header className="hp-main-header catalog-main-header">
          <button type="button" className="hp-brand" onClick={() => navigate("/")}>
            <img src="https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg" alt="Blinkiefash" className="hp-logo" />
            <span className="hp-brand-text">
              <span className="hp-brand-name">
                BLINKIE<span className="hp-brand-accent">FASH</span>
              </span>
              <span className="hp-tagline">DELIVERED IN 60 MINUTES</span>
            </span>
          </button>

          <form className="hp-header-search catalog-mobile-search" onSubmit={handleTopSearch}>
            <MdSearch className="hp-search-icon" />
            <input
              name="q"
              value={searchInput}
              onChange={(e) => {
                const value = e.target.value;
                setSearchInput(value);
                updateSearchSuggestions(value);
                if (!value.trim()) {
                  navigateWithFilters({ nextSearch: "" });
                }
              }}
              onFocus={handleSearchInputFocus}
              onBlur={handleSearchInputBlur}
              placeholder="Search products, brands..."
            />
            {searchInput.trim() ? (
              <button
                type="button"
                className="catalog-search-clear"
                aria-label="Clear search"
                onClick={() => {
                  setSearchInput("");
                  updateSearchSuggestions("");
                  navigateWithFilters({ nextSearch: "" });
                }}
              >
                <MdClose />
              </button>
            ) : null}
            <button type="submit" className="hp-search-btn" aria-label="Search products">
              <MdSearch />
            </button>
            {showSearchSuggestions && searchSuggestions.length > 0 ? (
              <div className="catalog-search-suggestions" role="listbox" aria-label="Search suggestions">
                {searchSuggestions.map((item, idx) => (
                  <button
                    key={`${item.type}-${item.text}-${idx}`}
                    type="button"
                    className="catalog-suggestion-item"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => applySuggestion(item)}
                  >
                    <MdSearch />
                    <span className="catalog-suggestion-text">{item.text}</span>
                    <span className="catalog-suggestion-type">{item.subtitle || item.type}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </form>

          <div className="catalog-header-actions-wrap">
            <button type="button" className="catalog-location-pill" onClick={() => navigate("/account")}>
              <MdLocationOn />
              <span>{city}</span>
              <MdKeyboardArrowDown />
            </button>

            <div className="hp-header-actions">
              {canSwitchToVendor ? (
                <button type="button" onClick={() => navigate("/vendor/orders")}>
                  <MdCheckroom />
                  <span>Switch to Vendor</span>
                </button>
              ) : null}
              <button type="button" onClick={() => navigate(isLoggedIn ? "/account" : "/login")}>
                <MdPersonOutline />
                <span>{accountLabel}</span>
              </button>
              <button type="button" onClick={() => navigate("/wishlist")}>
                <MdFavoriteBorder />
                <span>Wishlist</span>
                {wishlistCount > 0 ? <span className="hp-icon-badge">{wishlistCount}</span> : null}
              </button>
              <button type="button" onClick={() => navigate("/cart")}>
                <MdOutlineShoppingCart />
                <span>Cart</span>
                {cartCount > 0 ? <span className="hp-icon-badge">{cartCount}</span> : null}
              </button>
            </div>
          </div>
        </header>
      </div>

      <main className="catalog-main">
        <div className="catalog-headline-row">
          <div>
            <h2>All Products</h2>
            <p>Showing 1 - {Math.min(visibleCount, sortedProducts.length)} of {sortedProducts.length} products</p>
          </div>
          <div className="catalog-controls">
            <div className="catalog-select-wrap">
              <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
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
            </button>
          </div>
        </div>

        <div className="catalog-category-strip">
          <div className="catalog-round-list">
            {topCategoryStrip.map((category) => {
              const dbImage = resolveImageUrl(category.category_url ?? category.image);
              const image = dbImage || getCategoryImage(category.name) || "";
              const hasImage = Boolean(image);
              const isActive = toCategoryKey(category.id) === toCategoryKey(activeCategoryId);

              return (
                <button
                  key={category.id || "all-round"}
                  type="button"
                  className={`catalog-round-item ${isActive ? "active" : ""}`}
                  onClick={() => navigateWithFilters({ nextCategoryId: category.id || null })}
                >
                  <span className="catalog-round-image-wrap">
                    {hasImage ? (
                      <img
                        src={image}
                        alt={category.name}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          const fallback = event.currentTarget.parentElement?.querySelector(
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
        </div>

        {showFilters ? (
          <section className="catalog-filters-panel">
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
                  const checked = activeColor.includes(name.toLowerCase()) || activeColor.includes(name);
                  return (
                    <label key={name} className={`catalog-swatch-label ${checked ? "checked" : ""}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleColorFilter(name)}
                      />
                      <span className="catalog-swatch-dot" style={{ background: hex }} />
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
          </section>
        ) : null}

        <div className="catalog-products-scroll">
          <section className="catalog-products-grid">
            {loading
              ? Array.from({ length: 12 }).map((_, index) => (
                  <div key={`skeleton-${index}`} className="catalog-product-skeleton" />
                ))
              : visibleProducts.map((product) => {
                const originalPrice = Number(product.price || 0);
                const salePrice = Number(product.discount_price || 0) > 0
                  ? Number(product.discount_price)
                  : originalPrice;
                const hasDiscount = salePrice < originalPrice;
                const offPercent = hasDiscount
                  ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
                  : 0;
                const isBestseller = product.is_bestseller === true;
                const isTryAndBuy = product.is_try_and_buy === true;
                const badgeType = isBestseller
                  ? "BESTSELLER"
                  : isTryAndBuy
                    ? "Try & Buy"
                    : hasDiscount
                      ? `${offPercent}% OFF`
                      : "+ 60 MIN";

                return (
                  <article
                    key={`${product.id}-${product.variant_id || ""}-${product.image || ""}`}
                    className="catalog-product-card"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <div className="catalog-card-top">
                      <span
                        className={`catalog-card-badge ${
                          isBestseller
                            ? "bestseller"
                            : isTryAndBuy
                              ? "try-buy"
                              : hasDiscount
                                ? "discount"
                                : "fresh"
                        }`}
                      >
                        {badgeType}
                      </span>
                      <button
                        type="button"
                        className="catalog-wishlist"
                        onClick={(event) => handleAddToWishlist(event, product)}
                        aria-label="Add to wishlist"
                      >
                        <MdFavoriteBorder />
                      </button>
                    </div>

                    <div className="catalog-card-image-wrap">
                      {product.image ? (
                        <img
                          src={productImageUrlContain(product.image, 400, 533)}
                          srcSet={productImageSrcSetContain(product.image)}
                          sizes="(max-width: 420px) 45vw, (max-width: 760px) 46vw, (max-width: 900px) 31vw, (max-width: 1200px) 23vw, (max-width: 1400px) 18vw, 15vw"
                          alt={product.name}
                          loading="lazy"
                          width="400"
                          height="533"
                        />
                      ) : (
                        <div className="catalog-no-image"><MdCheckroom /></div>
                      )}
                    </div>

                    <div className="catalog-card-body">
                      <small>{product.brand || "Brand"}</small>
                      <h3>{product.name}</h3>
                      <p className="catalog-card-sub">
                        {product.color || "Multi color"}
                      </p>

                      <div className="catalog-card-price-row">
                        <strong>{formatPrice(salePrice)}</strong>
                        {hasDiscount ? <span>{formatPrice(originalPrice)}</span> : null}
                      </div>
                      {hasDiscount ? <p className="catalog-card-off">{offPercent}% OFF</p> : null}

                      <button
                        type="button"
                        className="catalog-card-cart"
                        onClick={(event) => handleAddToCart(event, product)}
                        aria-label="Add to cart"
                      >
                        <MdOutlineShoppingCart />
                      </button>
                    </div>
                  </article>
                );
              })}

            {!loading && visibleProducts.length === 0 ? (
              <div className="catalog-empty-state">
                <h3>No products found</h3>
                <p>Try clearing filters or searching another term.</p>
              </div>
            ) : null}
          </section>

          {!loading && visibleCount < sortedProducts.length ? (
            <button type="button" className="catalog-load-more" onClick={() => setVisibleCount((prev) => prev + 24)}>
              Load more products
            </button>
          ) : null}
        </div>
      </main>
    </div>
  );
}