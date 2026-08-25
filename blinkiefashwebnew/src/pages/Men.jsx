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
import "./Men.css";

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
  { label: "Footwear", to: "/shop?search=Footwear" },
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

export default function Men() {
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
  const accountLabel = isLoggedIn ? (headerFirstName ? `Hi, ${headerFirstName}` : "My Account") : "Login / Signup";

  const [searchInput, setSearchInput] = useState("");
  const [products, setProducts] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [menRootId, setMenRootId] = useState(null);
  const [menSubcats, setMenSubcats] = useState([]);
  const [menResolved, setMenResolved] = useState(false);
  const [brands, setBrands] = useState([]);
  const picksRailRef = useRef(null);

  // Resolve the real "Men" category from the DB category tree first — every
  // link and product fetch on this page is scoped to that subtree so this
  // page only ever shows men's items, never women's/kids'/other sections'.
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

  // Once we know which category *is* Men, fetch products scoped to it.
  // No gender-text or bestseller fallback here on purpose — if the Men
  // subtree has no products yet we show an empty state instead of mixing
  // in items from other sections.
  useEffect(() => {
    if (!menResolved) return;
    let cancelled = false;

    (async () => {
      setProductsLoading(true);
      let found = [];

      if (menRootId) {
        try {
          const byCategory = await getProducts({ category_id: menRootId, sort: "newest", limit: 8 });
          found = extractProducts(byCategory);
        } catch {
          found = [];
        }
      }

      if (!found.length && menRootId) {
        // Some backends only tag leaf-level products, not the root — retry
        // against each direct subcategory and merge until we have 8.
        try {
          const perSub = await Promise.all(
            menSubcats.slice(0, 6).map((sub) =>
              getProducts({ category_id: sub.id, sort: "newest", limit: 4 }).catch(() => [])
            )
          );
          found = perSub.flatMap(extractProducts);
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
  }, [menResolved, menRootId, menSubcats]);

  const menScopedShopUrl = useCallback((opts = {}) => {
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
  }, [menRootId]);

  const findMenSubcatByLabel = useCallback((label) => {
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
  }, [menSubcats]);

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
    return MEN_CATEGORY_FALLBACK_LABELS.map((label, idx) => {
      const match = findMenSubcatByLabel(label);
      return {
        id: match?.id || `fallback-${label}`,
        label,
        icon: CATEGORY_ICONS[idx] || MdGridView,
        image: match ? resolveImageUrl(match.image) || getCategoryImage(match.name) || "" : "",
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

  const wishlistCount = wishlistItems?.length || 0;

  return (
    <div className="catalog-page men-page">
      <PageSEO
        title="Men's Fashion — Shirts, T-Shirts, Jeans & More"
        description="Shop the latest men's fashion at Blinkiefash — t-shirts, shirts, jeans, footwear, watches, jackets and more, delivered in 60 minutes across Odisha."
        path="/men"
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
              placeholder="Search for men's clothing, shoes, accessories & more..."
            />
            <button type="submit" className="hp-search-btn" aria-label="Search products">
              <MdSearch />
            </button>
          </form>

          <div className="catalog-header-actions-wrap">
            <button type="button" className="catalog-location-pill" onClick={() => navigate("/account")}>
              <MdLocationOn />
              <span>{city}</span>
              <MdKeyboardArrowDown />
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

        <nav className="hp-category-nav men-topnav">
          <div className="hp-nav-links">
            {TOP_NAV.map((item) => (
              <button
                key={item.label}
                type="button"
                className={`hp-nav-link${item.label === "Men" ? " active" : ""}`}
                onClick={() => navigate(item.to)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <button type="button" className="men-nav-offers" onClick={() => navigate("/offers")}>
            <MdSettings /> Offers
          </button>
        </nav>
      </div>

      <main className="men-main">
        <div className="men-breadcrumb">
          <button type="button" onClick={() => navigate("/")}>Home</button>
          <span>›</span>
          <span className="current">Men</span>
        </div>

        <section className="men-hero-grid" aria-label="Men's fashion highlights">
          <div className="men-hero-card men-hero-main">
            <div className="men-hero-copy">
              <p className="men-hero-kicker">STYLE THAT MOVES WITH YOU</p>
              <h1>Delivered in a Blink!</h1>
              <p className="men-hero-sub">
                Latest trends, top brands &amp; everyday essentials — all in 60 minutes.
              </p>
              <ul className="men-hero-features">
                <li><MdBolt /> 60 MINS Delivery</li>
                <li><MdAutorenew /> Easy Returns</li>
                <li><MdVerifiedUser /> Top Quality Products</li>
                <li><MdSecurity /> Safe &amp; Trusted</li>
              </ul>
              <button type="button" className="men-hero-btn" onClick={() => navigate(menScopedShopUrl())}>
                Shop Now <MdArrowForward />
              </button>
            </div>
          </div>

          <div className="men-hero-card men-hero-side men-hero-trending">
            <p className="men-hero-tag">TRENDING NOW</p>
            <h3>Hot Right Now!</h3>
            <p>Most loved styles this week.</p>
            <button type="button" onClick={() => navigate(menScopedShopUrl())}>
              Explore Now <MdArrowForward />
            </button>
          </div>

          <div className="men-hero-card men-hero-side men-hero-arrivals">
            <p className="men-hero-tag">NEW ARRIVALS</p>
            <h3>Fresh Styles Just In!</h3>
            <p>Be the first to grab the latest.</p>
            <button type="button" onClick={() => navigate(menScopedShopUrl())}>
              View All <MdArrowForward />
            </button>
          </div>
        </section>

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
                        const fallback = event.currentTarget.nextElementSibling;
                        if (fallback) fallback.style.display = "inline-flex";
                      }}
                    />
                  ) : null}
                  <span className="men-cat-fallback-icon" style={cat.image ? { display: "none" } : undefined}>
                    {cat.icon ? <cat.icon /> : <MdGridView />}
                  </span>
                </span>
                <span>{cat.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="men-promo-strip">
          <button type="button" className="men-promo-card men-promo-prepaid" onClick={() => navigate("/offers")}>
            <div>
              <p className="men-promo-title">Prepaid Order Offers</p>
              <p className="men-promo-sub">Extra savings when you pay online</p>
            </div>
            <MdLocalOffer className="men-promo-icon" />
          </button>

          <button type="button" className="men-promo-card men-promo-brands" onClick={() => navigate(menScopedShopUrl())}>
            <div>
              <p className="men-promo-title">Top Brand Discounts</p>
              <p className="men-promo-sub">Nike · Adidas · Puma &amp; more</p>
            </div>
            <span className="men-promo-cta">Shop Now <MdArrowForward /></span>
          </button>

          <button type="button" className="men-promo-card men-promo-delivery" onClick={() => navigate(menScopedShopUrl())}>
            <div>
              <p className="men-promo-title">Fast &amp; Free Delivery</p>
              <p className="men-promo-sub">On eligible orders, in 60 minutes</p>
            </div>
            <span className="men-promo-cta">Shop Now <MdArrowForward /></span>
          </button>
        </section>

        <section className="section men-picks-section">
          <div className="hp-section-head">
            <h2>Top Picks for You</h2>
            <button type="button" onClick={() => navigate(menScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>

          {productsLoading ? (
            <p className="men-empty-state">Loading today&apos;s picks…</p>
          ) : products.length ? (
            <div className="hp-deals-wrap">
              <button type="button" className="hp-deals-prev" aria-label="Previous" onClick={() => scrollPicks(-1)}>
                <MdChevronLeft />
              </button>

              <div className="hp-deals-rail" role="list" ref={picksRailRef}>
                {products.map((p, idx) => (
                  <article
                    key={`men-pick-${p.id}-${idx}`}
                    className="hp-deal-card"
                    role="listitem"
                    onClick={() => navigate(`/product/${p.id}`, { state: { from: 'men', fromLabel: 'Men', fromPath: '/men' } })}
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
                          toggleWishlist({ productId: p.id, name: p.name, image: p.image, price: p.price });
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
<<<<<<< HEAD
                        <span className={`hp-deal-off${p.discount > 0 ? ' discount' : ''}`}>
=======
                        <span className="hp-deal-off">
>>>>>>> 89e8a35 (medha)
                          {p.discount > 0 ? `${p.discount}% OFF` : "BESTSELLER"}
                        </span>
                        <button
                          type="button"
                          className="hp-deal-cart"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({ productId: p.id, variantId: p.id, name: p.name, image: p.image, price: p.price });
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

              <button type="button" className="hp-deals-next" aria-label="Next" onClick={() => scrollPicks(1)}>
                <MdChevronRight />
              </button>
            </div>
          ) : (
            <p className="men-empty-state">New men&apos;s styles are landing soon — check back shortly.</p>
          )}
        </section>

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
                    {logo ? <img src={logo} alt="" loading="lazy" /> : <span>{initials || "BR"}</span>}
                  </span>
                  <span className="hp-top-brand-name">{brand.name}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section className="men-trust-strip" aria-label="Why shop with us">
          <div><MdBolt /><div><strong>60 MINUTES</strong><span>Delivery</span></div></div>
          <div><MdAutorenew /><div><strong>Easy 5-Day</strong><span>Returns</span></div></div>
          <div><MdVerifiedUser /><div><strong>100% Original</strong><span>Products</span></div></div>
          <div><MdLocalOffer /><div><strong>Best Prices</strong><span>Everyday</span></div></div>
          <div><MdSecurity /><div><strong>Secure Payments</strong><span>100% Safe &amp; Secure</span></div></div>
          <div><MdSupportAgent /><div><strong>24/7 Support</strong><span>We&apos;re here for you</span></div></div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
