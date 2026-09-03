import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdSearch,
  MdLocationOn,
  MdKeyboardArrowDown,
  MdPersonOutline,
  MdFavoriteBorder,
  MdOutlineShoppingCart,
  MdChevronLeft,
  MdChevronRight,
  MdSettings,
  MdCheckroom,
  MdDryCleaning,
  MdWaterDrop,
  MdOutlineWork,
  MdSnowing,
  MdDirectionsRun,
  MdWatch,
  MdVisibility,
  MdSportsHandball,
  MdBackpack,
  MdSpa,
  MdStyle,
  MdLocalOffer,
  MdBolt,
  MdAutorenew,
  MdVerifiedUser,
  MdSecurity,
  MdSupportAgent,
  MdArrowForward,
  MdGridView,
  MdLocalShipping,
  MdVerified,
  MdCached,
  MdPayments,
  MdMyLocation,
} from "react-icons/md";

import Footer from "../components/Footer";
import PageSEO from "../components/PageSEO";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { getProducts, getCategories, getBrands, getBestsellers } from "../api";
import { getCategoryImage } from "../utils/categoryImages";
import { API_BASE_URL } from "../apiBase";
import menBanner1 from "../assets/men-banner-1.png";
import menBanner2 from "../assets/men-banner-2.png";
import menBanner3 from "../assets/men-banner-3.png";
import "./Shop.css";
import "./Home.css";
import "./Men.css";

const PRODUCTS_PAGE_SIZE = 8;

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
// "men" as a substring) the same way Home.jsx's collection rails do.
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

const MEN_CATEGORY_FALLBACK_LABELS = [
  "T-Shirts",
  "Shirts",
  "Jeans",
  "Trousers",
  "Jackets",
  "Footwear",
  "Watches",
  "Accessories",
  "Sportswear",
  "Innerwear",
  "Bags & Wallets",
  "Perfumes",
  "Ethnic Wear",
];

const CATEGORY_ICONS = [
  MdCheckroom,
  MdDryCleaning,
  MdStyle,
  MdOutlineWork,
  MdSnowing,
  MdDirectionsRun,
  MdWatch,
  MdVisibility,
  MdSportsHandball,
  MdWaterDrop,
  MdBackpack,
  MdSpa,
  MdCheckroom,
];

const TOP_NAV = [
  { label: "Men", to: "/men" },
  { label: "Women", to: "/women" },
  { label: "Kids", to: "/kids" },
  { label: "Home", to: "/shop?search=Home" },
  { label: "Beauty", to: "/shop?search=Beauty" },
  { label: "Accessories", to: "/shop?search=Accessories" },
  { label: "Footwear", to: "/footwear" },
  { label: "Bags", to: "/shop?search=Bags" },
  { label: "Jewellery", to: "/shop?search=Jewellery" },
  { label: "Travel", to: "/shop?search=Travel" },
  { label: "Home Decor", to: "/shop?search=Home%20Decor" },
];

// Used only if the backend has no brands yet, so the section never sits empty.
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

/** Utility strip items — rendered as the top bar above the header */
const utilityItems = [
  { icon: MdLocalShipping, label: "Delivered in 60 Minutes" },
  { icon: MdVerified, label: "100% Authentic Products" },
  { icon: MdCached, label: "Easy Returns" },
  { icon: MdPayments, label: "Cash on Delivery" },
  { icon: MdMyLocation, label: "Track Your Order" },
];

/** The three large reward promo cards (Spin / Play / Refer) */
const heroPromoCards = [
  {
    title: "SPIN & WIN",
    subtitle: "Spin the wheel & win exciting rewards!",
    highlight: "Up To ₹500 OFF",
    accent: "green",
    action: "SPIN NOW",
    icon: "🎡",
    to: "/spin-wheel",
  },
  {
    title: "PLAY & WIN",
    subtitle: "Play fun games & win big discounts!",
    highlight: "Up To ₹250 OFF",
    accent: "purple",
    action: "PLAY NOW",
    icon: "🎮",
    to: "/play-and-win",
  },
  {
    title: "REFER & EARN",
    subtitle: "Refer your friend & you both get ₹100 off!",
    highlight: "Use code: BLINK100",
    accent: "pink",
    action: "REFER NOW",
    icon: "🎁",
    to: "/refer-earn",
  },
];

