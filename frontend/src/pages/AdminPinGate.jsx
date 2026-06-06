import { useState } from "react";
import logo from "../assets/logo.png";
import "./adminPinGate.css";

const ADMIN_PIN = "080890";

export default function AdminPinGate({ onSuccess }) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e) => {
    e.preventDefault();

    if (pin === ADMIN_PIN) {
      setError("");
      onSuccess();
      return;
    }

    setError("Invalid admin PIN. Access denied.");
  };

  return (
    <main className="admin-gate-shell">
      <section className="admin-gate-card">
        <div className="admin-gate-brand-row">
          <img src={logo} alt="Blinkiefash" className="admin-gate-logo" />
          <span className="admin-gate-brand-line">60 minutes Ecom || Book and Take || Try and Buy</span>
        </div>

        <h1>Private Launch Access</h1>
        <p>
          Blinkiefash will be live from <strong>1st June</strong>. We are currently
          in the final testing and development phase.
          Enter the admin PIN to continue.
        </p>

        <div className="admin-gate-quotes">
          <p>"Style is a way to say who you are without speaking."</p>
          <p>"Fast fashion, thoughtful choices, effortless confidence."</p>
          <p>"From everyday essentials to standout looks, we deliver it all."</p>
        </div>

        <p className="admin-gate-purpose">
          Blinkiefash is built to make fashion shopping quick, reliable, and
          exciting, bringing curated styles across apparel, beauty, footwear,
          and lifestyle right to your doorstep.
        </p>

        <section className="admin-gate-concept">
          <h2>Our Concept</h2>
          <ul>
            <li>Explore from store, buy from store.</li>
            <li>No waiting period with faster in-store availability.</li>
            <li>Quick billing for a smooth checkout experience.</li>
            <li>Reserve your picks and collect instantly.</li>
            <li>60-minute delivery on selected products and locations.</li>
            <li>Priority packing and dispatch for express orders.</li>
            <li>Real-time order tracking from store to doorstep.</li>
            <li>Discover nearby partner stores in real time.</li>
            <li>Get assisted shopping with trusted style recommendations.</li>
          </ul>
        </section>

        <form className="admin-gate-form" onSubmit={handleSubmit}>
          <label htmlFor="admin-pin">Admin Login PIN</label>
          <input
            id="admin-pin"
            type="password"
            inputMode="numeric"
            autoFocus
            placeholder="Enter PIN"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />

          {error ? <div className="admin-gate-error">{error}</div> : null}

          <button type="submit">Unlock Website</button>
        </form>
      </section>
    </main>
  );
}
