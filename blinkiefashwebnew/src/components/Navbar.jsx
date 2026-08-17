import "./Navbar.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";

const LOGO_URL =
  "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg";

function readAuthFromStorage() {
  return {
    isLoggedIn: Boolean(localStorage.getItem("token")),
    userName: localStorage.getItem("userName") || "",
  };
}

export default function Navbar() {
  const [profileOpen, setProfileOpen] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(() => readAuthFromStorage().isLoggedIn);
  const [userName, setUserName] = useState(() => readAuthFromStorage().userName);

  const navigate = useNavigate();

  useEffect(() => {
    const syncAuth = () => {
      const next = readAuthFromStorage();
      setIsLoggedIn(next.isLoggedIn);
      setUserName(next.userName);
    };

    window.addEventListener("storage", syncAuth);
    return () => window.removeEventListener("storage", syncAuth);
  }, []);

  const closeDrawer = () => setDrawerOpen(false);

  const drawerNav = (path) => {
    closeDrawer();
    navigate(path);
  };

  const handleLogout = (e) => {
    e?.stopPropagation?.();
    localStorage.clear();
    setIsLoggedIn(false);
    setUserName("");
    setProfileOpen(false);
    closeDrawer();
    navigate("/login");
  };

  return (
    <header className="navbar">
      <button
        type="button"
        className="nav-hamburger"
        aria-label="Open menu"
        onClick={() => setDrawerOpen(true)}
      >
        <svg
          viewBox="0 0 24 24"
          width="24"
          height="24"
          fill="none"
          stroke="#111827"
          strokeWidth="2.2"
          strokeLinecap="round"
        >
          <path d="M3 6h18M3 12h18M3 18h18" />
        </svg>
      </button>

      <div className="nav-left">
        <img src={LOGO_URL} alt="Blinkiefash" className="logo-img" />

        <span
          className="brand"
          onClick={() => navigate("/")}
          style={{ cursor: "pointer" }}
        >
          <span className="brand-black">BLINKIE</span>
          <span className="brand-green">FASH</span>
        </span>

        <nav
          className="nav-links"
          style={{ display: "flex", gap: "20px", marginLeft: "40px" }}
        >
          <button
            type="button"
            onClick={() => navigate("/vendor")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Vendor Portal
          </button>
          <button
            type="button"
            onClick={() => navigate("/vendor/add-product")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
          >
            Add Product
          </button>
          <button
            type="button"
            onClick={() => navigate("/darkstore")}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: "500",
            }}
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
            <div className="avatar">
              {userName ? userName[0].toUpperCase() : "U"}
            </div>
            <div className="profile-text">
              <span>Hello</span>
              <strong>{userName || "User"}</strong>
            </div>

            {profileOpen && (
              <div className="profile-dropdown">
                <div onClick={() => navigate("/offers")}>
                  My Offers &amp; Rewards
                </div>
                <div onClick={() => navigate("/vendor")}>Vendor Dashboard</div>
                <div onClick={() => navigate("/customer-service")}>Support</div>
                <div onClick={() => navigate("/policies")}>Policies</div>
                <div className="divider" />
                <div className="logout" onClick={handleLogout}>
                  Logout
                </div>
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            className="bf-btn-primary"
            onClick={() => navigate("/login")}
          >
            Login
          </button>
        )}
      </div>

      {drawerOpen && (
        <>
          <div className="nav-drawer-backdrop" onClick={closeDrawer} />
          <aside className="nav-drawer" role="dialog" aria-label="Menu">
            <div className="nav-drawer-header">
              {isLoggedIn ? (
                <>
                  <div className="nav-drawer-avatar">
                    {userName ? userName[0].toUpperCase() : "U"}
                  </div>
                  <div>
                    <div className="nav-drawer-hello">Hello,</div>
                    <div className="nav-drawer-name">{userName || "User"}</div>
                  </div>
                </>
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

            <div className="nav-drawer-section-title">ADMIN &amp; VENDOR</div>
            <button
              type="button"
              className="nav-drawer-link"
              onClick={() => drawerNav("/vendor")}
            >
              📦 Vendor Portal
            </button>
            <button
              type="button"
              className="nav-drawer-link"
              onClick={() => drawerNav("/vendor/add-product")}
            >
              ➕ Add Product
            </button>
            <button
              type="button"
              className="nav-drawer-link"
              onClick={() => drawerNav("/darkstore")}
            >
              🏪 Dark Store
            </button>

            <div className="nav-drawer-section-title">MORE</div>
            <button
              type="button"
              className="nav-drawer-link"
              onClick={() => drawerNav("/customer-service")}
            >
              Customer Service
            </button>
            <button
              type="button"
              className="nav-drawer-link"
              onClick={() => drawerNav("/policies")}
            >
              Policies
            </button>
            <button
              type="button"
              className="nav-drawer-link"
              onClick={() => drawerNav("/company")}
            >
              About BlinkieFash
            </button>

            {isLoggedIn && (
              <button
                type="button"
                className="nav-drawer-link nav-drawer-logout"
                onClick={handleLogout}
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
