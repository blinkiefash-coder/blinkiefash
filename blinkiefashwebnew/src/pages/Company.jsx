import { useNavigate } from "react-router-dom";
import { useState } from "react";
import logo from "../assets/logo.png";
import "./companyLanding.css";
import Footer from "../components/Footer";
import PartnerModal from "../components/PartnerModal";
import LpNav from "../components/LpNav";

const appScreens = [
  { img: "/images/home-store.png", label: "Home", sub: "Discover trending fashion near you" },
  { img: "/images/cloth.png", label: "Product Details", sub: "Check sizes, colors and offers" },
  { img: "/images/Payment.png", label: "Try Before You Buy", sub: "Try at home, pay only for what you keep" },
  { img: "/images/travel.png", label: "Track Order", sub: "Real-time tracking of your orders" },
  { img: "/images/return.png", label: "Secure Checkout", sub: "Multiple payment options" },
];

const trustItems = [
  { icon: "🛡️", label: "100% Original\nProducts" },
  { icon: "👗", label: "Top Fashion\nBrands" },
  { icon: "🏷️", label: "Best Prices &\nExclusive Deals" },
  { icon: "🔒", label: "Secure\nPayments" },
  { icon: "🔄", label: "Easy Returns &\nRefunds" },
  { icon: "🎧", label: "Dedicated\nCustomer Support" },
];

const whyItems = [
  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, title: "60 Min Delivery", sub: "Lightning fast delivery to your doorstep" },
  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26"><path d="M12 2L3.5 6v5c0 5.25 3.75 10.15 8.5 11 4.75-.85 8.5-5.75 8.5-11V6L12 2z"/><polyline points="9 12 11 14 15 10"/></svg>, title: "Try Before You Buy", sub: "At home, pay only for what you keep" },
  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>, title: "Nearby Fashion Stores", sub: "Shop from trusted local fashion stores" },
  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26"><circle cx="12" cy="12" r="10"/><line x1="14.5" y1="9.5" x2="9.5" y2="14.5"/><circle cx="9.5" cy="9.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="14.5" cy="14.5" r="0.8" fill="currentColor" stroke="none"/></svg>, title: "Exclusive Discounts", sub: "Best prices & exciting offers every day" },
  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg>, title: "Easy Returns", sub: "Hassle-free returns & refunds" },
  { icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="26" height="26"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>, title: "Live Tracking", sub: "Real-time tracking of your orders" },
];

const faqs = [
  { q: "What is Try Before You Buy?", a: "Try on clothes at home before paying. You only pay for what you keep — return the rest for free within the same delivery window, no questions asked." },
  { q: "How does 60-minute delivery work?", a: "We partner with nearby fashion stores in your city. Once you place an order, our delivery partner picks it up from the store and delivers it to your door in under 60 minutes." },
  { q: "Can I return products?", a: "Yes! With Try Before You Buy, return items during the same delivery. For regular orders, easy returns are available through the app within 7 days of delivery." },
  { q: "Which cities do you deliver in?", a: "We currently deliver in Cuttack and Bhubaneswar. We're expanding soon to Berhampur, Rourkela, Sambalpur, Puri, Balasore and more cities across Odisha." },
  { q: "Is Cash on Delivery available?", a: "Yes! We support Cash on Delivery along with UPI, debit/credit cards, and net banking for your convenience." },
];

