import "./Home.css";
import homeImg from "../assets/home1.png";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
function Home() {
  const navigate = useNavigate();

  const topCategories = [
    { label: "Dresses", img: "/images/dresses.png", url: "/catalog?category=Dresses" },
    { label: "Men's Topwear", img: "/images/Menstopwear.png", url: "/catalog?department=men&category=Topwear" },
    { label: "Women's Ethnic", img: "/images/Womenethnic.png", url: "/catalog?category=Ethnic" },
    { label: "Ethnic Wear", img: "/images/Ethnicwear.png", url: "/catalog?category=Ethnic%20Wear" },
    { label: "Bottomwear", img: "/images/bottomwear.png", url: "/catalog?category=Bottomwear" },
    { label: "Women's Topwear", img: "/images/womentopwear.png", url: "/catalog?category=Topwear" },
    { label: "Handbags", img: "/images/handbag.png", url: "/catalog?category=Handbags" },
    { label: "Beauty", img: "/images/beauty.png", url: "/catalog?department=beauty&category=Beauty" },
    { label: "Footwear", img: "/images/shoes.png", url: "/catalog?category=Footwear" },
    { label: "Jewellery", img: "/images/J.png", url: "/catalog?category=Jewellery" },
    { label: "Travel", img: "/images/travel.png", url: "/catalog?category=Travel" },
    { label: "Home Decor", img: "/images/homeliving.png", url: "/catalog?department=home-living&category=Home%20Decor" },
  ];

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
    {topCategories.map((item, index) => (
      <div className="category-card" key={index} onClick={() => navigate(item.url)} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate(item.url)}>
        <img src={item.img} alt={item.label} />
        <h4>{item.label}</h4>
        <span>Explore →</span>
      </div>
    ))}
  </div>
</section>
<Footer />

    </div>
  );
}
export default Home;
