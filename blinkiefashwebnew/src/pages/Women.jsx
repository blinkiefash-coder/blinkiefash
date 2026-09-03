import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdChevronLeft,
  MdChevronRight,
  MdCheckroom,
  MdStyle,
  MdDryCleaning,
  MdDirectionsRun,
  MdShoppingBag,
  MdDiamond,
  MdNightlight,
  MdLocalOffer,
  MdBolt,
  MdAutorenew,
  MdVerifiedUser,
  MdSecurity,
  MdSupportAgent,
  MdGridView,
  MdSpa,
  MdMyLocation,
  MdShield,
  MdInventory2,
  MdArrowForward,
  MdRedeem,
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
import womenBanner1 from "../assets/women-banner-1.png";
import womenBanner2 from "../assets/women-banner-2.png";
import womenBanner3 from "../assets/women-banner-3.png";
import "./Shop.css";
import "./Home.css";
import "./Women.css";

const EXPLORE_PAGE_SIZE = 6;

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

const WOMEN_CATEGORY_FALLBACK = [
  { label: "Kurtis & Suits", icon: MdCheckroom },
  { label: "Dresses", icon: MdDryCleaning },
  { label: "Tops & Tees", icon: MdStyle },
  { label: "Sarees", icon: MdSpa },
  { label: "Jeans", icon: MdStyle },
  { label: "Ethnic Wear", icon: MdCheckroom },
  { label: "Footwear", icon: MdDirectionsRun },
  { label: "Bags", icon: MdShoppingBag },
  { label: "Jewellery", icon: MdDiamond },
  { label: "Lingerie", icon: MdStyle },
  { label: "Nightwear", icon: MdNightlight },
  { label: "Accessories", icon: MdStyle },
];

const TOP_NAV = [
  { label: "Women", to: "/women" },
  { label: "Men", to: "/men" },
  { label: "Footwear", to: "/footwear" },
  { label: "Electronics", to: "/electronics" },
  { label: "Beauty", to: "/shop?search=Beauty" },
  { label: "Home Living", to: "/shop?search=Home%20Living" },
  { label: "Kids", to: "/kids" },
  { label: "Travel & Backpack", to: "/shop?search=Travel" },
];

const TOP_STRIP_ITEMS = [
  { icon: MdTwoWheeler, label: "Delivered in 60 Minutes" },
  { icon: MdShield, label: "100% Authentic Products" },
  { icon: MdAutorenew, label: "Easy Returns" },
  { icon: MdInventory2, label: "Cash on Delivery" },
  { icon: MdMyLocation, label: "Track Your Order" },
];

const TOP_BRANDS_FALLBACK = [
  "BIBA",
  "W",
  "Sassafras",
  "Libas",
  "Zudio",
  "Max Fashion",
  "Aurelia",
  "Mango",
  "ONLY",
  "H&M",
  "Vero Moda",
].map((name) => ({ id: null, name, logo_url: "" }));

