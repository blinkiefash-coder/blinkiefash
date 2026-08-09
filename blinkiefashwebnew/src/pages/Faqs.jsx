import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./companyLanding.css";

const allFaqs = [
  {
    category: "Orders & Delivery",
    items: [
      { q: "How does 60-minute delivery work?", a: "We partner with nearby fashion stores in your city. Once you place an order, our delivery partner picks it up from the store and delivers it to your door in under 60 minutes." },
      { q: "Which cities do you currently deliver in?", a: "We currently deliver in Cuttack and Bhubaneswar. We're expanding soon to Berhampur, Rourkela, Sambalpur, Puri, Balasore, Bhadrak, Jeypore, and Angul." },
      { q: "Can I track my order in real time?", a: "Yes! Once your order is picked up, you can track your delivery partner's live location directly in the BlinkieFash app." },
      { q: "What if my order is delayed?", a: "In rare cases of delay, you'll receive a notification. You can also reach our support team via WhatsApp or the app for immediate help." },
    ],
  },
  {
    category: "Try Before You Buy",
    items: [
      { q: "What is Try Before You Buy?", a: "Try on clothes at home before paying. You only pay for what you keep — return the rest for free within the same delivery window, no questions asked." },
      { q: "How long can I try the products?", a: "You can try the products while our delivery partner waits. Typically 10–15 minutes is given for you to decide what to keep." },
      { q: "Do I pay for items I return?", a: "No! You only pay for what you decide to keep. Items you return are taken back by the delivery partner at no charge." },
      { q: "Is Try Before You Buy available for all products?", a: "Try Before You Buy is available for most clothing and fashion items. Accessories and some specific items may vary by store." },
    ],
  },
  {
    category: "Returns & Refunds",
    items: [
      { q: "Can I return products after delivery?", a: "Yes. For regular orders, easy returns are available through the app within 7 days of delivery. Items must be unused and in original condition." },
      { q: "How long does a refund take?", a: "Refunds are processed within 3–5 business days to your original payment method. UPI and wallet refunds are usually instant." },
      { q: "What items cannot be returned?", a: "Innerwear, socks, and personalised items are non-returnable for hygiene reasons. Sale items may also have restricted return policies." },
    ],
  },
  {
    category: "Payments",
    items: [
      { q: "Is Cash on Delivery available?", a: "Yes! We support Cash on Delivery along with UPI, debit/credit cards, and net banking for your convenience." },
      { q: "Are my payment details secure?", a: "Absolutely. All payments are processed through encrypted, PCI-DSS compliant gateways. BlinkieFash never stores your card details." },
      { q: "Can I use coupons or promo codes?", a: "Yes! You can apply valid coupon codes at checkout. Check the app's Offers section for the latest deals and discounts." },
    ],
  },
  {
    category: "Account & App",
    items: [
      { q: "How do I download the BlinkieFash app?", a: "Search for 'BlinkieFash' on the Google Play Store or App Store, or scan the QR code on our website to download instantly." },
      { q: "How do I reset my password?", a: "Tap 'Forgot Password' on the login screen. Enter your registered mobile number or email to receive an OTP and reset your password." },
      { q: "Can I have multiple addresses?", a: "Yes! You can save multiple delivery addresses in your profile and select the relevant one at checkout." },
    ],
  },
];

export default function Faqs() {
  const navigate = useNavigate();

  return (
    <div className="lp">
      {/* NAV */}
      <header className="lp-nav">
        <button className="lp-brand" onClick={() => navigate("/")}>
          <img src={logo} alt="BlinkieFash" />
          <span>BLINKIE<b>FASH</b></span>
        </button>
        <nav>
          <button onClick={() => navigate("/")}>Home</button>
          <button onClick={() => navigate("/company")}>About Us</button>
          <button>Stores</button>
          <button>Careers</button>
          <button onClick={() => navigate("/vendor")}>Vendor Login</button>
          <button onClick={() => navigate("/customer-service")}>Contact Us</button>
        </nav>
        <div className="lp-nav-right">
          <button className="lp-dl-btn" onClick={() => window.open("https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share", "_blank", "noopener,noreferrer")}>Download App ↓</button>
        </div>
      </header>

      <div className="lp-body">
        {/* Header */}
        <div style={{ padding: "28px 4px 8px" }}>
          <h1 style={{ margin: 0, fontSize: "clamp(26px,3vw,40px)", fontWeight: 900, color: "#0d1a0f" }}>
            Frequently Asked <span className="lp-green">Questions</span>
          </h1>
          <p style={{ margin: "8px 0 0", fontSize: "16px", color: "#4d6551" }}>
            Everything you need to know about BlinkieFash
          </p>
        </div>

        {allFaqs.map((section) => (
          <div key={section.category} style={{ border: "1px solid #dce9dd", borderRadius: 16, background: "#fff", overflow: "hidden" }}>
            <div style={{ padding: "14px 20px", background: "#f0faf3", borderBottom: "1px solid #dce9dd" }}>
              <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 800, color: "#149040" }}>{section.category}</h2>
            </div>
            <div style={{ padding: "8px 16px" }}>
              {section.items.map((item, i) => (
                <details key={i} className="lp-faq-page-item">
                  <summary className="lp-faq-page-summary">
                    {item.q}
                    <span className="lp-arr">▾</span>
                  </summary>
                  <p className="lp-faq-ans">{item.a}</p>
                </details>
              ))}
            </div>
          </div>
        ))}

        {/* CTA */}
        <div style={{ border: "1px solid #dce9dd", borderRadius: 16, background: "#fff", padding: "24px 20px", textAlign: "center" }}>
          <h3 style={{ margin: "0 0 6px", fontSize: "18px", fontWeight: 800, color: "#0d1a0f" }}>Still have questions?</h3>
          <p style={{ margin: "0 0 16px", fontSize: "14px", color: "#4d6551" }}>Our support team is available 24/7 to help you.</p>
          <button
            className="lp-pc-btn"
            onClick={() => navigate("/customer-service")}
            style={{ margin: "0 auto" }}
          >
            Contact Support →
          </button>
        </div>
      </div>
    </div>
  );
}
