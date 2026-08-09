import "./Shop.css";
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";
import logo from "../assets/logo.png";

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

const CATEGORY_ICONS = {
  women: "/images/Women-section.png",
  men: "/images/Men-section.png",
  kids: "/images/kids-section.png",
  footwear: "/images/shoes.png",
  "bags & backpacks": "/images/backpack-section.png",
  electronics: "/images/electronics.png",
  beauty: "/images/beauty-section.png",
  jewellery: "/images/jwellery.png",
  "home & living": "/images/home-section.png",
  all: "/images/category.png",
};

const DEPARTMENT_MENU = [
  "Women",
  "Men",
  "Kids",
  "Footwear",
  "Bags & Backpacks",
  "Electronics",
  "Beauty",
  "Jewellery",
  "Home & Living",
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
  const selectedCity = localStorage.getItem("selectedCity") || "Cuttack";
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
  const [sortBy, setSortBy] = useState("newest");
  const [visibleCount, setVisibleCount] = useState(24);
  const [showFilters, setShowFilters] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [loading, setLoading] = useState(true);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);

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

  const activeCategory = categories.find((item) => item.id === activeCategoryId) || null;

  const normalizeText = (value) =>
    String(value || "").trim().toLowerCase();

  const extractProducts = (payload) => {
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray(payload.products)) return payload.products;
    return [];
  };

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

  useEffect(() => {
    setLoading(true);
    fetchAllProducts()
      .then((data) => {
        console.log('[Shop] Fetched products data:', {
          isArray: Array.isArray(data),
          dataLength: Array.isArray(data) ? data.length : 0,
          firstProduct: Array.isArray(data) && data.length > 0 ? data[0] : null,
          sampleProducts: Array.isArray(data) ? data.slice(0, 3).map(p => ({ id: p.id, name: p.name, image: p.image, variant_id: p.variant_id })) : []
        });
        setProducts(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error('[Shop] Error fetching products:', err);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!userId) {
      setWishlistCount(0);
      setCartCount(0);
      return;
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
    if (activeBrand.length > 0) {
      const productBrand = normalizeText(product.brand || product.brand_name);
      if (!activeBrand.map(normalizeText).includes(productBrand)) {
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

    if (activeColor.length > 0) {
      const productColor = typeof product.color === "string" ? product.color : "";
      if (productColor && !activeColor.map(normalizeText).includes(productColor.trim().toLowerCase())) {
        return false;
      }
    }

    if (searchTerm.trim()) {
      const haystack = normalizeText(`${product.name || ""} ${product.brand || product.brand_name || ""}`);
      if (!haystack.includes(normalizeText(searchTerm))) {
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
    const roots = getChildren("ROOT").slice(0, 9);
    return [{ id: null, name: "All" }, ...roots];
  }, [childrenByParent]);

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
      <header className="catalog-header">
        <div className="catalog-top-row">
          <button className="catalog-logo" onClick={() => navigate("/")} type="button">
            <img src={logo} alt="Blinkiefash" />
          </button>

          <div className="catalog-search-wrap">
            <input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="catalog-search"
              placeholder="Search for products, brands and more..."
            />
            <button type="button" className="catalog-search-btn">Search</button>
          </div>

          <div className="catalog-actions">
            <button type="button" className="catalog-city">Delivering to {selectedCity}</button>
            <button type="button" onClick={() => navigate("/account")}>My Account</button>
            <button type="button" onClick={() => navigate("/wishlist")}>
              Wishlist
              {wishlistCount > 0 ? <span>{wishlistCount}</span> : null}
            </button>
            <button type="button" onClick={() => navigate("/cart")}>
              Cart
              {cartCount > 0 ? <span>{cartCount}</span> : null}
            </button>
          </div>
        </div>

        <nav className="catalog-nav-row">
          <button type="button" className="catalog-nav-shop-btn">Shop by Category</button>
          {DEPARTMENT_MENU.map((name) => (
            <button key={name} type="button" className="catalog-nav-item" onClick={() => navigate("/shop")}>{name}</button>
          ))}
        </nav>
      </header>

      <main className="catalog-main">
        <div className="catalog-headline-row">
          <div>
            <h2>All Products</h2>
            <p>Showing 1 - {Math.min(visibleCount, sortedProducts.length)} of {sortedProducts.length} products</p>
          </div>
          <div className="catalog-controls">
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Sort by: Newest First</option>
              <option value="price_low">Sort by: Price Low to High</option>
              <option value="price_high">Sort by: Price High to Low</option>
              <option value="discount">Sort by: Highest Discount</option>
            </select>
            <button type="button" onClick={() => setShowFilters((prev) => !prev)}>Filter</button>
          </div>
        </div>

        <div className="catalog-category-strip">
          <input
            className="catalog-inline-search"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search products, brands..."
          />
          <div className="catalog-round-list">
            {topCategoryStrip.map((category) => {
              const key = normalizeText(category.name);
              const image = CATEGORY_ICONS[key] || "/images/category.png";
              const isActive = (category.id || null) === activeCategoryId;

              return (
                <button
                  key={category.id || "all-round"}
                  type="button"
                  className={`catalog-round-item ${isActive ? "active" : ""}`}
                  onClick={() => setActiveCategoryId(category.id || null)}
                >
                  <span className="catalog-round-image-wrap">
                    <img src={image} alt={category.name} />
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
              <div className="catalog-filter-list">
                {COLORS.map(([name]) => (
                  <label key={name}>
                    <input
                      type="checkbox"
                      checked={activeColor.includes(name.toLowerCase()) || activeColor.includes(name)}
                      onChange={() => toggleColorFilter(name)}
                    />
                    <span>{name}</span>
                  </label>
                ))}
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
                const badgeType = hasDiscount
                  ? `${offPercent}% OFF`
                  : Number(product.id) % 3 === 0
                    ? "Try & Buy"
                    : "NEW";

                return (
                  <article
                    key={`${product.id}-${product.variant_id || ""}-${product.image || ""}`}
                    className="catalog-product-card"
                    onClick={() => navigate(`/product/${product.id}`)}
                  >
                    <div className="catalog-card-top">
                      <span className={`catalog-card-badge ${hasDiscount ? "discount" : "fresh"}`}>{badgeType}</span>
                      <button
                        type="button"
                        className="catalog-wishlist"
                        onClick={(event) => handleAddToWishlist(event, product)}
                        aria-label="Add to wishlist"
                      >
                        ♡
                      </button>
                    </div>

                    <div className="catalog-card-image-wrap">
                      {product.image ? (
                        <img src={product.image} alt={product.name} />
                      ) : (
                        <div className="catalog-no-image">No image</div>
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
                        🛒
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
            Loading more products... Scroll to explore more
          </button>
        ) : null}
      </main>
    </div>
  );
}
