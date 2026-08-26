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


// Banner images for the Women hero cards: [main, trending side, arrivals side]
const WOMEN_BANNERS = [
  "https://res.cloudinary.com/vu2qpoeq/image/upload/v1787660973/IMG-20260825-WA0015.jpg",
  "https://res.cloudinary.com/vu2qpoeq/image/upload/v1787660973/IMG-20260825-WA0017.jpg",
  "https://res.cloudinary.com/vu2qpoeq/image/upload/v1787660973/IMG-20260825-WA0016.jpg",
];

function heroBannerStyle(url) {
  return {
    backgroundImage: `url(${url})`,
    backgroundSize: "cover",
    backgroundPosition: "center",
  };
}

function ProductRail({ list, railRef, keyPrefix, isWishlisted, toggleWishlist, addToCart, onProductClick }) {
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
          <article
            key={`${keyPrefix}-${p.id}-${idx}`}
            className="hp-deal-card"
            role="listitem"
            onClick={() => onProductClick(p.id)}
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
  const [newArrivals, setNewArrivals] = useState([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [womenRootId, setWomenRootId] = useState(null);
  const [womenSubcats, setWomenSubcats] = useState([]);
  const [womenResolved, setWomenResolved] = useState(false);
  const [brands, setBrands] = useState([]);
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

  const womenScopedShopUrl = useCallback((opts = {}) => {
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
  }, [womenRootId]);

  const findWomenSubcatByLabel = useCallback((label) => {
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
  }, [womenSubcats]);

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

  const goProduct = (id) => {
    navigate(`/product/${id}`, {
      state: { from: "women", fromLabel: "Women", fromPath: "/women" },
    });
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const value = searchInput.trim();
    if (!value) {
      navigate(womenScopedShopUrl());
      return;
    }
    navigate(womenScopedShopUrl({ search: value }));
  };

  const wishlistCount = wishlistItems?.length || 0;

  return (
    <div className="catalog-page women-page">
      <PageSEO
        title="Women's Fashion — Kurtis, Dresses, Ethnic & More"
        description="Shop women's clothing, footwear, bags and jewellery at Blinkiefash — delivered in 60 minutes across Odisha."
        path="/women"
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
              placeholder="Search for women's clothing, footwear, bags & more..."
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
          <button type="button" className="women-nav-offers" onClick={() => navigate("/offers")}>
            <MdSettings /> Offers
          </button>
        </nav>
      </div>

      <main className="women-main">
        <div className="women-breadcrumb">
          <button type="button" onClick={() => navigate("/")}>
            Home
          </button>
          <span>›</span>
          <span className="current">Women</span>
        </div>

        {/* Hero */}
        <section className="women-hero-grid" aria-label="Women's fashion highlights">
          <div
            className="women-hero-main"
            style={{ ...heroBannerStyle(WOMEN_BANNERS[0]), cursor: "pointer" }}
            onClick={() => navigate(womenScopedShopUrl())}
          />

          <div className="women-hero-side-col">
            <button
              type="button"
              className="women-hero-side trending"
              style={heroBannerStyle(WOMEN_BANNERS[1])}
              onClick={() =>
                navigate(womenScopedShopUrl())
              }
            />

            <button
              type="button"
              className="women-hero-side arrivals"
              style={heroBannerStyle(WOMEN_BANNERS[2])}
              onClick={() => navigate(womenScopedShopUrl())}
            />
          </div>
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
            <ProductRail
              list={products}
              railRef={trendingRef}
              keyPrefix="women-trend"
              isWishlisted={isWishlisted}
              toggleWishlist={toggleWishlist}
              addToCart={addToCart}
              onProductClick={goProduct}
            />
          ) : (
            <p className="women-empty-state">New women&apos;s styles are landing soon.</p>
          )}
        </section>

        {/* New arrivals */}
        <section className="section women-picks-section">
          <div className="hp-section-head">
            <h2>New Arrivals ✨</h2>
            <button type="button" onClick={() => navigate(womenScopedShopUrl())}>
              View All <MdChevronRight />
            </button>
          </div>
          {productsLoading ? (
            <p className="women-empty-state">Loading new arrivals…</p>
          ) : newArrivals.length ? (
            <ProductRail
              list={newArrivals}
              railRef={arrivalsRef}
              keyPrefix="women-new"
              isWishlisted={isWishlisted}
              toggleWishlist={toggleWishlist}
              addToCart={addToCart}
              onProductClick={goProduct}
            />
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