/** The two small stacked offer cards that share the fourth grid column */
const miniPromoCards = [
  {
    title: "FLAT 5% OFF",
    subtitle: "ON FIRST ORDER",
    highlight: "Use Code: WELCOME5",
    accent: "cream",
    to: "/shop",
    badge: true,
  },
  {
    title: "FREE DELIVERY",
    subtitle: "ON ORDERS ABOVE",
    highlight: "₹1499",
    accent: "blue",
    to: "/shop",
  },
];

// Matches ProductCard's expected shape: price = MRP, discount_price = sale
// price, plus the optional flags it reads (is_bestseller, is_try_and_buy).
function normalizeProduct(p) {
  const salePrice = Number(p.discount_price ?? p.price ?? 0);
  const originalPrice = Number(p.price ?? p.original_price ?? salePrice);
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
    is_bestseller: p.is_bestseller ?? false,
    is_try_and_buy: p.is_try_and_buy ?? false,
    isNew: p.is_new ?? p.isNew ?? false,
  };
}

// Banner images for the hero slideshow.
const MEN_BANNERS = [menBanner1, menBanner2, menBanner3];

function heroBannerStyle(url) {
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

export default function Men() {
  const navigate = useNavigate();
  const { user, isLoggedIn: authLoggedIn } = useAuth();
  const { count: cartCount } = useCart();
  const { items: wishlistItems } = useWishlist();

  const city =
    localStorage.getItem("bfw_city") ||
    localStorage.getItem("selectedCity") ||
    "Cuttack";
  const isLoggedIn =
    authLoggedIn ||
    Boolean(localStorage.getItem("userUuid") || localStorage.getItem("token"));
  const headerUserName = String(
    user?.name || localStorage.getItem("userName") || ""
  ).trim();
  const headerFirstName = headerUserName
    ? headerUserName.split(/\s+/)[0]
    : "";
  const accountLabel = isLoggedIn
    ? headerFirstName
      ? `Hi, ${headerFirstName}`
      : "My Account"
    : "Login / Signup";

  const [searchInput, setSearchInput] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsOffset, setProductsOffset] = useState(0);
  const [productsHasMore, setProductsHasMore] = useState(false);
  const [productsLoadingMore, setProductsLoadingMore] = useState(false);
  const [dealsOfDay, setDealsOfDay] = useState([]);
  const [dealsLoading, setDealsLoading] = useState(true);
  const [menRootId, setMenRootId] = useState(null);
  const [menSubcats, setMenSubcats] = useState([]);
  const [menResolved, setMenResolved] = useState(false);
  const [brands, setBrands] = useState([]);
  const [heroSlide, setHeroSlide] = useState(0);
  const picksRailRef = useRef(null);
  const dealsRailRef = useRef(null);

  // Resolve the real "Men" category from the DB category tree first.
  useEffect(() => {
    let cancelled = false;

    (async () => {
      let allCats = [];
      try {
        const catRes = await getCategories();
        if (Array.isArray(catRes)) {
          allCats = catRes;
        }
      } catch {
        // keep allCats as []
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

  // Pull real brand logos from the backend for "Top Brands You Love".
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

  // Deals of the Day — same bestsellers endpoint Home uses,
  // filtered to Men only; falls back to men-scoped products if needed.
  useEffect(() => {
    if (!menResolved) return;
    let cancelled = false;

    (async () => {
      setDealsLoading(true);

      const menCategoryIds = new Set(
        [menRootId, ...menSubcats.map((c) => c.id)]
          .filter((id) => id !== null && id !== undefined)
          .map(String)
      );

      const belongsToMen = (p) => {
        const catId = p?.category_id ?? p?.categoryId ?? p?.category?.id;
        if (
          catId !== undefined &&
          catId !== null &&
          menCategoryIds.has(String(catId))
        ) {
          return true;
        }
        const hay = `${p?.category_name || ""} ${p?.name || ""} ${
          p?.brand || ""
        } ${p?.gender || ""}`.toLowerCase();
        if (/\bwomen'?s?\b|\bkids?\b|\bgirls?\b/.test(hay)) return false;
        return /\bmen'?s?\b|\bmale\b/.test(hay);
      };

      const rankAndSlice = (list) =>
        list
          .map((p) => {
            const price = Number(p.discount_price ?? p.price ?? 0);
            const mrp = Number(p.price ?? p.original_price ?? price);
            const discount =
              mrp > price && mrp > 0
                ? Math.round(((mrp - price) / mrp) * 100)
                : 0;
            return { ...p, _discount: discount };
          })
          .sort((a, b) => b._discount - a._discount)
          .slice(0, 8)
          .map(normalizeProduct);

      // NOTE: `found` is intentionally not reset to [] in the catch blocks
      // below — it's already [] from this initial declaration, so
      // reassigning it there was a no-op flagged by no-useless-assignment.
      let found = [];

      try {
        const res = await getBestsellers(40);
        found = extractProducts(res).filter(belongsToMen);
      } catch (err) {
        console.warn("[Men] getBestsellers failed:", err);
      }

      // Fallback: men category products ranked by discount
      if (!found.length && menRootId) {
        try {
          const byCat = await getProducts({
            category_id: menRootId,
            sort: "newest",
            limit: 20,
          });
          found = extractProducts(byCat);
        } catch (err) {
          console.warn("[Men] men products fallback failed:", err);
        }

        if (!found.length && menSubcats.length) {
          try {
            const perSub = await Promise.all(
              menSubcats.slice(0, 6).map((sub) =>
                getProducts({
                  category_id: sub.id,
                  sort: "newest",
                  limit: 4,
                }).catch(() => [])
              )
            );
            found = perSub.flatMap(extractProducts);
          } catch {
            // found stays [] from the initial declaration
          }
        }
      }

      if (!cancelled) {
        setDealsOfDay(rankAndSlice(found));
        setDealsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [menResolved, menRootId, menSubcats]);

  // Initial men products (Trending Now + Show More)
  useEffect(() => {
    if (!menResolved) return;
    let cancelled = false;

    (async () => {
      setProductsLoading(true);
      setProductsOffset(0);
      setProductsHasMore(false);

      let found = [];

      if (menRootId) {
        try {
          const byCategory = await getProducts({
            category_id: menRootId,
            sort: "newest",
            limit: PRODUCTS_PAGE_SIZE,
            offset: 0,
          });
          found = extractProducts(byCategory);
        } catch {
          // found stays [] from the initial declaration
        }
      }

      if (!found.length && menRootId && menSubcats.length) {
        try {
          const perSub = await Promise.all(
            menSubcats.slice(0, 6).map((sub) =>
              getProducts({
                category_id: sub.id,
                sort: "newest",
                limit: 4,
                offset: 0,
              }).catch(() => [])
            )
          );
          found = perSub.flatMap(extractProducts);
        } catch {
          // found stays [] from the initial declaration
        }
      }

      if (!cancelled) {
        const slice = found.slice(0, PRODUCTS_PAGE_SIZE).map(normalizeProduct);
        setProducts(slice);
        setProductsOffset(slice.length);
        setProductsHasMore(found.length >= PRODUCTS_PAGE_SIZE);
        setProductsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [menResolved, menRootId, menSubcats]);

  const loadMoreProducts = async () => {
    if (productsLoadingMore || !productsHasMore || !menRootId) return;

    setProductsLoadingMore(true);
    try {
      const res = await getProducts({
        category_id: menRootId,
        sort: "newest",
        limit: PRODUCTS_PAGE_SIZE,
        offset: productsOffset,
      });
      const next = extractProducts(res).map(normalizeProduct);

      setProducts((prev) => {
        const seen = new Set(prev.map((p) => String(p.id)));
        const merged = [...prev];
        next.forEach((p) => {
          const key = String(p?.id || "");
          if (!key || seen.has(key)) return;
          seen.add(key);
          merged.push(p);
        });
        return merged;
      });

      setProductsOffset((prev) => prev + next.length);
      setProductsHasMore(next.length >= PRODUCTS_PAGE_SIZE);
    } catch {
      setProductsHasMore(false);
    } finally {
      setProductsLoadingMore(false);
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
      const exact = menSubcats.find(
        (c) => c.name.toLowerCase().trim() === needle
      );
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
        const image =
          resolveImageUrl(cat.image) || getCategoryImage(cat.name) || "";
        return {
          id: cat.id,
          label: cat.name,
          image,
          to: menScopedShopUrl({ categoryId: cat.id }),
        };
      });
    }
    return MEN_CATEGORY_FALLBACK_LABELS.map((label, idx) => {
      const match = findMenSubcatByLabel(label);
      return {
        id: match?.id || `fallback-${label}`,
        label,
        icon: CATEGORY_ICONS[idx] || MdGridView,
        image: match
          ? resolveImageUrl(match.image) ||
            getCategoryImage(match.name) ||
            ""
          : "",
        to: match
          ? menScopedShopUrl({ categoryId: match.id })
          : menScopedShopUrl({ search: label }),
      };
    });
  }, [menSubcats, menScopedShopUrl, findMenSubcatByLabel]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const value = searchInput.trim();
    if (!value) {
      navigate(menScopedShopUrl());
      return;
    }
    navigate(menScopedShopUrl({ search: value }));
  };

  const scrollPicks = (dir) => {
    const el = picksRailRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  const scrollDeals = (dir) => {
    const el = dealsRailRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  const goHeroSlide = (dir) => {
    setHeroSlide(
      (cur) => (cur + dir + MEN_BANNERS.length) % MEN_BANNERS.length
    );
  };

  const wishlistCount = wishlistItems?.length || 0;

  return (
    <div className="catalog-page men-page">
      <PageSEO
        title="Men's Fashion — Shirts, T-Shirts, Jeans & More | Blinkiefash India"
        description="Shop the latest men's fashion at Blinkiefash India — t-shirts, shirts, jeans, footwear, watches, jackets and more, delivered in 60 minutes across India."
        path="/men"
      />

      {/* Utility strip */}
      <div className="men-utility-strip" aria-label="Store benefits">
        {utilityItems.map((item) => (
          <div key={item.label} className="men-utility-item">
            <span className="men-utility-icon" aria-hidden="true">
              <item.icon />
            </span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>

      <div className="hp-sticky-head catalog-home-topbar">
        <header className="hp-main-header catalog-main-header">
          <button
            type="button"
            className="hp-brand"
            onClick={() => navigate("/")}
          >
            <img
              src="https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg"
              alt="Blinkiefash"
              className="hp-logo"
            />
            <span className="hp-brand-text">
              <span className="hp-brand-name">
                BLINKIE<span className="hp-brand-accent">FASH</span>
              </span>
              <span className="hp-tagline">DELIVERED IN 60 MINUTES</span>
            </span>
          </button>

          <form
            className="hp-header-search catalog-mobile-search"
            onSubmit={handleSearchSubmit}
          >
            <MdSearch className="hp-search-icon" />
            <input
              name="q"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search for men's clothing, shoes, accessories & more..."
            />
            <button
              type="submit"
              className="hp-search-btn"
              aria-label="Search products"
            >
              <MdSearch />
            </button>
          </form>

          <div className="catalog-header-actions-wrap">
            <button
              type="button"
              className="catalog-location-pill"
              onClick={() => navigate("/account")}
            >
              <MdLocationOn />
              <span className="men-location-copy">
                <small>Delivering to</small>
                <strong>{city}</strong>
              </span>
              <MdKeyboardArrowDown />
            </button>

            <div className="hp-header-actions">
              <button
                type="button"
                onClick={() => navigate(isLoggedIn ? "/account" : "/login")}
              >
                <MdPersonOutline />
                <span>{accountLabel}</span>
              </button>
              <button type="button" onClick={() => navigate("/wishlist")}>
                <MdFavoriteBorder />
                <span>Wishlist</span>
                {wishlistCount > 0 ? (
                  <span className="hp-icon-badge">{wishlistCount}</span>
                ) : null}
              </button>
              <button type="button" onClick={() => navigate("/cart")}>
                <MdOutlineShoppingCart />
                <span>Cart</span>
                {cartCount > 0 ? (
                  <span className="hp-icon-badge">{cartCount}</span>
                ) : null}
              </button>
            </div>
          </div>
        </header>

        <nav className="hp-category-nav men-topnav">
          <div className="hp-nav-links">
            {TOP_NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`hp-nav-link${
                  item.label === "Men" ? " active" : ""
                }`}
                onClick={() => navigate(item.to)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="men-nav-offers"
            onClick={() => navigate("/offers")}
          >
            <MdSettings /> Offers
          </button>
        </nav>
      </div>

      <main className="men-main">
        <div className="men-breadcrumb">
          <button type="button" onClick={() => navigate("/")}>
            Home
          </button>
          <span>›</span>
          <span className="current">Men</span>
        </div>

        {/* Mode switcher: India (this page) vs Local */}
        <section className="men-mode-row" aria-label="Store modes">
          <button
            type="button"
            className="men-mode-card men-mode-selected"
            onClick={() => navigate("/men")}
          >
            <span className="men-mode-icon">🌐</span>
            <span className="men-mode-copy">
              <strong>BLINKIEFASH INDIA</strong>
              <small>Products from stores across India</small>
            </span>
          </button>

          <button
            type="button"
            className="men-mode-card men-mode-local"
            onClick={() => navigate("/blinkiefash-local")}
          >
            <span className="men-mode-icon">⚡</span>
            <span className="men-mode-copy">
              <strong>BLINKIEFASH LOCAL</strong>
              <small>Fast delivery from nearby stores</small>
            </span>
          </button>
        </section>

        {/* Hero — single banner, plain image with slide controls */}
        <section
          className="men-hero-banner"
          aria-label="Men's fashion highlights"
        >
          <button
            type="button"
            className="men-hero-arrow men-hero-arrow-prev"
            aria-label="Previous banner"
            onClick={() => goHeroSlide(-1)}
          >
            <MdChevronLeft />
          </button>

          <div
            className="men-hero-slide"
            style={heroBannerStyle(MEN_BANNERS[heroSlide])}
            onClick={() => navigate(menScopedShopUrl())}
            role="button"
            tabIndex={0}
            aria-label="Shop men's fashion"
          />

          <button
            type="button"
            className="men-hero-arrow men-hero-arrow-next"
            aria-label="Next banner"
            onClick={() => goHeroSlide(1)}
          >
            <MdChevronRight />
          </button>

          <div className="men-hero-dots">
            {MEN_BANNERS.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`men-hero-dot${
                  idx === heroSlide ? " active" : ""
                }`}
                aria-label={`Show banner ${idx + 1}`}
                onClick={() => setHeroSlide(idx)}
              />
            ))}
          </div>
        </section>

        {/* Category strip */}
        <section className="men-cat-strip" aria-label="Shop by category">
          <div className="men-cat-list">
            {categoryStripItems.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="men-cat-item"
                onClick={() => navigate(cat.to)}
              >
                <span className="men-cat-icon-wrap">
                  {cat.image ? (
                    <img
                      src={cat.image}
                      alt={cat.label}
                      onError={(event) => {
                        event.currentTarget.style.display = "none";
                        const fallback =
                          event.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = "inline-flex";
                      }}
                    />
                  ) : null}
                  <span
                    className="men-cat-fallback-icon"
                    style={cat.image ? { display: "none" } : undefined}
                  >
                    {cat.icon ? <cat.icon /> : <MdGridView />}
                  </span>
                </span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        {/* Promo grid — 3 reward cards + a stacked pair of smaller offers */}
        <section className="men-promo-grid" aria-label="Promotional offers">
          {heroPromoCards.map((card, index) => {
            const homeStyleClass = `men-home-reward-card ${
              index === 0
                ? "men-home-reward-spin"
                : index === 1
                  ? "men-home-reward-play"
                  : "men-home-reward-refer"
            }`;
            return (
              <article
                key={card.title}
                className={`men-promo-card-bfi men-promo-${card.accent} ${homeStyleClass}`}
                onClick={() => navigate(card.to)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(card.to);
                  }
                }}
              >
                <div className="men-promo-content">
                  <p className="men-promo-title-bfi">{card.title}</p>
                  <p className="men-promo-subtitle-bfi">{card.subtitle}</p>
                  <div className="men-promo-highlight-bfi">
                    {card.highlight}
                  </div>
                  <button
                    type="button"
                    className="men-promo-button-bfi"
                    onClick={(e) => {
                      e.stopPropagation();
                      navigate(card.to);
                    }}
                  >
                    {card.action}
                  </button>
                </div>
                <div className="men-promo-icon-bfi" aria-hidden="true">
                  {card.icon}
                </div>
              </article>
            );
          })}

          <div className="men-promo-mini-col">
            {miniPromoCards.map((card) => (
              <article
                key={card.title}
                className={`men-promo-mini men-promo-${card.accent}`}
                onClick={() => navigate(card.to)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    navigate(card.to);
                  }
                }}
              >
                <div className="men-promo-mini-copy">
                  <p className="men-promo-mini-title">{card.title}</p>
                  <p className="men-promo-mini-sub">{card.subtitle}</p>
                  {card.badge ? (
                    <span className="men-promo-code-badge">
                      {card.highlight}
                    </span>
                  ) : (
                    <p className="men-promo-mini-highlight">
                      {card.highlight}
                    </p>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Secondary promo strip (Prepaid / Brands / Delivery) */}
        <section className="men-promo-strip">
          <button
            type="button"
            className="men-promo-card men-promo-prepaid"
            onClick={() => navigate("/offers")}
          >
            <div>
              <p className="men-promo-title">Prepaid Order Offers</p>
              <p className="men-promo-sub">
                Extra savings when you pay online
              </p>
            </div>
            <MdLocalOffer className="men-promo-icon" />
          </button>

          <button
            type="button"
            className="men-promo-card men-promo-brands"
            onClick={() => navigate(menScopedShopUrl())}
          >
            <div>
              <p className="men-promo-title">Top Brand Discounts</p>
              <p className="men-promo-sub">
                Nike · Adidas · Puma &amp; more
              </p>
            </div>
            <span className="men-promo-cta">
              Shop Now <MdArrowForward />
            </span>
          </button>

          <button
            type="button"
            className="men-promo-card men-promo-delivery"
            onClick={() => navigate(menScopedShopUrl())}
          >
            <div>
              <p className="men-promo-title">Fast &amp; Free Delivery</p>
              <p className="men-promo-sub">
                On eligible orders, in 60 minutes
              </p>
            </div>
            <span className="men-promo-cta">
              Shop Now <MdArrowForward />
            </span>
          </button>
        </section>

        {/* Deals of the Day — scoped to Men only */}
        <section className="section men-picks-section">
          <div className="hp-section-head">
            <h2>Deals of the Day</h2>
            <button
              type="button"
              onClick={() => navigate(menScopedShopUrl())}
            >
              View All <MdChevronRight />
            </button>
          </div>

          {dealsLoading ? (
            <p className="men-empty-state">Loading today&apos;s best deals…</p>
          ) : dealsOfDay.length ? (
            <div className="hp-deals-wrap">
              <button
                type="button"
                className="hp-deals-prev"
                aria-label="Previous"
                onClick={() => scrollDeals(-1)}
              >
                <MdChevronLeft />
              </button>

              <div className="hp-deals-rail" role="list" ref={dealsRailRef}>
                {dealsOfDay.map((p, idx) => (
                  <div
                    key={`men-deal-${p.id}-${idx}`}
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
                onClick={() => scrollDeals(1)}
              >
                <MdChevronRight />
              </button>
            </div>
          ) : (
            <p className="men-empty-state">
              No deals live right now — check back soon.
            </p>
          )}
        </section>

        {/* Trending Now + Show More */}
        <section className="section men-picks-section">
          <div className="hp-section-head">
            <h2>Trending Now</h2>
            <button
              type="button"
              onClick={() => navigate(menScopedShopUrl())}
            >
              View All <MdChevronRight />
            </button>
          </div>

          {productsLoading ? (
            <p className="men-empty-state">Loading today&apos;s picks…</p>
          ) : products.length ? (
            <>
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
                  {products.map((p, idx) => (
                    <div
                      key={`men-pick-${p.id}-${idx}`}
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

              {!productsLoadingMore && productsHasMore ? (
                <button
                  type="button"
                  className="hp-explore-more"
                  onClick={loadMoreProducts}
                  style={{ marginTop: 16 }}
                >
                  Show More Products
                </button>
              ) : null}

              {productsLoadingMore ? (
                <p className="men-empty-state">Loading more products…</p>
              ) : null}
            </>
          ) : (
            <p className="men-empty-state">
              New men&apos;s styles are landing soon — check back shortly.
            </p>
          )}
        </section>

        {/* Top Brands */}
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
                  onClick={() => {
                    navigate(menScopedShopUrl({ search: brand.name }));
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

        {/* Trust strip */}
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