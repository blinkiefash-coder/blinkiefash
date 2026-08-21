import { useNavigate } from "react-router-dom";
import "./Footer.css";

const LOGO_URL =
  "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg";

const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share";

export default function Footer() {
  const navigate = useNavigate();

  /** Navigate and always land at the top of the new page */
  const go = (path) => {
    navigate(path);
    // Defer so React Router can update the DOM first
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  };

  return (
    <footer className="footer">
      <div className="footer-main">
        <div className="footer-brand-col">
          <div className="footer-brand" onClick={() => go("/")} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter') go('/'); }} style={{ cursor: 'pointer' }}>
            <img src={LOGO_URL} alt="Blinkiefash Logo" className="footer-logo-img" />
            <h1 className="footer-logo-text">
              BLINKIE<span>FASH</span>
            </h1>
          </div>
          <p className="footer-copyright">© 2024 BlinkieFash. All rights reserved.</p>
        </div>

        <div className="footer-col">
          <h3 onClick={() => go("/customer-service")}>CUSTOMER SERVICE</h3>
          <ul>
            <li onClick={() => go("/contact-us")}>Contact Us</li>
            <li onClick={() => go("/faqs")}>FAQs</li>
            <li onClick={() => go("/customer-service")}>Shipping &amp; Delivery</li>
            <li onClick={() => go("/customer-service")}>Returns &amp; Refunds</li>
            <li onClick={() => go("/help-support")}>Help &amp; Support</li>
          </ul>
        </div>

        <div className="footer-col">
          <h3 onClick={() => go("/company")}>COMPANY</h3>
          <ul>
            <li onClick={() => go("/about")}>About Us</li>
            <li onClick={() => go("/careers")}>Careers</li>
            <li onClick={() => go("/stores")}>Stores</li>
            <li onClick={() => go("/company")}>Blinkie Blog</li>
            <li onClick={() => go("/company")}>Press &amp; Media</li>
          </ul>
        </div>

        <div className="footer-col">
          <h3 onClick={() => go("/policies")}>POLICIES</h3>
          <ul>
            <li onClick={() => go("/privacy-policy")}>Privacy Policy</li>
            <li onClick={() => go("/terms")}>Terms of Service</li>
            <li onClick={() => go("/policies")}>Cancellation Policy</li>
            <li onClick={() => go("/policies")}>EPR Compliance</li>
            <li className="footer-seller-link" onClick={() => go("/vendor")}>
              Become a Vendor
            </li>
          </ul>
        </div>

        <div className="footer-col footer-app-col">
          <h3>GET THE APP</h3>
          <div className="app-buttons">
            <a
              className="store-badge"
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="store-badge-icon" aria-hidden="true">
                ▶
              </span>
              <span className="store-badge-text">
                <small>GET IT ON</small>
                <strong>Google Play</strong>
              </span>
            </a>
          </div>
        </div>

        <div className="footer-col footer-social-col">
          <h3>FOLLOW US</h3>
          <div className="footer-socials">
            <button className="social-icon" type="button" aria-label="Facebook">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M13.5 21v-7.26h2.44l.37-2.83H13.5V9.11c0-.82.23-1.38 1.4-1.38h1.5V5.19c-.26-.03-1.16-.11-2.21-.11-2.19 0-3.69 1.34-3.69 3.79v2.04H8v2.83h2.5V21h3Z" />
              </svg>
            </button>
            <a
              className="social-icon"
              href="https://www.instagram.com/blinkiefash_official/"
              target="_blank"
              rel="noreferrer"
              aria-label="Instagram"
            >
              <svg viewBox="0 0 24 24" fill="none">
                <rect
                  x="3.5"
                  y="3.5"
                  width="17"
                  height="17"
                  rx="4.5"
                  stroke="currentColor"
                  strokeWidth="1.8"
                />
                <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
              </svg>
            </a>
            <button className="social-icon" type="button" aria-label="Twitter">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M18.9 7.14c.01.16.01.32.01.48 0 4.91-3.74 10.57-10.57 10.57-2.1 0-4.06-.62-5.7-1.67.29.03.58.04.88.04 1.74 0 3.35-.59 4.62-1.59-1.63-.03-3-1.11-3.47-2.59.23.04.46.07.7.07.33 0 .65-.04.95-.13-1.7-.34-2.98-1.84-2.98-3.64v-.05c.5.28 1.08.45 1.69.47-1-.67-1.65-1.8-1.65-3.08 0-.68.18-1.31.5-1.85 1.83 2.25 4.57 3.73 7.66 3.88-.06-.27-.1-.55-.1-.84 0-2.03 1.65-3.68 3.69-3.68 1.06 0 2.02.45 2.69 1.17.84-.16 1.63-.47 2.34-.89-.28.86-.86 1.57-1.63 2.02.75-.09 1.47-.29 2.13-.59-.5.75-1.12 1.41-1.84 1.94Z" />
              </svg>
            </button>
            <button className="social-icon" type="button" aria-label="YouTube">
              <svg viewBox="0 0 24 24" fill="currentColor">
                <path d="M21.58 7.19a2.98 2.98 0 0 0-2.1-2.11C17.63 4.5 12 4.5 12 4.5s-5.63 0-7.48.58a2.98 2.98 0 0 0-2.1 2.11A31.2 31.2 0 0 0 2 12a31.2 31.2 0 0 0 .42 4.81 2.98 2.98 0 0 0 2.1 2.11C6.37 19.5 12 19.5 12 19.5s5.63 0 7.48-.58a2.98 2.98 0 0 0 2.1-2.11c.28-1.58.42-3.18.42-4.81s-.14-3.23-.42-4.81ZM10 15.5v-7l6 3.5-6 3.5Z" />
              </svg>
            </button>
          </div>
        </div>
      </div>
    </footer>
  );
}
