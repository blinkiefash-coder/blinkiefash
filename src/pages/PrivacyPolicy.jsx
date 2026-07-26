import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./staticInfoPages.css";

export default function PrivacyPolicy() {
  const navigate = useNavigate();

  return (
    <div className="info-page policies-page">
      <header className="info-header" onClick={() => navigate("/")} style={{ cursor: "pointer" }}>
        <img src={logo} alt="Blinkiefash" />
        <h1 className="info-brand">BLINKIE<span>FASH</span></h1>
      </header>

      <main className="info-body">
        <section className="info-hero">
          <div className="info-hero-left">
            <h2 className="info-page-title">PRIVACY POLICY</h2>
            <h3 className="info-page-subtitle">Your data. Your rights. Our responsibility.</h3>
            <p>
              Effective Date: 7 June 2026 &nbsp;·&nbsp; Last Updated: 7 June 2026
            </p>
          </div>
          <div className="info-hero-visual info-policy-visual" aria-hidden="true" />
        </section>

        <section className="info-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="info-card info-card-wide">
            <h5>1. Introduction</h5>
            <p>
              This Privacy Policy explains how <strong>BLINKIEFASH</strong> ("we", "our", "us") collects,
              uses, stores, shares, and protects information when you use the BlinkieFash mobile
              application ("App") and the website <strong>blinkiefash.in</strong> ("Website"),
              collectively referred to as the "Services". By using the Services, you agree to this
              Privacy Policy. If you do not agree, please do not use the Services.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>2. Information We Collect</h5>
            <p className="sub">A. Information You Provide Directly</p>
            <ul>
              <li><strong>Account Data:</strong> name, email address, mobile number, password (hashed), date of birth, gender (optional).</li>
              <li><strong>Profile Data:</strong> profile photo (optional), saved addresses, preferred sizes.</li>
              <li><strong>Order Data:</strong> products purchased, delivery address, billing details, order history, cancellations and returns.</li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>3. Why We Collect This Information (Purpose)</h5>
            <p>We use your data to provide and improve services, process payments, support orders, and comply with legal obligations.</p>
          </article>

          <article className="info-card info-card-wide">
            <h5>9. Account &amp; Data Deletion</h5>
            <p>
              You can delete your BlinkieFash account and the personal data associated with it at any
              time via the app or by contacting support@blinkiefash.in.
            </p>
          </article>

        </section>

        <section className="info-banner info-commitment">
          <p><strong>Questions?</strong> Email us anytime at <a href="mailto:support@blinkiefash.in" style={{ color: "#fff", textDecoration: "underline" }}>support@blinkiefash.in</a></p>
          <button className="info-chat-btn" type="button" onClick={() => navigate("/")}>Back to Home</button>
        </section>
      </main>
    </div>
  );
}
