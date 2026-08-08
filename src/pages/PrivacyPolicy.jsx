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
            <p>Effective Date: 7 June 2026 &nbsp;·&nbsp; Last Updated: 8 August 2026</p>
          </div>
          <div className="info-hero-visual info-policy-visual" aria-hidden="true" />
        </section>

        <section className="info-grid" style={{ gridTemplateColumns: "1fr" }}>

          {/* 1 */}
          <article className="info-card info-card-wide">
            <h5>1. Introduction</h5>
            <p>
              This Privacy Policy explains how <strong>BLINKIEFASH</strong> ("we", "our", "us", "Company"),
              operated by <strong>BlinkieFash Pvt. Ltd.</strong>, registered in India, collects, uses,
              stores, shares, and protects personal data when you use the BlinkieFash mobile application
              ("App") and the website <strong>blinkiefash.in</strong> ("Website"), collectively referred
              to as the "Services".
            </p>
            <p>
              By accessing or using our Services you confirm that you have read, understood, and agree to
              this Privacy Policy. If you do not agree, please discontinue use of the Services immediately.
              This Policy is compliant with the <strong>Digital Personal Data Protection Act, 2023 (DPDPA)</strong>,
              India's Information Technology Act, 2000, and applicable rules thereunder.
            </p>
          </article>

          {/* 2 */}
          <article className="info-card info-card-wide">
            <h5>2. Information We Collect</h5>

            <p className="sub">A. Information You Provide Directly</p>
            <ul>
              <li><strong>Account / Identity Data:</strong> full name, email address, mobile number, password (stored as a cryptographic hash), date of birth, gender (optional).</li>
              <li><strong>Profile Data:</strong> profile photo (optional), clothing / shoe size preferences.</li>
              <li><strong>Address Data:</strong> delivery addresses including flat / house number, street, city, state, PIN code, and landmark.</li>
              <li><strong>Order &amp; Transaction Data:</strong> items ordered, quantities, prices, discount codes applied, payment method (card type / UPI ID — we do <em>not</em> store full card numbers), transaction reference IDs, order status, returns and refunds history.</li>
              <li><strong>Communications:</strong> messages sent to our support team via chat, email, or phone; reviews and ratings you submit; referral codes you generate or redeem.</li>
              <li><strong>Contacts (Optional):</strong> If you use the "Select from Contacts" feature when booking a Parcel Delivery, we access only the single contact you choose from your device's address book to pre-fill the recipient's name and phone number. We do not access, upload, or store your full contact list — only the name and phone number of the specific contact you select are sent to us as part of that delivery request.</li>
            </ul>

            <p className="sub">B. Information Collected Automatically</p>
            <ul>
              <li><strong>Device &amp; Technical Data:</strong> device model, operating system version, unique device identifiers, IP address, browser type and version, time zone setting.</li>
              <li><strong>Usage Data:</strong> pages / screens viewed, search queries, products clicked, time spent, cart events, checkout funnel data, crash reports.</li>
              <li><strong>Location Data:</strong> precise GPS location (with your permission) to identify the nearest store and estimate delivery time; coarse location derived from IP address as a fallback.</li>
              <li><strong>Cookies &amp; Similar Technologies:</strong> see Section 6 below.</li>
            </ul>

            <p className="sub">C. Information from Third Parties</p>
            <ul>
              <li>If you sign in via <strong>Google / Firebase Authentication</strong>, we receive your name, email address, and profile picture from Google, subject to Google's privacy policy.</li>
              <li>Payment processors (Razorpay / equivalent) may share transaction status and risk signals with us; they retain payment instrument details under their own data protection obligations.</li>
              <li>Delivery partners share delivery status updates including location of our delivery executive while your order is in transit.</li>
            </ul>
          </article>

          {/* 3 */}
          <article className="info-card info-card-wide">
            <h5>3. Legal Basis &amp; Consent (DPDPA 2023)</h5>
            <p>Under the Digital Personal Data Protection Act, 2023 we process your personal data on the following grounds:</p>
            <ul>
              <li><strong>Consent:</strong> You give explicit, informed consent at account creation. You may withdraw consent at any time (see Section 9).</li>
              <li><strong>Contractual Necessity:</strong> Processing required to fulfil an order you have placed, process payment, arrange delivery, and manage returns.</li>
              <li><strong>Legitimate Uses:</strong> Fraud prevention, security monitoring, enforcing our Terms of Service, and defending legal claims.</li>
              <li><strong>Legal Obligation:</strong> Compliance with applicable Indian law, court orders, or directions from regulators.</li>
            </ul>
            <p>We will never process <em>sensitive personal data</em> (financial, health, biometric, or religious data) without explicit, separate consent.</p>
          </article>

          {/* 4 */}
          <article className="info-card info-card-wide">
            <h5>4. How We Use Your Information</h5>
            <ul>
              <li>Create and manage your account and profile.</li>
              <li>Process orders, payments, and coordinate delivery.</li>
              <li>Provide real-time order tracking and delivery status notifications.</li>
              <li>Offer customer support and resolve disputes.</li>
              <li>Personalise product recommendations, offers, and the home feed.</li>
              <li>Send transactional communications (order confirmation, shipping updates, OTPs) via SMS, email, and push notification.</li>
              <li>Send promotional communications — you may opt out at any time via account settings or by replying STOP to SMS.</li>
              <li>Detect and prevent fraud, misuse, and security incidents.</li>
              <li>Conduct analytics to improve app performance, catalogue, and user experience.</li>
              <li>Comply with legal and regulatory obligations.</li>
              <li>Administer our Refer &amp; Earn, Spin &amp; Win, and Try &amp; Buy programmes.</li>
            </ul>
          </article>

          {/* 5 */}
          <article className="info-card info-card-wide">
            <h5>5. Sharing of Your Information</h5>
            <p>We do <strong>not</strong> sell your personal data. We share data only as described below:</p>
            <ul>
              <li><strong>Vendor Partners:</strong> We share your name, delivery address, and order details with the vendor fulfilling your order. Vendors are contractually bound to use this data only for order fulfilment.</li>
              <li><strong>Delivery Partners:</strong> Your name, phone number, and delivery address are shared with the delivery executive assigned to your order.</li>
              <li><strong>Payment Processors:</strong> Razorpay (or equivalent PCI-DSS compliant gateway) processes payments; we pass the minimum data required.</li>
              <li><strong>Technology Service Providers:</strong> Firebase (Google) for authentication and cloud messaging; Cloudinary for image hosting; mapping / geocoding APIs for location. All are under data processing agreements.</li>
              <li><strong>Analytics Providers:</strong> Aggregated, anonymised usage data may be shared with analytics tools (e.g., Google Analytics). This data cannot identify you personally.</li>
              <li><strong>Legal &amp; Regulatory Authorities:</strong> When required by law, court order, or government directive, we will disclose personal data to the extent legally required.</li>
              <li><strong>Business Transfers:</strong> In the event of a merger, acquisition, or asset sale, personal data may be transferred; we will provide notice before any such transfer.</li>
            </ul>
          </article>

          {/* 6 */}
          <article className="info-card info-card-wide">
            <h5>6. Cookies &amp; Tracking Technologies</h5>
            <p>Our Website uses cookies and similar technologies to:</p>
            <ul>
              <li><strong>Essential Cookies:</strong> Keep you logged in, maintain your cart session, and secure the site. These cannot be disabled.</li>
              <li><strong>Analytics Cookies:</strong> Understand how visitors use the site (page views, click paths). You may opt out via browser settings.</li>
              <li><strong>Marketing Cookies:</strong> Display relevant ads and measure campaign performance. You may opt out via your browser or device ad-settings.</li>
            </ul>
            <p>The mobile App does not use browser cookies but may use device identifiers (IDFA / GAID) for analytics, subject to your device's ad-tracking preferences.</p>
          </article>

          {/* 7 */}
          <article className="info-card info-card-wide">
            <h5>7. Data Retention</h5>
            <ul>
              <li><strong>Account Data:</strong> Retained for the lifetime of your account and for 3 years after account deletion (for legal compliance).</li>
              <li><strong>Order &amp; Transaction Data:</strong> Retained for 7 years as required under Indian accounting and tax law.</li>
              <li><strong>Location Data:</strong> Session-based precise location is not stored beyond order processing. Coarse location logs are retained for up to 90 days.</li>
              <li><strong>Support Communications:</strong> Retained for 2 years after the ticket is closed.</li>
              <li><strong>Marketing Data:</strong> Retained until you withdraw consent or opt out.</li>
            </ul>
            <p>After the applicable retention period, data is securely deleted or irreversibly anonymised.</p>
          </article>

          {/* 8 */}
          <article className="info-card info-card-wide">
            <h5>8. Data Security</h5>
            <ul>
              <li>All data in transit is encrypted using <strong>TLS 1.2 or higher</strong>.</li>
              <li>Passwords are stored as <strong>bcrypt hashes</strong> — never in plain text.</li>
              <li>Payment data is processed by PCI-DSS compliant gateways; we do not store card numbers.</li>
              <li>Access to production databases is restricted to authorised personnel and protected by multi-factor authentication.</li>
              <li>We conduct periodic security reviews and vulnerability assessments.</li>
              <li>In the event of a personal data breach that is likely to result in risk to your rights, we will notify you and the Data Protection Board of India as required by the DPDPA.</li>
            </ul>
          </article>

          {/* 9 */}
          <article className="info-card info-card-wide">
            <h5>9. Your Rights (Data Principal Rights — DPDPA 2023)</h5>
            <p>As a Data Principal under India's DPDPA 2023, you have the following rights:</p>
            <ul>
              <li><strong>Right to Access:</strong> Request a summary of the personal data we hold about you and how it is being processed.</li>
              <li><strong>Right to Correction &amp; Erasure:</strong> Request correction of inaccurate data or erasure of data that is no longer necessary.</li>
              <li><strong>Right to Withdraw Consent:</strong> Withdraw previously given consent at any time. Withdrawal does not affect the lawfulness of prior processing.</li>
              <li><strong>Right to Grievance Redressal:</strong> Lodge a complaint with our Grievance Officer (see Section 12) or escalate to the Data Protection Board of India.</li>
              <li><strong>Right to Nominate:</strong> Nominate another individual to exercise your rights in the event of your death or incapacity.</li>
            </ul>
            <p>To exercise any of these rights, email <a href="mailto:privacy@blinkiefash.in">privacy@blinkiefash.in</a> with subject "Data Rights Request". We will respond within <strong>30 days</strong>.</p>
          </article>

          {/* 10 */}
          <article className="info-card info-card-wide">
            <h5>10. Account &amp; Data Deletion</h5>
            <p>
              You may delete your BlinkieFash account at any time from <strong>App → Profile → Settings → Delete Account</strong>,
              or by emailing <a href="mailto:support@blinkiefash.in">support@blinkiefash.in</a>.
            </p>
            <ul>
              <li>Profile and preferences are deleted within <strong>30 days</strong> of your request.</li>
              <li>Order, payment, and tax records are retained for 7 years as required by law before permanent deletion.</li>
              <li>Anonymised, aggregated analytics data may be retained indefinitely as it cannot identify you.</li>
            </ul>
          </article>

          {/* 11 */}
          <article className="info-card info-card-wide">
            <h5>11. Children's Privacy</h5>
            <p>
              Our Services are not directed at children under 18 years of age. We do not knowingly collect
              personal data from minors. If you believe a minor has provided us with personal data without
              parental consent, please contact our Grievance Officer immediately and we will delete it
              without undue delay.
            </p>
          </article>

          {/* 12 */}
          <article className="info-card info-card-wide">
            <h5>12. Grievance Officer (India — IT Act &amp; DPDPA)</h5>
            <p>In accordance with the Information Technology Act, 2000 and DPDPA 2023, the details of our Grievance Officer are:</p>
            <ul>
              <li><strong>Name:</strong> Satyam Mohanty</li>
              <li><strong>Designation:</strong> Grievance Officer</li>
              <li><strong>Company:</strong> BlinkieFash Pvt. Ltd.</li>
              <li><strong>Email:</strong> <a href="mailto:grievance@blinkiefash.in">grievance@blinkiefash.in</a></li>
              <li><strong>Address:</strong> Bhubaneswar, Odisha, India</li>
              <li><strong>Response Time:</strong> Within 30 days of receipt of complaint</li>
            </ul>
            <p>If your grievance is not resolved to your satisfaction, you may escalate to the <strong>Data Protection Board of India</strong> once it is constituted under the DPDPA.</p>
          </article>

          {/* 13 */}
          <article className="info-card info-card-wide">
            <h5>13. Third-Party Links</h5>
            <p>
              Our Services may contain links to third-party websites or apps (e.g., social media, payment
              gateways, map services). We are not responsible for the privacy practices of those third
              parties. We encourage you to read their privacy policies before providing any personal data.
            </p>
          </article>

          {/* 14 */}
          <article className="info-card info-card-wide">
            <h5>14. Cross-Border Data Transfers</h5>
            <p>
              Some of our technology providers (e.g., Google Firebase, Cloudinary) are based outside India.
              Where personal data is transferred internationally, we ensure appropriate contractual
              safeguards are in place consistent with applicable Indian law and any rules notified under
              the DPDPA regarding permitted geographies.
            </p>
          </article>

          {/* 15 */}
          <article className="info-card info-card-wide">
            <h5>15. Changes to This Privacy Policy</h5>
            <p>
              We may update this Privacy Policy from time to time. When we make material changes we will:
            </p>
            <ul>
              <li>Update the "Last Updated" date at the top of this page.</li>
              <li>Send an in-app notification and / or email to registered users.</li>
              <li>Where required by law, seek fresh consent.</li>
            </ul>
            <p>Continued use of the Services after the effective date of any change constitutes acceptance of the updated policy.</p>
          </article>

          {/* 16 */}
          <article className="info-card info-card-wide">
            <h5>16. Contact Us</h5>
            <ul>
              <li><strong>General Support:</strong> <a href="mailto:support@blinkiefash.in">support@blinkiefash.in</a></li>
              <li><strong>Privacy / Data Rights:</strong> <a href="mailto:privacy@blinkiefash.in">privacy@blinkiefash.in</a></li>
              <li><strong>Grievances:</strong> <a href="mailto:grievance@blinkiefash.in">grievance@blinkiefash.in</a></li>
              <li><strong>Address:</strong> BlinkieFash Pvt. Ltd., Bhubaneswar, Odisha – 751001, India</li>
            </ul>
          </article>

        </section>

        <section className="info-banner info-commitment">
          <p><strong>Your privacy matters to us.</strong> For any data-related query email <a href="mailto:privacy@blinkiefash.in" style={{ color: "#fff", textDecoration: "underline" }}>privacy@blinkiefash.in</a></p>
          <button className="info-chat-btn" type="button" onClick={() => navigate("/")}>Back to Home</button>
        </section>
      </main>
    </div>
  );
}
