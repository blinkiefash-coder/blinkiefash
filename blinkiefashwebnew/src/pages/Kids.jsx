import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdSearch,
  MdLocationOn,
  MdKeyboardArrowDown,
  MdPersonOutline,
  MdFavoriteBorder,
  MdFavorite,
  MdOutlineShoppingCart,
  MdChevronLeft,
  MdChevronRight,
  MdSettings,
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
  MdMenu,
  MdNotificationsNone,
} from "react-icons/md";

import Footer from "../components/Footer";
import PageSEO from "../components/PageSEO";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
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

const TOP_NAV = [
  { label: "Men", to: "/men" },
  { label: "Women", to: "/women" },
  { label: "Kids", to: "/kids" },
  { label: "Home", to: "/shop?search=Home" },
  { label: "Beauty", to: "/shop?search=Beauty" },
  { label: "Accessories", to: "/shop?search=Accessories" },
  { label: "Footwear", to: "/shop?search=Footwear" },
  { label: "Bags", to: "/shop?search=Bags" },
  { label: "Jewellery", to: "/shop?search=Jewellery" },
  { label: "Travel", to: "/shop?search=Travel" },
  { label: "Home Decor", to: "/shop?search=Home%20Decor" },
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
  const price = Number(p.discount_price ?? p.price ?? 0);
  const mrp = Number(p.price ?? p.original_price ?? price);
  const discount = mrp > price ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return {
    id: p.id,
    name: p.name,
    brand: p.brand,
    image: resolveImageUrl(p.image),
    price,
    mrp,
    discount,
    isNew: p.is_new ?? p.isNew ?? false,
  };
}

