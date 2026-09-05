import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdChevronLeft,
  MdChevronRight,
  MdCheckroom,
  MdStyle,
  MdDryCleaning,
  MdDirectionsRun,
  MdWatch,
  MdVisibility,
  MdSportsHandball,
  MdBackpack,
  MdSpa,
  MdOutlineWork,
  MdSnowing,
  MdWaterDrop,
  MdLocalOffer,
  MdBolt,
  MdAutorenew,
  MdVerifiedUser,
  MdSecurity,
  MdSupportAgent,
  MdGridView,
  MdMyLocation,
  MdShield,
  MdInventory2,
  MdTwoWheeler,
  MdFilterList,
} from "react-icons/md";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Loader from "../components/Loader";
import PageSEO from "../components/PageSEO";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import { getProducts, getCategories, getBrands, getBestsellers } from "../api";
import { getCategoryImage } from "../utils/categoryImages";
import { API_BASE_URL } from "../apiBase";
import menBanner1 from "../assets/men-banner-1.png";
import menBanner2 from "../assets/men-banner-2.png";
import menBanner3 from "../assets/men-banner-3.png";
import playAndWinImage from "../assets/play&win.png";
import spinAndWinImage from "../assets/spin&win.png";
import referAndEarnImage from "../assets/refer&earn.png";
import freeDeliveryImage from "../assets/freedelivery.png";
import "./Shop.css";
import "./Home.css";
import "./Men.css";

const EXPLORE_PAGE_SIZE = 6;

const COLORS = [
  ["Blue", "#2563eb"],
  ["Black", "#111827"],
  ["White", "#ffffff"],
  ["Grey", "#9ca3af"],
  ["Navy", "#1e3a8a"],
  ["Green", "#22c55e"],
  ["Red", "#ef4444"],
  ["Beige", "#d6c7a1"],
  ["Brown", "#78350f"],
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

// Finds the exact "Men" root category (never matches "Women", which contains
// "men" as a substring).
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

const MEN_CATEGORY_FALLBACK = [
  { label: "T-Shirts", icon: MdCheckroom },
  { label: "Shirts", icon: MdDryCleaning },
  { label: "Jeans", icon: MdStyle },
  { label: "Trousers", icon: MdOutlineWork },
  { label: "Jackets", icon: MdSnowing },
  { label: "Footwear", icon: MdDirectionsRun },
  { label: "Watches", icon: MdWatch },
  { label: "Accessories", icon: MdVisibility },
  { label: "Sportswear", icon: MdSportsHandball },
  { label: "Innerwear", icon: MdWaterDrop },
  { label: "Bags & Wallets", icon: MdBackpack },
  { label: "Perfumes", icon: MdSpa },
  { label: "Ethnic Wear", icon: MdCheckroom },
];

const TOP_STRIP_ITEMS = [
  { icon: MdTwoWheeler, label: "Delivered in 60 Minutes" },
  { icon: MdShield, label: "100% Authentic Products" },
  { icon: MdAutorenew, label: "Easy Returns" },
  { icon: MdInventory2, label: "Cash on Delivery" },
  { icon: MdMyLocation, label: "Track Your Order" },
];

const TOP_BRANDS_FALLBACK = [
  "Nike",
  "Adidas",
  "Puma",
  "Levi's",
  "U.S. Polo Assn.",
  "HRX",
  "Jack & Jones",
  "Van Heusen",
  "Fossil",
  "Wildcraft",
].map((name) => ({ id: null, name, logo_url: "" }));

const HERO_SLIDES = [
  { image: menBanner1, tag: "New season styles for him" },
  { image: menBanner2, tag: "Trending this week" },
  { image: menBanner3, tag: "Fresh arrivals" },
];

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

function ProductRail({ list, railRef, keyPrefix }) {
  const scrollRail = (dir) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div className="hp-deals-wrap">
      <button type="button" className="hp-deals-prev" aria-label="Previous" onClick={() => scrollRail(-1)}>
        <MdChevronLeft />
      </button>

      <div className="hp-deals-rail" role="list" ref={railRef}>
        {list.map((p, idx) => (
          <div
            key={`${keyPrefix}-${p.id}-${idx}`}
            className="hp-deal-card-wrapper"
            role="listitem"
            style={{ minWidth: 180, maxWidth: 220, flex: "0 0 auto" }}
          >
            <ProductCard product={p} />
          </div>
        ))}
      </div>

      <button type="button" className="hp-deals-next" aria-label="Next" onClick={() => scrollRail(1)}>
        <MdChevronRight />
      </button>
    </div>
  );
}

