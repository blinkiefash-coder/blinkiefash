import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import CustomerBottomNav from "../components/CustomerBottomNav";
import { API_API_BASE_URL } from "../apiBase";
import "../styles/featurePages.css";

const STATUS_LABEL = {
  requested: "Pickup requested",
  scheduled: "Pickup scheduled",
  collected: "Collected — credit added 🎉",
  cancelled: "Cancelled",
};
const STATUS_CLS = {
  requested: "bf-status-placed",
  scheduled: "bf-status-confirmed",
  collected: "bf-status-delivered",
  cancelled: "bf-status-cancelled",
};

export default function OldClothes() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userUuid");
  const [pickups, setPickups] = useState([]);
  const [availableItems, setAvailableItems] = useState(0);
  const [availablePercent, setAvailablePercent] = useState(0);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState(null);
  const [itemCount, setItemCount] = useState(1);
  const [pickupSlot, setPickupSlot] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }
    refresh();
    (async () => {
      try {
        const res = await fetch(`${API_API_BASE_URL}/checkout/addresses?userId=${userId}`);
        const data = await res.json();
        const list = data.addresses || [];
        setAddresses(list);
        const def = list.find((a) => a.is_default) || list[0];
        if (def) setAddressId(def.id);
      } catch {}
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const refresh = async () => {
    try {
      const res = await fetch(`${API_API_BASE_URL}/old-clothes/${userId}`);
      const data = await res.json();
      if (data.success !== false) {
        setPickups(data.pickups || []);
        setAvailableItems(parseInt(data.availableItems) || 0);
        setAvailablePercent(parseFloat(data.availablePercent) || 0);
      }
    } catch {
      setError("Could not load your donations");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    setError(null);
    if (!addressId) {
      setError("Please select an address for pickup");
      return;
    }
    if (!itemCount || itemCount < 1) {
      setError("Item count must be at least 1");
      return;
    }
    if (Number(itemCount) > 5) {
      setError("You can donate a maximum of 5 clothing pieces");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`${API_API_BASE_URL}/old-clothes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          addressId,
          itemCount: Number(itemCount),
          pickupSlot: pickupSlot || null,
          notes: notes || null,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Could not schedule pickup");
      setMessage(
        "Pickup scheduled! Once collected, up to 5% discount will be available on your next order."
      );
      setItemCount(1);
      setPickupSlot("");
      setNotes("");
      refresh();
    } catch (e) {
      setError(e.message || "Could not schedule pickup");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bf-feature-page">
      <Navbar />
      <div className="bf-feature-shell">
        <section className="bf-hero amber">
          <span className="bf-hero-icon">👕</span>
          <h1>Donate old clothes</h1>
          <p>
            Pickup is available only after you place at least one order with BlinkieFash. Donate up to 5 pieces and get up to 5% off on your next order after collection.
          </p>
        </section>

        {availableItems > 0 && (
          <div className="bf-credit-banner">
            <div>
              <div className="bf-credit-amt">{Math.min(availablePercent, 50)}% off</div>
              <div className="bf-credit-label">
                From {availableItems} donated item(s) — max {Math.min(availablePercent, 5)}% on your next order
              </div>
            </div>
            <button className="bf-btn-primary" onClick={() => navigate("/cart")}>
              Use it now
            </button>
          </div>
        )}

        {message && <div className="bf-notice success">✅ {message}</div>}
        {error && <div className="bf-notice error">⚠️ {error}</div>}

        <section className="bf-card-section">
          <h2 className="bf-card-title">Schedule a pickup</h2>
          <form onSubmit={handleSubmit}>
            <div className="bf-field">
              <label>Pickup address</label>
              {addresses.length === 0 ? (
                <div className="bf-notice info">
                  Please add an address first from Checkout or your profile.
                </div>
              ) : (
                <select value={addressId || ""} onChange={(e) => setAddressId(e.target.value)} required>
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.address_line} — {a.city} {a.pincode}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div className="bf-field">
                <label>Number of items</label>
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={itemCount}
                  onChange={(e) => setItemCount(e.target.value)}
                  required
                />
              </div>
              <div className="bf-field">
                <label>Preferred pickup slot</label>
                <input
                  type="text"
                  placeholder="e.g. Tomorrow, 5–7 PM"
                  value={pickupSlot}
                  onChange={(e) => setPickupSlot(e.target.value)}
                />
              </div>
            </div>

            <div className="bf-field">
              <label>Notes (optional)</label>
              <textarea
                rows={3}
                placeholder="Any special instructions for our rider…"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </div>

            <div className="bf-notice info">
              ℹ️ Maximum 5 pieces per pickup. Once collected, you'll receive up to 5% off on your <strong>next order</strong>.
            </div>

            <button
              type="submit"
              className="bf-btn-primary"
              style={{ width: "100%", marginTop: 14, padding: 14 }}
              disabled={submitting || addresses.length === 0}
            >
              {submitting ? "Scheduling…" : "Schedule pickup"}
            </button>
          </form>
        </section>

        <section className="bf-card-section">
          <h2 className="bf-card-title">Your pickups</h2>
          {pickups.length === 0 ? (
            <div className="bf-empty" style={{ padding: 20 }}>
              <p>No pickups scheduled yet.</p>
            </div>
          ) : (
            pickups.map((p) => (
              <div key={p.id} className="bf-order-row">
                <div className="bf-order-row-head">
                  <div>
                    <div className="bf-order-row-id">
                      {p.item_count} item(s)
                      {p.pickup_slot ? ` • ${p.pickup_slot}` : ""}
                    </div>
                    <div className="bf-order-row-meta">
                      <span>{new Date(p.created_at).toLocaleString()}</span>
                    </div>
                  </div>
                  <span className={`bf-status-badge ${STATUS_CLS[p.status] || "bf-status-placed"}`}>
                    {STATUS_LABEL[p.status] || p.status}
                  </span>
                </div>
                {p.notes && (
                  <div className="bf-order-row-meta" style={{ marginTop: 4 }}>
                    {p.notes}
                  </div>
                )}
              </div>
            ))
          )}
        </section>
      </div>
      <CustomerBottomNav active="categories" />
    </div>
  );
}
