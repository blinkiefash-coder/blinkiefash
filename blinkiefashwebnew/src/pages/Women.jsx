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
  MdContentCopy,
  MdSportsEsports,
  MdRedeem,
  MdTwoWheeler,
} from "react-icons/md";

import Footer from "../components/Footer";
import PageSEO from "../components/PageSEO";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import { getProducts, getCategories, getBrands } from "../api";
import { getCategoryImage } from "../utils/categoryImages";
import { API_BASE_URL } from "../apiBase";
import womenBanner1 from "../assets/women-banner-1.png";
import womenBanner2 from "../assets/women-banner-2.png";
import womenBanner3 from "../assets/women-banner-3.png";
import "./Shop.css";
import "./Home.css";
import "./Women.css";

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

// Hero carousel slides — plain banner images, no overlay copy.
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



// Banner images for the Women hero cards
const WOMEN_BANNERS = [
  {
    src: womenBanner1,
    alt: "Women's Collection — unmatched styles, unstoppable you. Explore the Women's Collection.",
  },
  {
    src: womenBanner2,
    alt: "Trending styles for women — shop what's popular right now.",
  },
  {
    src: womenBanner3,
    alt: "New arrivals for women — discover the latest drops.",
  },
];


function ProductRail({ list, railRef, keyPrefix }) {
  const scrollRail = (dir) => {
    const el = railRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  return (
    <div className="hp-deals-wrap">
      <button
        type="button"
        className="hp-deals-prev"
        aria-label="Previous"
        onClick={() => scrollRail(-1)}
      >
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

      <button
        type="button"
        className="hp-deals-next"
        aria-label="Next"
        onClick={() => scrollRail(1)}
      >
        <MdChevronRight />
      </button>
    </div>
  );
}

export default function Women() {
  const navigate = useNavigate();
  const { user, isLoggedIn: authLoggedIn } = useAuth();
  const { count: cartCount } = useCart();
  const { items: wishlistItems } = useWishlist();

  const city =
    localStorage.getItem("bfw_city") ||
    localStorage.getItem("selectedCity") ||
    "Khordha";
  const isLoggedIn =
    authLoggedIn || Boolean(localStorage.getItem("userUuid") || localStorage.getItem("token"));
  const headerUserName = String(user?.name || localStorage.getItem("userName") || "").trim();
  const headerFirstName = headerUserName ? headerUserName.split(/\s+/)[0] : "";
  const accountLabel = isLoggedIn ? (headerFirstName ? headerFirstName : "My Account") : "Login";

  const [searchInput, setSearchInput] = useState("");
  const [products, setProducts] = useState([]);
  const [newArrivals, setNewArrivals] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [womenRootId, setWomenRootId] = useState(null);
  const [womenSubcats, setWomenSubcats] = useState([]);
  const [womenResolved, setWomenResolved] = useState(false);
  const [brands, setBrands] = useState([]);
  const [heroIndex, setHeroIndex] = useState(0);
  const trendingRef = useRef(null);
  const arrivalsRef = useRef(null);

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

  useEffect(() => {
    if (!womenResolved) return;
    let cancelled = false;

    (async () => {
      setProductsLoading(true);
      let found = [];

      if (womenRootId) {
        try {
          const byCategory = await getProducts({
            category_id: womenRootId,
            sort: "newest",
            limit: 16,
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
              getProducts({ category_id: sub.id, sort: "newest", limit: 4 }).catch(() => [])
            )
          );
          found = perSub.flatMap(extractProducts);
        } catch {
          found = [];
        }
      }

      if (!found.length) {
        try {
          const bySearch = await getProducts({ search: "women", limit: 16 });
          found = extractProducts(bySearch);
        } catch {
          found = [];
        }
      }

      if (!cancelled) {
        const normalized = found.map(normalizeProduct);
        setProducts(normalized.slice(0, 8));
        setNewArrivals(normalized.slice(0, 8));
        setProductsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [womenResolved, womenRootId, womenSubcats]);


  // Auto-advance the hero carousel every 5s, pausing is unnecessary since
  // arrows/dots simply reset the timer via index change.
  useEffect(() => {
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 5000);
    return () => clearInterval(id);
  }, []);


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

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const value = searchInput.trim();
    if (!value) {
      navigate(womenScopedShopUrl());
      return;
    }
    navigate(womenScopedShopUrl({ search: value }));
  };

  const handleCopyReferral = () => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText("BLINK100").catch(() => {});
    }
  };

  const wishlistCount = wishlistItems?.length || 0;
  const slide = HERO_SLIDES[heroIndex];

  return (
    <div className="catalog-page women-page">
      <PageSEO
        title="Women's Fashion — Kurtis, Dresses, Ethnic & More"
        description="Shop women's clothing, footwear, bags and jewellery at Blinkiefash — delivered in 60 minutes across Odisha."
        path="/women"
      />

      {/* Top utility strip */}
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

      <div className="hp-sticky-head catalog-home-topbar">
        <header className="hp-main-header catalog-main-header">
          <button type="button" className="hp-brand" onClick={() => navigate("/")}>
            <MdBolt className="women-brand-bolt" />
            <span className="hp-brand-name">
              BLINKIE<span className="hp-brand-accent">FASH</span>
            </span>
          </button>

          <form className="hp-header-search catalog-mobile-search" onSubmit={handleSearchSubmit}>
            <MdSearch className="hp-search-icon" />
            <input
              name="q"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search for Ethnic Wear, Kurta Sets, Sarees & more..."
            />
            <button type="submit" className="hp-search-btn" aria-label="Search products">
              <MdSearch />
            </button>
          </form>

          <div className="catalog-header-actions-wrap">
            <button type="button" className="catalog-location-pill" onClick={() => navigate("/account")}>
              <MdLocationOn />
              <span className="women-location-copy">
                <span className="women-location-label">Delivering to</span>
                <span className="women-location-value">
                  {city} <MdKeyboardArrowDown />
                </span>
              </span>
            </button>

            <button type="button" className="women-change-location-btn" onClick={() => navigate("/account")}>
              <MdMyLocation />
              <span>Change Location</span>
            </button>

            <div className="hp-header-actions">
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

        <nav className="hp-category-nav women-topnav">
          <div className="hp-nav-links">
            {TOP_NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`hp-nav-link${item.label === "Women" ? " active" : ""}`}
                onClick={() => navigate(item.to)}
              >
                {item.label}
              </button>
            ))}
          </div>
        </nav>
      </div>

      <main className="women-main">
        {/* Shop mode row — same markup/classes as Home.jsx so it matches exactly */}
        <section className="hp-mode-row" aria-label="Shop mode">
          <button
            type="button"
            className="hp-mode-banner hp-mode-india"
            onClick={() => navigate("/blinkiefash-india")}
          >
            <span className="hp-mode-icon">🌐</span>
            <span className="hp-mode-copy">
              <strong>BLINKIEFASH INDIA</strong>
              <span>Products from stores across India</span>
            </span>
          </button>

          <button
            type="button"
            className="hp-mode-banner hp-mode-local"
            onClick={() => navigate("/blinkiefash-local")}
          >
            <span className="hp-mode-icon">⚡</span>
            <span className="hp-mode-copy">
              <strong>BLINKIEFASH LOCAL</strong>
              <span>Fast delivery from nearby stores</span>
            </span>
          </button>
        </section>

        {/* Hero carousel — image only, no overlay copy */}
        <section className="women-hero-carousel" aria-label="Women's fashion highlights">
          <button
            type="button"
            className="women-hero-arrow prev"
            aria-label="Previous slide"
            onClick={() => setHeroIndex((i) => (i - 1 + HERO_SLIDES.length) % HERO_SLIDES.length)}
          >
            <MdChevronLeft />
          </button>

          <button
            type="button"
            className="women-hero-media-btn"
            onClick={() => navigate(womenScopedShopUrl())}
          >
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

        {/* Reward / promo grid */}
        <section className="women-rewards-grid" aria-label="Offers & rewards">
          <div className="women-reward-card women-reward-spin">
            <div>
              <h3>SPIN &amp; WIN</h3>
              <p>Spin the wheel &amp; win exciting rewards!</p>
            </div>
            <div className="women-reward-figure">
              <div className="women-wheel" aria-hidden="true" />
            </div>
            <div>
              <p className="women-reward-amount">Up To ₹500 OFF</p>
              <button type="button" className="women-reward-btn" onClick={() => navigate("/offers")}>
                SPIN NOW
              </button>
            </div>
          </div>

          <div className="women-reward-card women-reward-play">
            <div>
              <h3>PLAY &amp; WIN</h3>
              <p>Play fun games &amp; win big discounts!</p>
            </div>
            <div className="women-reward-figure women-controller">
              <MdSportsEsports />
            </div>
            <div>
              <p className="women-reward-amount">Up To ₹250 OFF</p>
              <button type="button" className="women-reward-btn" onClick={() => navigate("/offers")}>
                PLAY NOW
              </button>
            </div>
          </div>

          <div className="women-reward-card women-reward-refer">
            <div>
              <h3>REFER &amp; EARN</h3>
              <p>Refer your friend &amp; you both get ₹100 OFF!</p>
            </div>
            <div className="women-reward-code">
              <span>
                YOUR REFERRAL CODE
                <br />
                <strong>BLINK100</strong>
              </span>
              <button type="button" onClick={handleCopyReferral} aria-label="Copy referral code" style={{ border: "none", background: "none", cursor: "pointer", color: "#9f1239" }}>
                <MdContentCopy />
              </button>
            </div>
            <button type="button" className="women-reward-btn" onClick={() => navigate("/account")}>
              REFER NOW
            </button>
          </div>

          <div className="women-reward-stack">
            <div className="women-reward-mini">
              <div>
                <strong>FLAT 5% OFF</strong>
                <span>ON FIRST ORDER</span>
                <span className="chip">Use Code: WELCOME5</span>
              </div>
              <MdRedeem className="women-reward-emoji" />
            </div>
            <div className="women-reward-mini">
              <div>
                <strong>FREE DELIVERY</strong>
                <span>ON ORDERS ABOVE ₹1499</span>
              </div>
              <MdTwoWheeler className="women-reward-emoji" />
            </div>
          </div>
        </section>

        {/* Trending */}
        <section className="section women-picks-section">
          <div className="hp-section-head">
            <h2>TRENDING NOW 🔥</h2>
            <button type="button" onClick={() => navigate(womenScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>
          {productsLoading ? (
            <p className="women-empty-state">Loading today&apos;s picks…</p>
          ) : products.length ? (
            <ProductRail list={products} railRef={trendingRef} keyPrefix="women-trend" />
          ) : (
            <p className="women-empty-state">New women&apos;s styles are landing soon.</p>
          )}
        </section>

        {/* Categories */}
        <section className="women-cat-strip" aria-label="Shop by category">
          <div className="women-cat-list">
            {categoryStripItems.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="women-cat-item"
                onClick={() => navigate(cat.to)}
              >
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
                  <span
                    className="women-cat-fallback-icon"
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


        {/* Promos */}
        <section className="women-promo-strip" aria-label="Offers">
          <button
            type="button"
            className="women-promo-card women-promo-prepaid"
            onClick={() => navigate("/offers")}
          >
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

        {/* Trending */}
        <section className="section women-picks-section">
          <div className="hp-section-head">
            <h2>Trending Now 🔥</h2>
            <button type="button" onClick={() => navigate(womenScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>
          {productsLoading ? (
            <p className="women-empty-state">Loading today&apos;s picks…</p>
          ) : products.length ? (
            <ProductRail list={products} railRef={trendingRef} keyPrefix="women-trend" />
          ) : (
            <p className="women-empty-state">New women&apos;s styles are landing soon.</p>
          )}
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
            <p className="women-empty-state">Loading new arrivals…</p>
          ) : newArrivals.length ? (
            <ProductRail list={newArrivals} railRef={arrivalsRef} keyPrefix="women-new" />
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
                  onClick={() => {
                    navigate(womenScopedShopUrl({ search: brand.name }));
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