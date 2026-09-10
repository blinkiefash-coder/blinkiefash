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

// changes 

import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Loader from "../components/Loader";
import PageSEO from "../components/PageSEO";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import Filter from "../components/filter";
import { getProducts, getCategories, getBrands, getBestsellers } from "../api";
import { getCategoryImage } from "../utils/categoryImages";
import { API_BASE_URL } from "../apiBase";
import menBanner1 from "../assets/men-banner-1.png";
import menBanner2 from "../assets/men-banner-2.png";
import menBanner3 from "../assets/men-banner-3.png";
import traditionalBanner from "../assets/traditional.jpeg";
// import playAndWinImage from "../assets/play&win.png";
// import spinAndWinImage from "../assets/spin&win.png";
// import referAndEarnImage from "../assets/refer&earn.png";
// import freeDeliveryImage from "../assets/freedelivery.png";
import dealsOfTheDayIcon from "../assets/dealsoftheday.png";
import shopByBrandIcon from "../assets/shopbybrand.png";
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

const NIKE_LOGO_URL = "https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg";

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
  { icon: MdTwoWheeler, label: "Fast Delivery" },
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

function uniqueProducts(list) {
  const seen = new Set();
  return (list || []).filter((product) => {
    const key = product?.id || product?.product_id || product?.variant_id;
    if (!key || seen.has(String(key))) return false;
    seen.add(String(key));
    return true;
  });
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
        {uniqueProducts(list).map((p, idx) => (
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

export default function Men() {
  const navigate = useNavigate();

  const [products, setProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [deals, setDeals] = useState([]);
  const [festiveFits, setFestiveFits] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [menRootId, setMenRootId] = useState(null);
  const [menSubcats, setMenSubcats] = useState([]);
  const [menResolved, setMenResolved] = useState(false);
  const [productsRefreshKey, setProductsRefreshKey] = useState(0);
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

  // appliedFilters is what actually filters the product rails. activeBrand /
  // activeColor / etc. above are just the draft values the filter panel's
  // checkboxes and sliders are bound to — they don't affect the grid until
  // "Apply Filters" is pressed (mirrors the Shop page behavior).
  const [appliedFilters, setAppliedFilters] = useState({
    brand: [],
    color: [],
    minDiscount: 0,
    inStockOnly: false,
    maxPrice: 10000,
  });

  const [dealsCountdown, setDealsCountdown] = useState(() => formatCountdown(getMsUntilMidnight()));

  const normalizeText = (value) => String(value || "").trim().toLowerCase();

  // Reflects what's actually filtering the grid right now (appliedFilters),
  // not whatever's mid-edit in the still-open panel.
  const activeFilterCount =
    appliedFilters.brand.length +
    appliedFilters.color.length +
    (appliedFilters.minDiscount > 0 ? 1 : 0) +
    (appliedFilters.inStockOnly ? 1 : 0) +
    (appliedFilters.maxPrice < 10000 ? 1 : 0);

  const clearAllFilters = () => {
    setActiveBrand([]);
    setActiveColor([]);
    setMinDiscount(0);
    setInStockOnly(false);
    setMaxPrice(10000);
    setBrandSearch("");
    setAppliedFilters({
      brand: [],
      color: [],
      minDiscount: 0,
      inStockOnly: false,
      maxPrice: 10000,
    });
  };

  const applyFilters = () => {
    setAppliedFilters({
      brand: activeBrand,
      color: activeColor,
      minDiscount,
      inStockOnly,
      maxPrice,
    });
    setFilterOpen(false);
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
  const festiveRef = useRef(null);
  const shopBrandsRef = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setDealsCountdown(formatCountdown(getMsUntilMidnight()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const refreshProducts = () => {
      if (document.visibilityState === "visible") {
        setProductsRefreshKey((key) => key + 1);
      }
    };
    const refreshInterval = window.setInterval(refreshProducts, 60_000);

    window.addEventListener("focus", refreshProducts);
    document.addEventListener("visibilitychange", refreshProducts);
    return () => {
      window.clearInterval(refreshInterval);
      window.removeEventListener("focus", refreshProducts);
      document.removeEventListener("visibilitychange", refreshProducts);
    };
  }, []);

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

  useEffect(() => {
    if (!menResolved) return;
    let cancelled = false;

    (async () => {
      setProductsLoading(true);
      let found = [];
      let dealList;

      if (menRootId) {
        try {
          let offset = 0;
          while (true) {
            const byCategory = await getProducts({
              category_id: menRootId,
              sort: "newest",
              limit: 100,
              offset,
            });
            const page = extractProducts(byCategory);
            found.push(...page);
            if (page.length < 100) break;
            offset += page.length;
          }
        } catch {
          found = [];
        }
      }

      if (!found.length && menRootId) {
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
        setNewArrivals(normalized);
        setDeals(dealList.map(normalizeProduct).slice(0, 12));
        setProductsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [menResolved, menRootId, menSubcats, productsRefreshKey]);

  useEffect(() => {
    if (!menResolved) return;
    let cancelled = false;

    (async () => {
      const searchTerms = ["festive", "kurta", "ethnic wear"];
      let found = [];

      for (const search of searchTerms) {
        try {
          const response = await getProducts({
            category_id: menRootId || undefined,
            search,
            sort: "newest",
            limit: 8,
          });
          found = extractProducts(response);
          if (found.length) break;
        } catch {
          // Try the next festive search term.
        }
      }

      if (!found.length && menRootId) {
        try {
          const fallback = await getProducts({
            category_id: menRootId,
            sort: "newest",
            limit: 8,
          });
          found = extractProducts(fallback);
        } catch {
          found = [];
        }
      }

      if (!cancelled) setFestiveFits(found.map(normalizeProduct).slice(0, 8));
    })();

    return () => {
      cancelled = true;
    };
  }, [menResolved, menRootId]);

  useEffect(() => {
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);

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

  const menKurtaShopUrl = useCallback(() => {
    const kurtaCategory = findMenSubcatByLabel("kurta");
    return kurtaCategory
      ? menScopedShopUrl({ categoryId: kurtaCategory.id })
      : menScopedShopUrl({ search: "kurta" });
  }, [findMenSubcatByLabel, menScopedShopUrl]);

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

  const exploreChips = useMemo(() => [{ id: "", name: "All" }, ...menSubcats], [menSubcats]);

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

  // Only brands that appear on men's products
  const menBrands = useMemo(() => {
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

  return (
    <div className={`catalog-page men-page${!menResolved ? " men-loading" : ""}`}>
      {!menResolved && <Loader overlay />}
      <PageSEO
        title="Men's Fashion — Shirts, T-Shirts, Jeans & More | Blinkiefash India"
        description="Shop the latest men's fashion at Blinkiefash India — t-shirts, shirts, jeans, footwear, watches, jackets and more, delivered fast across India."
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

        {/* ========== DEALS OF THE DAY (Home-style + timer) ========== */}
        {topDeals.length > 0 && (
          <section className="section men-picks-section">
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
              <div className="men-section-actions">
                <button type="button" className="hp-shead-action" onClick={() => navigate(menScopedShopUrl())}>
                  View All <MdChevronRight />
                </button>
                <button
                  type="button"
                  className={`men-filter-btn${filterOpen || activeFilterCount ? " is-active" : ""}`}
                  onClick={() => {
                    // Reopening should reflect what's actually applied, not
                    // whatever was left half-edited the last time it was closed.
                    if (!filterOpen) {
                      setActiveBrand(appliedFilters.brand);
                      setActiveColor(appliedFilters.color);
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

            {filterOpen && (
              <Filter
                prefix="men"
                ariaLabel="Men filters"
                brands={brands}
                visibleBrands={visibleBrands}
                activeBrand={activeBrand}
                setActiveBrand={setActiveBrand}
                activeColor={activeColor}
                setActiveColor={setActiveColor}
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
            )}

            <ProductRail list={applyProductFilters(topDeals)} railRef={dealsRef} keyPrefix="men-deal" />
          </section>
        )}

        {/* ========== BRANDS YOU WILL LOVE (under Deals, men-only brands, 1 row) ========== */}
        {menBrands.length > 0 && (
          <section className="section hp-shop-brands-section men-brands-section" aria-label="Brands you will love">
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
              <button type="button" className="hp-shead-action" onClick={() => navigate(menScopedShopUrl())}>
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
                {menBrands.map((brand, idx) => {
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

        {festiveFits.length > 0 && (
          <section className="section men-festive-section" aria-labelledby="men-festive-title">
            <button
              type="button"
              className="men-festive-banner"
              onClick={() => navigate(menKurtaShopUrl())}
            >
              <img src={traditionalBanner} alt="Men's festive fashion" className="men-festive-image" />
            </button>

            <div className="men-festive-heading">
              <div>
                <h2>FESTIVE FITS</h2>
                <p>Traditional styles for modern celebrations</p>
              </div>
              <button type="button" onClick={() => navigate(menKurtaShopUrl())}>
                View All <MdChevronRight />
              </button>
            </div>
            <ProductRail list={applyProductFilters(festiveFits)} railRef={festiveRef} keyPrefix="men-festive" />
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

        {/* Offers */}
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
            <MdTwoWheeler style={{ fontSize: 28 }} />
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
            <ProductRail
              list={applyProductFilters(newArrivals)}
              railRef={arrivalsRef}
              keyPrefix="men-new"
              isNew
            />
          ) : (
            <p className="men-empty-state">Fresh styles coming soon.</p>
          )}
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
              {uniqueProducts(exploreProducts).map((p, idx) => (
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