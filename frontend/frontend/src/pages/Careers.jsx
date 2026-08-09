import { useNavigate } from "react-router-dom";
import { useState } from "react";
import "./companyLanding.css";
import LpNav from "../components/LpNav";
import Footer from "../components/Footer";

const perks = [
  { icon: "🚀", title: "High-Growth Startup", desc: "Be part of building Odisha's fastest growing fashion startup from the ground up." },
  { icon: "💰", title: "Competitive Pay", desc: "Fair salaries, performance bonuses, and delivery incentives for field roles." },
  { icon: "🕐", title: "Flexible Hours", desc: "Especially for delivery partners — choose hours that work for your schedule." },
  { icon: "📈", title: "Fast Growth", desc: "Small team means your work has immediate impact and quick career progression." },
  { icon: "🤝", title: "Great Culture", desc: "Young, energetic team that values ideas, speed, and getting things done." },
  { icon: "🏙️", title: "Local Impact", desc: "Help build the future of fashion delivery in Odisha's cities." },
];

const roles = [
  { title: "Delivery Partner", dept: "Operations", type: "Part-time / Full-time", city: "Cuttack, Bhubaneswar", desc: "Deliver fashion to customers within 60 minutes. Must have 2-wheeler. Flexible hours, weekly payouts." },
  { title: "Customer Support Executive", dept: "Support", type: "Full-time", city: "Bhubaneswar", desc: "Help customers with orders, returns, and queries. Excellent communication skills required." },
  { title: "Store Relationship Manager", dept: "Partnerships", type: "Full-time", city: "Cuttack, Bhubaneswar", desc: "Onboard and manage fashion store partners. Sales background preferred." },
  { title: "React Developer", dept: "Engineering", type: "Full-time", city: "Remote / Bhubaneswar", desc: "Build and improve the BlinkieFash web and mobile experience. React & Node.js required." },
  { title: "Social Media Manager", dept: "Marketing", type: "Part-time / Full-time", city: "Remote", desc: "Grow BlinkieFash's presence on Instagram, YouTube, and other platforms." },
  { title: "City Operations Lead", dept: "Operations", type: "Full-time", city: "Expansion Cities", desc: "Lead operations as we expand to new cities in Odisha. Strong logistics background needed." },
];

export default function Careers() {
  const [applied, setApplied] = useState(null);
  const navigate = useNavigate();

  return (
    <div className="lp">
      <LpNav active="Careers" />
      <div className="lp-body">

        <section className="cr-hero">
          <span className="lp-kicker">💼 We're Hiring</span>
          <h1>Build the Future of<br /><span className="lp-green">Fashion Delivery</span></h1>
          <p style={{fontSize:16,color:"#3d5042",lineHeight:1.7,maxWidth:540,margin:"14px auto 0"}}>Join a young, fast-moving team that's redefining how Odisha shops. Whether you love tech, people, or riding — we have a role for you.</p>
          <div className="cr-hero-stats">
            {[["6+","Open Roles"],["Cuttack","& Bhubaneswar"],["Growing","Team"],["Remote","Options Too"]].map(([v,l]) => (
              <div key={l} className="au-stat"><span className="au-stat-val">{v}</span><span className="au-stat-lbl">{l}</span></div>
            ))}
          </div>
        </section>

        <section className="au-section">
          <h2 className="au-section-title">Why Work at <span className="lp-green">BlinkieFash</span></h2>
          <div className="au-values-grid">
            {perks.map(p => (
              <div key={p.title} className="au-value-card">
                <span className="au-value-ico">{p.icon}</span>
                <h3>{p.title}</h3>
                <p>{p.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="au-section">
          <h2 className="au-section-title">Open <span className="lp-green">Positions</span></h2>
          <div className="cr-roles">
            {roles.map((r, i) => (
              <div key={i} className="cr-role-card">
                <div className="cr-role-top">
                  <div>
                    <h3>{r.title}</h3>
                    <div className="cr-role-meta">
                      <span className="cr-tag">{r.dept}</span>
                      <span className="cr-tag cr-tag-green">{r.type}</span>
                      <span className="cr-tag">📍 {r.city}</span>
                    </div>
                  </div>
                  <button className="lp-pc-btn cr-apply-btn" onClick={() => setApplied(r.title)}>
                    {applied === r.title ? "✓ Applied!" : "Apply Now"}
                  </button>
                </div>
                <p className="cr-role-desc">{r.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="au-cta">
          <h2>Don't See Your Role?</h2>
          <p>Send us your resume and we'll reach out when something fits.</p>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:20}}>
            <a href="mailto:careers@blinkiefash.in" className="lp-pc-btn" style={{textDecoration:"none"}}>📧 careers@blinkiefash.in</a>
            <button className="lp-pc-btn" style={{background:"transparent",border:"2px solid #149040",color:"#149040"}} onClick={() => navigate("/contact-us")}>Contact Us</button>
          </div>
        </section>

      </div>
      <Footer />
    </div>
  );
}
