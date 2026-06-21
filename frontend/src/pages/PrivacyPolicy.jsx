import { useNavigate } from "react-router-dom";
import logo from "../assets/logo.png";
import "./staticInfoPages.css";

export default function PrivacyPolicy() {
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
            <p>
              BlinkieFash is operated from India and complies with the Information Technology Act,
              2000, the Information Technology (Reasonable Security Practices and Procedures and
              Sensitive Personal Data or Information) Rules, 2011, and the Digital Personal Data
              Protection Act, 2023 (DPDP Act).
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>2. Information We Collect</h5>
            <p className="sub">A. Information You Provide Directly</p>
            <ul>
              <li><strong>Account Data:</strong> name, email address, mobile number, password (hashed), date of birth, gender (optional).</li>
              <li><strong>Profile Data:</strong> profile photo (optional), saved addresses, preferred sizes.</li>
              <li><strong>Order Data:</strong> products purchased, delivery address, billing details, order history, cancellations and returns.</li>
              <li><strong>Payment Data:</strong> processed by trusted payment gateways (Razorpay / UPI / Card networks). We do <em>not</em> store full card numbers, CVV, or UPI PINs on our servers.</li>
              <li><strong>Communications:</strong> messages, ratings, reviews, photos uploaded with reviews, customer-support requests.</li>
              <li><strong>Vendor Data (sellers only):</strong> business name, GSTIN, PAN, bank account, store address, KYC documents.</li>
            </ul>

            <p className="sub" style={{ marginTop: 16 }}>B. Information Collected Automatically</p>
            <ul>
              <li><strong>Device Information:</strong> device model, OS version, unique device identifiers, app version, language, time zone, crash logs.</li>
              <li><strong>Location Data:</strong> approximate (city/pincode) and precise (GPS) location — only when you grant the permission — to show nearby dark-store inventory and estimated delivery times.</li>
              <li><strong>Usage Data:</strong> pages viewed, products clicked, searches performed, session duration, referral source.</li>
              <li><strong>Notification Tokens:</strong> Firebase Cloud Messaging (FCM) token used to deliver push notifications.</li>
              <li><strong>Cookies & Local Storage:</strong> on the Website to keep you logged in and remember your cart.</li>
            </ul>

            <p className="sub" style={{ marginTop: 16 }}>C. Information from Third Parties</p>
            <ul>
              <li><strong>Google Sign-In / Firebase Auth:</strong> if you sign in with Google, we receive your name, email, and profile picture from your Google account.</li>
              <li><strong>Logistics Partners:</strong> delivery status updates from our courier partners.</li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>3. Why We Collect This Information (Purpose)</h5>
            <ul>
              <li>Create, secure, and authenticate your account.</li>
              <li>Process and deliver your orders, including coordinating with vendors and dark-stores.</li>
              <li>Show you nearby inventory, delivery estimates, and personalised recommendations.</li>
              <li>Send transactional messages (order confirmation, OTP, delivery, returns) via SMS / email / push notifications.</li>
              <li>Process payments and prevent fraud.</li>
              <li>Provide customer support and respond to your requests.</li>
              <li>Improve our Services through analytics and bug-fixes.</li>
              <li>Comply with legal, tax, accounting, and regulatory obligations.</li>
              <li>With your separate consent, send you promotional offers (you can opt out anytime).</li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>4. App Permissions We Request (Android)</h5>
            <p>
              The Android app requests only the permissions strictly required for the features you use.
              You can revoke any permission at any time from your device's Settings &gt; Apps &gt;
              BlinkieFash &gt; Permissions.
            </p>
            <ul>
              <li><strong>Location (ACCESS_FINE_LOCATION / ACCESS_COARSE_LOCATION):</strong> to detect your delivery area, show nearby dark-stores, and estimated 60-minute delivery eligibility. Used only while the app is in the foreground. We do <em>not</em> use background location.</li>
              <li><strong>Camera (via image_picker):</strong> only when you choose to take a photo for a product review or profile picture.</li>
              <li><strong>Photos / Storage (READ_MEDIA_IMAGES):</strong> only when you select an image from your gallery for a review or profile picture.</li>
              <li><strong>Notifications (POST_NOTIFICATIONS):</strong> to deliver order updates and offers you have subscribed to.</li>
              <li><strong>Internet:</strong> to communicate with our servers.</li>
            </ul>
            <p className="info-note">
              We never access your contacts, SMS, call logs, microphone, or files outside the images
              you explicitly select.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>5. How We Share Your Information</h5>
            <p>We do <strong>not sell</strong> your personal data. We share it only as described below:</p>
            <ul>
              <li><strong>Vendors and Dark-Stores:</strong> name, delivery address, contact number, and order details — only to fulfil your order.</li>
              <li><strong>Delivery Partners:</strong> name, address, phone number for last-mile delivery.</li>
              <li><strong>Payment Processors:</strong> Razorpay and other RBI-licensed payment aggregators to process transactions.</li>
              <li><strong>Service Providers:</strong> Google Firebase (authentication, push notifications, crash reporting), Google Maps Platform (geocoding), cloud hosting (Render, Neon PostgreSQL, Cloudflare R2 / image CDN), email/SMS gateways.</li>
              <li><strong>Legal &amp; Safety:</strong> when required by law, court order, or to protect our rights, users, or the public.</li>
              <li><strong>Business Transfers:</strong> in case of merger, acquisition, or asset sale, with prior notice to you.</li>
            </ul>
            <p>
              All third parties are bound by contractual obligations to handle your data securely and
              only for the purposes we authorise.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>6. Third-Party Services Used by the App</h5>
            <ul>
              <li>Google Firebase Authentication — <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></li>
              <li>Google Firebase Cloud Messaging — <a href="https://firebase.google.com/support/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></li>
              <li>Google Sign-In — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></li>
              <li>Google Maps / Geocoding — <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></li>
              <li>Razorpay (payments) — <a href="https://razorpay.com/privacy/" target="_blank" rel="noopener noreferrer">Privacy</a></li>
              <li>Render (hosting) — <a href="https://render.com/privacy" target="_blank" rel="noopener noreferrer">Privacy</a></li>
              <li>Neon (PostgreSQL database) — <a href="https://neon.tech/privacy-policy" target="_blank" rel="noopener noreferrer">Privacy</a></li>
              <li>OpenStreetMap (map tiles) — <a href="https://wiki.osmfoundation.org/wiki/Privacy_Policy" target="_blank" rel="noopener noreferrer">Privacy</a></li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>7. Data Retention</h5>
            <ul>
              <li><strong>Active accounts:</strong> we retain your data while your account is active.</li>
              <li><strong>Order &amp; tax records:</strong> kept for up to 8 years to comply with the Income-Tax Act and GST law.</li>
              <li><strong>Account deleted by you:</strong> personal identifiers are erased within 30 days, except where retention is required by law (e.g. invoices).</li>
              <li><strong>Inactive accounts:</strong> we may delete accounts inactive for more than 3 years after notifying you by email.</li>
              <li><strong>Server logs &amp; crash reports:</strong> automatically deleted after 90 days.</li>
            </ul>
          </article>

          <article className="info-card info-card-wide">
            <h5>8. Your Rights</h5>
            <p>Subject to applicable law, you have the right to:</p>
            <ul>
              <li><strong>Access</strong> the personal data we hold about you.</li>
              <li><strong>Correct</strong> inaccurate or outdated data — directly from the app's Profile screen or by emailing us.</li>
              <li><strong>Delete</strong> your account and personal data (see Section 9).</li>
              <li><strong>Withdraw consent</strong> for marketing communications at any time.</li>
              <li><strong>Port</strong> your data — request a downloadable copy.</li>
              <li><strong>Lodge a grievance</strong> with our Grievance Officer (Section 13) or with the Data Protection Board of India.</li>
            </ul>
          </article>

          <article className="info-card info-card-wide" id="account-deletion">
            <h5>9. Account &amp; Data Deletion</h5>
            <p>
              You can delete your BlinkieFash account and the personal data associated with it at any
              time, using either of the following methods:
            </p>
            <ul>
              <li><strong>From inside the App:</strong> Profile &gt; Settings &gt; Delete My Account &gt; Confirm.</li>
              <li><strong>By email:</strong> send a request from your registered email to <a href="mailto:support@blinkiefash.in?subject=Account%20Deletion%20Request">support@blinkiefash.in</a> with the subject "Account Deletion Request".</li>
              <li><strong>Via web form:</strong> visit <a href="/account-deletion">blinkiefash.in/account-deletion</a> and submit the deletion form.</li>
            </ul>
            <p>
              <strong>What gets deleted:</strong> your name, email, phone number, profile photo,
              addresses, saved cart, wishlist, reviews, push-notification token, and authentication
              records — within 30 days of verification.
            </p>
            <p>
              <strong>What may be retained:</strong> anonymised order/transaction records required by
              tax laws (kept for up to 8 years with no personally identifying information linked to
              you), and any data needed to resolve an open dispute or fraud investigation.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>10. Data Security</h5>
            <ul>
              <li>All network traffic between the app/website and our servers is encrypted using HTTPS / TLS.</li>
              <li>Passwords are stored only as one-way salted hashes (bcrypt).</li>
              <li>Database access is restricted by IAM, IP allow-listing, and role-based access controls.</li>
              <li>Payment data is handled by PCI-DSS compliant gateways — we never store card or UPI credentials.</li>
              <li>Regular security reviews and dependency audits.</li>
            </ul>
            <p className="info-note">
              No method of transmission over the Internet is 100% secure. We strive to use commercially
              acceptable means to protect your data but cannot guarantee absolute security.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>11. Children's Privacy</h5>
            <p>
              BlinkieFash is intended for users aged 18 and above. We do not knowingly collect personal
              information from children under 18. If you believe a minor has provided us personal data,
              please contact us and we will promptly delete it.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>12. International Data Transfers</h5>
            <p>
              Your data is primarily stored on servers located in India and the United States via our
              cloud providers (Render, Neon, Google Cloud). When data is transferred outside India, we
              ensure equivalent safeguards through standard contractual clauses or the providers' own
              certifications.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>13. Grievance Officer / Contact Us</h5>
            <p>
              In accordance with the Information Technology Act, 2000 and rules made thereunder, the
              name and contact details of the Grievance Officer are provided below:
            </p>
            <ul>
              <li><strong>Name:</strong> Grievance Officer, BlinkieFash</li>
              <li><strong>Email:</strong> <a href="mailto:support@blinkiefash.in">support@blinkiefash.in</a></li>
              <li><strong>Response time:</strong> we acknowledge within 48 hours and resolve within 30 days.</li>
            </ul>
            <p>
              For all general privacy questions, write to{" "}
              <a href="mailto:support@blinkiefash.in">support@blinkiefash.in</a>.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>14. Changes to This Policy</h5>
            <p>
              We may update this Privacy Policy from time to time. The "Last Updated" date at the top
              of this page reflects the latest revision. Material changes will be notified via in-app
              banner, email, or push notification at least 7 days before they take effect. Continued
              use of the Services after changes become effective constitutes acceptance of the revised
              policy.
            </p>
          </article>

          <article className="info-card info-card-wide">
            <h5>15. Consent</h5>
            <p>
              By creating an account or using the BlinkieFash Services, you confirm that you have read,
              understood, and agreed to this Privacy Policy and consent to the collection, use, and
              disclosure of your personal information as described herein.
            </p>
          </article>

        </section>

        <section className="info-banner info-commitment">
          <p><strong>Questions?</strong> Email us anytime at <a href="mailto:support@blinkiefash.in" style={{ color: "#fff", textDecoration: "underline" }}>support@blinkiefash.in</a></p>
          <button className="info-chat-btn" type="button" onClick={() => navigate("/home")}>Back to Home</button>
        </section>
      </main>
    </div>
  );
}
