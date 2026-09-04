import "./Navbar.css";
import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import ConfirmDialog from "./ConfirmDialog";
import { useLogoutConfirm } from "../hooks/useLogoutConfirm";
import { getCategories } from "../api";

const LOGO_URL =
  "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg";

/* ---------- inline icons ---------- */
const IconChevronDown = ({ size = 14 }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <path d="m6 9 6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden="true">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" strokeLinecap="round" />
  </svg>
);
const IconCart = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="9" cy="21" r="1.4" />
    <circle cx="18" cy="21" r="1.4" />
    <path d="M2.5 3h2l2.4 12.2a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 8H6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconHeart = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M12 21s-7.5-4.6-10-9.1C.5 8.4 2 4.8 5.6 4c2.1-.5 4.2.4 5.4 2.1C12.2 4.4 14.3 3.5 16.4 4c3.6.8 5.1 4.4 3.6 7.9C17.5 16.4 12 21 12 21Z" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const IconUser = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <circle cx="12" cy="8" r="3.6" />
    <path d="M4.5 20a7.5 7.5 0 0 1 15 0" strokeLinecap="round" />
  </svg>
);

/* Paths aligned with your Home / app routes */
const CATEGORY_LINKS = [
  { label: "Women", path: "/women" },
  { label: "Men", path: "/men" },
  { label: "Footwear", path: "/footwear" },
  { label: "Beauty", path: "/beauty" },
  { label: "Electronics", path: "/electronics" },
];

const MORE_LINKS = [
  { label: "Kids", path: "/kids" },
  { label: "Home & Living", path: "/home-living" },
  { label: "Backpack", path: "/backpack" },
];

function readAuthFromStorage() {
  return {
    isLoggedIn: Boolean(localStorage.getItem("token")),
    userName: localStorage.getItem("userName") || "",
  };
}

