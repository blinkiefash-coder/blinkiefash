import "./Navbar.css";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";

const LOGO_URL = "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg";

export default function Navbar({ active }) {
  const [activeTab, setActiveTab] = useState(active || "ALL");
  const [selectedCity, setSelectedCity] = useState("Bhubaneswar");
  const [addressOpen, setAddressOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [userName, setUserName] = useState("");
  const [locating, setLocating] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [cartCount, setCartCount] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();

  const resolveActiveTabFromPath = () => {
    const path = location.pathname.toLowerCase();
    const params = new URLSearchParams(location.search);
    const department = (params.get("department") || "").toLowerCase();

    if (path === "/women") return "WOMEN";
    if (department === "women") return "WOMEN";
    if (department === "men") return "MEN";
    if (department === "kids") return "KIDS";
    if (department === "beauty") return "BEAUTY";
    if (department === "home-living") return "HOMELIVING";
    return "ALL";
  };

  const handleTabNavigation = (tab) => {
    if (tab === "WOMEN") {
      navigate("/women");
      return;
    }

    if (tab === "ALL") {
      navigate("/shop");
      return;
    }

    if (tab === "MEN") {
      navigate("/catalog?department=men");
      return;
    }

    if (tab === "KIDS") {
      navigate("/catalog?department=kids");
      return;
    }

    if (tab === "BEAUTY") {
      navigate("/catalog?department=beauty");
      return;
    }

    if (tab === "HOMELIVING") {
      navigate("/catalog?department=home-living");
      return;
    }

    navigate("/shop");
  };

  const loadActionCounts = async () => {
    const userId = localStorage.getItem("userUuid");
    if (!userId) {
      setWishlistCount(0);
      setCartCount(0);
      return;
    }

    try {
      const [wishlistRes, cartRes] = await Promise.all([
        fetch(`${API_API_BASE_URL}/wishlist/${userId}`),
        fetch(`${API_API_BASE_URL}/cart/${userId}`),
      ]);

      const [wishlistData, cartData] = await Promise.all([
        wishlistRes.json(),
        cartRes.json(),
      ]);

      setWishlistCount(Array.isArray(wishlistData.items) ? wishlistData.items.length : 0);
      setCartCount(
        Array.isArray(cartData.items)
          ? cartData.items.reduce((sum, item) => sum + Number(item.quantity || 0), 0)
          : 0
      );
    } catch {
      setWishlistCount(0);
      setCartCount(0);
    }
  };

  useEffect(() => {
    const token = localStorage.getItem('token');
    const name = localStorage.getItem('userName');
    const savedCity = localStorage.getItem('selectedCity');
    setIsLoggedIn(!!token);
    setUserName(name || "");
    if (savedCity) setSelectedCity(savedCity);
    if (token) {
      loadActionCounts();
    }

    const handleWishlistUpdate = () => loadActionCounts();
    const handleCartUpdate = () => loadActionCounts();
    const handleStorage = () => {
      const nextToken = localStorage.getItem('token');
      setIsLoggedIn(!!nextToken);
      setUserName(localStorage.getItem('userName') || "");
      if (nextToken) loadActionCounts();
      else {
        setWishlistCount(0);
        setCartCount(0);
      }
    };

    window.addEventListener("wishlist:updated", handleWishlistUpdate);
    window.addEventListener("cart:updated", handleCartUpdate);
    window.addEventListener("storage", handleStorage);

    return () => {
      window.removeEventListener("wishlist:updated", handleWishlistUpdate);
      window.removeEventListener("cart:updated", handleCartUpdate);
      window.removeEventListener("storage", handleStorage);
    };
  }, []);

  useEffect(() => {
    setActiveTab(active || resolveActiveTabFromPath());
  }, [active, location.pathname, location.search]);

  const handleUseCurrentLocation = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported in this browser");
      return;
    }

    setLocating(true);

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          const { latitude, longitude } = position.coords;
          const response = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}`
          );
          const data = await response.json();
          const detectedCity =
            data?.address?.city ||
            data?.address?.town ||
            data?.address?.village ||
            data?.address?.county ||
            "Current Location";

          setSelectedCity(detectedCity);
          localStorage.setItem('selectedCity', detectedCity);
          setAddressOpen(false);
        } catch {
          setSelectedCity("Current Location");
          localStorage.setItem('selectedCity', "Current Location");
          setAddressOpen(false);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        alert("Unable to fetch your current location");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const tabs = ["ALL", "WOMEN", "MEN", "KIDS", "BEAUTY", "HOMELIVING"];

  const closeDrawer = () => setDrawerOpen(false);
  const drawerNav = (path) => {
    closeDrawer();
    navigate(path);
  };

  return (
    <header className="navbar">
      {/* ===== Mobile-only hamburger ===== */}
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

      <div className="nav-left">
        <img src={LOGO_URL} alt="Blinkiefash" className="logo-img" />

        <span className="brand" 
            onClick={() => navigate("/")}
              style={{ cursor: "pointer" }}
            >
          <span className="brand-black">BLINKIE</span>
          <span className="brand-green">FASH</span>
        </span>

        {/* Admin/Vendor Navigation Links - Hidden on mobile */}
        <nav className="nav-links" style={{ display: 'flex', gap: '20px', marginLeft: '40px' }}>
          <button
            type="button"
            onClick={() => navigate('/vendor')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Vendor Portal
          </button>
          <button
            type="button"
            onClick={() => navigate('/vendor/add-product')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Add Product
          </button>
          <button
            type="button"
            onClick={() => navigate('/darkstore')}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', fontWeight: '500' }}
          >
            Dark Store
          </button>
        </nav>
      </div>

      <div className="nav-right">
        {isLoggedIn ? (
          <div
            className="profile-box"
            onClick={() => setProfileOpen(!profileOpen)}
          >
            <div className="avatar">{userName ? userName[0].toUpperCase() : "U"}</div>
            <div className="profile-text">
              <span>Hello</span>
              <strong>{userName || "User"}</strong>
            </div>

            {profileOpen && (
              <div className="profile-dropdown">
                <div onClick={() => navigate('/offers')}>My Offers &amp; Rewards</div>
                <div onClick={() => navigate('/vendor')}>Vendor Dashboard</div>
                <div onClick={() => navigate('/customer-service')}>Support</div>
                <div onClick={() => navigate('/policies')}>Policies</div>
                <div className="divider" />
                <div 
                  className="logout"
                  onClick={(e) => {
                    e.stopPropagation();
                    localStorage.clear();
                    setIsLoggedIn(false);
                    setUserName("");
                    setWishlistCount(0);
                    setCartCount(0);
                    setProfileOpen(false);
                    navigate('/login');
                  }}
                >
                  Logout
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            className="login-btn"
            onClick={() => navigate('/login')}
          >
            Login
          </button>
        )}
      </div>

      {/* ===== Mobile drawer (visible <= 900px) ===== */}
      {drawerOpen && (
        <>
          <div className="nav-drawer-scrim" onClick={closeDrawer} />
          <aside className="nav-drawer" role="dialog" aria-modal="true">
            <div className="nav-drawer-header">
              {isLoggedIn ? (
                <>
                  <div className="nav-drawer-avatar">{userName ? userName[0].toUpperCase() : "U"}</div>
                  <div>
                    <div className="nav-drawer-hello">Hello,</div>
                    <div className="nav-drawer-name">{userName || "User"}</div>
                  </div>
                </>
              ) : (
                <button
                  className="bf-btn-primary"
                  onClick={() => drawerNav('/login')}
                  style={{ width: '100%' }}
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

            <div className="nav-drawer-section-title">ADMIN & VENDOR</div>
            <button type="button" className="nav-drawer-link" onClick={() => drawerNav('/vendor')}>
              📦 Vendor Portal
            </button>
            <button type="button" className="nav-drawer-link" onClick={() => drawerNav('/vendor/add-product')}>
              ➕ Add Product
            </button>
            <button type="button" className="nav-drawer-link" onClick={() => drawerNav('/darkstore')}>
              🏪 Dark Store
            </button>

            <div className="nav-drawer-section-title">MORE</div>
            <button type="button" className="nav-drawer-link" onClick={() => drawerNav('/customer-service')}>Customer Service</button>
            <button type="button" className="nav-drawer-link" onClick={() => drawerNav('/policies')}>Policies</button>
            <button type="button" className="nav-drawer-link" onClick={() => drawerNav('/company')}>About BlinkieFash</button>

            {isLoggedIn && (
              <button
                type="button"
                className="nav-drawer-link nav-drawer-logout"
                onClick={() => {
                  localStorage.clear();
                  setIsLoggedIn(false);
                  setUserName("");
                  setWishlistCount(0);
                  setCartCount(0);
                  closeDrawer();
                  navigate('/login');
                }}
              >
                ⎋ Logout
              </button>
            )}
          </aside>
        </>
      )}
    </header>
  );
}