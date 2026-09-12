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
  MdTwoWheeler,
  MdFilterList,
} from "react-icons/md";

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Loader from "../components/Loader";
import PageSEO from "../components/PageSEO";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import Filter from "../components/filter";
import { getProducts, getCategories, getBrands, getBestsellers } from "../api";
import { getCategoryImage } from "../utils/categoryImages";
import { API_BASE_URL } from "../apiBase";

import womenBanner1 from "../assets/women-banner-1.png";
import womenBanner2 from "../assets/women-banner-2.png";
import womenBanner3 from "../assets/women-banner-3.png";

import womenMobileBanner1 from "../assets/womenmobilebanner1.png";
import womenMobileBanner2 from "../assets/womenmobilebanner2.png";
import womenMobileBanner3 from "../assets/womenmobilebanner3.png";

import womenEthnicBanner from "../assets/womenethnicbanner.jpg";
// import playAndWinImage from "../assets/play&win.png";
// import spinAndWinImage from "../assets/spin&win.png";
// import referAndEarnImage from "../assets/refer&earn.png";
// import freeDeliveryImage from "../assets/freedelivery.png";
import dealsOfTheDayIcon from "../assets/dealsoftheday.png";
import shopByBrandIcon from "../assets/shopbybrand.png";
import "./Shop.css";
import "./Home.css";
import "./Women.css";

const EXPLORE_PAGE_SIZE = 8;
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

// Any women's subcategory whose name matches one of these keywords counts
// as "ethnic wear" — this is keyword-based (not a fixed label list) so it
// automatically picks up things like "Kurtis & Suits", "Kurti Sets",
// "Ethnic Sets", "Anarkali", "Sarees", etc. straight from your backend's
// actual category names, without needing to hardcode every variant.
const ETHNIC_KEYWORDS = [
  "ethnic",
  "kurti",
  "kurta",
  "saree",
  "sari",
  "suit",
  "lehenga",
  "salwar",
  "dupatta",
  "chikankari",
  "anarkali",
  "sharara",
  "dhoti",
  "indo western",
  "indo-western",
  "fusion wear",
];

// Per-category fetch size — high enough that pooling several ethnic
// categories together reliably surfaces everything available, not just
// a capped preview.
const ETHNIC_FETCH_LIMIT_PER_CATEGORY = 100;

// How many pages of `sort: "newest"` results to page through when building
// the women's New Arrivals pool. Each page pulls up to 100 products, so
// 4 pages covers up to 400 of the most recently added women's products
// before we trim down to what the rail actually displays.
const NEW_ARRIVALS_MAX_PAGES = 4;
const NEW_ARRIVALS_PAGE_SIZE = 100;
const NEW_ARRIVALS_DISPLAY_LIMIT = 20;

const NIKE_LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg";

// How far (in px) a touch must travel horizontally before we treat it as a
// deliberate swipe rather than an accidental drag/tap.
const HERO_SWIPE_THRESHOLD = 40;
// How often the hero auto-advances, in ms. Also used to restart the timer
// after a manual swipe/arrow/dot interaction so it doesn't jump again
// a moment later.
const HERO_AUTOPLAY_MS = 5000;

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

function seededShuffle(array, seed) {
  const arr = [...array];
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function todaysSeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getMsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, midnight.getTime() - now.getTime());
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function scrollRailByCards(el, direction = 1, cardsPerPage = 3) {
  if (!el) return;
  const dir = direction < 0 ? -1 : 1;
  const card = el.querySelector(".hp-shop-brand-card, .pc-card, .hp-deal-card");
  let step = Math.round(el.clientWidth * 0.95);
  if (card) {
    const styles = window.getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap || "14") || 14;
    const cardW = card.getBoundingClientRect().width;
    step = Math.round((cardW + gap) * cardsPerPage);
  }
  el.scrollBy({ left: dir * step, behavior: "smooth" });
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

const TOP_STRIP_ITEMS = [
  { icon: MdTwoWheeler, label: "Fast Delivery" },
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
  { image: womenBanner1, mobileImage: womenMobileBanner1, tag: "Kurta sets for every mood" },
  { image: womenBanner2, mobileImage: womenMobileBanner2, tag: "Trending styles" },
  { image: womenBanner3, mobileImage: womenMobileBanner3, tag: "New arrivals" },
];

let womenPageCache = null;

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

