import { useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import "./companyLanding.css";
import LpNav from "../components/LpNav";
import Footer from "../components/Footer";
import { API_BASE_URL } from "../apiBase";

const steps = [
  { icon: "📍", title: "Find Nearby Stores", desc: "We show you fashion stores within your delivery zone in Cuttack & Bhubaneswar." },
  { icon: "🛍️", title: "Browse & Order", desc: "Pick your favorite outfits, sizes, and colors — order directly through the app." },
  { icon: "⏱️", title: "60-Min Delivery", desc: "Our delivery partner picks up from the store and brings it to your door in 60 minutes." },
  { icon: "👗", title: "Try Before You Pay", desc: "Try at home. Pay only for what you keep. Return the rest — no questions asked." },
];

const CITY_FILTERS = ["All", "Cuttack", "Bhubaneswar"];

export default function Stores() {
  const navigate = useNavigate();
  const [stores, setStores] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [city, setCity] = useState("All");
  const [search, setSearch] = useState("");

  useEffect(() => {
    Promise.all([
      fetch(`${API_BASE_URL}/api/vendor`).then(r => r.json()),
      fetch(`${API_BASE_URL}/api/brands`).then(r => r.json()),
    ]).then(([storeData, brandData]) => {
      setStores(Array.isArray(storeData) ? storeData : []);
      setBrands(Array.isArray(brandData) ? brandData : []);
      setLoading(false);
    }).catch(() => { setError("Could not load data. Please try again."); setLoading(false); });
  }, []);

  const filtered = stores.filter(s => {
    const matchCity = city === "All" || s.city === city;
    const matchSearch = !search || s.store_name.toLowerCase().includes(search.toLowerCase()) || (s.description || "").toLowerCase().includes(search.toLowerCase());
    return matchCity && matchSearch;
  });

  return (
    <div className="lp">
      <LpNav active="Stores" />
      <div className="lp-body">

        {/* HERO */}
        <section className="st-hero">
          <div>
            <span className="lp-kicker">🏪 {stores.length}+ Partner Stores</span>
            <h1>Shop From Your<br /><span className="lp-green">Nearest Fashion Store</span></h1>
            <p style={{fontSize:16,color:"#3d5042",lineHeight:1.7,margin:"14px 0 22px"}}>Browse top fashion stores nearby. Order through the app and get delivery in 60 minutes — or try before you buy.</p>
            <button className="lp-pc-btn" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app","_blank","noopener,noreferrer")}>Browse on App →</button>
          </div>
          <div className="au-stat-grid">
            {[[stores.length+"","Partner Stores"],["2","Cities"],["60 Min","Delivery"],["4.8★","Rating"]].map(([v,l]) => (
              <div key={l} className="au-stat"><span className="au-stat-val">{v}</span><span className="au-stat-lbl">{l}</span></div>
            ))}
          </div>
        </section>

        {/* BRANDS WE CARRY */}
        {brands.length > 0 && (
          <section className="au-section">
            <h2 className="au-section-title">Brands We <span className="lp-green">Carry</span></h2>
            <div className="st-brands-row">
              {brands.map(b => (
                <div key={b.id} className="st-brand-logo-card">
                  {b.logo_url ? (
                    <img src={b.logo_url} alt={b.name} onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex'; }} />
                  ) : null}
                  <div className="st-brand-name-placeholder" style={{display: b.logo_url ? 'none' : 'flex'}}>
                    {b.name.charAt(0)}
                  </div>
                  <span>{b.name}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* HOW IT WORKS */}
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

        {/* STORES GRID */}
        <section className="au-section">
          <h2 className="au-section-title">Partner <span className="lp-green">Stores</span></h2>

          {/* Filters */}
          <div className="st-filters">
            <div className="st-cats">
              {CITY_FILTERS.map(c => (
                <button key={c} className={city===c?"st-cat-btn active":"st-cat-btn"} onClick={() => setCity(c)}>{c === "All" ? "🌍 All Cities" : c === "Cuttack" ? "📍 Cuttack" : "📍 Bhubaneswar"}</button>
              ))}
            </div>
            <div className="st-search-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="16" height="16"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              <input className="st-search" type="text" placeholder="Search stores..." value={search} onChange={e => setSearch(e.target.value)} />
            </div>
          </div>

          {loading && (
            <div className="st-loading">
              {[1,2,3,4,5,6].map(i => <div key={i} className="st-skeleton" />)}
            </div>
          )}

          {error && <p style={{textAlign:"center",color:"#dc2626",padding:"20px"}}>{error}</p>}

          {!loading && !error && filtered.length === 0 && (
            <p style={{textAlign:"center",color:"#4d6551",padding:"20px"}}>No stores found. Try a different filter.</p>
          )}

          {!loading && !error && filtered.length > 0 && (
            <div className="st-brands-grid">
              {filtered.map(store => (
                <div key={store.id} className="st-brand-card">
                  <div className="st-brand-img">
                    <img
                      src={store.vendor_img_url || "/images/home-section.png"}
                      alt={store.store_name}
                      onError={e => { e.target.src = "/images/home-section.png"; }}
                    />
                    {store.is_verified && <span className="st-verified-badge">✓ Verified</span>}
                  </div>
                  <div className="st-brand-info">
                    <strong>{store.store_name}</strong>
                    <span className="st-brand-cat">{store.description || "Fashion Store"}</span>
                    <div className="st-brand-meta">
                      <span>📍 {store.city}</span>
                      <span>{store.address}</span>
                    </div>
                    <div className="st-brand-meta" style={{marginTop:4}}>
                      <span>📌 {store.pincode}</span>
                      <span>🏍️ {store.service_radius_km}km radius</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <p style={{textAlign:"center",color:"#4d6551",marginTop:16,fontSize:13}}>
            Showing {filtered.length} of {stores.length} stores. More stores joining daily.
          </p>
        </section>

        {/* CTA */}
        <section className="au-cta">
          <h2>Own a Fashion Store?</h2>
          <p>Join {stores.length}+ retailers growing with BlinkieFash. Reach thousands of customers in your city.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:20}}>
            <button className="lp-pc-btn" style={{background:"#fff",color:"#149040"}} onClick={() => navigate("/")}>Become a Partner →</button>
            <button className="lp-pc-btn" style={{background:"transparent",border:"2px solid #fff",color:"#fff"}} onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app","_blank","noopener,noreferrer")}>Download App</button>
          </div>
        </section>

      </div>
      <Footer />
    </div>
  );
}