export default function Men() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [deals, setDeals] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [menRootId, setMenRootId] = useState(null);
  const [menSubcats, setMenSubcats] = useState([]);
  const [menResolved, setMenResolved] = useState(false);
  const [brands, setBrands] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);

  const [exploreCatId, setExploreCatId] = useState("");
  const [exploreProducts, setExploreProducts] = useState([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [exploreHasMore, setExploreHasMore] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [activeBrand, setActiveBrand] = useState([]);
  const [activeColor, setActiveColor] = useState([]);
  const [minDiscount, setMinDiscount] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(10000);
  const [brandSearch, setBrandSearch] = useState("");

  const normalizeText = (value) => String(value || "").trim().toLowerCase();

  const toggleBrandFilter = (name) => {
    setActiveBrand((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
  };

  const toggleColorFilter = (name) => {
    setActiveColor((prev) =>
      prev.includes(name) ? prev.filter((v) => v !== name) : [...prev, name]
    );
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

  const visibleBrands = brands.filter((b) =>
    normalizeText(b.name).includes(normalizeText(brandSearch))
  );

  // Shared filter predicate, applied to any product list on this page
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

  const trendingRef = useRef(null);
  const arrivalsRef = useRef(null);
  const dealsRef = useRef(null);

  // Resolve the real "Men" category from the DB category tree first — every
  // link and product fetch on this page is scoped to that subtree so this
  // page only ever shows men's items, never women's/kids'/other sections'.
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

      const rootId = rootIdForAny(allCats, "Men");
      const subcats = childCatsFor(allCats, rootId);

      if (cancelled) return;
      setMenRootId(rootId);
      setMenSubcats(subcats);
      setMenResolved(true);
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

  // Main product pool + deals
  useEffect(() => {
    if (!menResolved) return;
    let cancelled = false;

    (async () => {
      setProductsLoading(true);
      let found = [];
      let dealList;

      if (menRootId) {
        try {
          const byCategory = await getProducts({
            category_id: menRootId,
            sort: "newest",
            limit: 30,
          });
          found = extractProducts(byCategory);
        } catch {
          found = [];
        }
      }

      if (!found.length && menRootId) {
        // Some backends only tag leaf-level products, not the root — retry
        // against each direct subcategory and merge until we have enough.
        try {
          const perSub = await Promise.all(
            menSubcats.slice(0, 6).map((sub) =>
              getProducts({ category_id: sub.id, sort: "newest", limit: 5 }).catch(() => [])
            )
          );
          found = perSub.flatMap(extractProducts);
        } catch {
          found = [];
        }
      }

      if (!found.length) {
        try {
          const bySearch = await getProducts({ search: "men", limit: 30 });
          found = extractProducts(bySearch);
        } catch {
          found = [];
        }
      }

      try {
        const dealsRes = await getBestsellers(12);
        dealList = extractProducts(dealsRes);
      } catch {
        dealList = [];
      }

      if (!dealList.length) {
        try {
          const fallbackDeals = await getProducts({
            category_id: menRootId || undefined,
            search: menRootId ? undefined : "men",
            sort: "newest",
            limit: 12,
          });
          dealList = extractProducts(fallbackDeals);
        } catch {
          dealList = [];
        }
      }

      if (!cancelled) {
        const normalized = found.map(normalizeProduct);
        setProducts(normalized.slice(0, 20));
        setNewArrivals(normalized.slice(0, 10));
        setDeals(dealList.map(normalizeProduct).slice(0, 12));
        setProductsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [menResolved, menRootId, menSubcats]);

  useEffect(() => {
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // More to Explore
  useEffect(() => {
    if (!menResolved) return;
    let cancelled = false;

    (async () => {
      setExploreLoading(true);
      try {
        const categoryId = exploreCatId || menRootId || undefined;
        const res = await getProducts({
          category_id: categoryId,
          search: categoryId ? undefined : "men",
          sort: "newest",
          limit: EXPLORE_PAGE_SIZE,
          offset: 0,
        });
        const items = extractProducts(res).map(normalizeProduct);
        if (cancelled) return;
        setExploreProducts(items);
        setExploreOffset(items.length);
        setExploreHasMore(items.length === EXPLORE_PAGE_SIZE);
      } catch {
        if (!cancelled) {
          setExploreProducts([]);
          setExploreOffset(0);
          setExploreHasMore(false);
        }
      } finally {
        if (!cancelled) setExploreLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [menResolved, menRootId, exploreCatId]);

  const loadMoreExplore = async () => {
    if (exploreLoading || !exploreHasMore) return;
    setExploreLoading(true);
    try {
      const categoryId = exploreCatId || menRootId || undefined;
      const res = await getProducts({
        category_id: categoryId,
        search: categoryId ? undefined : "men",
        sort: "newest",
        limit: EXPLORE_PAGE_SIZE,
        offset: exploreOffset,
      });
      const items = extractProducts(res).map(normalizeProduct);
      setExploreProducts((prev) => {
        const seen = new Set(prev.map((p) => String(p.id)));
        const merged = [...prev];
        items.forEach((p) => {
          const key = String(p.id || "");
          if (!key || seen.has(key)) return;
          seen.add(key);
          merged.push(p);
        });
        return merged;
      });
      setExploreOffset((prev) => prev + items.length);
      setExploreHasMore(items.length === EXPLORE_PAGE_SIZE);
    } finally {
      setExploreLoading(false);
    }
  };

  const menScopedShopUrl = useCallback(
    (opts = {}) => {
      const params = new URLSearchParams();
      if (opts.categoryId) {
        params.set("category_id", String(opts.categoryId));
      } else if (menRootId) {
        params.set("category_id", String(menRootId));
      }
      let search = opts.search ? String(opts.search).trim() : "";
      if (!params.has("category_id")) {
        const lower = search.toLowerCase();
        if (!lower.includes("men") && !lower.includes("male")) {
          search = search ? `men ${search}` : "men";
        } else if (!search) {
          search = "men";
        }
      }
      if (search) params.set("search", search);
      const qs = params.toString();
      return qs ? `/shop?${qs}` : "/shop?search=men";
    },
    [menRootId]
  );

  const findMenSubcatByLabel = useCallback(
    (label) => {
      const needle = String(label || "")
        .toLowerCase()
        .replace(/&/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!needle || !menSubcats.length) return null;
      const exact = menSubcats.find((c) => c.name.toLowerCase().trim() === needle);
      if (exact) return exact;
      return (
        menSubcats.find((c) => {
          const name = c.name.toLowerCase();
          return name.includes(needle) || needle.includes(name);
        }) || null
      );
    },
    [menSubcats]
  );

  const categoryStripItems = useMemo(() => {
    if (menSubcats.length) {
      return menSubcats.map((cat) => {
        const image = resolveImageUrl(cat.image) || getCategoryImage(cat.name) || "";
        return {
          id: cat.id,
          label: cat.name,
          image,
          to: menScopedShopUrl({ categoryId: cat.id }),
        };
      });
    }
    return MEN_CATEGORY_FALLBACK.map((item) => {
      const match = findMenSubcatByLabel(item.label);
      return {
        id: match?.id || `fallback-${item.label}`,
        label: item.label,
        icon: item.icon || MdGridView,
        image: match ? resolveImageUrl(match.image) || getCategoryImage(match.name) || "" : "",
        to: match
          ? menScopedShopUrl({ categoryId: match.id })
          : menScopedShopUrl({ search: item.label }),
      };
    });
  }, [menSubcats, menScopedShopUrl, findMenSubcatByLabel]);

  const exploreChips = useMemo(
    () => [{ id: "", name: "All" }, ...menSubcats],
    [menSubcats]
  );

  const topDeals = useMemo(() => {
    const enriched = (Array.isArray(deals) ? deals : []).map((item) => {
      const price = Number(item?.discount_price ?? item?.price ?? item?._price ?? 0);
      const mrp = Number(item?.price ?? item?._mrp ?? item?.original_price ?? price);
      const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
      return { ...item, _discount: discount };
    });
    return [...enriched].sort((a, b) => b._discount - a._discount).slice(0, 10);
  }, [deals]);

  const slide = HERO_SLIDES[heroIndex];

  return (
    <div className={`catalog-page men-page${!menResolved ? " men-loading" : ""}`}>
      {!menResolved && <Loader overlay />}
      <PageSEO
        title="Men's Fashion — Shirts, T-Shirts, Jeans & More | Blinkiefash India"
        description="Shop the latest men's fashion at Blinkiefash India — t-shirts, shirts, jeans, footwear, watches, jackets and more, delivered in 60 minutes across India."
        path="/men"
      />

      <div className="men-top-strip">
        <div className="men-top-strip-inner">
          {TOP_STRIP_ITEMS.map((item) => (
            <span className="men-top-strip-item" key={item.label}>
              <item.icon />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      <Navbar activeTab="Men" />

      <main className="men-main">
        <section className="men-hero-carousel" aria-label="Men's fashion highlights">
          <button
            type="button"
            className="men-hero-arrow prev"
            aria-label="Previous slide"
            onClick={() => setHeroIndex((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          >
            <MdChevronLeft />
          </button>

          <button type="button" className="men-hero-media-btn" onClick={() => navigate(menScopedShopUrl())}>
            <img src={slide.image} alt={slide.tag} className="men-hero-img" />
          </button>

          <button
            type="button"
            className="men-hero-arrow next"
            aria-label="Next slide"
            onClick={() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)}
          >
            <MdChevronRight />
          </button>

          <div className="men-hero-dots">
            {HERO_SLIDES.map((s, idx) => (
              <button
                key={s.tag}
                type="button"
                className={`men-hero-dot${idx === heroIndex ? " active" : ""}`}
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setHeroIndex(idx)}
              />
            ))}
          </div>
        </section>

        <section className="section hp-rewards-section" aria-label="Offers & rewards">
          <div className="hp-rewards-grid">
            <button type="button" className="hp-reward-image-card" onClick={() => navigate("/spin-wheel")}>
              <img src={spinAndWinImage} alt="Spin and win up to 500 rupees off" />
            </button>
            <button type="button" className="hp-reward-image-card" onClick={() => navigate("/play-and-win")}>
              <img src={playAndWinImage} alt="Play and win up to 250 rupees off" />
            </button>
            <button type="button" className="hp-reward-image-card" onClick={() => navigate("/refer-earn")}>
              <img src={referAndEarnImage} alt="Refer a friend and both get 100 rupees off" />
            </button>
            <button type="button" className="hp-reward-image-card" onClick={() => navigate("/shop")}>
              <img src={freeDeliveryImage} alt="Free delivery on orders above 1499 rupees" />
            </button>
          </div>
        </section>

        {/* Filters */}
        <div className="men-filter-bar">
          <button
            type="button"
            className={`men-filter-btn${filterOpen || activeFilterCount ? " is-active" : ""}`}
            onClick={() => setFilterOpen((o) => !o)}
          >
            <MdFilterList /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
          </button>

          {filterOpen && (
            <section className="men-filters-panel" role="dialog" aria-label="Men filters">
              <div className="men-filters-panel-header">
                <h3>Filters</h3>
                {activeFilterCount > 0 ? (
                  <button type="button" className="men-filters-clear" onClick={clearAllFilters}>
                    Clear All
                  </button>
                ) : null}
              </div>

              <div className="men-filter-col">
                <h4>Brand</h4>
                <input
                  className="men-filter-search"
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                  placeholder="Search brand"
                />
                <div className="men-filter-list">
                  {visibleBrands.slice(0, 15).map((brand) => (
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

              <div className="men-filter-col">
                <h4>Color</h4>
                <div className="men-filter-list men-filter-swatches">
                  {COLORS.map(([name, hex]) => {
                    const checked = activeColor.includes(name.toLowerCase()) || activeColor.includes(name);
                    return (
                      <label key={name} className={`men-swatch-label${checked ? " checked" : ""}`}>
                        <input type="checkbox" checked={checked} onChange={() => toggleColorFilter(name)} />
                        <span className="men-swatch-dot" style={{ background: hex }} />
                        <span>{name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="men-filter-col">
                <h4>Price</h4>
                <input
                  type="range"
                  min="500"
                  max="12000"
                  step="100"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                />
                <p>Up to ₹{maxPrice.toLocaleString("en-IN")}</p>
              </div>

              <div className="men-filter-col">
                <h4>Discount Range</h4>
                <div className="men-filter-chips">
                  {DISCOUNT_BUCKETS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`men-filter-chip-item${minDiscount === value ? " active" : ""}`}
                      onClick={() => selectMinDiscount(value)}
                    >
                      {value}% and above
                    </button>
                  ))}
                </div>
              </div>

              <div className="men-filter-col">
                <h4>Availability</h4>
                <div className="men-filter-list">
                  <label>
                    <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
                    <span>In stock only</span>
                  </label>
                </div>
              </div>
            </section>
          )}
        </div>

        {/* Deals of the Day */}
        {topDeals.length > 0 && (
          <section className="section men-picks-section">
            <div className="hp-section-head hp-deals-section-head">
              <h2 className="hp-deals-title">DEALS OF THE DAY</h2>
              <button type="button" onClick={() => navigate(menScopedShopUrl())}>
                View All <MdChevronRight />
              </button>
            </div>
            <ProductRail list={applyProductFilters(topDeals)} railRef={dealsRef} keyPrefix="men-deal" />
          </section>
        )}

        {/* All Men's Picks */}
        <section className="section men-picks-section">
          <div className="hp-section-head">
            <h2>ALL MEN&apos;S PICKS 👔</h2>
            <button type="button" onClick={() => navigate(menScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>
          {productsLoading ? (
            <Loader />
          ) : products.length ? (
            <ProductRail list={applyProductFilters(products)} railRef={trendingRef} keyPrefix="men-all" />
          ) : (
            <p className="men-empty-state">New men&apos;s styles are landing soon.</p>
          )}
        </section>

        {/* Categories */}
        <section className="men-cat-strip" aria-label="Shop by category">
          <div className="men-cat-list">
            {categoryStripItems.map((cat) => (
              <button key={cat.id} type="button" className="men-cat-item" onClick={() => navigate(cat.to)}>
                <span className="men-cat-icon-wrap">
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
                  <span className="men-cat-fallback-icon" style={cat.image ? { display: "none" } : undefined}>
                    {cat.icon ? <cat.icon /> : <MdGridView />}
                  </span>
                </span>
                <span className="men-cat-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Promos */}
        <section className="men-promo-strip" aria-label="Offers">
          <button type="button" className="men-promo-card men-promo-prepaid" onClick={() => navigate("/offers")}>
            <div>
              <p className="title">EXTRA 10% OFF</p>
              <p className="sub">On Prepaid Orders · Code BLINK10</p>
            </div>
            <MdLocalOffer style={{ fontSize: 28 }} />
          </button>

          <button
            type="button"
            className="men-promo-card men-promo-brands"
            onClick={() => navigate(menScopedShopUrl())}
          >
            <div>
              <p className="title">UP TO 60% OFF</p>
              <p className="sub">On Top Brands</p>
              <div className="men-promo-brands-row">
                <span className="men-promo-brand-chip">NIKE</span>
                <span className="men-promo-brand-chip">PUMA</span>
                <span className="men-promo-brand-chip">LEVI&apos;S</span>
              </div>
            </div>
            <span className="cta">SHOP NOW →</span>
          </button>

          <button
            type="button"
            className="men-promo-card men-promo-delivery"
            onClick={() => navigate(menScopedShopUrl())}
          >
            <div>
              <p className="title">FREE DELIVERY</p>
              <p className="sub">On Orders Above ₹1499</p>
              <span className="cta">SHOP NOW →</span>
            </div>
            <span style={{ fontSize: 28 }}>🛵</span>
          </button>
        </section>

        {/* New arrivals */}
        <section className="section men-picks-section">
          <div className="hp-section-head">
            <h2>NEW ARRIVALS ✨</h2>
            <button type="button" onClick={() => navigate(menScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>
          {productsLoading ? (
            <Loader />
          ) : newArrivals.length ? (
            <ProductRail list={applyProductFilters(newArrivals)} railRef={arrivalsRef} keyPrefix="men-new" />
          ) : (
            <p className="men-empty-state">Fresh styles coming soon.</p>
          )}
        </section>

        {/* Brands */}
        <section className="men-brands-section" aria-label="Top brands">
          <div className="hp-section-head">
            <h2>Top Brands You Love</h2>
          </div>
          <div className="hp-top-brands-rail">
            {brands.slice(0, 14).map((brand, idx) => {
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
                  onClick={() => navigate(menScopedShopUrl({ search: brand.name }))}
                  aria-label={`Shop ${brand.name}`}
                >
                  <span className="hp-top-brand-logo">
                    {logo ? <img src={logo} alt="" loading="lazy" /> : <span>{initials || "BR"}</span>}
                  </span>
                  <span className="hp-top-brand-name">{brand.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        {/* More to Explore */}
        <section className="section men-explore-section" aria-label="More to explore">
          <div className="hp-section-head hp-feed-head">
            <h2>MORE TO EXPLORE</h2>
          </div>

          <div className="hp-explore-chips" role="list">
            {exploreChips.map((cat) => {
              const selected = (cat.id ? String(cat.id) : "") === exploreCatId;
              return (
                <button
                  key={cat.id || "all"}
                  type="button"
                  className={`hp-explore-chip${selected ? " active" : ""}`}
                  role="listitem"
                  onClick={() => setExploreCatId(cat.id ? String(cat.id) : "")}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>

          {exploreProducts.length > 0 ? (
            <div className="hp-explore-grid" role="list">
              {exploreProducts.map((p, idx) => (
                <ProductCard key={`explore-${p.id}-${idx}`} product={p} />
              ))}
              {exploreLoading
                ? Array.from({ length: 3 }).map((_, idx) => <ProductCardSkeleton key={`explore-skel-${idx}`} />)
                : null}
            </div>
          ) : !exploreLoading ? (
            <p className="men-empty-state">No products in this category yet.</p>
          ) : (
            <div className="hp-explore-grid" role="list">
              {Array.from({ length: 6 }).map((_, idx) => (
                <ProductCardSkeleton key={`explore-init-${idx}`} />
              ))}
            </div>
          )}

          {!exploreLoading && exploreHasMore ? (
            <button type="button" className="hp-explore-more" onClick={loadMoreExplore}>
              Show More Products
            </button>
          ) : null}
        </section>

        <section className="men-trust-strip" aria-label="Why shop with us">
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