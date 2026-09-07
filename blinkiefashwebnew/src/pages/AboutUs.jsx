import { useNavigate } from "react-router-dom";
import "./companyLanding.css";
import "./aboutUs.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

const heroStats = [
  { val: "60 Mins", lbl: "Express SLA", sub: "Doorstep in an hour" },
  { val: "300+", lbl: "Orders Delivered", sub: "Rapidly growing daily" },
  { val: "4.8 ★", lbl: "User Rating", sub: "From verified buyers" },
  { val: "100+", lbl: "Partner Brands", sub: "Puma, Libas, FCUK & more" },
  { val: "2 Cities", lbl: "Twin City Network", sub: "Bhubaneswar & Cuttack" },
  { val: "MSME", lbl: "Startup Odisha", sub: "Accredited Enterprise" },
];

const boardMembers = [
  {
    initials: "SKM",
    name: "Sanjaya Kumar Mohanty",
    role: "Director",
    tag: "Strategic Vision & Corporate Governance",
    desc: "Provides strategic counsel, governance oversight, state policy alignment, and capital scaling roadmaps for BlinkieFash's statewide rollout.",
  },
  {
    initials: "SM",
    name: "Sasmita Mohanty",
    role: "Director",
    tag: "Brand Partnerships & Regional Growth",
    desc: "Leads premier fashion label onboarding, ethnic master weaver tie-ups, regional merchandising partnerships, and organizational culture.",
  },
];

const executiveTeam = [
  {
    initials: "SM",
    name: "Satyam Mohanty",
    role: "Founder",
    tag: "Chief Product Visionary & Innovation Lead",
    desc: "Conceptualized BlinkieFash's quick-commerce model in Odisha. Drives platform architecture, real-time routing algorithms, and consumer mobile application experience.",
  },
  {
    initials: "AB",
    name: "Alakananda Bag",
    role: "Chief Executive Officer",
    tag: "Scale, Operations & Strategic Execution",
    desc: "Directs day-to-day scaling, unit economics, rider safety, retail store integration, and tactical fleet distribution across twin cities.",
  },
];

const techTeam = [
  {
    initials: "AKD",
    name: "Asish Kumar Das",
    role: "Operations",
    title: "Operational Manager",
    desc: "Supervises hyper-local supply routes, hub inventory accuracy, rider fleet dispatch, and SLA enforcement for sub-60 min delivery.",
    footer: "Supply Chain, Hub Logistics & 60-Min Mesh",
  },
  {
    initials: "DJM",
    name: "Dibyajyoti Mohanty",
    role: "Engineering",
    title: "Web Developer",
    desc: "Architects distributed catalog systems, realtime inventory sockets, order queuing pipelines, and lightning-fast web infrastructure.",
    footer: "Full-Stack & Real-time Architecture",
  },
  {
    initials: "KMR",
    name: "K Medha Rani",
    role: "Engineering",
    title: "Web Developer",
    desc: "Engineers slick mobile web experiences, sub-second search interactions, responsive typography, and checkout flows for thousands of shoppers.",
    footer: "Frontend UI Engineer & Interactivity",
  },
];

const featurePills = [
  "📍 Cuttack Hub",
  "⚡ 60 Min Delivery",
  "👗 Try Before Buy",
  "🏪 100+ Partner Stores",
  "📦 Zero-Friction Returns",
  "📍 Bhubaneswar Hub",
  "🌱 Odisha Handloom & Craft",
  "🛡️ 100% Authentic Brands",
];

