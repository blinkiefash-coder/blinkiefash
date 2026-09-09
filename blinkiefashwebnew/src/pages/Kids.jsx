import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdChevronLeft,
  MdChevronRight,
  MdCheckroom,
  MdToys,
  MdDirectionsRun,
  MdBackpack,
  MdChildCare,
  MdStyle,
  MdNightlight,
  MdCelebration,
  MdLocalOffer,
  MdBolt,
  MdAutorenew,
  MdVerifiedUser,
  MdSecurity,
  MdSupportAgent,
  MdGridView,
  MdFilterList,
} from "react-icons/md";

import Footer from "../components/Footer";
import Loader from "../components/Loader";
import Navbar from "../components/Navbar";
import PageSEO from "../components/PageSEO";
import ProductCard from "../components/ProductCard";
import { getProducts, getCategories, getBrands } from "../api";
import { getCategoryImage } from "../utils/categoryImages";
import { API_BASE_URL } from "../apiBase";
import "./Shop.css";
import "./Home.css";
import "./Kids.css";

// Banners live in: src/assets/kids-hero.png, kids-boys.png, kids-girls.png
import kidsHeroBanner from "../assets/kids-hero.png";
import kidsBoysBanner from "../assets/kids-boys.png";
import kidsGirlsBanner from "../assets/kids-girls.png";

const COLORS = [
  ["Pink", "#ec4899"],
  ["Blue", "#2563eb"],
  ["Black", "#111827"],
  ["Green", "#22c55e"],
  ["Yellow", "#facc15"],
  ["White", "#ffffff"],
  ["Grey", "#9ca3af"],
  ["Red", "#ef4444"],
];

const DISCOUNT_BUCKETS = [10, 20, 30, 40, 50, 60, 70];

function resolveImageUrl(raw) {
  const value = (raw ?? "").toString().trim();
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  if (payload && Array.isArray(payload.bestsellers)) return payload.bestsellers;
  return [];
}

function rootIdForAny(allCats, names) {
  const needles = (Array.isArray(names) ? names : [names])
    .map((n) => (n || "").toString().toLowerCase().trim())
    .filter(Boolean);
  if (!needles.length) return null;

  const exact = allCats.find((c) => {
    if (c.parent_id) return false;
    const name = (c?.name || "").toString().toLowerCase().trim();
    return needles.some((needle) => name === needle);
  });
  if (exact) return exact.id;

  const loose = allCats.find((c) => {
    if (c.parent_id) return false;
    const name = (c?.name || "").toString().toLowerCase().trim();
    return needles.some((needle) => name.includes(needle) || needle.includes(name));
  });
  return loose?.id || null;
}

function childCatsFor(allCats, rootId) {
  if (!rootId) return [];
  return allCats
    .filter((c) => String(c.parent_id) === String(rootId))
    .map((c) => ({
      id: c.id,
      name: (c?.name || "").toString().trim(),
      image: c.category_url || c.image || "",
    }))
    .filter((c) => c.name);
}

function normalizeBrandName(value) {
  return (value || "").toString().toLowerCase().replace(/\./g, "").trim();
}

const AGE_BANDS = [
  { label: "0–2 Years", emoji: "👶", search: "baby" },
  { label: "2–4 Years", emoji: "🧒", search: "toddler" },
  { label: "4–6 Years", emoji: "👧", search: "kids 4-6" },
  { label: "6–8 Years", emoji: "👦", search: "kids 6-8" },
  { label: "8–10 Years", emoji: "🧑", search: "kids 8-10" },
  { label: "10+ Years", emoji: "👦", search: "kids 10" },
];

const KIDS_CATEGORY_FALLBACK = [
  { label: "Clothing", icon: MdCheckroom },
  { label: "Toys & Games", icon: MdToys },
  { label: "Footwear", icon: MdDirectionsRun },
  { label: "School Supplies", icon: MdBackpack },
  { label: "Baby Care", icon: MdChildCare },
  { label: "Accessories", icon: MdStyle },
  { label: "Nightwear", icon: MdNightlight },
  { label: "Party Wear", icon: MdCelebration },
];

