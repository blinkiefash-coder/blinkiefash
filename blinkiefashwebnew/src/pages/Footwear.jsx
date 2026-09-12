import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdChevronLeft,
  MdChevronRight,
  MdDirectionsRun,
  MdHiking,
  MdBeachAccess,
  MdWork,
  MdSportsSoccer,
  MdChildCare,
  MdFemale,
  MdMale,
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
  MdClose,
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

// NOTE: dedicated hero banner artwork for Footwear beyond the single banner
// doesn't exist yet. Reusing the one footwear banner for all three hero
// slides as a placeholder — swap these three imports for real
// desktop/mobile banner assets (e.g. footwearBanner1/2/3,
// footwearMobileBanner1/2/3) the same way the Women page does with
// womenBanner1/2/3.
import footwearBanner from "../assets/footwearbanner.png";
import dealsOfTheDayIcon from "../assets/dealsoftheday.png";
import shopByBrandIcon from "../assets/shopbybrand.png";
import "./Shop.css";
import "./Home.css";
import "./Footwear.css";

const EXPLORE_PAGE_SIZE = 8;
const COLORS = [
  ["Black", "#111827"],
  ["White", "#ffffff"],
  ["Brown", "#78350f"],
  ["Tan", "#d2b48c"],
  ["Grey", "#9ca3af"],
  ["Navy", "#1e3a8a"],
  ["Beige", "#e8dcc4"],
  ["Red", "#ef4444"],
  ["Green", "#22c55e"],
];

const DISCOUNT_BUCKETS = [10, 20, 30, 40, 50, 60, 70];

// How many pages of `sort: "newest"` results to page through when building
// the Footwear New Arrivals pool. Each page pulls up to 100 products, so
// 4 pages covers up to 400 of the most recently added footwear products
// before we trim down to what the rail actually displays.
const NEW_ARRIVALS_MAX_PAGES = 4;
const NEW_ARRIVALS_PAGE_SIZE = 100;
const NEW_ARRIVALS_DISPLAY_LIMIT = 20;

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

const FOOTWEAR_CATEGORY_FALLBACK = [
  { label: "Sneakers", icon: MdDirectionsRun },
  { label: "Boots", icon: MdHiking },
  { label: "Sandals", icon: MdBeachAccess },
  { label: "Formal Shoes", icon: MdWork },
  { label: "Sports Shoes", icon: MdSportsSoccer },
  { label: "Flip Flops", icon: MdBeachAccess },
  { label: "Women's Shoes", icon: MdFemale },
  { label: "Men's Shoes", icon: MdMale },
  { label: "Kids Shoes", icon: MdChildCare },
  { label: "Accessories", icon: MdGridView },
];

const TOP_STRIP_ITEMS = [
  { icon: MdTwoWheeler, label: "Fast Delivery" },
  { icon: MdShield, label: "100% Genuine Products" },
  { icon: MdAutorenew, label: "Easy Returns" },
  { icon: MdInventory2, label: "Cash on Delivery" },
  { icon: MdMyLocation, label: "Track Your Order" },
];

const TOP_BRANDS_FALLBACK = [
  "Nike",
  "Adidas",
  "Puma",
  "Reebok",
  "Skechers",
  "Woodland",
  "Bata",
  "Campus",
  "Sparx",
  "Red Tape",
  "Crocs",
  "Clarks",
].map((name) => ({ id: null, name, logo_url: "" }));

// Placeholder hero slides — all three currently point at the same banner
// image and each links somewhere useful. Replace `image` / `mobileImage`
// with real per-slide artwork when it's ready.
const HERO_SLIDES = [
  { image: footwearBanner, mobileImage: null, tag: "Fresh kicks & everyday footwear" },
  { image: footwearBanner, mobileImage: null, tag: "Top footwear deals" },
  { image: footwearBanner, mobileImage: null, tag: "New arrivals in footwear" },
];

let footwearPageCache = null;

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

