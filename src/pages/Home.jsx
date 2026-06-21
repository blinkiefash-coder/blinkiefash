import "./Home.css";
import homeImg from "../assets/home1.png";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function Home() {
  const navigate = useNavigate();
  const selectedCity = localStorage.getItem("selectedCity") || "Bhubaneswar";

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

  const quickOptions = [
    { title: "Orders", subtitle: "Track and reorder", to: "/orders" },
    { title: "Wishlist", subtitle: "Your saved picks", to: "/wishlist" },
    { title: "Refer & Earn", subtitle: "Invite and reward", to: "/refer-earn" },
    { title: "Donate Clothes", subtitle: "Get next-order discount", to: "/donate-clothes" },
  ];

  return (
    <div className="home mobile-replica-home">
      <Navbar />

      <div className="home-shell">
        <section className="mh-location-bar" role="button" tabIndex={0} onClick={() => navigate("/shop")} onKeyDown={(e) => e.key === "Enter" && navigate("/shop")}>
          <div>
            <p className="mh-location-label">Deliver in 60 mins to</p>
            <p className="mh-location-city">{selectedCity}</p>
          </div>
          <span className="mh-pill">60 MIN DELIVERY</span>
        </section>

        <section className="mh-hero" onClick={() => navigate("/shop")} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate("/shop")}>
          <div className="mh-hero-copy">
            <p className="mh-eyebrow">TRENDING NOW</p>
            <h1>Fashion delivered fast</h1>
            <p>Try at home, keep what you love.</p>
            <button className="mh-primary" type="button" onClick={(e) => { e.stopPropagation(); navigate("/shop"); }}>
              Shop now
            </button>
          </div>
          <img src={homeImg} alt="Fashion collection" />
        </section>

        <section className="mh-feature-row" aria-label="Shopping features">
          <article>
            <strong>60 MIN</strong>
            <span>Fast delivery</span>
          </article>
          <article>
            <strong>TRY & BUY</strong>
            <span>At-home fitting</span>
          </article>
          <article>
            <strong>EASY</strong>
            <span>Quick returns</span>
          </article>
          <article>
            <strong>SECURE</strong>
            <span>Safe payments</span>
          </article>
        </section>

        <section className="mh-section">
          <div className="mh-section-head">
            <h2>Quick options</h2>
          </div>
          <div className="mh-options-grid">
            {quickOptions.map((item) => (
              <button key={item.title} className="mh-option-card" type="button" onClick={() => navigate(item.to)}>
                <strong>{item.title}</strong>
                <span>{item.subtitle}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mh-section">
          <div className="mh-section-head">
            <h2>Explore categories</h2>
            <button type="button" onClick={() => navigate("/shop")}>View all</button>
          </div>
          <div className="mh-category-strip">
            {topCategories.slice(0, 8).map((item) => (
              <button key={item.label} type="button" className="mh-category-chip" onClick={() => navigate(item.url)}>
                <span className="mh-category-media">
                  <img src={item.img} alt={item.label} />
                </span>
                <span>{item.label}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mh-store-banner" onClick={() => navigate("/explore-shops")} role="button" tabIndex={0} onKeyDown={(e) => e.key === "Enter" && navigate("/explore-shops")}>
          <div>
            <p className="mh-eyebrow">VISIT STORE</p>
            <h3>Reserve online, try in store</h3>
            <p>Use the same picks from app and web for instant pickup.</p>
            <button className="mh-secondary" type="button" onClick={(e) => { e.stopPropagation(); navigate("/explore-shops"); }}>
              Explore stores
            </button>
          </div>
          <img src="/images/home-store.png" alt="Store experience" />
        </section>

        <section className="mh-section">
          <div className="mh-section-head">
            <h2>Top categories</h2>
          </div>
          <div className="mh-categories-grid">
            {topCategories.map((item) => (
              <button key={item.label} type="button" className="mh-category-card" onClick={() => navigate(item.url)}>
                <img src={item.img} alt={item.label} />
                <h4>{item.label}</h4>
                <span>Explore</span>
              </button>
            ))}
          </div>
        </section>

        <Footer />
      </div>

      <nav className="mh-bottom-nav" aria-label="Mobile quick navigation">
        <button type="button" className="active" onClick={() => navigate("/home")}>Home</button>
        <button type="button" onClick={() => navigate("/shop")}>Categories</button>
        <button type="button" onClick={() => navigate("/orders")}>Orders</button>
        <button type="button" onClick={() => navigate(localStorage.getItem("token") ? "/wishlist" : "/login")}>Wishlist</button>
      </nav>

    </div>
  );
}
export default Home;