export default function Company() {
  const navigate = useNavigate();
  const [partnerModal, setPartnerModal] = useState(null); // 'store' | 'delivery' | null

  return (
    <div className="lp">
      <LpNav active="Home" />
      <div className="lp-body">
        {/* HERO */}
        <section className="lp-hero">
          {/* Left */}
          <div className="lp-hero-left">
            <span className="lp-kicker">⚡ INDIA'S FASTEST FASHION DELIVERY</span>
            <h1>Fashion Delivered in<br /><span className="lp-green">60 Minutes</span></h1>
            <p className="lp-hero-sub">
              Shop from nearby fashion stores, <strong>Try Before You Buy</strong>,
              and get your favorite outfits delivered in just <strong className="lp-green">60 minutes.</strong>
            </p>
            <div className="lp-cta-row">
              <button className="lp-store-btn lp-sb-dark" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share", "_blank", "noopener,noreferrer")}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3.18 23.76a2.48 2.48 0 0 0 2.63-.17l12.4-7.29-2.73-2.73zM.5 1.26C.19 1.6 0 2.12 0 2.82v18.37c0 .69.19 1.21.51 1.55l.08.08 10.3-10.29v-.24zM20.1 9.85l-2.85-1.67-3.06 3.06 3.07 3.06 2.85-1.67c.81-.48.81-1.26 0-1.74zm-19.1 12.5 11.74-6.9-2.73-2.73z"/></svg>
                <span><small>GET IT ON</small><strong>Google Play</strong></span>
              </button>
              <button className="lp-store-btn lp-sb-dark" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share", "_blank", "noopener,noreferrer")}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.84 12.94c-.02-2.32 1.9-3.43 1.98-3.48-1.08-1.58-2.76-1.8-3.36-1.82-1.43-.14-2.8.84-3.52.84-.73 0-1.85-.82-3.04-.8-1.56.02-3 .91-3.8 2.31-1.62 2.81-.41 6.98 1.16 9.25.77 1.11 1.69 2.35 2.89 2.31 1.16-.05 1.6-.75 3-.75 1.41 0 1.8.75 3.03.72 1.25-.02 2.03-1.12 2.79-2.24.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.41-.92-2.43-3.74Zm-1.79-6.42c.63-.77 1.06-1.84.94-2.91-.91.04-2.01.61-2.66 1.38-.58.67-1.08 1.75-.95 2.79 1.01.08 2.04-.51 2.67-1.26Z"/></svg>
                <span><small>Download on the</small><strong>App Store</strong></span>
              </button>
              <button className="lp-store-btn lp-sb-outline" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share", "_blank", "noopener,noreferrer")}>
                <span>📱</span><strong>Open in App</strong>
              </button>
            </div>
            <div className="lp-hero-stats">
              <div>
                <span className="lp-hs-ico">🛒</span>
                <span className="lp-hs-val">300+</span>
                <span className="lp-hs-lbl">Orders Delivered</span>
              </div>
              <div>
                <span className="lp-hs-ico">⭐</span>
                <span className="lp-hs-val">4.8/5</span>
                <span className="lp-hs-lbl">Customer Rating</span>
              </div>
              <div>
                <span className="lp-hs-ico">📍</span>
                <span className="lp-hs-val">2</span>
                <span className="lp-hs-lbl">Cuttack &amp; Bhubaneswar</span>
              </div>
            </div>
            <div className="lp-hs-city">
              <div className="lp-hs-city-a">
                <p className="lp-city-h"><span className="lp-green">📍</span> Currently Delivering In</p>
                <p className="lp-city-n">Cuttack <span className="tick">✅</span></p>
                <p className="lp-city-n">Bhubaneswar <span className="tick">✅</span></p>
              </div>
              <div className="lp-hs-city-b">
                <p className="lp-city-h">Coming Soon</p>
                <p className="lp-city-coming">• Berhampur &nbsp; • Rourkela &nbsp; • Sambalpur</p>
                <p className="lp-city-coming">• Puri &nbsp; • Balasore &nbsp; • Brahmapur</p>
                <p className="lp-city-coming">• Bhadrak &nbsp; • Jeypore &nbsp; • Angul</p>
              </div>
            </div>
          </div>

          {/* Center phone */}
          <div className="lp-hero-center">
            <div className="lp-phone-wrap">
              <img src="/images/Web_Right.jpeg" className="lp-hero-static" alt="BlinkieFash App" />
            </div>
          </div>
        </section>

        {/* TRUST STRIP */}
        <section className="lp-trust">
          <div className="lp-trust-item">
            <span className="lp-ticon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="34" height="34"><path d="M12 2L3.5 6v5c0 5.25 3.75 10.15 8.5 11 4.75-.85 8.5-5.75 8.5-11V6L12 2z"/><polyline points="9 12 11 14 15 10"/></svg></span>
            <div><strong>100% Original</strong><span>Products</span></div>
          </div>
          <div className="lp-trust-item">
            <span className="lp-ticon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="34" height="34"><path d="M20.59 13.41l-7.17 7.17a2 2 0 01-2.83 0L2 12V2h10l8.59 8.59a2 2 0 010 2.82z"/><circle cx="7" cy="7" r="1" fill="currentColor" stroke="none"/></svg></span>
            <div><strong>Top Fashion</strong><span>Brands</span></div>
          </div>
          <div className="lp-trust-item">
            <span className="lp-ticon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="34" height="34"><circle cx="12" cy="12" r="10"/><line x1="14.5" y1="9.5" x2="9.5" y2="14.5"/><circle cx="9.5" cy="9.5" r="0.8" fill="currentColor" stroke="none"/><circle cx="14.5" cy="14.5" r="0.8" fill="currentColor" stroke="none"/></svg></span>
            <div><strong>Best Prices &amp;</strong><span>Exclusive Deals</span></div>
          </div>
          <div className="lp-trust-item">
            <span className="lp-ticon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="34" height="34"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg></span>
            <div><strong>Secure</strong><span>Payments</span></div>
          </div>
          <div className="lp-trust-item">
            <span className="lp-ticon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="34" height="34"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15"/></svg></span>
            <div><strong>Easy Returns &amp;</strong><span>Refunds</span></div>
          </div>
          <div className="lp-trust-item">
            <span className="lp-ticon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="34" height="34"><path d="M3 18v-6a9 9 0 0118 0v6"/><path d="M21 19a2 2 0 01-2 2h-1a2 2 0 01-2-2v-3a2 2 0 012-2h3zM3 19a2 2 0 002 2h1a2 2 0 002-2v-3a2 2 0 00-2-2H3z"/></svg></span>
            <div><strong>Dedicated</strong><span>Customer Support</span></div>
          </div>
        </section>

        {/* PARTNERS */}
        <section className="lp-partners">
          <article className="lp-pcard">
            <div className="lp-pc-copy">
              <h3>Own a Fashion Store?</h3>
              <p>Join 100+ retailers growing with BlinkieFash.</p>
              <ul>
                <li>Reach more customers</li>
                <li>Increase your sales</li>
                <li>No marketing cost</li>
                <li>Fast &amp; secure settlements</li>
                <li>Easy inventory sync</li>
              </ul>
              <button className="lp-pc-btn" onClick={() => setPartnerModal('store')}>Become a Partner →</button>
            </div>
            <div className="lp-pc-img">
              <img src="/images/Fashion_store.jpeg" alt="store partner" />
            </div>
          </article>

          <article className="lp-pcard">
            <div className="lp-pc-copy">
              <h3>Become a Delivery Partner</h3>
              <p>Earn flexible income delivering fashion.</p>
              <ul>
                <li>Flexible work hours</li>
                <li>Weekly payouts</li>
                <li>Incentives &amp; bonuses</li>
                <li>Be your own boss</li>
              </ul>
              <button className="lp-pc-btn" onClick={() => setPartnerModal('delivery')}>Apply Now →</button>
            </div>
            <div className="lp-pc-img lp-pc-img-green">
              <img src="/images/delivery.jpeg" alt="delivery partner" />
            </div>
          </article>

          <article className="lp-testimonial">
            <h3>What Our Customers Say</h3>
            <div className="lp-tq">❝❝</div>
            <blockquote>Received my order in just 45 minutes! The quality is amazing and Try Before You Buy is a game changer.</blockquote>
            <p className="lp-stars">★★★★★</p>
            <p className="lp-author">– Ananya, Cuttack</p>
            <div className="lp-dots"><span /><span className="on" /><span /><span /></div>
          </article>
        </section>

        {/* SOCIAL + FAQ + NEWSLETTER */}
        <section className="lp-sfn">
          <article className="lp-social">
            <div className="lp-sfn-head">
              <div>
                <h3>Follow Us on Instagram</h3>
                <p className="lp-handle"><a href="https://www.instagram.com/blinkiefash_official?igsh=MWttZzBlNnUyZnAwNQ==" target="_blank" rel="noopener noreferrer" className="lp-ig-link">@blinkiefash_official</a></p>
              </div>
            </div>
            <div className="lp-ig-banner">
              <img src="/images/follow_insta.jpeg" alt="Follow BlinkieFash on Instagram" />
            </div>
          </article>

          <article className="lp-faq">
            <h3>Frequently Asked Questions</h3>
            {faqs.map((f,i)=>(
              <details key={i}>
                <summary>{f.q} <span className="lp-arr">▾</span></summary>
                <p className="lp-faq-ans">{f.a}</p>
              </details>
            ))}
            <button className="lp-va" style={{marginTop:"10px"}} onClick={() => navigate("/faqs")}>View All FAQs →</button>
          </article>

          <article className="lp-news" style={{display:'none'}}></article>
        </section>

        {/* GET EXCLUSIVE OFFERS */}
        <section className="lp-offer">
          <div className="lp-offer-left">
            <span className="lp-offer-badge">🎁 Exclusive Members Only</span>
            <h2>Get <span style={{color:'#86efac'}}>Exclusive Offers</span> &amp; Style Updates</h2>
            <p>Join 1,000+ fashion lovers getting early access to deals, new arrivals &amp; style tips.</p>
            <div className="lp-offer-perks">
              <span>✓ First order 10% off</span>
              <span>✓ Early sale access</span>
              <span>✓ New arrivals first</span>
              <span>✓ Weekly style tips</span>
            </div>
          </div>
          <div className="lp-offer-right">
            <form onSubmit={(e) => e.preventDefault()} className="lp-offer-form">
              <div className="lp-offer-input-wrap">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="18" height="18"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></svg>
                <input type="email" placeholder="Enter your email address" aria-label="Email" required />
              </div>
              <button type="submit" className="lp-offer-btn">Subscribe for Free →</button>
            </form>
            <p className="lp-offer-trust">🔒 No spam, ever. Unsubscribe anytime.</p>
            <div className="lp-offer-avatars">
              <span className="lp-offer-av">S</span>
              <span className="lp-offer-av">P</span>
              <span className="lp-offer-av">A</span>
              <span className="lp-offer-av">+</span>
              <span className="lp-offer-count">1,000+ subscribers</span>
            </div>
          </div>
        </section>

        {/* WHY LOVE */}
        <section className="lp-why">
          <h2>Why People Love <span className="lp-green">BlinkieFash</span></h2>
          <div className="lp-why-grid">
            {whyItems.map((w) => (
              <div key={w.title} className="lp-why-item">
                <span className="lp-wico">{w.icon}</span>
                <div><strong>{w.title}</strong><p>{w.sub}</p></div>
              </div>
            ))}
          </div>
        </section>

        {/* DOWNLOAD BAND */}
        <section className="lp-dl">
          <div className="lp-dl-copy">
            <span className="lp-dl-badge">⚡ India’s Fastest Fashion Delivery</span>
            <h2>Download the <span style={{color:'#86efac'}}>BlinkieFash</span> App</h2>
            <p>Shop from nearby stores, try before you buy, and get fashion delivered to your door in just 60 minutes.</p>
            <div className="lp-dl-btns">
              <button className="lp-store-btn lp-sb-dark" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share", "_blank", "noopener,noreferrer")}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M3.18 23.76a2.48 2.48 0 0 0 2.63-.17l12.4-7.29-2.73-2.73zM.5 1.26C.19 1.6 0 2.12 0 2.82v18.37c0 .69.19 1.21.51 1.55l.08.08 10.3-10.29v-.24zM20.1 9.85l-2.85-1.67-3.06 3.06 3.07 3.06 2.85-1.67c.81-.48.81-1.26 0-1.74zm-19.1 12.5 11.74-6.9-2.73-2.73z"/></svg>
                <span><small>GET IT ON</small><strong>Google Play</strong></span>
              </button>
              <button className="lp-store-btn lp-sb-dark" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share", "_blank", "noopener,noreferrer")}>
                <svg viewBox="0 0 24 24" fill="currentColor" width="18" height="18"><path d="M16.84 12.94c-.02-2.32 1.9-3.43 1.98-3.48-1.08-1.58-2.76-1.8-3.36-1.82-1.43-.14-2.8.84-3.52.84-.73 0-1.85-.82-3.04-.8-1.56.02-3 .91-3.8 2.31-1.62 2.81-.41 6.98 1.16 9.25.77 1.11 1.69 2.35 2.89 2.31 1.16-.05 1.6-.75 3-.75 1.41 0 1.8.75 3.03.72 1.25-.02 2.03-1.12 2.79-2.24.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.41-.92-2.43-3.74Zm-1.79-6.42c.63-.77 1.06-1.84.94-2.91-.91.04-2.01.61-2.66 1.38-.58.67-1.08 1.75-.95 2.79 1.01.08 2.04-.51 2.67-1.26Z"/></svg>
                <span><small>Download on the</small><strong>App Store</strong></span>
              </button>
              <button className="lp-store-btn lp-sb-outline-dl" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share", "_blank", "noopener,noreferrer")}>
                <span>📱</span><strong>Open in App</strong>
              </button>
            </div>
            <div className="lp-dl-chips">
              <span>⏱ 60 Min Delivery</span>
              <span>👗 Try Before You Buy</span>
              <span>📍 Live Tracking</span>
              <span>🔄 Easy Returns</span>
            </div>
          </div>
          <div className="lp-dl-or">OR</div>
          <div className="lp-dl-qr">
            <div className="lp-dl-qr-wrap">
              <img
                src="https://api.qrserver.com/v1/create-qr-code/?size=120x120&color=0d7d3a&bgcolor=ffffff&data=https://play.google.com/store/apps/details?id=com.blinkiefash.app"
                alt="Scan to Download BlinkieFash"
                className="lp-qr-img"
                width="110"
                height="110"
              />
            </div>
            <div>
              <p style={{margin:0}}><strong>Scan to Download</strong></p>
              <p style={{margin:'4px 0 0'}}>Point your camera at the QR code to install instantly.</p>
              <p style={{margin:'8px 0 0',color:'#86efac',fontSize:'11px',fontWeight:700}}>✓ Free · No sign-up required</p>
            </div>
          </div>
          <div className="lp-dl-stats">
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              <div><strong>300+</strong><small>Orders Delivered</small></div>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
              <div><strong>4.8/5</strong><small>Customer Rating</small></div>
            </div>
            <div>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" width="22" height="22"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0118 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <div><strong>2 Cities</strong><small>& Expanding</small></div>
            </div>
          </div>
        </section>
      </div>

      {partnerModal && <PartnerModal type={partnerModal} onClose={() => setPartnerModal(null)} />}

      <a
        href="https://wa.me/919827901891"
        target="_blank"
        rel="noopener noreferrer"
        className="lp-wa-btn"
        aria-label="Chat on WhatsApp"
      >
        <svg viewBox="0 0 24 24" fill="currentColor" width="22" height="22">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
        <span>Chat with us</span>
      </a>
      <Footer />
    </div>
  );
}