export default function Footwear() {
  const navigate = useNavigate();

  const [products, setProducts] = useState(() => footwearPageCache?.products ?? []);
  const [newArrivals, setNewArrivals] = useState(() => footwearPageCache?.newArrivals ?? []);
  const [deals, setDeals] = useState(() => footwearPageCache?.deals ?? []);
  const [productsLoading, setProductsLoading] = useState(!footwearPageCache);
  const [newArrivalsLoading, setNewArrivalsLoading] = useState(!footwearPageCache);
  const [rootId, setRootId] = useState(() => footwearPageCache?.rootId ?? null);
  const [subcats, setSubcats] = useState(() => footwearPageCache?.subcats ?? []);
  const [categoryResolved, setCategoryResolved] = useState(() => Boolean(footwearPageCache));
  const [brands, setBrands] = useState(() => footwearPageCache?.brands ?? []);
  const [heroIndex, setHeroIndex] = useState(0);

  const [exploreCatId, setExploreCatId] = useState("");
  const [exploreProducts, setExploreProducts] = useState([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [exploreHasMore, setExploreHasMore] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);

  const [filterOpen, setFilterOpen] = useState(false);
  const [activeBrand, setActiveBrand] = useState([]);
  const [activeColor, setActiveColor] = useState([]);
  const [activeGender, setActiveGender] = useState([]);
  const [minDiscount, setMinDiscount] = useState(0);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [maxPrice, setMaxPrice] = useState(50000);
  const [brandSearch, setBrandSearch] = useState("");

  // appliedFilters is what actually filters the product rails. activeBrand /
  // activeColor / etc. above are just the draft values the filter panel's
  // checkboxes and sliders are bound to — they don't affect the grid until
  // "Apply Filters" is pressed (mirrors the Shop page behavior).
  const [appliedFilters, setAppliedFilters] = useState({
    brand: [],
    color: [],
    gender: [],
    minDiscount: 0,
    inStockOnly: false,
    maxPrice: 50000,
  });

  const [dealsCountdown, setDealsCountdown] = useState(() => formatCountdown(getMsUntilMidnight()));

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

  // Reflects what's actually filtering the grid right now (appliedFilters),
  // not whatever's mid-edit in the still-open panel.
  const activeFilterCount =
    appliedFilters.brand.length +
    appliedFilters.color.length +
    appliedFilters.gender.length +
    (appliedFilters.minDiscount > 0 ? 1 : 0) +
    (appliedFilters.inStockOnly ? 1 : 0) +
    (appliedFilters.maxPrice < 50000 ? 1 : 0);

  const clearAllFilters = () => {
    setActiveBrand([]);
    setActiveColor([]);
    setActiveGender([]);
    setMinDiscount(0);
    setInStockOnly(false);
    setMaxPrice(50000);
    setBrandSearch("");
    setAppliedFilters({
      brand: [],
      color: [],
      gender: [],
      minDiscount: 0,
      inStockOnly: false,
      maxPrice: 50000,
    });
  };

  const applyFilters = ({ close = true } = {}) => {
    setAppliedFilters({
      brand: activeBrand,
      color: activeColor,
      gender: activeGender,
      minDiscount,
      inStockOnly,
      maxPrice,
    });
    if (close) setFilterOpen(false);
  };

  const visibleBrands = brands.filter((b) => normalizeText(b.name).includes(normalizeText(brandSearch)));

  const applyProductFilters = useCallback(
    (list) =>
      (list || []).filter((p) => {
        if (appliedFilters.brand.length > 0) {
          const b = normalizeText(p.brand);
          if (!appliedFilters.brand.map(normalizeText).includes(b)) return false;
        }
        if (appliedFilters.color.length > 0) {
          const c = normalizeText(p.color);
          if (c && !appliedFilters.color.map(normalizeText).includes(c)) return false;
        }
        if (appliedFilters.gender.length > 0) {
          const gender = normalizeText(p.gender);
          if (gender && !appliedFilters.gender.map(normalizeText).includes(gender)) return false;
        }
        if (appliedFilters.minDiscount > 0 && (p.discount || 0) < appliedFilters.minDiscount) return false;
        if (appliedFilters.inStockOnly && p.in_stock === false) return false;
        const finalPrice = Number(p.discount_price) > 0 ? Number(p.discount_price) : Number(p.price || 0);
        if (finalPrice > appliedFilters.maxPrice) return false;
        return true;
      }),
    [appliedFilters]
  );

  const trendingRef = useRef(null);
  const arrivalsRef = useRef(null);
  const dealsRef = useRef(null);
  const shopBrandsRef = useRef(null);

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
    if (footwearPageCache) return undefined;
    let cancelled = false;

    (async () => {
      let allCats = [];
      try {
        const catRes = await getCategories();
        if (Array.isArray(catRes)) allCats = catRes;
      } catch {
        // keep []
      }

      const resolvedRootId = rootIdForAny(allCats, ["Footwear", "Shoes", "Footwear & Shoes"]);
      const resolvedSubcats = childCatsFor(allCats, resolvedRootId);

      if (cancelled) return;
      setRootId(resolvedRootId);
      setSubcats(resolvedSubcats);
      setCategoryResolved(true);
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (footwearPageCache?.brands?.length) return undefined;
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
          footwearPageCache = { ...(footwearPageCache || {}), brands: nextBrands };
        }
      } catch {
        if (!cancelled) {
          setBrands(TOP_BRANDS_FALLBACK);
          footwearPageCache = { ...(footwearPageCache || {}), brands: TOP_BRANDS_FALLBACK };
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // Main product pool + deals
  useEffect(() => {
    if (!categoryResolved) return;
    if (footwearPageCache?.products) return;
    let cancelled = false;

    (async () => {
      setProductsLoading(true);
      let found = [];
      let dealList;

      if (rootId) {
        try {
          const byCategory = await getProducts({
            category_id: rootId,
            sort: "newest",
            limit: 30,
          });
          found = extractProducts(byCategory);
        } catch {
          found = [];
        }
      }

      if (!found.length && rootId) {
        try {
          const perSub = await Promise.all(
            subcats.slice(0, 6).map((sub) =>
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
          const bySearch = await getProducts({ search: "footwear", limit: 30 });
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
            category_id: rootId || undefined,
            search: rootId ? undefined : "footwear",
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
        footwearPageCache = {
          ...(footwearPageCache || {}),
          products: normalized.slice(0, 20),
          deals: dealList.map(normalizeProduct).slice(0, 12),
          rootId,
          subcats,
        };
        setProductsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryResolved, rootId, subcats]);

  // New Arrivals — a dedicated, newest-first pool (same approach Home uses
  // for "New on Blinkiefash"), scoped to the Footwear category only.
  // This pages through `sort: "newest"` results instead of reusing
  // whatever "All Footwear Picks" happened to fetch, so it reflects
  // products that were actually added most recently.
  useEffect(() => {
    if (!categoryResolved) return;
    if (footwearPageCache?.newArrivals) return;
    let cancelled = false;

    (async () => {
      setNewArrivalsLoading(true);
      try {
        const pool = [];
        const seen = new Set();
        let offset = 0;

        for (let i = 0; i < NEW_ARRIVALS_MAX_PAGES; i += 1) {
          const res = await getProducts({
            category_id: rootId || undefined,
            search: rootId ? undefined : "footwear",
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
        footwearPageCache = { ...(footwearPageCache || {}), newArrivals: normalizedNewArrivals };
      } catch {
        if (!cancelled) setNewArrivals([]);
      } finally {
        if (!cancelled) setNewArrivalsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [categoryResolved, rootId]);

  // More to Explore
  useEffect(() => {
    if (!categoryResolved) return;
    let cancelled = false;

    (async () => {
      setExploreLoading(true);
      try {
        const categoryId = exploreCatId || rootId || undefined;
        const res = await getProducts({
          category_id: categoryId,
          search: categoryId ? undefined : "footwear",
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
  }, [categoryResolved, rootId, exploreCatId]);

  const loadMoreExplore = async () => {
    if (exploreLoading || !exploreHasMore) return;
    setExploreLoading(true);
    try {
      const categoryId = exploreCatId || rootId || undefined;
      const res = await getProducts({
        category_id: categoryId,
        search: categoryId ? undefined : "footwear",
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

  const footwearScopedShopUrl = useCallback(
    (opts = {}) => {
      const params = new URLSearchParams();
      if (opts.categoryId) {
        params.set("category_id", String(opts.categoryId));
      } else if (rootId) {
        params.set("category_id", String(rootId));
      }
      let search = opts.search ? String(opts.search).trim() : "";
      if (!params.has("category_id")) {
        const lower = search.toLowerCase();
        if (!lower.includes("footwear") && !lower.includes("shoe")) {
          search = search ? `footwear ${search}` : "footwear";
        } else if (!search) {
          search = "footwear";
        }
      }
      if (search) params.set("search", search);
      if (opts.sort) params.set("sort", String(opts.sort));
      if (opts.newArrivals) params.set("new_arrivals", "true");
      const qs = params.toString();
      return qs ? `/shop?${qs}` : "/shop?search=footwear";
    },
    [rootId]
  );

  const findSubcatByLabel = useCallback(
    (label) => {
      const needle = String(label || "")
        .toLowerCase()
        .replace(/&/g, " ")
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
      if (!needle || !subcats.length) return null;
      const exact = subcats.find((c) => c.name.toLowerCase().trim() === needle);
      if (exact) return exact;
      return (
        subcats.find((c) => {
          const name = c.name.toLowerCase();
          return name.includes(needle) || needle.includes(name);
        }) || null
      );
    },
    [subcats]
  );

  const categoryStripItems = useMemo(() => {
    if (subcats.length) {
      return subcats.map((cat) => {
        const image = resolveImageUrl(cat.image) || getCategoryImage(cat.name) || "";
        return {
          id: cat.id,
          label: cat.name,
          image,
          to: footwearScopedShopUrl({ categoryId: cat.id }),
        };
      });
    }
    return FOOTWEAR_CATEGORY_FALLBACK.map((item) => {
      const match = findSubcatByLabel(item.label);
      return {
        id: match?.id || `fallback-${item.label}`,
        label: item.label,
        icon: item.icon || MdGridView,
        image: match ? resolveImageUrl(match.image) || getCategoryImage(match.name) || "" : "",
        to: match
          ? footwearScopedShopUrl({ categoryId: match.id })
          : footwearScopedShopUrl({ search: item.label }),
      };
    });
  }, [subcats, footwearScopedShopUrl, findSubcatByLabel]);

  const exploreChips = useMemo(() => [{ id: "", name: "All" }, ...subcats], [subcats]);

  // Deals of the Day — same ranking + daily rotation as Home
  const topDeals = useMemo(() => {
    const list = Array.isArray(deals) ? deals : [];
    const enriched = list.map((item) => {
      const price = Number(item?.discount_price ?? item?.price ?? item?._price ?? 0);
      const mrp = Number(item?.price ?? item?._mrp ?? item?.original_price ?? price);
      const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
      return { ...item, _discount: discount };
    });

    const discountedOnly = enriched.filter((item) => item._discount > 0);
    const ranked = [...discountedOnly].sort((a, b) => b._discount - a._discount);
    const pool = ranked.slice(0, Math.max(30, Math.min(80, ranked.length)));
    return seededShuffle(pool, todaysSeed()).slice(0, 30);
  }, [deals]);

  // Only brands that appear on footwear products
  const footwearBrands = useMemo(() => {
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

  const slide = HERO_SLIDES[heroIndex];
  const heroDestination = heroIndex === 2
    ? footwearScopedShopUrl({ sort: "newest", newArrivals: true })
    : footwearScopedShopUrl();

  const filtersPanel = (
    <section className="footwear-filters-panel" role="dialog" aria-label="Footwear filters">
      <div className="footwear-filters-panel-header">
        <h3>Filters</h3>
        <div className="footwear-filters-panel-actions">
          {activeFilterCount > 0 ? (
            <button type="button" className="footwear-filters-clear" onClick={clearAllFilters}>
              Clear All
            </button>
          ) : null}
          <button
            type="button"
            className="footwear-filters-close"
            aria-label="Close filters"
            onClick={() => setFilterOpen(false)}
          >
            <MdClose />
          </button>
        </div>
      </div>

      <div className="footwear-filter-col">
        <h4>Brand</h4>
        <input
          className="footwear-filter-search"
          value={brandSearch}
          onChange={(e) => setBrandSearch(e.target.value)}
          placeholder="Search brand"
        />
        <div className="footwear-filter-list">
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

      <div className="footwear-filter-col">
        <h4>Color</h4>
        <div className="footwear-filter-list footwear-filter-swatches">
          {COLORS.map(([name, hex]) => {
            const checked = activeColor.includes(name.toLowerCase()) || activeColor.includes(name);
            return (
              <label key={name} className={`footwear-swatch-label${checked ? " checked" : ""}`}>
                <input type="checkbox" checked={checked} onChange={() => toggleColorFilter(name)} />
                <span className="footwear-swatch-dot" style={{ background: hex }} />
                <span>{name}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div className="footwear-filter-col">
        <h4>Price</h4>
        <input
          type="range"
          min="500"
          max="100000"
          step="500"
          value={maxPrice}
          onChange={(e) => setMaxPrice(Number(e.target.value))}
        />
        <p>Up to ₹{maxPrice.toLocaleString("en-IN")}</p>
      </div>

      <div className="footwear-filter-col">
        <h4>Discount Range</h4>
        <div className="footwear-filter-discount-chips">
          {DISCOUNT_BUCKETS.map((value) => (
            <button
              key={value}
              type="button"
              className={`footwear-filter-chip-item${minDiscount === value ? " active" : ""}`}
              onClick={() => selectMinDiscount(value)}
            >
              {value}% and above
            </button>
          ))}
        </div>
      </div>

      <div className="footwear-filter-col">
        <h4>Availability</h4>
        <div className="footwear-filter-list">
          <label>
            <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} />
            <span>In stock only</span>
          </label>
        </div>
      </div>

      <div className="footwear-filters-footer">
        <button type="button" className="footwear-filters-apply" onClick={applyFilters}>
          Apply Filters
        </button>
      </div>
    </section>
  );
  void filtersPanel;

  return (
    <div className={`catalog-page footwear-page${!categoryResolved ? " footwear-loading" : ""}`}>
      {!categoryResolved && <Loader overlay />}
      <PageSEO
        title="Footwear — Sneakers, Boots, Sandals & More"
        description="Shop sneakers, boots, sandals and formal shoes at Blinkiefash — delivered fast across Odisha."
        path="/footwear"
      />

      <div className="footwear-top-strip">
        <div className="footwear-top-strip-inner">
          {TOP_STRIP_ITEMS.map((item) => (
            <span className="footwear-top-strip-item" key={item.label}>
              <item.icon />
              <span>{item.label}</span>
            </span>
          ))}
        </div>
      </div>

      <Navbar activeTab="Footwear" />

      <main className="footwear-main">
        <section
          className="footwear-hero-carousel"
          aria-label="Footwear highlights"
          onTouchStart={handleHeroTouchStart}
          onTouchMove={handleHeroTouchMove}
          onTouchEnd={handleHeroTouchEnd}
        >
          <button
            type="button"
            className="footwear-hero-arrow prev"
            aria-label="Previous slide"
            onClick={() => goToHeroSlide((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          >
            <MdChevronLeft />
          </button>

          <button type="button" className="footwear-hero-media-btn" onClick={() => navigate(heroDestination)}>
            <picture>
              {slide.mobileImage ? (
                <source media="(max-width: 767px)" srcSet={slide.mobileImage} />
              ) : null}
              <img src={slide.image} alt={slide.tag} className="footwear-hero-img" draggable={false} />
            </picture>
          </button>

          <button
            type="button"
            className="footwear-hero-arrow next"
            aria-label="Next slide"
            onClick={() => goToHeroSlide((i) => (i + 1) % HERO_SLIDES.length)}
          >
            <MdChevronRight />
          </button>

          <div className="footwear-hero-dots">
            {HERO_SLIDES.map((s, idx) => (
              <button
                key={s.tag}
                type="button"
                className={`footwear-hero-dot${idx === heroIndex ? " active" : ""}`}
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => goToHeroSlide(idx)}
              />
            ))}
          </div>
        </section>

        {/* ========== DEALS OF THE DAY (Home-style + timer) ========== */}
        {topDeals.length > 0 && (
          <section className="section footwear-picks-section">
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
              <div className="footwear-section-actions">
                <button
                  type="button"
                  className="hp-shead-action"
                  onClick={() => navigate(rootId ? `/deals-of-the-day?category_id=${encodeURIComponent(rootId)}` : "/deals-of-the-day")}
                >
                  View All <MdChevronRight />
                </button>
                <button
                  type="button"
                  className={`footwear-filter-btn${filterOpen || activeFilterCount ? " is-active" : ""}`}
                  onClick={() => {
                    // Reopening should reflect what's actually applied, not
                    // whatever was left half-edited the last time it was closed.
                    if (!filterOpen) {
                      setActiveBrand(appliedFilters.brand);
                      setActiveColor(appliedFilters.color);
                      setActiveGender(appliedFilters.gender);
                      setMinDiscount(appliedFilters.minDiscount);
                      setInStockOnly(appliedFilters.inStockOnly);
                      setMaxPrice(appliedFilters.maxPrice);
                    }
                    setFilterOpen((o) => !o);
                  }}
                >
                  <MdFilterList /> Filters{activeFilterCount ? ` (${activeFilterCount})` : ""}
                </button>
              </div>
            </div>

            {filterOpen ? (
              <Filter
                prefix="footwear"
                ariaLabel="Footwear filters"
                brands={brands}
                visibleBrands={visibleBrands}
                activeBrand={activeBrand}
                setActiveBrand={setActiveBrand}
                activeColor={activeColor}
                setActiveColor={setActiveColor}
                availableGenders={["Men", "Women", "Kids", "Unisex"]}
                activeGender={activeGender}
                setActiveGender={setActiveGender}
                minDiscount={minDiscount}
                setMinDiscount={setMinDiscount}
                inStockOnly={inStockOnly}
                setInStockOnly={setInStockOnly}
                maxPrice={maxPrice}
                setMaxPrice={setMaxPrice}
                brandSearch={brandSearch}
                setBrandSearch={setBrandSearch}
                activeFilterCount={activeFilterCount}
                clearAllFilters={clearAllFilters}
                applyFilters={applyFilters}
                onClose={() => setFilterOpen(false)}
                colors={COLORS}
                discountBuckets={DISCOUNT_BUCKETS}
              />
            ) : null}

            <ProductRail list={applyProductFilters(topDeals)} railRef={dealsRef} keyPrefix="footwear-deal" />
          </section>
        )}

        {/* ========== BRANDS YOU WILL LOVE (under Deals, footwear-only brands) ========== */}
        {footwearBrands.length > 0 && (
          <section className="section hp-shop-brands-section footwear-brands-section" aria-label="Brands you will love">
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
              <button type="button" className="hp-shead-action" onClick={() => navigate(footwearScopedShopUrl())}>
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
                {footwearBrands.map((brand, idx) => {
                  const label = (brand.name || "").toString().trim();
                  const displayName = label || "Brand";
                  const logo = resolveImageUrl(brand.logo_url || brand.image);
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
                          <img src={logo} alt={displayName} loading="lazy" className="hp-shop-brand-logo" />
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

        {/* All Footwear Picks */}
        <section className="section footwear-picks-section">
          <div className="hp-section-head">
            <h2>ALL FOOTWEAR PICKS 👟</h2>
            <button type="button" onClick={() => navigate(footwearScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>
          {productsLoading ? (
            <Loader />
          ) : products.length ? (
            <ProductRail list={applyProductFilters(products)} railRef={trendingRef} keyPrefix="footwear-all" />
          ) : (
            <p className="footwear-empty-state">New footwear is landing soon.</p>
          )}
        </section>

        {/* Categories */}
        <section className="footwear-cat-strip" aria-label="Shop by category">
          <div className="footwear-cat-list">
            {categoryStripItems.map((cat) => (
              <button key={cat.id} type="button" className="footwear-cat-item" onClick={() => navigate(cat.to)}>
                <span className="footwear-cat-icon-wrap">
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
                  <span className="footwear-cat-fallback-icon" style={cat.image ? { display: "none" } : undefined}>
                    {cat.icon ? <cat.icon /> : <MdGridView />}
                  </span>
                </span>
                <span className="footwear-cat-label">{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* New arrivals — genuinely newest footwear products (Home-style pool) */}
        <section className="section footwear-picks-section">
          <div className="hp-section-head">
            <h2>NEW ARRIVALS 👟</h2>
            <button type="button" onClick={() => navigate(footwearScopedShopUrl({ search: "newest" }))}>
              View All <MdChevronRight />
            </button>
          </div>
          {newArrivalsLoading ? (
            <Loader />
          ) : newArrivals.length ? (
            <ProductRail
              list={applyProductFilters(newArrivals)}
              railRef={arrivalsRef}
              keyPrefix="footwear-new"
              isNew
            />
          ) : (
            <p className="footwear-empty-state">Fresh footwear coming soon.</p>
          )}
        </section>

        {/* More to Explore */}
        <section className="section footwear-explore-section" aria-label="More to explore">
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
            <p className="footwear-empty-state">No products in this category yet.</p>
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

        <section className="footwear-trust-strip" aria-label="Why shop with us">
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
              <strong>100% Genuine</strong>
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