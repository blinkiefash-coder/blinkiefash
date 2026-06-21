import { useState } from "react";
import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./staticInfoPages.css";

export default function AccountDeletion() {
  const navigate = useNavigate();
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    const data = new FormData(e.target);
    const email = data.get("email");
    const phone = data.get("phone");
    const reason = data.get("reason") || "Not provided";
    const subject = encodeURIComponent("Account Deletion Request");
    const body = encodeURIComponent(
      `Hello BlinkieFash Support,\n\nI request deletion of my BlinkieFash account and associated personal data.\n\nRegistered Email: ${email}\nRegistered Phone: ${phone}\nReason (optional): ${reason}\n\nI understand that:\n- My personal data will be erased within 30 days of verification.\n- Anonymised order/transaction records may be retained for up to 8 years to comply with tax law.\n\nThank you.`
    );
    window.location.href = `mailto:support@blinkiefash.in?subject=${subject}&body=${body}`;
    setSubmitted(true);
  };

  return (
    <div className="info-page policies-page">
      <header className="info-header" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>
        <img src={logo} alt="Blinkiefash" />
        <h1 className="info-brand">BLINKIE<span>FASH</span></h1>
      </header>

      <main className="info-body">
        <section className="info-hero">
          <div className="info-hero-left">
            <h2 className="info-page-title">DELETE MY ACCOUNT</h2>
            <h3 className="info-page-subtitle">Request deletion of your BlinkieFash account &amp; data</h3>
            <p>
              You can permanently delete your BlinkieFash account and the personal data associated
              with it at any time. This page explains how, what gets deleted, and what we are legally
              required to retain.
            </p>
          </div>
          <div className="info-hero-visual info-policy-visual" aria-hidden="true" />
        </section>

        <section className="info-grid" style={{ gridTemplateColumns: "1fr" }}>
          <article className="info-card info-card-wide">
            <h5>How to delete your account</h5>
            <p>You can request deletion using any of the three methods below:</p>
            <ul>
              <li>
                <strong>1. From the BlinkieFash app:</strong> Open the app &rarr; Profile &rarr;
                Settings &rarr; <em>Delete My Account</em> &rarr; Confirm. Your request is verified
                via OTP and processed within 30 days.
              </li>
              <li>
                <strong>2. Email:</strong> Send a request from your <em>registered email address</em>{" "}
                to{" "}
                <a href="mailto:support@blinkiefash.in?subject=Account%20Deletion%20Request">
                  support@blinkiefash.in
                </a>
                {" "}with the subject "Account Deletion Request".
              </li>
              <li>
                <strong>3. The form below:</strong> fill in your registered details and we'll process
                your request within 30 days.
              </li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>What data gets deleted</h5>
            <ul>
              <li>Name, email address, phone number</li>
              <li>Profile photo and date of birth</li>
              <li>Saved delivery addresses</li>
              <li>Cart items and wishlist</li>
              <li>Product reviews and uploaded review photos</li>
              <li>Push-notification (FCM) token</li>
              <li>Authentication records</li>
              <li>Customer-support correspondence</li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>What may be retained (and why)</h5>
            <ul>
              <li>
                <strong>Anonymised invoices &amp; transaction records</strong> — retained for up to 8
                years as required by the Income-Tax Act and GST law. These records contain no
                personally identifying information linked to you.
              </li>
              <li>
                <strong>Open disputes / chargebacks / fraud investigations</strong> — retained until
                the matter is resolved, then deleted.
              </li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>How long it takes</h5>
            <p>
              We acknowledge your request within 48 hours. Verification (via OTP or email reply) is
              required to ensure no one else can delete your account. Once verified, deletion is
              completed within 30 days.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>Submit a deletion request</h5>
            {submitted ? (
              <div style={{ padding: 20, background: "#e8f5e9", borderRadius: 8 }}>
                <p style={{ margin: 0 }}>
                  ✅ Your email client should have opened with a pre-filled deletion request. If it
                  didn't, please email{" "}
                  <a href="mailto:support@blinkiefash.in?subject=Account%20Deletion%20Request">
                    support@blinkiefash.in
                  </a>{" "}
                  manually with your registered email and phone number.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} style={{ display: "grid", gap: 12, maxWidth: 500 }}>
                <label style={{ display: "grid", gap: 4 }}>
                  <span><strong>Registered email *</strong></span>
                  <input
                    type="email"
                    name="email"
                    required
                    placeholder="you@example.com"
                    style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span><strong>Registered mobile number *</strong></span>
                  <input
                    type="tel"
                    name="phone"
                    required
                    placeholder="+91 98765 43210"
                    style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14 }}
                  />
                </label>
                <label style={{ display: "grid", gap: 4 }}>
                  <span>Reason (optional)</span>
                  <textarea
                    name="reason"
                    rows={3}
                    placeholder="Help us improve — why are you leaving?"
                    style={{ padding: 10, border: "1px solid #ccc", borderRadius: 6, fontSize: 14, resize: "vertical" }}
                  />
                </label>
                <button
                  type="submit"
                  style={{
                    padding: "12px 20px",
                    background: "#d32f2f",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    fontWeight: 600,
                    cursor: "pointer",
                    fontSize: 14,
                  }}
                >
                  Submit Deletion Request
                </button>
                <p className="info-note" style={{ margin: 0 }}>
                  By submitting, you confirm that the email and phone above belong to you and you
                  request permanent deletion of your BlinkieFash account.
                </p>
              </form>
            )}
          </article>

          <article className="info-card info-card-wide">
            <h5>Contact</h5>
            <p>
              For questions about account deletion, email{" "}
              <a href="mailto:support@blinkiefash.in">support@blinkiefash.in</a>.
            </p>
            <p>
              See our full <a href="/privacy-policy">Privacy Policy</a> for more details on what data
              we collect, how it is used, and your rights.
            </p>
          </article>
        </section>

        <section className="info-banner info-commitment">
          <p><strong>We're sorry to see you go.</strong> Your privacy and control over your data are our priority.</p>
          <button className="info-chat-btn" type="button" onClick={() => navigate("/home")}>Back to Home</button>
        </section>
      </main>
    </div>
  );
}