const brands = [
  {
    img: "https://lh3.googleusercontent.com/aida/AEtjO1WqhO9N4M6ixia0lljNhbuXdUW-BA0mR-0Ze5rI3ymQXTz7xOI-ExG3eYnJ9Ybrlpq-9xXIwfKWQoh4s6RlfnyyChr1CcRE9bmSa_DBgbHMKayibCN19Mq5Nm1F_O_0c2Y3-9_T-0HCt1Y2YVaiLpDnArUKMvvC6NyP5DWpAEfcNjw3M1oKaiZuLUsDIDlRB8ErH6OaFg0vUHEnN9tKMcERYbD_5zfsBjZbll2x1XHzn-P81HOAYnOXglw",
    alt: "Puma at BlinkieFash",
    tag: "Sportswear & Athleisure",
    name: "PUMA Official",
    desc: "Footwear, activewear & running tees delivered in 60 mins.",
  },
  {
    img: "https://lh3.googleusercontent.com/aida/AEtjO1WfV-xNVRSJiTZVqP_rmcgmNyRT3bbzg1Df9bor3cvRJxaYkKkeyYJIqQk1MMWc8xZNe0tAN9hreP0jn15bMdQ1T8-P0R9fSTdfemzBcJxKV9Axcp5GJa7ypzNcIWI9P_nz8-ZA62pADJQZyqo2dwzb7ChPD-ctaZDEPDjzZZtry6bm2YIr6hcMCuNg8sF3X3fv363sBrJOmi5Q-FZ3h1yQt_Yowq4EOkFharHFa2wkuj_Zp7tHZaBUihlM",
    alt: "Libas at BlinkieFash",
    tag: "Women's Ethnic Couture",
    name: "Libas Exclusive",
    desc: "Designer kurtis, shararas & festive sets on your doorstep.",
  },
  {
    img: "https://lh3.googleusercontent.com/aida/AEtjO1X7YJEQhD9Li7UQrPeLcBUougjM9iUAZQ321RICb1EtxpNBo-fIeBDVC82M6Yshomj-tUQuoyXTyXyDoFXietwfTbV6cM8Hk8BYTyP5p6luN_9QdAxlCIIW2OWkSb9yjNPC8_q0tSE0KSE4rx7BTOXF9iFRbDDgQfoLSV3QZJF5NW-ThI7_-FcgJE0PKq8ehJwT6vSm8wUZRt7huM7sE_vprbevSynZP3ZG8g2MUft5ILWoKA-u2wvjYhep",
    alt: "FCUK & French Connection at BlinkieFash",
    tag: "Modern Streetwear",
    name: "FCUK / French Connection",
    desc: "Bold graphic tees, chinos and outerwear ready on demand.",
  },
  {
    img: "https://lh3.googleusercontent.com/aida/AEtjO1WL6fJ3R9BVzo5tQIFUdzVd7GsbtFH9VNpzUIYkXNxyT-T6CEEWmGyVKN76yEjEVTTWUMMIRE7tBDJK5r0ZXUP_FFjf4yfWV3ipnQNXd9bc8D1bacsI9YbnOJRbQI3pvLdiv9pAaafjLKGz9MJ_py30QRQWktPxTHYA659tjgrP4VXqepV8yjnL-QE0p7idSqRieG8B3qmSegqlOfn33y5t8Q71zJ26CmqpayiRb3HQv0KYJsBxDe2fiOBT",
    alt: "MK Fashion Ethnic Collection",
    tag: "Regional Handloom & Style",
    name: "MK Fashion",
    desc: "Ethnic roots meet contemporary tailoring for every celebration.",
  },
];

const codeValues = [
  {
    icon: "⚡",
    title: "Hyper-Speed Logistics",
    desc: "Eliminating multi-day shipping friction with strategically placed micro-fulfillment dark hubs and sub-60 min express doorstep dispatch.",
  },
  {
    icon: "🛡️",
    title: "100% Authentic Brands",
    desc: "Direct brand partnerships ensure only pristine, original fashion items and certified regional master weaves ever reach your doorstep.",
  },
  {
    icon: "😊",
    title: "Customer-First Culture",
    desc: "Try Before You Buy empowers you to try garments for 10 minutes before confirming payment, backed by instant doorstep exchanges.",
  },
  {
    icon: "💻",
    title: "Tech-Driven Reliability",
    desc: "Algorithmic inventory balancing, intelligent route clustering, and sub-second socket pipelines provide predictable delivery precision.",
  },
];

const hubs = [
  { name: "Saheed Nagar", status: "Bhubaneswar Live" },
  { name: "Patia Infocity", status: "Bhubaneswar Live" },
  { name: "CDA Sector 6", status: "Cuttack Live" },
  { name: "Rourkela Hub", status: "Coming Q3 2025" },
];

