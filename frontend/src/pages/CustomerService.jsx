import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./staticInfoPages.css";

export default function CustomerService() {
  const navigate = useNavigate();

  return (
    <div className="info-page customer-service-page">
      <header className="info-header" onClick={() => navigate("/home")} style={{ cursor: "pointer" }}>
        <img src={logo} alt="Blinkiefash" />
        <h1 className="info-brand">BLINKIE<span>FASH</span></h1>
      </header>

      <main className="info-body">
        <section className="info-hero">
          <div className="info-hero-left">
            <h2 className="info-page-title">Customer Service</h2>
            <h3 className="info-page-subtitle">We're Here to Help You</h3>
            <p>
              At BLINKIEFASH, we want your shopping experience to be smooth, fast, and stress-free.
              Whether you need help with your order, delivery, payment, return, refund, Try and Buy,
              or store visit, our support team is always ready to assist you.
            </p>
          </div>
          <div className="info-callout info-contact-card">
            <h4>Contact Our Support Team</h4>
            <div className="info-contact-grid">
              <p>Email<br />support@blinkiefash.in</p>
              <p>Support Hours<br />9:00 AM - 11:00 PM</p>
            </div>
          </div>
        </section>

        <h4 className="info-mid-title">How Can We Help You?</h4>

        <section className="info-grid">
          <article className="info-card">
            <h5>Order Support</h5>
            <p className="sub">Need help with your order?</p>
            <ul>
              <li>Order confirmation and tracking</li>
              <li>Product availability</li>
              <li>Wrong or missing item issues</li>
              <li>Order changes</li>
            </ul>
          </article>

          <article className="info-card">
            <h5>Delivery Support</h5>
            <p className="sub">Delivery updates and partner details</p>
            <ul>
              <li>60-minute delivery updates</li>
              <li>Delayed delivery issues</li>
              <li>Address and route support</li>
              <li>Failed delivery attempts</li>
            </ul>
          </article>

          <article className="info-card">
            <h5>Try and Buy Support</h5>
            <p className="sub">Details of trial and returns</p>
            <ul>
              <li>Trial window and size support</li>
              <li>Return during delivery</li>
              <li>Accept or return process</li>
              <li>Refund after return</li>
            </ul>
          </article>

          <article className="info-card">
            <h5>Return and Refund Support</h5>
            <p className="sub">Guidance through complete return flow</p>
            <ul>
              <li>Return eligibility</li>
              <li>Refund status</li>
              <li>Damaged product complaints</li>
              <li>Product quality issues</li>
            </ul>
          </article>

          <article className="info-card">
            <h5>Store Visit Support</h5>
            <p className="sub">Guidance before visiting stores</p>
            <ul>
              <li>Store location and timing</li>
              <li>Vendor availability</li>
              <li>Product availability before visit</li>
            </ul>
          </article>
        </section>

        <section className="info-split-row">
          <article className="info-banner info-response-card">
            <p><strong>Response Time</strong> We try to respond as quickly as possible.</p>
            <p>Chat Support: Instant to few minutes | Email Support: Within 24 hours</p>
          </article>
          <article className="info-banner info-urgent-card">
            <p><strong>Need Urgent Help?</strong> For urgent order or delivery issues, please use live chat.</p>
            <button className="info-chat-btn" type="button">Chat With Us</button>
          </article>
        </section>

        <section className="info-banner info-promise">
          <p><strong>Our Promise</strong> At BLINKIEFASH, our customer service team is committed to a reliable and friendly shopping experience every time.</p>
        </section>
      </main>
    </div>
  );
}