function ProductRail({ list, railRef, keyPrefix, isNew = false }) {

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
            <ProductCard product={p} isNew={isNew} />
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

  const [products, setProducts] = useState(() => womenPageCache?.products ?? []);
  const [newArrivals, setNewArrivals] = useState(() => womenPageCache?.newArrivals ?? []);
  const [deals, setDeals] = useState(() => womenPageCache?.deals ?? []);
  const [productsLoading, setProductsLoading] = useState(!womenPageCache);
  const [newArrivalsLoading, setNewArrivalsLoading] = useState(!womenPageCache);
  const [womenRootId, setWomenRootId] = useState(() => womenPageCache?.womenRootId ?? null);
  const [womenSubcats, setWomenSubcats] = useState(() => womenPageCache?.womenSubcats ?? []);
  const [womenResolved, setWomenResolved] = useState(() => Boolean(womenPageCache));
  const [brands, setBrands] = useState(() => womenPageCache?.brands ?? []);
  const [heroIndex, setHeroIndex] = useState(0);

  const [exploreCatId, setExploreCatId] = useState("");
  const [exploreProducts, setExploreProducts] = useState([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [exploreHasMore, setExploreHasMore] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);

  // Festive Edit (ethnic wear) products
  const [ethnicProducts, setEthnicProducts] = useState([]);

  // ---- Filters: single controlled object, mirrors Men.js ----
  const [filterOpen, setFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
    subcategory: null,
    brand: [],
    color: [],
    gender: [],
    minDiscount: 0,
    minRating: 0,
    inStockOnly: false,
    maxPrice: 10000,
    sort: "popularity",
  });

  const [dealsCountdown, setDealsCountdown] = useState(() => formatCountdown(getMsUntilMidnight()));

  const normalizeText = (value) => String(value || "").trim().toLowerCase();

  const activeFilterCount =
    filters.brand.length +
    filters.color.length +
    filters.gender.length +
    (filters.minDiscount > 0 ? 1 : 0) +
    (filters.inStockOnly ? 1 : 0) +
    (filters.maxPrice < 10000 ? 1 : 0);

  const clearAllFilters = () =>
    setFilters((f) => ({
      ...f,
      brand: [],
      color: [],
      gender: [],
      minDiscount: 0,
      inStockOnly: false,
      maxPrice: 10000,
    }));

  const applyProductFilters = useCallback(
    (list) =>
      (list || []).filter((p) => {
        if (filters.brand.length > 0) {
          const b = normalizeText(p.brand);
          if (!filters.brand.map(normalizeText).includes(b)) return false;
        }
        if (filters.color.length > 0) {
          const c = normalizeText(p.color);
          if (c && !filters.color.map(normalizeText).includes(c)) return false;
        }
        if (filters.gender.length > 0) {
          const gender = normalizeText(p.gender);
          if (gender && !filters.gender.map(normalizeText).includes(gender)) return false;
        }
        if (filters.minDiscount > 0 && (p.discount || 0) < filters.minDiscount) return false;
        if (filters.inStockOnly && p.in_stock === false) return false;
        const finalPrice = Number(p.discount_price) > 0 ? Number(p.discount_price) : Number(p.price || 0);
        if (finalPrice > filters.maxPrice) return false;
        return true;
      }),
    [filters]
  );

  const trendingRef = useRef(null);
  const arrivalsRef = useRef(null);
  const dealsRef = useRef(null);
  const shopBrandsRef = useRef(null);
  const festiveRef = useRef(null);

  // ---- Hero carousel: swipe + restartable autoplay ----
  const heroAutoplayRef = useRef(null);
  const heroTouchStartX = useRef(null);
  const heroTouchStartY = useRef(null);
  const heroTouchDeltaX = useRef(0);
  const heroSwiping = useRef(false);

  const startHeroAutoplay = useCallback(() => {
    if (heroAutoplayRef.current) {
      clearInterval(heroAutoplayRef.current);
    }
    heroAutoplayRef.current = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, HERO_AUTOPLAY_MS);
  }, []);

  // Any manual navigation (arrow, dot, swipe) should push the next
  // auto-advance HERO_AUTOPLAY_MS out from *now*, instead of firing again
  // moments later on the old schedule.
  const goToHeroSlide = useCallback(
    (updater) => {
      setHeroIndex(updater);
      startHeroAutoplay();
    },
    [startHeroAutoplay]
  );

  useEffect(() => {
    startHeroAutoplay();
    return () => {
      if (heroAutoplayRef.current) clearInterval(heroAutoplayRef.current);
    };
  }, [startHeroAutoplay]);

  const handleHeroTouchStart = (e) => {
    const touch = e.touches[0];
    heroTouchStartX.current = touch.clientX;
    heroTouchStartY.current = touch.clientY;
    heroTouchDeltaX.current = 0;
    heroSwiping.current = false;
  };

  const handleHeroTouchMove = (e) => {
    if (heroTouchStartX.current === null) return;
    const touch = e.touches[0];
    const deltaX = touch.clientX - heroTouchStartX.current;
    const deltaY = touch.clientY - heroTouchStartY.current;
    heroTouchDeltaX.current = deltaX;

    // Only claim the gesture as a horizontal swipe once movement is clearly
    // more horizontal than vertical, so the page can still scroll normally.
    if (!heroSwiping.current && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > 10) {
      heroSwiping.current = true;
    }
    if (heroSwiping.current) {
      e.preventDefault();
    }
  };

  const handleHeroTouchEnd = () => {
    const delta = heroTouchDeltaX.current;
    if (heroSwiping.current) {
      if (delta > HERO_SWIPE_THRESHOLD) {
        goToHeroSlide((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length);
      } else if (delta < -HERO_SWIPE_THRESHOLD) {
        goToHeroSlide((i) => (i + 1) % HERO_SLIDES.length);
      }
    }
    heroTouchStartX.current = null;
    heroTouchStartY.current = null;
    heroTouchDeltaX.current = 0;
    heroSwiping.current = false;
  };
  // ---- end hero carousel helpers ----

  useEffect(() => {
    const interval = setInterval(() => {
      setDealsCountdown(formatCountdown(getMsUntilMidnight()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (womenPageCache) return undefined;
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
    if (womenPageCache?.brands?.length) return undefined;
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

        if (!cancelled) {
          const nextBrands = list.length ? list : TOP_BRANDS_FALLBACK;
          setBrands(nextBrands);
          womenPageCache = { ...(womenPageCache || {}), brands: nextBrands };
        }
      } catch {
        if (!cancelled) {
          setBrands(TOP_BRANDS_FALLBACK);
          womenPageCache = { ...(womenPageCache || {}), brands: TOP_BRANDS_FALLBACK };
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Main product pool + deals
  useEffect(() => {
    if (!womenResolved) return;
    if (womenPageCache?.products) return;
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
        setDeals(dealList.map(normalizeProduct).slice(0, 12));
        womenPageCache = {
          ...(womenPageCache || {}),
          products: normalized.slice(0, 20),
          deals: dealList.map(normalizeProduct).slice(0, 12),
          womenRootId,
          womenSubcats,
        };
        setProductsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [womenResolved, womenRootId, womenSubcats]);

  // New Arrivals — a dedicated, newest-first pool (same approach Home uses
  // for "New on Blinkiefash"), scoped to the Women's category only. This
  // pages through `sort: "newest"` results instead of reusing whatever
  // "All Women's Picks" happened to fetch, so it reflects products that
  // were actually added most recently.
  useEffect(() => {
    if (!womenResolved) return;
    if (womenPageCache?.newArrivals) return;
    let cancelled = false;

    (async () => {
      setNewArrivalsLoading(true);
      try {
        const pool = [];
        const seen = new Set();
        let offset = 0;

        for (let i = 0; i < NEW_ARRIVALS_MAX_PAGES; i += 1) {
          const res = await getProducts({
            category_id: womenRootId || undefined,
            search: womenRootId ? undefined : "women",
            sort: "newest",
            limit: NEW_ARRIVALS_PAGE_SIZE,
            offset,
          });
          const batch = extractProducts(res);
          if (!Array.isArray(batch) || batch.length === 0) break;

          batch.forEach((item) => {
            const key = String(item?.id ?? "");
            if (!key || seen.has(key)) return;
            seen.add(key);
            pool.push(item);
          });

          if (batch.length < NEW_ARRIVALS_PAGE_SIZE) break;
          offset += NEW_ARRIVALS_PAGE_SIZE;
        }

        if (cancelled) return;
        const normalizedNewArrivals = pool.map(normalizeProduct).slice(0, NEW_ARRIVALS_DISPLAY_LIMIT);
        setNewArrivals(normalizedNewArrivals);
        womenPageCache = { ...(womenPageCache || {}), newArrivals: normalizedNewArrivals };
      } catch {
        if (!cancelled) setNewArrivals([]);
      } finally {
        if (!cancelled) setNewArrivalsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [womenResolved, womenRootId]);

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
      if (opts.sort) params.set("sort", String(opts.sort));
      if (opts.newArrivals) params.set("new_arrivals", "true");
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

  const exploreChips = useMemo(() => [{ id: "", name: "All" }, ...womenSubcats], [womenSubcats]);

  // Deals of the Day — same ranking + daily rotation as Home
  const topDeals = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    const enriched = list.map((item) => {
      const price = Number(item?.discount_price ?? item?.price ?? item?._price ?? 0);
      const mrp = Number(item?.price ?? item?._mrp ?? item?.original_price ?? price);
      const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
      const brand = (item?.brand || "").toString().trim().toLowerCase();
      const isSouledStore = brand === "the souled store" || brand === "souled store";
      return { ...item, _discount: discount, _isSouledStore: isSouledStore };
    });

    const discountedOnly = enriched.filter((item) => item._discount > 0);
    const ranked = [...discountedOnly].sort((a, b) => b._discount - a._discount);
    const pool = ranked.slice(0, Math.max(30, Math.min(80, ranked.length)));
    const rotated = seededShuffle(pool, todaysSeed());
    const souledFirst = rotated.filter((item) => item._isSouledStore);
    const others = rotated.filter((item) => !item._isSouledStore);
    return [...souledFirst, ...others].slice(0, 30);
  }, [deals]);

  // Only brands that appear on women's products
  const womenBrands = useMemo(() => {
    const fromProducts = new Map();
    const push = (list) => {
      (list || []).forEach((p) => {
        const name = (p?.brand || "").toString().trim();
        if (!name) return;
        const key = normalizeBrandName(name);
        if (!fromProducts.has(key)) fromProducts.set(key, name);
      });
    };
    push(products);
    push(deals);
    push(newArrivals);
    push(exploreProducts);

    if (fromProducts.size === 0) {
      return (brands || []).slice(0, 14);
    }

    const logoByName = new Map();
    (brands || []).forEach((b) => {
      const key = normalizeBrandName(b.name);
      if (key) logoByName.set(key, b.logo_url || "");
    });

    return [...fromProducts.entries()]
      .map(([key, name]) => ({
        id: null,
        name,
        logo_url: logoByName.get(key) || "",
      }))
      .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
  }, [products, deals, newArrivals, exploreProducts, brands]);

  const ethnicCategories = useMemo(() => {
    if (!womenSubcats.length) return [];
    return womenSubcats.filter((cat) => {
      const name = (cat.name || "").toLowerCase();
      return ETHNIC_KEYWORDS.some((kw) => name.includes(kw));
    });
  }, [womenSubcats]);

  // Festive Edit — every ethnic wear product for women (kurtis, kurta
  // sets, sarees, suits, lehengas, etc.), pooled across all matching
  // subcategories with no artificial cap on the total shown.
  useEffect(() => {
    if (!womenResolved) return;
    let cancelled = false;

    (async () => {
      let merged = [];

      if (ethnicCategories.length) {
        try {
          const perCat = await Promise.all(
            ethnicCategories.map((cat) =>
              getProducts({
                category_id: cat.id,
                sort: "newest",
                limit: ETHNIC_FETCH_LIMIT_PER_CATEGORY,
              }).catch(() => [])
            )
          );
          merged = perCat.flatMap(extractProducts);
        } catch {
          merged = [];
        }
      }

      // Dedupe by product id, preserving first occurrence
      const seenIds = new Set();
      merged = merged.filter((p) => {
        const key = String(p?.id ?? "");
        if (!key || seenIds.has(key)) return false;
        seenIds.add(key);
        return true;
      });

      // No ethnic subcategories resolved at all — fall back to a keyword search
      if (!merged.length) {
        try {
          const res = await getProducts({
            category_id: womenRootId || undefined,
            search: womenRootId ? "ethnic" : "women ethnic",
            sort: "newest",
            limit: ETHNIC_FETCH_LIMIT_PER_CATEGORY,
          });
          extractProducts(res).forEach((p) => {
            const key = String(p?.id ?? "");
            if (key && !seenIds.has(key)) {
              seenIds.add(key);
              merged.push(p);
            }
          });
        } catch {
          // ignore, use whatever we already have
        }
      }

      if (!cancelled) {
        setEthnicProducts(merged.map(normalizeProduct));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [womenResolved, womenRootId, ethnicCategories]);

  const ethnicShopUrl = useMemo(() => {
    const ethnicCat = findWomenSubcatByLabel("Ethnic Wear") || ethnicCategories[0];
    return ethnicCat
      ? womenScopedShopUrl({ categoryId: ethnicCat.id })
      : womenScopedShopUrl({ search: "ethnic" });
  }, [findWomenSubcatByLabel, ethnicCategories, womenScopedShopUrl]);
  void ethnicShopUrl; // kept for now in case other flows still want the /shop-scoped ethnic URL

  const slide = HERO_SLIDES[heroIndex];
  const indianFusionCategory = findWomenSubcatByLabel("Indian and Fusion wear") || ethnicCategories[0];
  const heroDestination = heroIndex === 1
    ? womenScopedShopUrl({ categoryId: indianFusionCategory?.id })
    : heroIndex === 2
      ? womenScopedShopUrl({ sort: "newest", newArrivals: true })
      : womenScopedShopUrl();

  return (
    <div className={`catalog-page women-page${!womenResolved ? " women-loading" : ""}`}>
      {!womenResolved && <Loader overlay />}
      <PageSEO
        title="Women's Fashion — Kurtis, Dresses, Ethnic & More"
        description="Shop women's clothing, footwear, bags and jewellery at Blinkiefash — delivered fast across Odisha."
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
        <section
          className="women-hero-carousel"
          aria-label="Women's fashion highlights"
          onTouchStart={handleHeroTouchStart}
          onTouchMove={handleHeroTouchMove}
          onTouchEnd={handleHeroTouchEnd}
        >
          <button
            type="button"
            className="women-hero-arrow prev"
            aria-label="Previous slide"
            onClick={() => goToHeroSlide((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          >
            <MdChevronLeft />
          </button>

          <button type="button" className="women-hero-media-btn" onClick={() => navigate(heroDestination)}>
            <picture>
              {slide.mobileImage ? (
                <source media="(max-width: 767px)" srcSet={slide.mobileImage} />
              ) : null}
              <img src={slide.image} alt={slide.tag} className="women-hero-img" draggable={false} />
            </picture>
          </button>

          <button
            type="button"
            className="women-hero-arrow next"
            aria-label="Next slide"
            onClick={() => goToHeroSlide((i) => (i + 1) % HERO_SLIDES.length)}
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
                onClick={() => goToHeroSlide(idx)}
              />
            ))}
          </div>
        </section>

        {/* ========== DEALS OF THE DAY (Home-style + timer) ========== */}
        {topDeals.length > 0 && (
          <section className="section women-picks-section">
            <div className="hp-shead">
              <div className="hp-shead-title-group">
                <div className="hp-shead-title-wrap">
                  <span className="hp-shead-mark hp-shead-mark-deals" aria-hidden="true">
                    <img src={dealsOfTheDayIcon} alt="" className="hp-shead-mark-img" />
                  </span>
                  <h2 className="hp-shead-title">
                    <span>Deals of the </span>
                    <span className="hp-shead-accent">Day</span>
                  </h2>
                  <div className="hp-deals-timer" aria-live="polite">
                    <span className="hp-deals-timer-label">Deal Ends in</span>
                    <span className="hp-deals-timer-value">{dealsCountdown}</span>
                  </div>
                </div>
              </div>
              <div className="women-section-actions">
                <button
                  type="button"
                  className="hp-shead-action"
                  onClick={() => navigate(womenRootId ? `/deals-of-the-day?category_id=${encodeURIComponent(womenRootId)}` : "/deals-of-the-day")}
                >
                  View All <MdChevronRight />
                </button>
                <button
                  type="button"
                  className={`women-filter-btn${filterOpen || activeFilterCount ? " is-active" : ""}`}
                  onClick={() => setFilterOpen((o) => !o)}
                >
                  <MdFilterList /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
                </button>
              </div>
            </div>

            {filterOpen && (
              <Filter
                hideBar
                open={filterOpen}
                onOpenChange={setFilterOpen}
                ariaLabel="Women filters"
                brands={brands}
                availableGenders={["Men", "Women", "Kids", "Unisex"]}
                filters={filters}
                onChange={(patch) => setFilters((f) => ({ ...f, ...patch }))}
                onClearAll={clearAllFilters}
                colors={COLORS}
                discountBuckets={DISCOUNT_BUCKETS}
                priceBounds={{ min: 0, max: 10000 }}
              />
            )}

            <ProductRail list={applyProductFilters(topDeals)} railRef={dealsRef} keyPrefix="women-deal" />
          </section>
        )}

        {/* ========== BRANDS YOU WILL LOVE (under Deals, women-only brands) ========== */}
        {womenBrands.length > 0 && (
          <section className="section hp-shop-brands-section women-brands-section" aria-label="Brands you will love">
            <div className="hp-shead">
              <div className="hp-shead-title-group">
                <div className="hp-shead-title-wrap">
                  <span className="hp-shead-mark" aria-hidden="true">
                    <img src={shopByBrandIcon} alt="" className="hp-shead-mark-img" />
                  </span>
                  <h2 className="hp-shead-title">
                    <span>Brands You </span>
                    <span className="hp-shead-accent">Will Love</span>
                  </h2>
                </div>
              </div>
              <button type="button" className="hp-shead-action" onClick={() => navigate(womenScopedShopUrl())}>
                View All <MdChevronRight />
              </button>
            </div>

            <div className="hp-deals-wrap hp-shop-brands-wrap">
              <button
                type="button"
                className="hp-deals-prev"
                aria-label="Scroll brands left"
                onClick={() => scrollRailByCards(shopBrandsRef.current, -1, 3)}
              >
                <MdChevronLeft />
              </button>

              <div className="hp-shop-brands-grid" role="list" ref={shopBrandsRef}>
                {womenBrands.map((brand, idx) => {
                  const label = (brand.name || "").toString().trim();
                  const displayName = label || "Brand";
                  const normalizedDisplayName = normalizeBrandName(displayName);
                  const logo =
                    normalizedDisplayName === "nike"
                      ? NIKE_LOGO_URL
                      : resolveImageUrl(brand.logo_url || brand.image);
                  const isFeatured = idx === 0;

                  return (
                    <article
                      key={`${brand.id || displayName}-${idx}`}
                      className={`hp-shop-brand-card${isFeatured ? " featured" : ""}`}
                      role="listitem"
                      tabIndex={0}
                      style={{ cursor: "pointer" }}
                      onClick={() => navigate(`/brands/${encodeURIComponent(displayName)}`)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          navigate(`/brands/${encodeURIComponent(displayName)}`);
                        }
                      }}
                    >
                      <div className="hp-shop-brand-visual">
                        {logo ? (
                          <img
                            src={logo}
                            alt={displayName}
                            loading="lazy"
                            className={`hp-shop-brand-logo${
                              normalizedDisplayName === "nike" ? " hp-shop-brand-nike-logo" : ""
                            }`}
                          />
                        ) : (
                          <div className="hp-shop-brand-fallback" aria-label={displayName}>
                            {displayName.slice(0, 5).toUpperCase()}
                          </div>
                        )}
                      </div>
                    </article>
                  );
                })}
              </div>

              <button
                type="button"
                className="hp-deals-next"
                aria-label="Scroll brands right"
                onClick={() => scrollRailByCards(shopBrandsRef.current, 1, 3)}
              >
                <MdChevronRight />
              </button>
            </div>
          </section>
        )}

        {/* ========== ETHNIC BANNER ========== */}
        <section className="women-ethnic-banner-section" aria-label="Festive ethnic wear">
          <button
            type="button"
            className="women-ethnic-banner-btn"
            onClick={() => navigate("/festive/women")}
          >
            <img
              src={womenEthnicBanner}
              alt="Your Festive Fits — traditional roots, modern style"
              className="women-ethnic-banner-img"
            />
          </button>
        </section>

        {/* ========== FESTIVE EDIT (ethnic wear rail) ========== */}
        {ethnicProducts.length > 0 && (
          <section className="section women-picks-section" aria-label="Festive edit — ethnic wear">
            <div className="hp-section-head">
              <h2>FESTIVE EDIT 🪔</h2>
              <button type="button" onClick={() => navigate("/festive/women")}>
                View All <MdChevronRight />
              </button>
            </div>
            <ProductRail
              list={applyProductFilters(ethnicProducts)}
              railRef={festiveRef}
              keyPrefix="women-festive"
            />
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

        {/* New arrivals — genuinely newest women's products (Home-style pool) */}
        <section className="section women-picks-section">
          <div className="hp-section-head">
            <h2>NEW ARRIVALS ✨</h2>
            <button type="button" onClick={() => navigate(womenScopedShopUrl({ search: "newest" }))}>
              View All <MdChevronRight />
            </button>
          </div>
          {newArrivalsLoading ? (
            <Loader />
          ) : newArrivals.length ? (
            <ProductRail
              list={applyProductFilters(newArrivals)}
              railRef={arrivalsRef}
              keyPrefix="women-new"
              isNew
            />
          ) : (
            <p className="women-empty-state">Fresh styles coming soon.</p>
          )}
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
              {Array.from({ length: 8 }).map((_, idx) => (
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
              <strong>FAST</strong>
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