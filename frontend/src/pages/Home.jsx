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

  </div>

  {/* RIGHT PANEL */}
  <div className="hero-right">
    <img src={homeImg} alt="Fashion banner" />
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
  {/* TOP TRUST STRIP */}
  {/* ================= FEATURES STRIP ================= */}
<section className="features-strip">
  <div className="feature-item">
    <img src="/images/Payment.png" alt="Secure Payments" />
    <span>Secure Payments</span>
  </div>

  <div className="feature-item">
    <img src="/images/verified.png" alt="Genuine Products" />
    <span>Genuine Products</span>
  </div>

  <div className="feature-item">
    <img src="/images/cloth.png" alt="Try & Buy" />
    <span>Try & Buy</span>
  </div>

  <div className="feature-item">
    <img src="/images/return.png" alt="7 Day Return" />
    <span>7 Day Return</span>
  </div>

  <div className="feature-item social">
    <img src="/images/insta.png"/>
    <span>Show us some ❤️ on our social media</span>
  </div>
</section>

  {/* MAIN FOOTER */}
  <div className="footer-main">
    {/* BRAND + APP */}
    <div className="footer-col brand-col">
      <div className="footer-brand">
  <img src={logo} alt="Blinkiefash Logo" className="footer-logo-img" />
  <h1 className="footer-logo-text">
    BLINKIE<span>FASH</span>
  </h1>
</div>
      <p>Experience the Blinkiefash app on your mobile.</p>

      <div className="app-buttons">
        <button>Get it on Google Play</button>
        <button>Download on App Store</button>
      </div>

      <div className="newsletter">
        <input placeholder="Enter your email" />
        <button>SUBSCRIBE</button>
      </div>
    </div>

    {/* HELP */}
    <div className="footer-col">
      <h3>HELP</h3>
      <ul>
        <li>Contact Us</li>
        <li>FAQs</li>
        <li>Track Order</li>
        <li>Careers</li>
        <li>Sitemap</li>
      </ul>
    </div>

    {/* QUICK LINKS */}
    <div className="footer-col">
      <h3>QUICK LINKS</h3>
      <ul>
        <li>Offer Zone</li>
        <li>Brands</li>
      </ul>
    </div>

    {/* TOP CATEGORIES */}
    <div className="footer-col">
      <h3>TOP CATEGORIES</h3>
      <ul>
        <li>Top Wear</li>
        <li>Bottom Wear</li>
        <li>Ethnic</li>
        <li>Dresses</li>
        <li>Sleep Wear</li>
        <li>Inner Wear</li>
      </ul>
    </div>

    {/* POLICIES */}
    <div className="footer-col">
      <h3>POLICIES</h3>
      <ul>
        <li onClick={() => navigate("/vendor")}>Become a Seller</li>
        <li>Terms & Conditions</li>
        <li>Privacy Policy</li>
        <li>Refund Policy</li>
        <li>Return & Exchange</li>
        <li>Shipping Policy</li>
      </ul>
    </div>
  </div>

  {/* BOTTOM BAR */}
  <div className="footer-bottom">
    © 2026 Blinkiefash. All rights reserved.
  </div>
</footer>

    </div>
  );
}
export default Home;
