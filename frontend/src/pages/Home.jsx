import "./Home.css";
import logo from "../assets/logo.png";
import homeImg from "../assets/home1.png";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
function Home() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [selectedCity, setSelectedCity] = useState("Bhubaneswar");
  const [addressOpen, setAddressOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const navigate = useNavigate();
  const tabs = ["ALL", "WOMEN", "MEN", "KIDS", "BEAUTY", "HOMELIVING"];

  return (
    <div className="home">

      <div className="top-gradient" />

      {/* ================= NAVBAR ================= */}
     <Navbar />
     {/* ================= HERO ================= */}
<section className="hero-card">

  {/* LEFT PANEL */}
  <div className="hero-left">
    <div className="delivery-box">
      DELIVERY IN 60 MINUTES</div>

    <h1 className="hero-title1">
      <span className="font-posterama">Fashion at your</span><br />
      
    </h1>
    <h1 className="hero-title2">
      <span className="font-rockwell">DOORSTEP, FAST</span>
    </h1>

    <p className="subtext">
      Curated apparel & accessories. Try at home — pay only for what you keep.
    </p>

    
<button
  className="primary-btn"
  onClick={() => navigate("/shop")}
>
  Shop Now
</button>

    <div className="hero-features">
      <div className="hero-feature-item">
        <span className="hero-feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3 5 6.5v5.5c0 4.4 3 7.86 7 9 4-1.14 7-4.6 7-9V6.5L12 3Z" />
            <path d="m9.25 12.25 1.9 1.9 3.6-4.15" />
          </svg>
        </span>
        <div>
          <strong>100% Original</strong>
          <span>Genuine Products</span>
        </div>
      </div>

      <div className="hero-feature-item">
        <span className="hero-feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 5a7 7 0 1 1-7 7" />
            <path d="M12 1.75V5h3.25" />
            <path d="M5.6 18.4 3 21" />
          </svg>
        </span>
        <div>
          <strong>Easy Returns</strong>
          <span>Hassle-free returns</span>
        </div>
      </div>

      <div className="hero-feature-item">
        <span className="hero-feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7.5 10V7.75a4.5 4.5 0 1 1 9 0V10" />
            <path d="M6 10h12v10H6V10Z" />
            <path d="M12 13.5v3" />
          </svg>
        </span>
        <div>
          <strong>Secure Payments</strong>
          <span>Safe &amp; trusted</span>
        </div>
      </div>
    </div>

  </div>

  {/* RIGHT PANEL */}
  <div className="hero-right">
    <img src={homeImg} alt="Fashion banner" />
  </div>

</section>

<section className="store-banner">
  <div className="store-banner-content">
    <span className="store-banner-eyebrow">VISIT STORE</span>

    <h2 className="store-banner-title">
      Experience <span>Fashion</span> In Person
    </h2>

    <p className="store-banner-copy">
      Reserve online. Try in-store. Pick up instantly.
    </p>

    <div className="store-banner-features">
      <div className="store-feature-item">
        <span className="store-feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M7 8V6.75C7 4.68 8.68 3 10.75 3h2.5C15.32 3 17 4.68 17 6.75V8" />
            <path d="M4.5 8.5h15l-1.1 10.38a2 2 0 0 1-1.99 1.79H7.59a2 2 0 0 1-1.99-1.79L4.5 8.5Z" />
            <path d="M9.25 12.5a.75.75 0 1 0 0 .01" />
            <path d="M14.75 12.5a.75.75 0 1 0 0 .01" />
          </svg>
        </span>
        <div>
          <strong>RESERVE ONLINE</strong>
          <span>Add your favorites</span>
        </div>
      </div>

      <div className="store-feature-item">
        <span className="store-feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M4 20V8.5A2.5 2.5 0 0 1 6.5 6H17" />
            <path d="M7 20V11.5A1.5 1.5 0 0 1 8.5 10H20" />
            <path d="M10 20V13.5A1.5 1.5 0 0 1 11.5 12H20V20H10Z" />
            <path d="M13 15.5h4" />
          </svg>
        </span>
        <div>
          <strong>PICK UP IN STORE</strong>
          <span>Fast &amp; easy</span>
        </div>
      </div>

      <div className="store-feature-item">
        <span className="store-feature-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none">
            <path d="M12 3.5 20 9v6L12 20.5 4 15V9l8-5.5Z" />
            <path d="M12 3.5V10m0 0 5.5 3.25M12 10 6.5 13.25" />
            <path d="m9.5 12.75 5-2.75" />
          </svg>
        </span>
        <div>
          <strong>EXCLUSIVE IN-STORE</strong>
          <span>Offers &amp; benefits</span>
        </div>
      </div>
    </div>

    <button
      className="store-banner-btn"
      onClick={() => navigate("/explore-shops")}
    >
      Explore Stores
    </button>
  </div>

  <div className="store-banner-visual">
    <img src="/images/home-store.png" alt="Blinkiefash store interior" />
  </div>
</section>

{/* ================= TOP CATEGORIES ================= */}
<section className="top-categories">
  <h2 className="section-title">TOP CATEGORIES</h2>
  <p className="section-subtitle">Your one-stop shop for Crazy deals, Delivered in a BLINK ⚡️</p>

  <div className="categories-grid">
    {[
      { label: "Dresses", img: "/images/dresses.png" },
      { label: "Men's Topwear", img: "/images/Menstopwear.png" },
      { label: "Women's Ethnic", img: "/images/Womenethnic.png" },
      { label: "Ethnic Wear", img: "/images/Ethnicwear.png" },
      { label: "Bottomwear", img: "/images/bottomwear.png" },
      { label: "Women's Topwear", img: "/images/womentopwear.png" },
      { label: "Handbags", img: "/images/handbag.png" },
      { label: "Beauty", img: "/images/beauty.png" },
      { label: "Footwear", img: "/images/shoes.png" },
      { label: "Jewellery", img: "/images/J.png" },
      { label: "Travel", img: "/images/travel.png" },
      { label: "Home Decor", img: "/images/homeliving.png" },
    ].map((item, index) => (
      <div className="category-card" key={index}>
        <img src={item.img} alt={item.label} />
        <h4>{item.label}</h4>
        <span>Explore →</span>
      </div>
    ))}
  </div>
</section>
{/* ================= FOOTER ================= */}
<footer className="footer">
  <div className="footer-main">
    <div className="footer-brand-col">
      <div className="footer-brand">
        <img src={logo} alt="Blinkiefash Logo" className="footer-logo-img" />
        <h1 className="footer-logo-text">
          BLINKIE<span>FASH</span>
        </h1>
      </div>
      <p className="footer-copyright">© 2024 BlinkieFash. All rights reserved.</p>
    </div>

    <div className="footer-col">
      <h3>CUSTOMER SERVICE</h3>
      <ul>
        <li>Contact Us</li>
        <li>FAQs</li>
        <li>Shipping &amp; Delivery</li>
        <li>Returns &amp; Refunds</li>
      </ul>
    </div>

    <div className="footer-col">
      <h3>COMPANY</h3>
      <ul>
        <li>About Us</li>
        <li>Careers</li>
        <li>Blinkie Blog</li>
        <li>Press &amp; Media</li>
      </ul>
    </div>

    <div className="footer-col">
      <h3>POLICIES</h3>
      <ul>
        <li>Privacy Policy</li>
        <li>Terms of Service</li>
        <li>Cancellation Policy</li>
        <li>EPR Compliance</li>
        <li className="footer-seller-link" onClick={() => navigate("/vendor")}>Become a Seller</li>
      </ul>
    </div>

    <div className="footer-col footer-app-col">
      <h3>GET THE APP</h3>
      <div className="app-buttons">
        <button className="store-badge" type="button">
          <span className="store-badge-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M16.84 12.94c-.02-2.32 1.9-3.43 1.98-3.48-1.08-1.58-2.76-1.8-3.36-1.82-1.43-.14-2.8.84-3.52.84-.73 0-1.85-.82-3.04-.8-1.56.02-3 .91-3.8 2.31-1.62 2.81-.41 6.98 1.16 9.25.77 1.11 1.69 2.35 2.89 2.31 1.16-.05 1.6-.75 3-.75 1.41 0 1.8.75 3.03.72 1.25-.02 2.03-1.12 2.79-2.24.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.41-.92-2.43-3.74Zm-1.79-6.42c.63-.77 1.06-1.84.94-2.91-.91.04-2.01.61-2.66 1.38-.58.67-1.08 1.75-.95 2.79 1.01.08 2.04-.51 2.67-1.26Z" />
            </svg>
          </span>
          <span className="store-badge-text">
            <small>Download on the</small>
            <strong>App Store</strong>
          </span>
        </button>
        <button className="store-badge" type="button">
          <span className="store-badge-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M3.61 2.23 13.8 12 3.61 21.77c-.29-.19-.48-.52-.48-.9V3.13c0-.38.19-.71.48-.9Zm11.58 11.1 2.6 2.49-10.5 5.92 7.9-8.41Zm3.56-2.01 2.48 1.4c.84.47.84 1.68 0 2.15l-2.48 1.4L15.7 12l3.05-1.68ZM7.29 2.26l10.5 5.92-2.6 2.49-7.9-8.41Z" />
            </svg>
          </span>
          <span className="store-badge-text">
            <small>GET IT ON</small>
            <strong>Google Play</strong>
          </span>
        </button>
      </div>
    </div>

    <div className="footer-col footer-social-col">
      <h3>FOLLOW US</h3>
      <div className="footer-socials">
        <button className="social-icon" type="button" aria-label="Facebook">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.5 21v-7.26h2.44l.37-2.83H13.5V9.11c0-.82.23-1.38 1.4-1.38h1.5V5.19c-.26-.03-1.16-.11-2.21-.11-2.19 0-3.69 1.34-3.69 3.79v2.04H8v2.83h2.5V21h3Z" />
          </svg>
        </button>
        <button className="social-icon" type="button" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="none">
            <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
            <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
          </svg>
        </button>
        <button className="social-icon" type="button" aria-label="Twitter">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.9 7.14c.01.16.01.32.01.48 0 4.91-3.74 10.57-10.57 10.57-2.1 0-4.06-.62-5.7-1.67.29.03.58.04.88.04 1.74 0 3.35-.59 4.62-1.59-1.63-.03-3-1.11-3.47-2.59.23.04.46.07.7.07.33 0 .65-.04.95-.13-1.7-.34-2.98-1.84-2.98-3.64v-.05c.5.28 1.08.45 1.69.47-1-.67-1.65-1.8-1.65-3.08 0-.68.18-1.31.5-1.85 1.83 2.25 4.57 3.73 7.66 3.88-.06-.27-.1-.55-.1-.84 0-2.03 1.65-3.68 3.69-3.68 1.06 0 2.02.45 2.69 1.17.84-.16 1.63-.47 2.34-.89-.28.86-.86 1.57-1.63 2.02.75-.09 1.47-.29 2.13-.59-.5.75-1.12 1.41-1.84 1.94Z" />
          </svg>
        </button>
        <button className="social-icon" type="button" aria-label="YouTube">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M21.58 7.19a2.98 2.98 0 0 0-2.1-2.11C17.63 4.5 12 4.5 12 4.5s-5.63 0-7.48.58a2.98 2.98 0 0 0-2.1 2.11A31.2 31.2 0 0 0 2 12a31.2 31.2 0 0 0 .42 4.81 2.98 2.98 0 0 0 2.1 2.11C6.37 19.5 12 19.5 12 19.5s5.63 0 7.48-.58a2.98 2.98 0 0 0 2.1-2.11c.28-1.58.42-3.18.42-4.81s-.14-3.23-.42-4.81ZM10 15.5v-7l6 3.5-6 3.5Z" />
          </svg>
        </button>
      </div>
    </div>
  </div>
</footer>

    </div>
  );
}
export default Home;