const TOP_BRANDS_FALLBACK = [
  "Babyhug",
  "H&M",
  "Max Kids",
  "FirstCry",
  "Hamleys",
  "U.S. Polo Assn. Kids",
  "Levi's Kids",
  "Disney",
  "Nike Kids",
].map((name) => ({ id: null, name, logo_url: "" }));

function normalizeProduct(p) {
  const salePrice = Number(p.discount_price ?? p.price ?? 0);
  const originalPrice = Number(p.price ?? p.original_price ?? p._mrp ?? salePrice);
  const discount =
    originalPrice > salePrice
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : 0;

  const image = resolveImageUrl(p.image || p.image_url || p.thumbnail);

  return {
    ...p,
    id: p.id,
    name: p.name,
    brand: p.brand,
    image,
    image_url: image,
    // ProductCard expects these field names
    price: originalPrice,
    discount_price: salePrice,
    _mrp: originalPrice,
    _price: salePrice,
    color: p.color || p.colour || "Multi color",
    is_bestseller: p.is_bestseller ?? false,
    is_try_and_buy: p.is_try_and_buy ?? false,
    in_stock: p.in_stock !== false,
    available: p.available !== false,
    rating: p.rating ?? p.avg_rating ?? 0,
    review_count: p.review_count ?? p.reviews_count ?? 0,
    sold_count: p.sold_count ?? p.sales_count ?? 0,
    isNew: p.is_new ?? p.isNew ?? false,
    discount,
  };
}

