import { useNavigate } from "react-router-dom";
import "./companyLanding.css";
import LpNav from "../components/LpNav";
import Footer from "../components/Footer";

const categories = [
  { icon: "📦", label: "My Orders", sub: "Track, modify or cancel" },
  { icon: "🔄", label: "Returns & Refunds", sub: "Easy return process" },
  { icon: "👗", label: "Try Before You Buy", sub: "How it works" },
  { icon: "💳", label: "Payment Issues", sub: "Billing & transactions" },
  { icon: "📍", label: "Delivery & Tracking", sub: "Where is my order?" },
  { icon: "🏪", label: "Store Partners", sub: "Become a vendor" },
  { icon: "📱", label: "App Issues", sub: "Technical support" },
  { icon: "🎁", label: "Offers & Coupons", sub: "Deals & discounts" },
  { icon: "💬", label: "Other", sub: "Anything else" },
];

const hours = [
  { day: "Monday – Friday", time: "9:00 AM – 11:00 PM" },
  { day: "Saturday – Sunday", time: "9:00 AM – 11:00 PM" },
  { day: "Public Holidays", time: "10:00 AM – 8:00 PM" },
];

export default function ContactUs() {
  const navigate = useNavigate();
  return (
    <div className="lp">
      <LpNav active="Contact Us" />
      <div className="lp-body">

        {/* HERO */}
        <section className="cu-hero">
          <h1>How can we <span className="lp-green">help you?</span></h1>
          <p>Our support team is here 7 days a week. Reach us on WhatsApp for the fastest response.</p>
        </section>

        {/* CONTACT OPTIONS */}
        <section className="cu-contact-cards">
          <a href="https://wa.me/919827901891" target="_blank" rel="noopener noreferrer" className="cu-contact-card cu-wa">
            <div className="cu-card-ico">
              <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            </div>
            <div>
              <strong>Chat on WhatsApp</strong>
              <span>Fastest response · Usually replies in minutes</span>
              <p>+91 9827901891</p>
            </div>
            <span className="cu-badge cu-badge-green">Recommended</span>
          </a>

          <a href="tel:+919827901891" className="cu-contact-card">
            <div className="cu-card-ico cu-card-ico-blue">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.79 19.79 0 01.05 2.22 2 2 0 012.03 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
            </div>
            <div>
              <strong>Call Us</strong>
              <span>Mon–Sun, 9 AM – 11 PM</span>
              <p>+91 9827901891</p>
            </div>
          </a>

          <a href="mailto:support@blinkiefash.in" className="cu-contact-card">
            <div className="cu-card-ico cu-card-ico-orange">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="28" height="28"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="2 7 12 13 22 7"/></svg>
            </div>
            <div>
              <strong>Email Support</strong>
              <span>Response within 24 hours</span>
              <p>support@blinkiefash.in</p>
            </div>
          </a>
        </section>

        {/* CATEGORIES */}
        <section className="au-section">
          <h2 className="au-section-title">What do you need <span className="lp-green">help with?</span></h2>
          <div className="cu-cats-grid">
            {categories.map(c => (
              <a key={c.label} href={`https://wa.me/919827901891?text=Hi, I need help with: ${encodeURIComponent(c.label)}`} target="_blank" rel="noopener noreferrer" className="cu-cat-card">
                <span className="cu-cat-ico">{c.icon}</span>
                <strong>{c.label}</strong>
                <span>{c.sub}</span>
              </a>
            ))}
          </div>
        </section>

        {/* HOURS */}
        <section className="cu-hours-section">
          <div className="cu-hours-card">
            <h2>Support <span className="lp-green">Hours</span></h2>
            <div className="cu-hours-list">
              {hours.map(h => (
                <div key={h.day} className="cu-hour-row">
                  <span>{h.day}</span>
                  <strong>{h.time}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="cu-hours-card">
            <h2>Quick <span className="lp-green">Links</span></h2>
            <div className="cu-quick-links">
              {[["📋 FAQs","/faqs"],["📦 Track Order","/"],["🔄 Return Policy","/policies"],["💼 Become a Partner","/"],["📱 Download App","https://play.google.com/store/apps/details?id=com.blinkiefash.app"]].map(([label, path]) => (
                <button key={label} className="cu-quick-link" onClick={() => path.startsWith("http") ? window.open(path,"_blank") : navigate(path)}>{label}</button>
              ))}
            </div>
          </div>
        </section>

      </div>
      <Footer />
    </div>
  );
}
