import { useNavigate } from "react-router-dom";
import "./companyLanding.css";
import LpNav from "../components/LpNav";
import Footer from "../components/Footer";
import { useState } from "react";

const categories = ["All","Men's Fashion","Women's Fashion","Kids","Ethnic Wear","Western Wear","Footwear","Accessories","Jewellery"];

const brands = [
  { name: "FashionHub", category: "Men's Fashion", city: "Cuttack", img: "/images/Men-section.png", rating: 4.8, orders: "120+" },
  { name: "EthnicVibe", category: "Women's Fashion", city: "Bhubaneswar", img: "/images/Women-section.png", rating: 4.9, orders: "95+" },
  { name: "TrendZone", category: "Western Wear", city: "Cuttack", img: "/images/Women-section.png", rating: 4.7, orders: "80+" },
  { name: "KidsCorner", category: "Kids", city: "Bhubaneswar", img: "/images/Men-section.png", rating: 4.8, orders: "60+" },
  { name: "SilkRoute", category: "Ethnic Wear", city: "Cuttack", img: "/images/Ethnicwear.png", rating: 4.9, orders: "110+" },
  { name: "FootFirst", category: "Footwear", city: "Bhubaneswar", img: "/images/shoes.png", rating: 4.6, orders: "70+" },
  { name: "GlamBag", category: "Accessories", city: "Cuttack", img: "/images/handbag.png", rating: 4.7, orders: "55+" },
  { name: "GoldLeaf", category: "Jewellery", city: "Bhubaneswar", img: "/images/J.png", rating: 4.8, orders: "45+" },
];

const steps = [
  { icon: "📍", title: "Find Nearby Stores", desc: "We show you fashion stores within your delivery zone in Cuttack & Bhubaneswar." },
  { icon: "🛍️", title: "Browse & Order", desc: "Pick your favorite outfits, sizes, and colors — order directly through the app." },
  { icon: "⏱️", title: "60-Min Delivery", desc: "Our delivery partner picks up from the store and brings it to your door in 60 minutes." },
  { icon: "👗", title: "Try Before You Pay", desc: "Try at home. Pay only for what you keep. Return the rest — no questions asked." },
];

export default function Stores() {
  const navigate = useNavigate();
  const [cat, setCat] = useState("All");
  const filtered = cat === "All" ? brands : brands.filter(b => b.category === cat);

  return (
    <div className="lp">
      <LpNav active="Stores" />
      <div className="lp-body">

        <section className="st-hero">
          <div>
            <span className="lp-kicker">🏪 100+ Partner Stores</span>
            <h1>Shop From Your<br /><span className="lp-green">Nearest Fashion Store</span></h1>
            <p style={{fontSize:16,color:"#3d5042",lineHeight:1.7,margin:"14px 0 22px"}}>Browse top fashion brands nearby. Order through the app and get delivery in 60 minutes — or try before you buy.</p>
            <button className="lp-pc-btn" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app","_blank","noopener,noreferrer")}>Browse on App →</button>
          </div>
          <div className="st-hero-stats">
            {[["100+","Partner Stores"],["2","Cities"],["500+","Brands Available"],["60 Min","Delivery"]].map(([v,l]) => (
              <div key={l} className="au-stat"><span className="au-stat-val">{v}</span><span className="au-stat-lbl">{l}</span></div>
            ))}
          </div>
        </section>

        <section className="au-section">
          <h2 className="au-section-title">How It <span className="lp-green">Works</span></h2>
          <div className="st-steps">
            {steps.map((s,i) => (
              <div key={i} className="st-step">
                <div className="st-step-ico">{s.icon}</div>
                <div className="st-step-num">{i+1}</div>
                <h3>{s.title}</h3>
                <p>{s.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="au-section">
          <h2 className="au-section-title">Partner <span className="lp-green">Brands</span></h2>
          <div className="st-cats">
            {categories.map(c => (
              <button key={c} className={cat===c?"st-cat-btn active":"st-cat-btn"} onClick={() => setCat(c)}>{c}</button>
            ))}
          </div>
          <div className="st-brands-grid">
            {filtered.map(b => (
              <div key={b.name} className="st-brand-card">
                <div className="st-brand-img"><img src={b.img} alt={b.name} /></div>
                <div className="st-brand-info">
                  <strong>{b.name}</strong>
                  <span className="st-brand-cat">{b.category}</span>
                  <div className="st-brand-meta">
                    <span>⭐ {b.rating}</span>
                    <span>📦 {b.orders} orders</span>
                    <span>📍 {b.city}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <p style={{textAlign:"center",color:"#4d6551",marginTop:16,fontSize:13}}>More brands available in the app. Download to see all stores near you.</p>
        </section>

        <section className="au-cta">
          <h2>Own a Fashion Store?</h2>
          <p>Join 100+ retailers growing with BlinkieFash. Reach thousands of customers in your city.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:20}}>
            <button className="lp-pc-btn" onClick={() => navigate("/")}>Become a Partner →</button>
            <button className="lp-pc-btn" style={{background:"transparent",border:"2px solid #149040",color:"#149040"}} onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app","_blank","noopener,noreferrer")}>Download App</button>
          </div>
        </section>

      </div>
      <Footer />
    </div>
  );
}