function readCartCount() {
  const raw = localStorage.getItem("cartCount");
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export default function Navbar() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoggedIn, setIsLoggedIn] = useState(() => readAuthFromStorage().isLoggedIn);
  const [userName, setUserName] = useState(() => readAuthFromStorage().userName);
  const [cartCount, setCartCount] = useState(() => readCartCount());

  /* Category hover mega-menu (Women / Men / Footwear / Beauty / Electronics) */
  const [hoveredCat, setHoveredCat] = useState(null);
  const [categoryCols, setCategoryCols] = useState({});
  const closeHoverTimer = useRef(null);

  const navigate = useNavigate();
  const location = useLocation();
  const moreRef = useRef(null);
  const profileRef = useRef(null);

  /* Mobile "search-only" mode: on the shop/search page, mobile navbar shows
     just the full search bar (no hamburger, logo, cart, wishlist, profile).
     Desktop layout is unaffected — this only applies inside the existing
     max-width: 900px media query in Navbar.css. */
  const isSearchOnlyMobile = location.pathname.startsWith("/shop");

  useEffect(() => {
    const syncAuth = () => {
      const next = readAuthFromStorage();
      setIsLoggedIn(next.isLoggedIn);
      setUserName(next.userName);
      setCartCount(readCartCount());
    };
    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  /* Close dropdowns on outside click */
  useEffect(() => {
    const onDocClick = (e) => {
      if (moreRef.current && !moreRef.current.contains(e.target)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  /* Fetch categories once and build Women/Men/Footwear/Beauty/Electronics -> sub-columns lookup,
     the same structure used by the Home page's hover mega menu. */
  useEffect(() => {
    let cancelled = false;

    const rootIdForAny = (allCats, names) => {
      const needles = (Array.isArray(names) ? names : [names]).map((n) =>
        n.toString().toLowerCase().trim()
      );
      const root =
        allCats.find((c) => {
          if (c.parent_id) return false;
          const catName = (c?.name || "").toString().toLowerCase().trim();
          return needles.some((needle) => catName === needle);
        }) ||
        allCats.find((c) => {
          if (c.parent_id) return false;
          const catName = (c?.name || "").toString().toLowerCase().trim();
          return needles.some((needle) => catName.includes(needle) || needle.includes(catName));
        });
      return root?.id || null;
    };

    const childCatsFor = (allCats, rootNames) => {
      const rootId = rootIdForAny(allCats, rootNames);
      if (!rootId) return [];

      const subCatsFor = (categoryId) =>
        allCats
          .filter((c) => String(c.parent_id) === String(categoryId))
          .map((c) => ({
            id: c.id,
            name: (c?.name || "").toString().trim(),
            image: c.category_url || c.image || "",
          }))
          .filter((c) => c.name)
          .slice(0, 6);

      return allCats
        .filter((c) => String(c.parent_id) === String(rootId))
        .map((c) => ({
          id: c.id,
          name: c.name,
          image: c.category_url || c.image || "",
          subcategories: subCatsFor(c.id),
        }))
        .slice(0, 10);
    };

    (async () => {
      try {
        const res = await getCategories();
        const allCats = Array.isArray(res)
          ? res
          : res?.categories || res?.data?.categories || res?.data || [];
        if (cancelled || !Array.isArray(allCats) || allCats.length === 0) return;

        setCategoryCols({
          Women: childCatsFor(allCats, "Women"),
          Men: childCatsFor(allCats, "Men"),
          Footwear: childCatsFor(allCats, ["Footwear", "Shoes"]),
          Beauty: childCatsFor(allCats, "Beauty"),
          Electronics: childCatsFor(allCats, "Electronics"),
        });
      } catch {
        /* silently ignore — nav items still work as plain links */
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const openHover = (label) => {
    if (closeHoverTimer.current) clearTimeout(closeHoverTimer.current);
    setHoveredCat(label);
  };

  const scheduleCloseHover = () => {
    if (closeHoverTimer.current) clearTimeout(closeHoverTimer.current);
    closeHoverTimer.current = setTimeout(() => setHoveredCat(null), 120);
  };

  const closeDrawer = () => setDrawerOpen(false);
  const drawerNav = (path) => {
    closeDrawer();
    navigate(path);
  };

  const performLogout = () => {
    localStorage.clear();
    setIsLoggedIn(false);
    setUserName("");
    setProfileOpen(false);
    closeDrawer();
  };

  const {
    open: logoutConfirmOpen,
    loading: loggingOut,
    requestLogout,
    cancel: cancelLogout,
    confirm: confirmLogout,
  } = useLogoutConfirm(performLogout, "/login");

  const handleSearch = (e) => {
    e.preventDefault();
    const q = searchQuery.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
  };

  return (
    <>
      <header className={`navbar${isSearchOnlyMobile ? " navbar-search-only" : ""}`}>
        <button
          type="button"
          className="nav-hamburger"
          aria-label="Open menu"
          onClick={() => setDrawerOpen(true)}
        >
          <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="#111827" strokeWidth="2.2" strokeLinecap="round">
            <path d="M3 6h18M3 12h18M3 18h18" />
          </svg>
        </button>

        {/* LEFT: logo + brand + address */}
        <div className="nav-left">
          <button type="button" className="nav-logo-btn" onClick={() => navigate("/")} aria-label="Home">
            <img src={LOGO_URL} alt="" className="logo-img" />
            <div className="brand-block">
              <span className="brand">
                <span className="brand-black">BLINKIE</span>
                <span className="brand-green">FASH</span>
              </span>
              <span className="brand-tagline">DELIVERED IN 60 MINUTES</span>
            </div>
          </button>
        </div>

        {/* CENTER: categories */}
        <nav className="nav-links" aria-label="Categories" onMouseLeave={scheduleCloseHover}>
          {CATEGORY_LINKS.map((cat) => {
            const cols = categoryCols[cat.label] || [];
            const hasMega = cols.length > 0;
            return (
              <div
                key={cat.label}
                className="nav-item-dropdown-wrap"
                onMouseEnter={() => hasMega && openHover(cat.label)}
              >
                <button
                  type="button"
                  className={`nav-item${hasMega && hoveredCat === cat.label ? " active" : ""}`}
                  onClick={() => navigate(cat.path)}
                  onFocus={() => hasMega && openHover(cat.label)}
                >
                  {cat.label}
                </button>
              </div>
            );
          })}

          <div className="nav-item-dropdown-wrap" ref={moreRef}>
            <button
              type="button"
              className="nav-item"
              onClick={() => setMoreOpen((v) => !v)}
              aria-expanded={moreOpen}
            >
              More <IconChevronDown />
            </button>
            {moreOpen && (
              <div className="more-dropdown">
                {MORE_LINKS.map((link) => (
                  <div
                    key={link.label}
                    onClick={() => {
                      setMoreOpen(false);
                      navigate(link.path);
                    }}
                  >
                    {link.label}
                  </div>
                ))}
              </div>
            )}
          </div>
        </nav>

        {/* Full-width mega menu panel — content swaps based on which top-level category is hovered */}
        {hoveredCat && (categoryCols[hoveredCat] || []).length > 0 && (
          <div
            className="nav-mega-menu"
            onMouseEnter={() => openHover(hoveredCat)}
            onMouseLeave={scheduleCloseHover}
          >
            <div className="nav-mega-columns">
              {categoryCols[hoveredCat].map((parent) => (
                <div key={parent.id} className="nav-mega-col">
                  <button
                    type="button"
                    className="nav-mega-col-title"
                    onClick={() => {
                      setHoveredCat(null);
                      navigate(`/shop?category_id=${parent.id}`);
                    }}
                  >
                    {parent.name}
                  </button>
                  {Array.isArray(parent.subcategories) && parent.subcategories.length > 0 ? (
                    <ul className="nav-mega-sublist">
                      {parent.subcategories.map((sub) => (
                        <li key={sub.id}>
                          <button
                            type="button"
                            className="nav-mega-sublink"
                            onClick={() => {
                              setHoveredCat(null);
                              navigate(`/shop?category_id=${sub.id}`);
                            }}
                          >
                            {sub.name}
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* RIGHT: search + actions */}
        <div className="nav-right">
          {/* Mobile-only search icon — taps straight to the shop/search page */}
          <button
            type="button"
            className="nav-mobile-search-btn"
            aria-label="Search"
            onClick={() => navigate("/shop")}
          >
            <IconSearch />
          </button>

          <form className="search-box" onSubmit={handleSearch}>
            <span className="search-icon-leading" aria-hidden="true">
              <IconSearch />
            </span>
            <input
              type="text"
              placeholder="Search fashion, electronics..."
              className="search-input"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search products"
            />
            <button type="submit" className="search-btn" aria-label="Search">
              <IconSearch />
            </button>
          </form>

          <button type="button" className="nav-action-btn" onClick={() => navigate("/cart")}>
            <span className="nav-action-icon">
              <IconCart />
              {cartCount > 0 && <span className="nav-count-badge">{cartCount}</span>}
            </span>
            <span className="nav-action-copy">
              <strong>Cart</strong>
            </span>
          </button>

          <button type="button" className="nav-action-btn" onClick={() => navigate("/wishlist")}>
            <span className="nav-action-icon wishlist-icon">
              <IconHeart />
            </span>
            <span className="nav-action-copy">
              <strong>Wishlist</strong>
            </span>
          </button>

          {isLoggedIn ? (
            <div className="profile-box" ref={profileRef} onClick={() => setProfileOpen((v) => !v)}>
              <span className="nav-action-icon">
                <IconUser />
              </span>
              <span className="nav-action-copy">
                <strong>{userName || "Account"}</strong>
              </span>
              {profileOpen && (
                <div className="profile-dropdown" onClick={(e) => e.stopPropagation()}>
                  <div onClick={() => { setProfileOpen(false); navigate("/account"); }}>
                    My Account
                  </div>
                  <div onClick={() => { setProfileOpen(false); navigate("/offers"); }}>
                    My Offers &amp; Rewards
                  </div>
                  <div onClick={() => { setProfileOpen(false); navigate("/customer-service"); }}>
                    Support
                  </div>
                  <div onClick={() => { setProfileOpen(false); navigate("/policies"); }}>
                    Policies
                  </div>
                  <div className="divider" />
                  <div
                    className="logout"
                    onClick={(e) => {
                      e.stopPropagation();
                      requestLogout();
                    }}
                  >
                    Logout
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button type="button" className="nav-action-btn" onClick={() => navigate("/login")}>
              <span className="nav-action-icon">
                <IconUser />
              </span>
              <span className="nav-action-copy">
                <strong>Login</strong>
              </span>
            </button>
          )}
        </div>

        {/* MOBILE DRAWER */}
        {drawerOpen && (
          <>
            <div className="nav-drawer-backdrop" onClick={closeDrawer} />
            <aside className="nav-drawer" role="dialog" aria-label="Menu">
              <div className="nav-drawer-header">
                {isLoggedIn ? (
                  <button
                    type="button"
                    className="nav-action-btn"
                    onClick={() => navigate("/account")}
                  >
                    <span className="nav-action-icon">
                      <IconUser />
                    </span>
                    <span className="nav-action-copy">
                      <strong>{userName || "Account"}</strong>
                    </span>
                  </button>
                ) : (
                  <button
                    type="button"
                    className="bf-btn-primary"
                    onClick={() => drawerNav("/login")}
                    style={{ width: "100%" }}
                  >
                    Login / Register
                  </button>
                )}
                <button
                  type="button"
                  className="nav-drawer-close"
                  aria-label="Close menu"
                  onClick={closeDrawer}
                >
                  ×
                </button>
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const q = searchQuery.trim();
                  closeDrawer();
                  navigate(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
                }}
              >
                <input
                  type="text"
                  className="nav-drawer-search"
                  placeholder="Search fashion, electronics..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </form>

              <div className="nav-drawer-section-title">SHOP</div>
              {CATEGORY_LINKS.map((cat) => (
                <button
                  key={cat.label}
                  type="button"
                  className="nav-drawer-link"
                  onClick={() => drawerNav(cat.path)}
                >
                  {cat.label}
                </button>
              ))}

              <div className="nav-drawer-section-title">ADMIN &amp; VENDOR</div>
              <button type="button" className="nav-drawer-link" onClick={() => drawerNav("/vendor")}>
                📦 Vendor Portal
              </button>
              <button type="button" className="nav-drawer-link" onClick={() => drawerNav("/vendor/add-product")}>
                ➕ Add Product
              </button>
              <button type="button" className="nav-drawer-link" onClick={() => drawerNav("/darkstore")}>
                🏪 Dark Store
              </button>

              <div className="nav-drawer-section-title">MORE</div>
              <button type="button" className="nav-drawer-link" onClick={() => drawerNav("/customer-service")}>
                Customer Service
              </button>
              <button type="button" className="nav-drawer-link" onClick={() => drawerNav("/policies")}>
                Policies
              </button>
              <button type="button" className="nav-drawer-link" onClick={() => drawerNav("/company")}>
                About BlinkieFash
              </button>

              {isLoggedIn && (
                <button type="button" className="nav-drawer-link nav-drawer-logout" onClick={requestLogout}>
                  Logout
                </button>
              )}
            </aside>
          </>
        )}

        <ConfirmDialog
          open={logoutConfirmOpen}
          title="Log out"
          message="Are you sure you want to log out?"
          confirmLabel="Log out"
          cancelLabel="Cancel"
          destructive
          loading={loggingOut}
          onConfirm={confirmLogout}
          onCancel={cancelLogout}
        />
      </header>
      <div className="navbar-spacer" aria-hidden="true" />
    </>
  );
}