const milestones = [
  {
    year: "2023",
    title: "Founded in Cuttack",
    event: "Pioneered the vision of delivering apparel faster than food in Odisha's historic silver city.",
  },
  {
    year: "2024",
    title: "Startup Odisha",
    event: "Formal accreditation under Govt. of Odisha MSME. Rolled out first 'Try Before You Buy' pilot.",
  },
  {
    year: "2024",
    title: "Bhubaneswar Launch",
    event: "Crossed 100+ top brand partnerships and set up dark hubs in Saheed Nagar and Patia Infocity.",
  },
  {
    year: "2025",
    title: "Android App Launch",
    event: "Debuted the BlinkieFash mobile app on Google Play with live delivery tracking and instant doorstep trial.",
  },
  {
    year: "2026",
    title: "Statewide Expansion",
    event: "Expanding 60-min delivery arrays to Berhampur, Rourkela, Sambalpur, and Puri.",
  },
];

export default function AboutUs() {
  const navigate = useNavigate();
  return (
    <div className="lp">
      <Navbar />
      <div className="lp-body abt-page-body">

        {/* Verification sub-bar */}
        <div className="abt-verify-bar">
          <span className="abt-verify-left">
            <span className="abt-verify-badge">✔ Startup Odisha Accredited Startup</span>
            <span className="abt-verify-sep">•</span>
            <span>Govt. of Odisha Recognition ID: OD-ST-2024-BF</span>
          </span>
          <span className="abt-verify-right">
            <span className="abt-verify-hub">📍 Active Hubs: Saheed Nagar &amp; CDA Sector 6</span>
            <span className="abt-verify-sep">•</span>
            <span className="abt-verify-trial">Doorstep Trial &amp; Free 10-Min Exchange</span>
          </span>
        </div>

        {/* Hero */}
        <section className="abt-hero">
          <div className="abt-hero-badges">
            <span className="lp-kicker">🏆 Our Story &amp; Quick-Commerce Revolution</span>
            <span className="abt-badge-amber">🏛️ Recognized by Startup Odisha</span>
            <span className="abt-badge-live"><span className="abt-live-dot" /> Live in Bhubaneswar &amp; Cuttack</span>
          </div>
          <h1 className="abt-hero-title">
            Reimagining Fashion Delivery in Odisha.<br />
            <span className="abt-hero-gradient">Hyperlocal Speed. Delivered in 60 Minutes.</span>
          </h1>
          <p className="abt-hero-copy">
            BlinkieFash connects you to 100+ partner stores and premier brands across Odisha with doorstep trial, instant return, and lightning-fast dispatch. From trend-setting streetwear to authentic Sambalpuri ethnic couture, enjoy runway-grade apparel at your doorstep in under an hour.
          </p>
          <div className="abt-hero-actions">
            <button className="lp-pc-btn" onClick={() => navigate("/stores")}>Explore Partner Stores →</button>
            <button className="abt-btn-outline" onClick={() => navigate("#team-section")}>👥 Meet the Leadership</button>
          </div>
          <div className="abt-hero-stats">
            {heroStats.map((s) => (
              <div key={s.lbl} className="abt-hero-stat">
                <span className="abt-hero-stat-val">{s.val}</span>
                <span className="abt-hero-stat-lbl">{s.lbl}</span>
                <span className="abt-hero-stat-sub">{s.sub}</span>
              </div>
            ))}
          </div>
        </section>

        {/* Startup Odisha spotlight */}
        <section className="abt-gov">
          <div className="abt-gov-left">
            <span className="abt-gov-tag">✔ Government Recognized Startup Ecosystem</span>
            <h2 className="abt-gov-title">
              Empowered by Startup Odisha.<br />
              <span className="abt-gov-highlight">Building for Odisha, Scaling for India.</span>
            </h2>
            <p>Startup Odisha is the flagship initiative under the MSME Department, Government of Odisha, dedicated to fostering high-impact tech entrepreneurship, local employment, and indigenous commerce breakthroughs.</p>
            <p>As a formally recognized enterprise, BlinkieFash leverages institutional backing to scale proprietary route-optimization, deploy EV-assisted dark hubs, and generate dignified fulfillment opportunities for Odisha's youth.</p>
          </div>
          <div className="abt-gov-card">
            <div className="abt-gov-card-head">
              <span>⭐ Innovation Credential</span>
              <span className="abt-gov-verified">Verified Entity</span>
            </div>
            <div className="abt-gov-recog">
              <span>Recognition Number</span>
              <strong>OD-ST-2024-BF</strong>
            </div>
            <div className="abt-gov-mini-stats">
              <div><strong>150+</strong><span>Local Jobs Created</span></div>
              <div><strong>100%</strong><span>Indigenous IP</span></div>
            </div>
            <div className="abt-gov-foot">✔ Incubated in Odisha's Digital Tech Mesh</div>
          </div>
        </section>

        {/* Leadership */}
        <section className="au-section" id="team-section">
          <div className="abt-team-head">
            <div>
              <span className="abt-eyebrow">GOVERNANCE &amp; ARCHITECTS</span>
              <h2 className="au-section-title">Executive Leadership &amp; Board</h2>
              <p className="abt-team-sub">The visionary leadership and technical builders executing the 60-minute quick-fashion infrastructure across Odisha.</p>
            </div>
            <span className="abt-pillar-badge">7 Core Pillars</span>
          </div>

          <div className="abt-team-group">
            <div className="abt-group-head"><span className="abt-dot abt-dot-green" />Board of Directors</div>
            <div className="abt-cards abt-cards-2">
              {boardMembers.map((m) => (
                <div key={m.name} className="abt-person-card">
                  <div className="abt-avatar abt-avatar-light">{m.initials}</div>
                  <div className="abt-person-body">
                    <div className="abt-person-row">
                      <span className="abt-role-tag">{m.role}</span>
                      <span className="abt-check">✔</span>
                    </div>
                    <h4>{m.name}</h4>
                    <p className="abt-person-tag">{m.tag}</p>
                    <p className="abt-person-desc">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="abt-team-group">
            <div className="abt-group-head"><span className="abt-dot abt-dot-primary" />Executive Leadership</div>
            <div className="abt-cards abt-cards-2">
              {executiveTeam.map((m) => (
                <div key={m.name} className="abt-person-card abt-person-card-dark">
                  <div className="abt-avatar abt-avatar-dark">{m.initials}</div>
                  <div className="abt-person-body">
                    <div className="abt-person-row">
                      <span className="abt-role-tag abt-role-tag-lime">{m.role}</span>
                      <span className="abt-check abt-check-lime">⚡</span>
                    </div>
                    <h4>{m.name}</h4>
                    <p className="abt-person-tag abt-person-tag-lime">{m.tag}</p>
                    <p className="abt-person-desc abt-person-desc-dark">{m.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="abt-team-group">
            <div className="abt-group-head"><span className="abt-dot abt-dot-secondary" />Operational &amp; Tech Team</div>
            <div className="abt-cards abt-cards-3">
              {techTeam.map((m) => (
                <div key={m.name} className="abt-tech-card">
                  <div className="abt-tech-head">
                    <div className="abt-avatar abt-avatar-sm">{m.initials}</div>
                    <div>
                      <span className="abt-role-tag">{m.role}</span>
                      <h4>{m.name}</h4>
                      <p className="abt-person-tag">{m.title}</p>
                    </div>
                  </div>
                  <p className="abt-person-desc">{m.desc}</p>
                  <div className="abt-tech-foot">{m.footer}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Purpose banner */}
        <section className="au-section">
          <div className="abt-purpose-banner">
            <div className="abt-purpose-copy">
              <span className="abt-eyebrow abt-eyebrow-light">OUR PURPOSE &amp; COMMITMENT</span>
              <h2>"To make fashion accessible to every household in Odisha — delivered in 60 minutes, tried at home, and loved before you pay."</h2>
              <p>No waiting 4 to 7 days for national courier vans. Your favorite styles from top regional and global labels reach your living room in the time it takes to grab a coffee.</p>
            </div>
            <div className="abt-purpose-card">
              <span className="abt-purpose-icon">👗</span>
              <span className="abt-purpose-card-title">Try Before You Buy</span>
              <span className="abt-purpose-card-sub">Rider waits 10 mins at doorstep</span>
              <span className="abt-purpose-card-tag">Zero Extra Cost</span>
            </div>
          </div>

          <div className="abt-pills">
            {featurePills.map((p) => <span key={p} className="au-pill">{p}</span>)}
          </div>

          <div className="abt-brands-grid">
            {brands.map((b) => (
              <div key={b.name} className="abt-brand-card">
                <img src={b.img} alt={b.alt} className="abt-brand-img" />
                <div className="abt-brand-body">
                  <span className="abt-brand-tag">{b.tag}</span>
                  <h4>{b.name}</h4>
                  <p>{b.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* The BlinkieFash Code */}
        <section className="au-section">
          <div className="abt-center-head">
            <span className="abt-eyebrow">THE BLINKIEFASH CODE</span>
            <h2 className="au-section-title">Engineered for Velocity &amp; Trust</h2>
            <p className="abt-team-sub">Our day-to-day operations balance software precision with radical consumer obsession.</p>
          </div>
          <div className="au-values-grid">
            {codeValues.map((v) => (
              <div key={v.title} className="au-value-card">
                <span className="au-value-ico">{v.icon}</span>
                <h3>{v.title}</h3>
                <p>{v.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Fulfillment mesh */}
        <section className="au-section">
          <div className="abt-mesh-card">
            <div className="abt-mesh-left">
              <span className="abt-mesh-badge">🔗 Hyperlocal Dark-Hub Network</span>
              <h3>Strategic Fulfillment Mesh</h3>
              <p>Our rapid response units are positioned near Odisha's densest urban corridors, ensuring instant order batching and rapid bike fleet deployment.</p>
              <div className="abt-mesh-grid">
                {hubs.map((h) => (
                  <div key={h.name} className="abt-mesh-hub">
                    <span className="abt-mesh-hub-name">{h.name}</span>
                    <span className="abt-mesh-hub-status">{h.status}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="abt-mesh-right">
              <div className="abt-mesh-stat abt-mesh-stat-green">
                <span className="abt-mesh-stat-ico">⏱️</span>
                <div><strong>60 Mins</strong><span>Standard Express SLA</span></div>
              </div>
              <div className="abt-mesh-stat">
                <span className="abt-mesh-stat-ico">✔</span>
                <div><strong>99.4%</strong><span>On-Time Dispatch Rate</span></div>
              </div>
            </div>
          </div>
        </section>

        {/* Journey */}
        <section className="au-section">
          <div className="abt-center-head">
            <span className="abt-eyebrow">OUR JOURNEY</span>
            <h2 className="au-section-title">From Idea to Odisha's #1 Fashion Hub</h2>
            <p className="abt-team-sub">A rapid trajectory of quick-commerce innovation.</p>
          </div>
          <div className="abt-journey-grid">
            {milestones.map((m) => (
              <div key={m.title} className="abt-journey-card">
                <span className="abt-journey-year">{m.year}</span>
                <h4>{m.title}</h4>
                <p>{m.event}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Final CTA */}
        <section className="abt-final-cta">
          <div className="abt-final-copy">
            <span className="abt-final-kicker">⚡ JOIN THE FASHION REVOLUTION</span>
            <h2>Experience Fashion in a Blink.</h2>
            <p>Download the BlinkieFash Android app for real-time live rider tracking, doorstep trial scheduling, and instant 60-minute doorstep fashion dispatch.</p>
          </div>
          <div className="abt-final-actions">
            <button className="lp-store-btn lp-sb-dark" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app", "_blank", "noopener,noreferrer")}>
              <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3.18 23.76a2.48 2.48 0 0 0 2.63-.17l12.4-7.29-2.73-2.73zM.5 1.26C.19 1.6 0 2.12 0 2.82v18.37c0 .69.19 1.21.51 1.55l.08.08 10.3-10.29v-.24zM20.1 9.85l-2.85-1.67-3.06 3.06 3.07 3.06 2.85-1.67c.81-.48.81-1.26 0-1.74zm-19.1 12.5 11.74-6.9-2.73-2.73z" /></svg>
              <span><small>GET IT ON</small><strong>Google Play</strong></span>
            </button>
            <a className="abt-mail-btn" href="mailto:contact@blinkiefash.in">✉️ Contact Us</a>
          </div>
        </section>

      </div>
      <Footer />
    </div>
  );
}