export default function Kids() {
  const navigate = useNavigate();
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [kidsRootId, setKidsRootId] = useState(null);
  const [kidsSubcats, setKidsSubcats] = useState([]);
  const [kidsResolved, setKidsResolved] = useState(false);
  const [brands, setBrands] = useState([]);
  const picksRailRef = useRef(null);

  // ---------- Filters (Brand / Color / Price / Discount / Availability) ----------
  const [filterOpen, setFilterOpen] = useState(false);
  const [activeBrand, setActiveBrand] = useState([]);
  const [activeColor, setActiveColor] = useState([]);
  const [minDiscount, setMinDiscount] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [brandSearch, setBrandSearch] = useState("");

  const normalizeText = (value) => String(value || "").trim().toLowerCase();

  const toggleBrandFilter = (name) => {
    setActiveBrand((prev) => (prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]));
  };

  const toggleColorFilter = (name) => {
    setActiveColor((prev) => (prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]));
  };

  const selectMinDiscount = (value) => {
    setMinDiscount((prev) => (prev === value ? 0 : value));
  };

  const activeFilterCount =
    activeBrand.length +
    activeColor.length +
    (minDiscount > 0 ? 1 : 0) +
    (inStockOnly ? 1 : 0) +
    (maxPrice < 10000 ? 1 : 0);

  const clearAllFilters = () => {
    setActiveBrand([]);
    setActiveColor([]);
    setMinDiscount(0);
    setInStockOnly(false);
    setMaxPrice(10000);
    setBrandSearch("");
  };

  const visibleBrands = brands.filter((b) => normalizeText(b.name).includes(normalizeText(brandSearch)));

  const applyProductFilters = useCallback(
    (list) =>
      (list || []).filter((p) => {
        if (activeBrand.length > 0) {
          const b = normalizeText(p.brand);
          if (!activeBrand.map(normalizeText).includes(b)) return false;
        }
        if (activeColor.length > 0) {
          const c = normalizeText(p.color);
          if (c && !activeColor.map(normalizeText).includes(c)) return false;
        }
        if (minDiscount > 0 && (p.discount || 0) < minDiscount) return false;
        if (inStockOnly && p.in_stock === false) return false;
        const finalPrice = Number(p.discount_price) > 0 ? Number(p.discount_price) : Number(p.price || 0);
        if (finalPrice > maxPrice) return false;
        return true;
      }),
    [activeBrand, activeColor, minDiscount, inStockOnly, maxPrice]
  );
  // ---------------------------------------------------------------------------

  useEffect(() => {
    let cancelled = false;

    (async () => {
      let allCats = [];
      try {
        const catRes = await getCategories();
        if (Array.isArray(catRes)) allCats = catRes;
      } catch {
        // keep []
      }

      const rootId = rootIdForAny(allCats, ["Kids", "Kid", "Children", "Baby"]);
      const subcats = childCatsFor(allCats, rootId);

      if (cancelled) return;
      setKidsRootId(rootId);
      setKidsSubcats(subcats);
      setKidsResolved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const res = await getBrands();
        const list = (Array.isArray(res) ? res : res?.brands || [])
          .map((b) => ({
            id: b.id,
            name: (b?.name || "").toString().trim(),
            logo_url: b?.logo_url || b?.image || "",
          }))
          .filter((b) => b.name);

        if (!cancelled) setBrands(list.length ? list : TOP_BRANDS_FALLBACK);
      } catch {
        if (!cancelled) setBrands(TOP_BRANDS_FALLBACK);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!kidsResolved) return;
    let cancelled = false;

    (async () => {
      setProductsLoading(true);
      let found = [];

      if (kidsRootId) {
        try {
          const byCategory = await getProducts({
            category_id: kidsRootId,
            sort: "newest",
            limit: 8,
          });
          found = extractProducts(byCategory);
        } catch {
          found = [];
        }
      }

      if (!found.length && kidsRootId) {
        try {
          const perSub = await Promise.all(
            kidsSubcats.slice(0, 6).map((sub) =>
              getProducts({ category_id: sub.id, sort: "newest", limit: 4 }).catch(() => [])
            )
          );
          found = perSub.flatMap(extractProducts);
        } catch {
          found = [];
        }
      }

      // Last resort: keyword search so the rail is not empty on sparse data
      if (!found.length) {
        try {
          const bySearch = await getProducts({ search: "kids", limit: 8 });
          found = extractProducts(bySearch);
        } catch {
          found = [];
        }
      }

      if (!cancelled) {
        setProducts(found.slice(0, 8).map(normalizeProduct));
        setProductsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kidsResolved, kidsRootId, kidsSubcats]);

  const kidsScopedShopUrl = useCallback(
    (opts = {}) => {
      const params = new URLSearchParams();
      if (opts.categoryId) {
        params.set("category_id", String(opts.categoryId));
      } else if (kidsRootId) {
        params.set("category_id", String(kidsRootId));
      }
      let search = opts.search ? String(opts.search).trim() : "";
      if (!params.has("category_id")) {
        const lower = search.toLowerCase();
        if (
          !lower.includes("kid") &&
          !lower.includes("child") &&
          !lower.includes("baby") &&
          !lower.includes("boy") &&
          !lower.includes("girl")
        ) {
          search = search ? `kids ${search}` : "kids";
        } else if (!search) {
          search = "kids";
        }
      }
      if (search) params.set("search", search);
      const qs = params.toString();
      return qs ? `/shop?${qs}` : "/shop?search=kids";
    },
    [kidsRootId]
  );

  const findSubcatByLabel = useCallback(
    (label) => {
      const needle = String(label || "")
        .toLowerCase()
        .replace(/&/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!needle || !kidsSubcats.length) return null;

      const exact = kidsSubcats.find((c) => c.name.toLowerCase().trim() === needle);
      if (exact) return exact;

      return (
        kidsSubcats.find((c) => {
          const name = c.name.toLowerCase();
          return name.includes(needle) || needle.includes(name);
        }) || null
      );
    },
    [kidsSubcats]
  );

  const categoryStripItems = useMemo(() => {
    if (kidsSubcats.length) {
      return kidsSubcats.map((cat) => {
        const image = resolveImageUrl(cat.image) || getCategoryImage(cat.name) || "";
        return {
          id: cat.id,
          label: cat.name,
          image,
          to: kidsScopedShopUrl({ categoryId: cat.id }),
        };
      });
    }
    return KIDS_CATEGORY_FALLBACK.map((item) => {
      const match = findSubcatByLabel(item.label);
      return {
        id: match?.id || `fallback-${item.label}`,
        label: item.label,
        icon: item.icon || MdGridView,
        image: match ? resolveImageUrl(match.image) || getCategoryImage(match.name) || "" : "",
        to: match
          ? kidsScopedShopUrl({ categoryId: match.id })
          : kidsScopedShopUrl({ search: item.label }),
      };
    });
  }, [kidsSubcats, kidsScopedShopUrl, findSubcatByLabel]);

  const scrollPicks = (dir) => {
    const el = picksRailRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  // Only brands that appear on kids' products (falls back to the full API
  // brand list if the current picks don't cover any brand names yet).
  const kidsBrandsForRail = useMemo(() => {
    const fromProducts = new Map();
    (products || []).forEach((p) => {
      const name = (p?.brand || "").toString().trim();
      if (!name) return;
      const key = normalizeBrandName(name);
      if (!fromProducts.has(key)) fromProducts.set(key, name);
    });

    if (fromProducts.size === 0) {
      return (brands || []).slice(0, 14);
    }

    const logoByName = new Map();
    (brands || []).forEach((b) => {
      const key = normalizeBrandName(b.name);
      if (key) logoByName.set(key, b.logo_url || "");
    });

    return [...fromProducts.entries()]
      .map(([key, name]) => ({ id: null, name, logo_url: logoByName.get(key) || "" }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [products, brands]);

  const filteredPicks = applyProductFilters(products);

  return (
    <div className="catalog-page kids-page">
      <PageSEO
        title="Kids Fashion, Toys & Essentials"
        description="Shop kids clothing, toys, footwear and everyday essentials at Blinkiefash — delivered in 60 minutes across Odisha."
        path="/kids"
      />
      {productsLoading ? (
        <Loader
          overlay
          label="Loading kids products..."
          subtitle="Getting the latest products ready"
        />
      ) : null}

      <Navbar />

      <main className="kids-main">
        <div className="kids-breadcrumb">
          <button type="button" onClick={() => navigate("/")}>
            Home
          </button>
          <span>›</span>
          <span className="current">Kids</span>
        </div>

        {/* Hero + Shop by Age */}
        <section className="kids-hero-row" aria-label="Kids highlights">
          <div className="kids-hero-main kids-hero-main--banner">
            <img
              className="kids-hero-banner-img"
              src={kidsHeroBanner}
              alt="Little Dreams, Delivered in a Blink! Cool styles, fun toys and everyday essentials — all in 60 minutes."
            />
            <div className="kids-hero-copy kids-hero-copy--sr">
              <p className="kids-hero-kicker">Little Dreams</p>
              <h1>
                Delivered in a <em>Blink!</em>
              </h1>
              <p className="kids-hero-sub">
                Cool styles, fun toys &amp; everyday essentials — all in 60 minutes.
              </p>
            </div>
          </div>

          <div className="kids-age-card">
            <h3>Shop by Age</h3>
            <div className="kids-age-grid">
              {AGE_BANDS.map((band) => (
                <button
                  key={band.label}
                  type="button"
                  className="kids-age-item"
                  onClick={() => {
                    navigate(kidsScopedShopUrl({ search: band.search }));
                  }}
                >
                  <span className="kids-age-avatar">{band.emoji}</span>
                  <span>{band.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Boys / Girls + categories */}
        <section className="kids-gender-row">
          <button
            type="button"
            className="kids-gender-card boys kids-gender-card--banner"
            aria-label="Explore boys"
            onClick={() => {
              const match = findSubcatByLabel("boys") || findSubcatByLabel("boy");
              navigate(
                match
                  ? kidsScopedShopUrl({ categoryId: match.id })
                  : kidsScopedShopUrl({ search: "boys" })
              );
            }}
          >
            <img
              className="kids-gender-banner-img"
              src={kidsBoysBanner}
              alt="For Boys — Cool, comfy and made for adventure"
            />
          </button>

          <button
            type="button"
            className="kids-gender-card girls kids-gender-card--banner"
            aria-label="Explore girls"
            onClick={() => {
              const match = findSubcatByLabel("girls") || findSubcatByLabel("girl");
              navigate(
                match
                  ? kidsScopedShopUrl({ categoryId: match.id })
                  : kidsScopedShopUrl({ search: "girls" })
              );
            }}
          >
            <img
              className="kids-gender-banner-img"
              src={kidsGirlsBanner}
              alt="For Girls — Pretty, playful and perfect for every moment"
            />
          </button>

          <div className="kids-shop-cat">
            <h3>Shop by Category</h3>
            <div className="kids-cat-list">
              {categoryStripItems.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className="kids-cat-item"
                  onClick={() => navigate(cat.to)}
                >
                  <span className="kids-cat-icon-wrap">
                    {cat.image ? (
                      <img
                        src={cat.image}
                        alt={cat.label}
                        onError={(event) => {
                          event.currentTarget.style.display = "none";
                          const fallback = event.currentTarget.nextElementSibling;
                          if (fallback) fallback.style.display = "inline-flex";
                        }}
                      />
                    ) : null}
                    <span
                      className="kids-cat-fallback-icon"
                      style={cat.image ? { display: "none" } : undefined}
                    >
                      {cat.icon ? <cat.icon /> : <MdGridView />}
                    </span>
                  </span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Promo cards */}
        <section className="kids-promo-row" aria-label="Kids offers">
          <button
            type="button"
            className="kids-promo-card kids-promo-toys"
            onClick={() => {
              const match = findSubcatByLabel("toys");
              navigate(
                match
                  ? kidsScopedShopUrl({ categoryId: match.id })
                  : kidsScopedShopUrl({ search: "toys" })
              );
            }}
          >
            <h4>Fun. Play. Learn. Repeat.</h4>
            <p>Toys they&apos;ll never get bored of!</p>
            <span className="kids-promo-cta">EXPLORE TOYS</span>
          </button>

          <button
            type="button"
            className="kids-promo-card kids-promo-essentials"
            onClick={() => {
              const match = findSubcatByLabel("baby");
              navigate(
                match
                  ? kidsScopedShopUrl({ categoryId: match.id })
                  : kidsScopedShopUrl({ search: "baby care" })
              );
            }}
          >
            <h4>Everyday Essentials</h4>
            <p>All their daily needs, delivered in a blink.</p>
            <span className="kids-promo-cta">SHOP ESSENTIALS</span>
          </button>

          <button
            type="button"
            className="kids-promo-card kids-promo-school"
            onClick={() => {
              const match = findSubcatByLabel("school");
              navigate(
                match
                  ? kidsScopedShopUrl({ categoryId: match.id })
                  : kidsScopedShopUrl({ search: "school" })
              );
            }}
          >
            <h4>Back to School</h4>
            <p>Everything for a great start!</p>
            <span className="kids-promo-cta">SHOP SCHOOL</span>
          </button>
        </section>

        {/* Top picks */}
        <section className="section kids-picks-section">
          <div className="hp-section-head">
            <h2>Top Picks for You</h2>
            <div className="kids-section-actions">
              <button type="button" onClick={() => navigate(kidsScopedShopUrl())}>
                View All <MdChevronRight />
              </button>
              <button
                type="button"
                className={`kids-filter-btn${filterOpen || activeFilterCount ? " is-active" : ""}`}
                onClick={() => setFilterOpen((o) => !o)}
              >
                <MdFilterList /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
              </button>
            </div>
          </div>

          {filterOpen ? (
            <section className="kids-filters-panel" role="dialog" aria-label="Kids filters">
              <div className="kids-filters-panel-header">
                <h3>Filters</h3>
                {activeFilterCount > 0 ? (
                  <button type="button" className="kids-filters-clear" onClick={clearAllFilters}>
                    Clear All
                  </button>
                ) : null}
              </div>

              <div className="kids-filter-col">
                <h4>Brand</h4>
                <input
                  className="kids-filter-search"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="Search brand"
                />
                <div className="kids-filter-list">
                  {visibleBrands.map((brand) => (
                    <label key={brand.id || brand.name}>
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

              <div className="kids-filter-col">
                <h4>Color</h4>
                <div className="kids-filter-list kids-filter-swatches">
                  {COLORS.map(([name, hex]) => {
                    const checked = activeColor.includes(name.toLowerCase()) || activeColor.includes(name);
                    return (
                      <label key={name} className={`kids-swatch-label${checked ? " checked" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleColorFilter(name)} />
                        <span className="kids-swatch-dot" style={{ background: hex }} />
                        <span>{name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="kids-filter-col">
                <h4>Price</h4>
                <input
                  type="range"
                  min="200"
                  max="8000"
                  step="100"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
                <p>Up to ₹{maxPrice.toLocaleString("en-IN")}</p>
              </div>

              <div className="kids-filter-col">
                <h4>Discount Range</h4>
                <div className="kids-filter-discount-chips">
                  {DISCOUNT_BUCKETS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`kids-filter-chip-item${minDiscount === value ? " active" : ""}`}
                      onClick={() => selectMinDiscount(value)}
                    >
                      {value}% and above
                    </button>
                  ))}
                </div>
              </div>

              <div className="kids-filter-col">
                <h4>Availability</h4>
                <div className="kids-filter-list">
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

          {productsLoading ? (
            <p className="kids-empty-state">Loading today&apos;s picks…</p>
          ) : filteredPicks.length ? (
            <div className="hp-deals-wrap">
              <button
                type="button"
                className="hp-deals-prev"
                aria-label="Previous"
                onClick={() => scrollPicks(-1)}
              >
                <MdChevronLeft />
              </button>

              <div className="hp-deals-rail" role="list" ref={picksRailRef}>
                {filteredPicks.map((p, idx) => (
                  <div
                    key={`kids-pick-${p.id}-${idx}`}
                    className="hp-deal-card-wrapper"
                    role="listitem"
                  >
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>

              <button
                type="button"
                className="hp-deals-next"
                aria-label="Next"
                onClick={() => scrollPicks(1)}
              >
                <MdChevronRight />
              </button>
            </div>
          ) : (
            <p className="kids-empty-state">
              {products.length
                ? "No products match the selected filters."
                : "New kids styles are landing soon — check back shortly."}
            </p>
          )}
        </section>

        {/* Brands */}
        <section className="kids-brands-section" aria-label="Top kids brands">
          <div className="hp-section-head">
            <h2>Top Brands Kids Love</h2>
          </div>
          <div className="hp-top-brands-rail">
            {kidsBrandsForRail.map((brand, idx) => {
              const logo = resolveImageUrl(brand.logo_url);
              const initials = brand.name
                .split(/\s+/)
                .map((part) => part[0])
                .join("")
                .slice(0, 2)
                .toUpperCase();

              return (
                <button
                  key={`${brand.id || brand.name}-${idx}`}
                  type="button"
                  className="hp-top-brand-card"
                  onClick={() => {
                    navigate(kidsScopedShopUrl({ search: brand.name }));
                  }}
                  aria-label={`Shop ${brand.name}`}
                >
                  <span className="hp-top-brand-logo">
                    {logo ? (
                      <img src={logo} alt="" loading="lazy" />
                    ) : (
                      <span>{initials || "BR"}</span>
                    )}
                  </span>
                  <span className="hp-top-brand-name">{brand.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="kids-trust-strip" aria-label="Why shop with us">
          <div>
            <MdBolt />
            <div>
              <strong>60 MINUTES</strong>
              <span>Delivery</span>
            </div>
          </div>
          <div>
            <MdAutorenew />
            <div>
              <strong>Easy 5-Day</strong>
              <span>Returns</span>
            </div>
          </div>
          <div>
            <MdVerifiedUser />
            <div>
              <strong>100% Original</strong>
              <span>Products</span>
            </div>
          </div>
          <div>
            <MdLocalOffer />
            <div>
              <strong>Best Prices</strong>
              <span>Everyday</span>
            </div>
          </div>
          <div>
            <MdSecurity />
            <div>
              <strong>Secure Payments</strong>
              <span>100% Safe &amp; Secure</span>
            </div>
          </div>
          <div>
            <MdSupportAgent />
            <div>
              <strong>24/7 Support</strong>
              <span>We&apos;re here for you</span>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}