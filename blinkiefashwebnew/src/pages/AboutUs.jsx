import { useNavigate } from "react-router-dom";
import "./companyLanding.css";
import LpNav from "../components/LpNav";
import Footer from "../components/Footer";

const values = [
  { icon: "⚡", title: "Speed First", desc: "We built our entire operation around 60-minute delivery. Every decision puts speed without compromise at the center." },
  { icon: "🤝", title: "Trust & Transparency", desc: "Try Before You Buy exists because fashion should be experienced, not guessed. We stand behind every product." },
  { icon: "🌱", title: "Community Growth", desc: "We partner with local fashion stores to help them reach more customers and grow their business." },
  { icon: "🔄", title: "Customer Obsession", desc: "From hassle-free returns to 24/7 support, every experience is designed around making you feel taken care of." },
];

const milestones = [
  { year: "2023", event: "BlinkieFash founded in Cuttack, Odisha with a vision for 60-min fashion delivery." },
  { year: "2024", event: "Launched Try Before You Buy — a first in Odisha's fashion delivery space." },
  { year: "2024", event: "Expanded to Bhubaneswar. Crossed 100+ partner stores and 4.8★ rating." },
  { year: "2025", event: "Launched BlinkieFash mobile app on Google Play. 300+ orders delivered." },
  { year: "2026", event: "Expanding to Berhampur, Rourkela, Puri and more cities across Odisha." },
];

export default function AboutUs() {
  const navigate = useNavigate();
  return (
    <div className="lp">
      <LpNav active="About Us" />
      <div className="lp-body">

        <section className="au-hero">
          <div className="au-hero-left">
            <span className="lp-kicker">🏆 Our Story</span>
            <h1>Reimagining Fashion<br /><span className="lp-green">Delivery in Odisha</span></h1>
            <p style={{fontSize:16,lineHeight:1.7,color:"#3d5042",margin:"14px 0 22px"}}>BlinkieFash was born from a simple frustration — great fashion nearby, but no fast way to get it. We built the solution: shop from local stores, try at home, pay for what you keep — all in 60 minutes.</p>
            <div style={{display:"flex",gap:12,flexWrap:"wrap"}}>
              <button className="lp-pc-btn" onClick={() => navigate("/stores")}>Explore Stores →</button>
              <button className="lp-pc-btn" style={{background:"transparent",border:"2px solid #149040",color:"#149040"}} onClick={() => navigate("/careers")}>Join Our Team</button>
            </div>
          </div>
          <div className="au-stat-grid">
            {[["300+","Orders Delivered"],["4.8★","Customer Rating"],["100+","Partner Stores"],["2","Cities & Growing"]].map(([val,lbl]) => (
              <div key={lbl} className="au-stat"><span className="au-stat-val">{val}</span><span className="au-stat-lbl">{lbl}</span></div>
            ))}
          </div>
        </section>

        <section className="au-mission">
          <div>
            <h2>Our <span className="lp-green">Mission</span></h2>
            <p className="au-mission-quote">"To make fashion accessible to every household in Odisha — delivered in 60 minutes, tried at home, and loved before you pay."</p>
            <p style={{color:"#4d6551",lineHeight:1.7}}>We believe fashion should be effortless, local, and lightning fast. By connecting you with the best nearby stores, we're making that a reality.</p>
          </div>
          <div className="au-pills">
            {["📍 Cuttack","⚡ 60 Min Delivery","👗 Try Before Buy","🏪 Local Stores","📦 Free Returns","📍 Bhubaneswar"].map(p => (
              <span key={p} className="au-pill">{p}</span>
            ))}
          </div>
        </section>

        <section className="au-section">
          <h2 className="au-section-title">What We <span className="lp-green">Stand For</span></h2>
          <div className="au-values-grid">
            {values.map(v => (
              <div key={v.title} className="au-value-card">
                <span className="au-value-ico">{v.icon}</span>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="au-section">
          <h2 className="au-section-title">Our <span className="lp-green">Journey</span></h2>
          <div className="au-timeline">
            {milestones.map((m, i) => (
              <div key={i} className="au-milestone">
                <div className="au-mile-year">{m.year}</div>
                <div className="au-mile-dot" />
                <p className="au-mile-event">{m.event}</p>
              </div>
            ))}
          </div>
        </section>

        <div className="au-team-credit">
          <p className="au-credit-ceo">CEO — Alakananda Bag</p>
          <p className="au-credit-label">Created by</p>
          <p className="au-credit-by">Satyam Mohanty &middot; Dibyajyoti Mohanty &middot; K Medha Rani</p>
        </div>

        <section className="au-cta">
          <h2>Ready to Experience BlinkieFash?</h2>
          <p>Download the app and get your first fashion order in 60 minutes.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:20}}>
            <button className="lp-store-btn lp-sb-dark" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app","_blank","noopener,noreferrer")}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3.18 23.76a2.48 2.48 0 0 0 2.63-.17l12.4-7.29-2.73-2.73zM.5 1.26C.19 1.6 0 2.12 0 2.82v18.37c0 .69.19 1.21.51 1.55l.08.08 10.3-10.29v-.24zM20.1 9.85l-2.85-1.67-3.06 3.06 3.07 3.06 2.85-1.67c.81-.48.81-1.26 0-1.74zm-19.1 12.5 11.74-6.9-2.73-2.73z"/></svg>
              <span><small>GET IT ON</small><strong>Google Play</strong></span>
            </button>
            <button className="lp-pc-btn" onClick={() => navigate("/contact-us")}>Contact Us →</button>
          </div>
        </section>

      </div>
      <Footer />
    </div>
  );
}