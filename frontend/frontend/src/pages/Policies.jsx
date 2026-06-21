import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./staticInfoPages.css";

export default function Policies() {
  const navigate = useNavigate();

  return (
    <div className="info-page policies-page">
      <header className="info-header" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>
        <img src={logo} alt="Blinkiefash" />
        <h1 className="info-brand">BLINKIE<span>FASH</span></h1>
      </header>

      <main className="info-body">
        <section className="info-hero">
          <div className="info-hero-left">
            <h2 className="info-page-title">POLICIES</h2>
            <h3 className="info-page-subtitle">Your trust, our priority.</h3>
            <p>
              We are committed to transparency, security, and a safe experience for every customer.
            </p>
          </div>
          <div className="info-hero-visual info-policy-visual" aria-hidden="true" />
        </section>

        <section className="info-grid">
          <article className="info-card">
            <h5>Privacy Policy</h5>
            <p className="sub">Your privacy matters to us</p>
            <p>BLINKIEFASH collects only necessary information to provide secure shopping services.</p>
            <ul>
              <li>Name and contact details</li>
              <li>Delivery addresses and payment info</li>
              <li>Device and app usage data</li>
            </ul>
          </article>

          <article className="info-card">
            <h5>Terms of Service</h5>
            <p className="sub">Using Blinkiefash means you agree to</p>
            <ul>
              <li>Provide accurate information</li>
              <li>Respect vendor and delivery policies</li>
              <li>Follow return and Try and Buy rules</li>
            </ul>
            <p className="info-note">BLINKIEFASH reserves the right to modify services and pricing policies when needed.</p>
          </article>

          <article className="info-card">
            <h5>Cancellation Policy</h5>
            <p className="sub">Orders may be cancelled</p>
            <ul>
              <li>Before vendor confirmation</li>
              <li>Before dispatch</li>
              <li>In specific delivery issue situations</li>
            </ul>
            <p className="info-note">Once dispatched, cancellation availability may vary based on order type.</p>
          </article>

          <article className="info-card">
            <h5>EPR Compliance</h5>
            <p className="sub">Sustainable operations</p>
            <p>
              We support responsible environmental practices and eco-friendly packaging initiatives
              across vendors and deliveries.
            </p>
          </article>
        </section>

        <section className="info-banner info-commitment">
          <p><strong>Our Commitment</strong> We follow fair practices, protect your information, and ensure a smooth shopping experience. Safe. Secure. Reliable.</p>
          <button className="info-chat-btn" type="button" onClick={() => navigate("/home")}>Back to Home</button>
        </section>
      </main>
    </div>
  );
}
