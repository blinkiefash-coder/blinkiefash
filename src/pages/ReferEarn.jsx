import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import CustomerBottomNav from "../components/CustomerBottomNav";
import { API_API_BASE_URL } from "../apiBase";
import "../styles/featurePages.css";

export default function ReferEarn() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userUuid");
  const [info, setInfo] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const res = await fetch(`${API_API_BASE_URL}/referrals/${userId}`);
        const data = await res.json();
        if (data.success === false) throw new Error(data.message);
        setInfo(data);
      } catch {
        setError("Could not load your referral info");
      }
    })();
  }, [userId, navigate]);

  const code = info?.code || "—";
  const totalRefs = info?.totalReferrals || 0;
  const available = Number(info?.availableReward || 0);
  const perReferral = Number(info?.perReferralReward || 50);

  const handleCopy = async () => {
    if (!code || code === "—") return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {}
  };

  const handleShare = async () => {
    const message = `Join me on BlinkieFash and we'll BOTH get ₹${perReferral} off our orders! 🎁\n\nUse my code at signup: ${code}\n\nDownload: https://blinkiefash.in`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "BlinkieFash — Refer & Earn", text: message });
      } catch {}
    } else {
      try {
        await navigator.clipboard.writeText(message);
        alert("Referral message copied! Paste it anywhere to share.");
      } catch {}
    }
  };

  return (
    <div className="bf-feature-page">
      <Navbar />
      <div className="bf-feature-shell">
        {error && <div className="bf-notice error">{error}</div>}

        <section className="bf-hero">
          <span className="bf-hero-icon">🎁</span>
          <h1>Refer & Earn ₹{perReferral}</h1>
          <p>
            Share your code with friends. When they sign up and place their first order, you BOTH get
            flat ₹{perReferral} off your next purchase.
          </p>
        </section>

        <section className="bf-card-section">
          <h2 className="bf-card-title">Your referral code</h2>
          <div className="bf-code-box">
            <span className="bf-code-text">{code}</span>
            <button className="ghost" onClick={handleCopy} disabled={!code || code === "—"}>
              {copied ? "Copied ✓" : "Copy"}
            </button>
            <button onClick={handleShare} disabled={!code || code === "—"}>
              Share
            </button>
          </div>

          <div className="bf-stat-grid" style={{ marginTop: 16 }}>
            <div className="bf-stat-tile">
              <div className="bf-stat-value">{totalRefs}</div>
              <div className="bf-stat-label">Friends referred</div>
            </div>
            <div className="bf-stat-tile">
              <div className="bf-stat-value">₹{available.toFixed(0)}</div>
              <div className="bf-stat-label">Reward available</div>
            </div>
          </div>
          {available > 0 && (
            <div className="bf-notice success" style={{ marginTop: 12 }}>
              💚 You have ₹{available.toFixed(0)} ready to use on your next order.
            </div>
          )}
        </section>

        <section className="bf-card-section">
          <h2 className="bf-card-title">How it works</h2>
          <ol className="bf-steps">
            <li>
              <div>
                <strong>Share your code</strong>
                <span>Send your code to friends via WhatsApp, SMS, or social media.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>They sign up using it</strong>
                <span>Your friend enters the code while creating their BlinkieFash account.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>You both get ₹{perReferral} off</strong>
                <span>Both of you get a flat ₹{perReferral} discount on the next order. The reward
                applies automatically at checkout.</span>
              </div>
            </li>
          </ol>
        </section>
      </div>
      <CustomerBottomNav active="categories" />
    </div>
  );
}
