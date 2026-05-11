import "./Navbar.css";
import logo from "../assets/logo.png";
import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";

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

  return (
    <header className="navbar">
      <div className="nav-left">
        <img src={logo} alt="Blinkiefash" className="logo-img" />

        <span className="brand" 
            onClick={() => navigate("/home")}
              style={{ cursor: "pointer" }}
            >
          <span className="brand-black">BLINKIE</span>
          <span className="brand-green">FASH</span>
        </span>

        <div
          className="address-box"
          onClick={() => setAddressOpen(!addressOpen)}
        >
          <span className="address-top">DELIVER IN 60 MIN</span>
          <span className="address-bottom">
            {selectedCity} ▾
          </span>

          {addressOpen && (
            <div className="address-dropdown">
              <div onClick={() => {
                setSelectedCity("Bhubaneswar");
                localStorage.setItem('selectedCity', "Bhubaneswar");
              }}>
                Bhubaneswar
              </div>
              <div onClick={() => {
                setSelectedCity("Cuttack");
                localStorage.setItem('selectedCity', "Cuttack");
              }}>
                Cuttack
              </div>
              <div
                className="location-action"
                onClick={handleUseCurrentLocation}
              >
                {locating ? "Detecting location..." : "Use Current Location"}
              </div>
              <div className="divider" />
              <div className="add-address">+ Add address</div>
            </div>
          )}
        </div>

        <nav className="nav-links">
          {tabs.map((tab) => (
            <span
              key={tab}
              className={`nav-item ${
                activeTab === tab ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(tab);
                handleTabNavigation(tab);
              }}
            >
              {tab}
            </span>
          ))}
        </nav>
      </div>

      <div className="nav-right">
        <input
          className="search-box"
          placeholder="Search for apparels, brands & trends"
        />

        <button
          className="nav-action-btn"
          onClick={() => navigate(isLoggedIn ? '/wishlist' : '/login')}
          title="Go to Wishlist"
        >
          <span className="nav-action-icon wishlist-icon">
            <svg viewBox="0 0 24 24">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {wishlistCount > 0 ? <span className="nav-count-badge">{wishlistCount}</span> : null}
          </span>
          <span className="nav-action-copy">
            <strong>Wishlist</strong>
          </span>
        </button>

        <button 
          className="nav-action-btn"
          onClick={() => navigate(isLoggedIn ? '/cart' : '/login')}
          title="Go to Cart"
        >
          <span className="nav-action-icon cart-icon">
            <svg viewBox="0 0 24 24">
              <path d="M6 6h15l-1.5 9h-12z" />
              <circle cx="9" cy="21" r="1" />
              <circle cx="18" cy="21" r="1" />
            </svg>
            {cartCount > 0 ? <span className="nav-count-badge">{cartCount}</span> : null}
          </span>
          <span className="nav-action-copy">
            <strong>Cart</strong>
          </span>
        </button>

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
                <div>My Profile</div>
                <div>Orders</div>
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
    </header>
  );
}