const HERO_SLIDES = [
  { image: womenBanner1, tag: "Kurta sets for every mood" },
  { image: womenBanner2, tag: "Trending styles" },
  { image: womenBanner3, tag: "New arrivals" },
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

export default function Women() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [deals, setDeals] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [womenRootId, setWomenRootId] = useState(null);
  const [womenSubcats, setWomenSubcats] = useState([]);
  const [womenResolved, setWomenResolved] = useState(false);
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

      const rootId = rootIdForAny(allCats, ["Women", "Woman", "Ladies", "Womens"]);
      const subcats = childCatsFor(allCats, rootId);

      if (cancelled) return;
      setWomenRootId(rootId);
      setWomenSubcats(subcats);
      setWomenResolved(true);
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
    if (!womenResolved) return;
    let cancelled = false;

    (async () => {
      setProductsLoading(true);
      let found = [];
      let dealList;

      if (womenRootId) {
        try {
          const byCategory = await getProducts({
            category_id: womenRootId,
            sort: "newest",
            limit: 30,
          });
          found = extractProducts(byCategory);
        } catch {
          found = [];
        }
      }

      if (!found.length && womenRootId) {
        try {
          const perSub = await Promise.all(
            womenSubcats.slice(0, 6).map((sub) =>
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
          const bySearch = await getProducts({ search: "women", limit: 30 });
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
            category_id: womenRootId || undefined,
            search: womenRootId ? undefined : "women",
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
  }, [womenResolved, womenRootId, womenSubcats]);

  useEffect(() => {
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

  // More to Explore
  useEffect(() => {
    if (!womenResolved) return;
    let cancelled = false;

    (async () => {
      setExploreLoading(true);
      try {
        const categoryId = exploreCatId || womenRootId || undefined;
        const res = await getProducts({
          category_id: categoryId,
          search: categoryId ? undefined : "women",
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
  }, [womenResolved, womenRootId, exploreCatId]);

  const loadMoreExplore = async () => {
    if (exploreLoading || !exploreHasMore) return;
    setExploreLoading(true);
    try {
      const categoryId = exploreCatId || womenRootId || undefined;
      const res = await getProducts({
        category_id: categoryId,
        search: categoryId ? undefined : "women",
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

  const womenScopedShopUrl = useCallback(
    (opts = {}) => {
      const params = new URLSearchParams();
      if (opts.categoryId) {
        params.set("category_id", String(opts.categoryId));
      } else if (womenRootId) {
        params.set("category_id", String(womenRootId));
      }
      let search = opts.search ? String(opts.search).trim() : "";
      if (!params.has("category_id")) {
        const lower = search.toLowerCase();
        if (!lower.includes("women") && !lower.includes("woman") && !lower.includes("ladies")) {
          search = search ? `women ${search}` : "women";
        } else if (!search) {
          search = "women";
        }
      }
      if (search) params.set("search", search);
      const qs = params.toString();
      return qs ? `/shop?${qs}` : "/shop?search=women";
    },
    [womenRootId]
  );

  const findWomenSubcatByLabel = useCallback(
    (label) => {
      const needle = String(label || "")
        .toLowerCase()
        .replace(/&/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!needle || !womenSubcats.length) return null;
      const exact = womenSubcats.find((c) => c.name.toLowerCase().trim() === needle);
      if (exact) return exact;
      return (
        womenSubcats.find((c) => {
          const name = c.name.toLowerCase();
          return name.includes(needle) || needle.includes(name);
        }) || null
      );
    },
    [womenSubcats]
  );

  const categoryStripItems = useMemo(() => {
    if (womenSubcats.length) {
      return womenSubcats.map((cat) => {
        const image = resolveImageUrl(cat.image) || getCategoryImage(cat.name) || "";
        return {
          id: cat.id,
          label: cat.name,
          image,
          to: womenScopedShopUrl({ categoryId: cat.id }),
        };
      });
    }
    return WOMEN_CATEGORY_FALLBACK.map((item) => {
      const match = findWomenSubcatByLabel(item.label);
      return {
        id: match?.id || `fallback-${item.label}`,
        label: item.label,
        icon: item.icon || MdGridView,
        image: match ? resolveImageUrl(match.image) || getCategoryImage(match.name) || "" : "",
        to: match
          ? womenScopedShopUrl({ categoryId: match.id })
          : womenScopedShopUrl({ search: item.label }),
      };
    });
  }, [womenSubcats, womenScopedShopUrl, findWomenSubcatByLabel]);

  const exploreChips = useMemo(
    () => [{ id: "", name: "All" }, ...womenSubcats],
    [womenSubcats]
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
    <div className={`catalog-page women-page${!womenResolved ? " women-loading" : ""}`}>
      {!womenResolved && <Loader overlay />}
      <PageSEO
        title="Women's Fashion — Kurtis, Dresses, Ethnic & More"
        description="Shop women's clothing, footwear, bags and jewellery at Blinkiefash — delivered in 60 minutes across Odisha."
        path="/women"
      />

      <div className="women-top-strip">
        <div className="women-top-strip-inner">
          {TOP_STRIP_ITEMS.map((item) => (
            <span className="women-top-strip-item" key={item.label}>
              <item.icon />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      <Navbar activeTab="Women" />

      <main className="women-main">
        <section className="women-hero-carousel" aria-label="Women's fashion highlights">
          <button
            type="button"
            className="women-hero-arrow prev"
            aria-label="Previous slide"
            onClick={() => setHeroIndex((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          >
            <MdChevronLeft />
          </button>

          <button type="button" className="women-hero-media-btn" onClick={() => navigate(womenScopedShopUrl())}>
            <img src={slide.image} alt={slide.tag} className="women-hero-img" />
          </button>

          <button
            type="button"
            className="women-hero-arrow next"
            aria-label="Next slide"
            onClick={() => setHeroIndex((i) => (i + 1) % HERO_SLIDES.length)}
          >
            <MdChevronRight />
          </button>

          <div className="women-hero-dots">
            {HERO_SLIDES.map((s, idx) => (
              <button
                key={s.tag}
                type="button"
                className={`women-hero-dot${idx === heroIndex ? " active" : ""}`}
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setHeroIndex(idx)}
              />
            ))}
          </div>
        </section>

        {/* Rewards — Home-style */}
        <section className="section hp-rewards-section" aria-label="Offers & rewards">
          <div className="hp-rewards-grid">
            <div className="hp-reward-panel hp-reward-spin">
              <div className="hp-reward-copy">
                <h3>SPIN &amp; WIN</h3>
                <p>Spin the wheel &amp; win exciting discounts!</p>
                <div className="hp-reward-amount">Up To ₹500</div>
                <button type="button" onClick={() => navigate("/spin-wheel")}>
                  SPIN NOW <MdArrowForward />
                </button>
              </div>
              <div className="hp-reward-graphic hp-spin-wheel" aria-hidden="true">
                🎡
              </div>
            </div>

            <div className="hp-reward-panel hp-reward-play">
              <div className="hp-reward-copy">
                <h3>PLAY &amp; WIN</h3>
                <p>Play fun games &amp; win big discounts!</p>
                <div className="hp-reward-amount">Up To ₹250</div>
                <button type="button" onClick={() => navigate("/play-and-win")}>
                  PLAY NOW <MdArrowForward />
                </button>
              </div>
              <div className="hp-reward-graphic" aria-hidden="true">
                🎮
              </div>
            </div>

            <div className="hp-reward-panel hp-reward-refer">
              <div className="hp-reward-copy">
                <h3>REFER &amp; EARN</h3>
                <p>Refer your friend &amp; you both get ₹100 off!</p>
                <div className="hp-referral-code">
                  <span>YOUR REFERRAL CODE</span>
                  <strong>BLINK100</strong>
                </div>
                <button type="button" onClick={() => navigate("/refer-earn")}>
                  REFER NOW <MdArrowForward />
                </button>
              </div>
              <div className="hp-reward-graphic" aria-hidden="true">
                🎁
              </div>
            </div>

            <div className="hp-reward-stack">
              <div className="hp-reward-mini">
                <div>
                  <strong>FLAT 5% OFF</strong>
                  <span>ON FIRST ORDER</span>
                  <span className="hp-reward-mini-chip">Use Code: WELCOME5</span>
                </div>
                <MdRedeem className="hp-reward-mini-icon" />
              </div>
              <div className="hp-reward-mini">
                <div>
                  <strong>FREE DELIVERY</strong>
                  <span>ON ORDERS ABOVE ₹1499</span>
                </div>
                <MdTwoWheeler className="hp-reward-mini-icon" />
              </div>
            </div>
          </div>
        </section>

        {/* Filters */}
          <div className="women-filter-bar">
            <button
              type="button"
              className={`women-filter-btn${filterOpen || activeFilterCount ? " is-active" : ""}`}
              onClick={() => setFilterOpen((o) => !o)}
            >
              <MdFilterList /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
            </button>

            {filterOpen && (
              <section className="women-filters-panel" role="dialog" aria-label="Women filters">
                <div className="women-filters-panel-header">
                  <h3>Filters</h3>
                  {activeFilterCount > 0 ? (
                    <button type="button" className="women-filters-clear" onClick={clearAllFilters}>
                      Clear All
                    </button>
                  ) : null}
                </div>

                <div className="women-filter-col">
                  <h4>Brand</h4>
                  <input
                    className="women-filter-search"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    placeholder="Search brand"
                  />
                  <div className="women-filter-list">
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

                <div className="women-filter-col">
                  <h4>Color</h4>
                  <div className="women-filter-list women-filter-swatches">
                    {COLORS.map(([name, hex]) => {
                      const checked = activeColor.includes(name.toLowerCase()) || activeColor.includes(name);
                      return (
                        <label key={name} className={`women-swatch-label${checked ? " checked" : ""}`}>
                          <input type="checkbox" checked={checked} onChange={() => toggleColorFilter(name)} />
                          <span className="women-swatch-dot" style={{ background: hex }} />
                          <span>{name}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="women-filter-col">
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

                <div className="women-filter-col">
                  <h4>Discount Range</h4>
                  <div className="women-filter-chips">
                    {DISCOUNT_BUCKETS.map((value) => (
                      <button
                        key={value}
                        type="button"
                        className={`women-filter-chip-item${minDiscount === value ? " active" : ""}`}
                        onClick={() => selectMinDiscount(value)}
                      >
                        {value}% and above
                      </button>
                    ))}
                  </div>
                </div>

                <div className="women-filter-col">
                  <h4>Availability</h4>
                  <div className="women-filter-list">
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
          <section className="section women-picks-section">
            <div className="hp-section-head">
              <h2>DEALS OF THE DAY</h2>
              <button type="button" onClick={() => navigate(womenScopedShopUrl())}>
                View All <MdChevronRight />
              </button>
            </div>
            <ProductRail list={applyProductFilters(topDeals)} railRef={dealsRef} keyPrefix="women-deal" />
          </section>
        )}

        {/* All Women's Picks */}
        <section className="section women-picks-section">
          <div className="hp-section-head">
            <h2>ALL WOMEN&apos;S PICKS ✨</h2>
            <button type="button" onClick={() => navigate(womenScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>
          {productsLoading ? (
            <Loader />
          ) : products.length ? (
            <ProductRail list={applyProductFilters(products)} railRef={trendingRef} keyPrefix="women-all" />
          ) : (
            <p className="women-empty-state">New women&apos;s styles are landing soon.</p>
          )}
        </section>

        {/* Categories */}
        <section className="women-cat-strip" aria-label="Shop by category">
          <div className="women-cat-list">
            {categoryStripItems.map((cat) => (
              <button key={cat.id} type="button" className="women-cat-item" onClick={() => navigate(cat.to)}>
                <span className="women-cat-icon-wrap">
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
                  <span className="women-cat-fallback-icon" style={cat.image ? { display: "none" } : undefined}>
                    {cat.icon ? <cat.icon /> : <MdGridView />}
                  </span>
                </span>
                <span className="women-cat-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Promos */}
        <section className="women-promo-strip" aria-label="Offers">
          <button type="button" className="women-promo-card women-promo-prepaid" onClick={() => navigate("/offers")}>
            <div>
              <p className="title">EXTRA 10% OFF</p>
              <p className="sub">On Prepaid Orders · Code BLINK10</p>
            </div>
            <MdLocalOffer style={{ fontSize: 28 }} />
          </button>

          <button
            type="button"
            className="women-promo-card women-promo-brands"
            onClick={() => navigate(womenScopedShopUrl())}
          >
            <div>
              <p className="title">UP TO 60% OFF</p>
              <p className="sub">On Top Brands</p>
              <div className="women-promo-brands-row">
                <span className="women-promo-brand-chip">ZUDIO</span>
                <span className="women-promo-brand-chip">BIBA</span>
                <span className="women-promo-brand-chip">MANGO</span>
              </div>
            </div>
            <span className="cta">SHOP NOW →</span>
          </button>

          <button
            type="button"
            className="women-promo-card women-promo-delivery"
            onClick={() => navigate(womenScopedShopUrl())}
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
        <section className="section women-picks-section">
          <div className="hp-section-head">
            <h2>NEW ARRIVALS ✨</h2>
            <button type="button" onClick={() => navigate(womenScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>
          {productsLoading ? (
            <Loader />
          ) : newArrivals.length ? (
            <ProductRail list={applyProductFilters(newArrivals)} railRef={arrivalsRef} keyPrefix="women-new" />
          ) : (
            <p className="women-empty-state">Fresh styles coming soon.</p>
          )}
        </section>

        {/* Brands */}
        <section className="women-brands-section" aria-label="Top brands">
          <div className="hp-section-head">
            <h2>Top Brands You&apos;ll Love</h2>
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
                  onClick={() => navigate(womenScopedShopUrl({ search: brand.name }))}
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
        <section className="section women-explore-section" aria-label="More to explore">
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
            <p className="women-empty-state">No products in this category yet.</p>
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

        <section className="women-trust-strip" aria-label="Why shop with us">
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