import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./staticInfoPages.css";

export default function Company() {
  const navigate = useNavigate();

  return (
    <div className="info-page company-page">
      <header className="info-header" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>
        <img src={logo} alt="Blinkiefash" />
        <h1 className="info-brand">BLINKIE<span>FASH</span></h1>
      </header>

      <main className="info-body">
        <section className="info-hero">
          <div className="info-hero-left">
            <h2 className="info-page-title">COMPANY</h2>
            <h3 className="info-page-subtitle">Building the future of fast fashion commerce.</h3>
            <p>
              We combine speed, style, and technology to create a next-generation shopping
              experience for modern India.
            </p>
          </div>
          <div className="info-hero-visual" aria-hidden="true" />
        </section>

        <section className="info-grid info-grid-2">
          <article className="info-card info-card-wide">
            <h5>About Us</h5>
            <p className="sub">Fashion delivered in a blink</p>
            <p>
              Blinkiefash connects customers with nearby trusted vendors for ultra-fast,
              reliable, and authentic shopping experiences.
            </p>
            <div className="info-mini-columns">
              <div>
                <p className="sub">Our Vision</p>
                <p>To become India's fastest and most loved fashion delivery platform.</p>
              </div>
              <div>
                <p className="sub">Our Mission</p>
                <ul>
                  <li>Deliver fashion instantly</li>
                  <li>Empower local vendors</li>
                  <li>Create seamless shopping experiences</li>
                </ul>
              </div>
            </div>
          </article>

          <article className="info-card info-card-wide">
            <h5>Careers</h5>
            <p className="sub">Build the future of fast fashion commerce</p>
            <p>We are looking for creative thinkers, developers, designers, and operators who want to transform shopping experiences in India.</p>
            <p className="sub">Open Roles</p>
            <ul>
              <li>UI and UX Designers</li>
              <li>Frontend and Backend Developers</li>
              <li>Delivery Operations</li>
              <li>Marketing and Brand</li>
              <li>Vendor Relations and Customer Success</li>
            </ul>
            <p>Send your resume to: careers@blinkiefash.in</p>
          </article>

          <article className="info-card info-card-wide">
            <h5>BLINKIEFASH Blog</h5>
            <p className="sub">Trends. Fashion. Technology. Lifestyle.</p>
            <p>Stay updated with what's trending, delivered in a blink.</p>
          </article>

          <article className="info-card info-card-wide">
            <h5>Press and Media</h5>
            <p className="sub">Media and collaboration enquiries</p>
            <p>BLINKIEFASH is transforming local fashion retail with ultra-fast delivery and technology-driven experiences.</p>
            <ul>
              <li>Brand collaborations</li>
              <li>Interviews and campaigns</li>
              <li>Press requests</li>
            </ul>
          </article>
        </section>

        <section className="info-banner">
          <p>At BLINKIEFASH, we believe in innovation, speed, and style. BLINKIEFASH - Fashion delivered in a blink.</p>
          <button className="info-chat-btn" type="button" onClick={() => navigate("/home")}>Back to Home</button>
        </section>
      </main>
    </div>
  );
}