export default function Kids() {
  const navigate = useNavigate();
  const { user, isLoggedIn: authLoggedIn } = useAuth();
  const { count: cartCount, addToCart } = useCart();
  const { items: wishlistItems, isWishlisted, toggleWishlist } = useWishlist();

  const city =
    localStorage.getItem("bfw_city") ||
    localStorage.getItem("selectedCity") ||
    "Cuttack";
  const isLoggedIn =
    authLoggedIn || Boolean(localStorage.getItem("userUuid") || localStorage.getItem("token"));
  const headerUserName = String(user?.name || localStorage.getItem("userName") || "").trim();
  const headerFirstName = headerUserName ? headerUserName.split(/\s+/)[0] : "";
  const accountLabel = isLoggedIn
    ? headerFirstName
      ? `Hi, ${headerFirstName}`
      : "My Account"
    : "Login / Signup";

  const [searchInput, setSearchInput] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [kidsRootId, setKidsRootId] = useState(null);
  const [kidsSubcats, setKidsSubcats] = useState([]);
  const [kidsResolved, setKidsResolved] = useState(false);
  const [brands, setBrands] = useState([]);
  const picksRailRef = useRef(null);

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

  const kidsScopedShopUrl = useCallback((opts = {}) => {
    const params = new URLSearchParams();
    // Prefer a leaf category; otherwise force Kids root so Shop never opens unfiltered.
    if (opts.categoryId) {
      params.set("category_id", String(opts.categoryId));
    } else if (kidsRootId) {
      params.set("category_id", String(kidsRootId));
    }
    let search = opts.search ? String(opts.search).trim() : "";
    // If we still have no category_id, force a kids-scoped search so the full catalog cannot open.
    if (!params.has("category_id")) {
      const lower = search.toLowerCase();
      if (!lower.includes("kid") && !lower.includes("child") && !lower.includes("baby") && !lower.includes("boy") && !lower.includes("girl")) {
        search = search ? `kids ${search}` : "kids";
      } else if (!search) {
        search = "kids";
      }
    }
    if (search) params.set("search", search);
    const qs = params.toString();
    return qs ? `/shop?${qs}` : "/shop?search=kids";
  }, [kidsRootId]);

  const findSubcatByLabel = useCallback((label) => {
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
  }, [kidsSubcats]);

  const categoryStripItems = useMemo(() => {
    if (kidsSubcats.length) {
      return kidsSubcats.map((cat) => {
        const image = resolveImageUrl(cat.image) || getCategoryImage(cat.name) || "";
        return {
          id: cat.id,
          label: cat.name,
          image,
          // Leaf category only — not the full Kids tree
          to: kidsScopedShopUrl({ categoryId: cat.id }),
        };
      });
    }
    // No DB subcategories yet: still scope under Kids root + search by label
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

  const goProduct = (id) => {
    navigate(`/product/${id}`, {
      state: { from: "kids", fromLabel: "Kids", fromPath: "/kids" },
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const value = searchInput.trim();
    if (!value) {
      navigate(kidsScopedShopUrl());
      return;
    }
    navigate(kidsScopedShopUrl({ search: value }));
  };

  const scrollPicks = (dir) => {
    const el = picksRailRef.current;
    if (!el) return;
    el.scrollBy({ left: dir * 320, behavior: "smooth" });
  };

  const wishlistCount = wishlistItems?.length || 0;

  return (
    <div className="catalog-page kids-page">
      <PageSEO
        title="Kids Fashion, Toys & Essentials"
        description="Shop kids clothing, toys, footwear and everyday essentials at Blinkiefash — delivered in 60 minutes across Odisha."
        path="/kids"
      />

      <div className="hp-sticky-head catalog-home-topbar">
        <header className="hp-main-header catalog-main-header">
          <button type="button" className="hp-brand" onClick={() => navigate("/")}>
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

          <form className="hp-header-search catalog-mobile-search" onSubmit={handleSearchSubmit}>
            <MdSearch className="hp-search-icon" />
            <input
              name="q"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Search for kids clothing, toys, essentials & more..."
            />
            <button type="submit" className="hp-search-btn" aria-label="Search products">
              <MdSearch />
            </button>
          </form>

          <div className="catalog-header-actions-wrap">
            <button type="button" className="catalog-location-pill kids-location-pill" onClick={() => navigate("/account")}>
              <MdLocationOn className="kids-location-icon" />
              <span className="kids-location-text">
                <span className="kids-location-label">Delivering to</span>
                <span className="kids-location-city">{city}</span>
              </span>
              <MdKeyboardArrowDown />
            </button>

            <div className="hp-header-actions kids-header-actions">
              <button type="button" className="kids-icon-action" onClick={() => navigate("/notifications")}>
                <MdNotificationsNone />
                <span>Notifications</span>
              </button>
              <button type="button" className="kids-icon-action" onClick={() => navigate("/wishlist")}>
                <MdFavoriteBorder />
                <span>Wishlist</span>
                {wishlistCount > 0 ? <span className="hp-icon-badge">{wishlistCount}</span> : null}
              </button>
              <button type="button" className="kids-icon-action" onClick={() => navigate("/cart")}>
                <MdOutlineShoppingCart />
                <span>Cart</span>
                {cartCount > 0 ? <span className="hp-icon-badge">{cartCount}</span> : null}
              </button>
              <button type="button" className="kids-icon-action kids-account-action" onClick={() => navigate(isLoggedIn ? "/account" : "/login")}>
                <MdPersonOutline />
                <span>{accountLabel}</span>
              </button>
            </div>
          </div>
        </header>

        <nav className="hp-category-nav kids-topnav">
          <div className="hp-nav-links">
            <button
              type="button"
              className="kids-categories-btn"
              onClick={() => navigate("/shop")}
            >
              <MdMenu />
              Categories
              <MdKeyboardArrowDown />
            </button>
            {TOP_NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`hp-nav-link${item.label === "Kids" ? " active" : ""}`}
                onClick={() => navigate(item.to)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="kids-nav-offers" onClick={() => navigate("/offers")}>
            <MdSettings /> Offers
          </button>
        </nav>
      </div>

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
            <button type="button" onClick={() => navigate(kidsScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>

          {productsLoading ? (
            <p className="kids-empty-state">Loading today&apos;s picks…</p>
          ) : products.length ? (
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
                  <article
                    key={`kids-pick-${p.id}-${idx}`}
                    className="hp-deal-card"
                    role="listitem"
                    onClick={() => goProduct(p.id)}
                  >
                    <div className="hp-deal-media">
                      {p.image ? (
                        <img src={p.image} alt={p.name} loading="lazy" />
                      ) : (
                        <div className="hp-deal-fallback">No image</div>
                      )}
                      <span className={`hp-deal-ribbon${p.discount === 0 ? " new" : ""}`}>
                        {p.discount > 0 ? `${p.discount}% OFF` : "NEW"}
                      </span>
                      <button
                        type="button"
                        className={`hp-deal-wish${isWishlisted(p.id) ? " active" : ""}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist({
                            productId: p.id,
                            name: p.name,
                            image: p.image,
                            price: p.price,
                          });
                        }}
                        aria-label="Toggle wishlist"
                      >
                        {isWishlisted(p.id) ? <MdFavorite /> : <MdFavoriteBorder />}
                      </button>
                    </div>
                    <div className="hp-deal-body">
                      {p.brand && <p className="hp-deal-brand">{p.brand}</p>}
                      <p className="hp-deal-name">{p.name}</p>
                      <div className="hp-deal-price-row">
                        <span className="hp-deal-price">₹{p.price}</span>
                        {p.mrp > p.price && <span className="hp-deal-mrp">₹{p.mrp}</span>}
                      </div>
                      <div className="hp-deal-footer-row">
                        <span className={`hp-deal-off${p.discount > 0 ? ' discount' : ''}`}>
                          {p.discount > 0 ? `${p.discount}% OFF` : "NEW"}
                        </span>
                        <button
                          type="button"
                          className="hp-deal-cart"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({
                              productId: p.id,
                              variantId: p.id,
                              name: p.name,
                              image: p.image,
                              price: p.price,
                            });
                          }}
                          aria-label="Add to cart"
                        >
                          <MdOutlineShoppingCart />
                        </button>
                      </div>
                    </div>
                  </article>
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
              New kids styles are landing soon — check back shortly.
            </p>
          )}
        </section>

        {/* Brands */}
        <section className="kids-brands-section" aria-label="Top kids brands">
          <div className="hp-section-head">
            <h2>Top Brands Kids Love</h2>
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