import { Link } from 'react-router-dom';
import './Footer.css';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share';

export default function Footer() {
  return (
    <footer className="footer" id="footer">
      <div className="footer__top container">

        {/* Brand */}
        <div className="footer__brand">
          <div className="footer__logo">
            <img src="/images/logo.png" alt="BlinkieFash" />
            <span>BLINKIE<b>FASH</b></span>
          </div>
          <p className="footer__tagline">Fashion delivered in 60 minutes.<br />Try before you buy.</p>
          <div className="footer__downloads">
            <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="footer__store-btn footer__store-btn--play">
              <img src="/images/google.png" alt="" />
              <div>
                <span>GET IT ON</span>
                <strong>Google Play</strong>
              </div>
            </a>
            <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="footer__store-btn footer__store-btn--apple">
              <img src="/images/apple-logo.png" alt="" />
              <div>
                <span>DOWNLOAD ON THE</span>
                <strong>App Store</strong>
              </div>
            </a>
          </div>
        </div>

        {/* Company */}
        <div className="footer__col">
          <h4>Company</h4>
          <Link to="/about">About Us</Link>
          <a href="mailto:careers@blinkiefash.in">Careers</a>
          <a href="mailto:press@blinkiefash.in">Press</a>
          <a href="/about">Blog</a>
          <a href="/about">Investor Relations</a>
        </div>

        {/* Help */}
        <div className="footer__col">
          <h4>Help &amp; Support</h4>
          <Link to="/customer-service">FAQ</Link>
          <Link to="/customer-service">Track Order</Link>
          <Link to="/customer-service">Returns &amp; Refunds</Link>
          <Link to="/customer-service">Cancellations</Link>
          <Link to="/customer-service">Contact Us</Link>
        </div>

        {/* Policies */}
        <div className="footer__col">
          <h4>Policies</h4>
          <Link to="/policies">Privacy Policy</Link>
          <Link to="/policies">Terms of Service</Link>
          <Link to="/policies">Shipping Policy</Link>
          <Link to="/policies">Return Policy</Link>
          <Link to="/policies">Cookie Policy</Link>
        </div>

        {/* Sell */}
        <div className="footer__col">
          <h4>Sell on BlinkieFash</h4>
          <Link to="/vendor/register">Register as Seller</Link>
          <Link to="/vendor">Vendor Login</Link>
          <Link to="/vendor/register">Seller Guidelines</Link>
          <Link to="/vendor/register">Commission Structure</Link>
          <a href="mailto:vendor@blinkiefash.in">Partner with Us</a>
        </div>

      </div>

      {/* Trust badges */}
      <div className="footer__trust container">
        <div className="footer__badge"><span>🔒</span> 100% Secure Payments</div>
        <div className="footer__badge"><span>⚡</span> 60-Min Delivery</div>
        <div className="footer__badge"><span>🔄</span> Easy Returns</div>
        <div className="footer__badge"><span>✅</span> Verified Vendors</div>
        <div className="footer__badge"><span>📱</span> Try Before You Buy</div>
      </div>

      {/* Social */}
      <div className="footer__social container">
        <span>Follow us:</span>
        <a href="https://www.instagram.com/blinkiefash" target="_blank" rel="noopener noreferrer" aria-label="Instagram">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
        </a>
        <a href="https://www.facebook.com/blinkiefash" target="_blank" rel="noopener noreferrer" aria-label="Facebook">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073C24 5.405 18.627 0 12 0S0 5.405 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/></svg>
        </a>
        <a href="https://twitter.com/blinkiefash" target="_blank" rel="noopener noreferrer" aria-label="X/Twitter">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
        </a>
        <a href="https://www.youtube.com/@blinkiefash" target="_blank" rel="noopener noreferrer" aria-label="YouTube">
          <svg viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
        </a>
      </div>

      {/* Bottom */}
      <div className="footer__bottom container">
        <p>© {new Date().getFullYear()} BlinkieFash. All rights reserved. Made with ❤️ in India.</p>
        <div className="footer__bottom-links">
          <a href="/">Privacy</a>
          <a href="/">Terms</a>
          <a href="/">Cookies</a>
          <a href="/">Sitemap</a>
        </div>
      </div>
    </footer>
  );
}
