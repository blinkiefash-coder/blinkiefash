import { useState } from "react";
import "./pinAccessGate.css";

export default function PinAccessGate({
  requiredPin,
  sectionLabel = "Protected Area",
  onSuccess,
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (event) => {
    event.preventDefault();

    if (pin === requiredPin) {
      setError("");
      onSuccess?.();
      return;
    }

    setError("Invalid PIN. Please try again.");
  };

  return (
    <main className="pin-gate-shell">
      <section className="pin-gate-card">
        <h1>{sectionLabel}</h1>
        <p>Enter your access PIN to continue.</p>

        <form className="pin-gate-form" onSubmit={handleSubmit}>
          <label htmlFor="pin-gate-input">Access PIN</label>
          <input
            id="pin-gate-input"
            type="password"
            inputMode="numeric"
            autoFocus
            placeholder="Enter PIN"
            value={pin}
            onChange={(event) => {
              setPin(event.target.value);
              setError("");
            }}
          />

          {error ? <div className="pin-gate-error">{error}</div> : null}

          <button type="submit">Continue</button>
        </form>
      </section>
    </main>
  );
}