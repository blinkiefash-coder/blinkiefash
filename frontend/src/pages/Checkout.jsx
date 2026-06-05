import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import CustomerBottomNav from "../components/CustomerBottomNav";
import { API_API_BASE_URL } from "../apiBase";
import "../styles/featurePages.css";

export default function Checkout() {
  const navigate = useNavigate();
  const userId = localStorage.getItem("userUuid");

  const [items, setItems] = useState([]);
  const [addresses, setAddresses] = useState([]);
  const [selectedAddressId, setSelectedAddressId] = useState(null);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [distanceKm, setDistanceKm] = useState(null);
  const [feeWithinRange, setFeeWithinRange] = useState(true);

  const [referralAmount, setReferralAmount] = useState(0);
  const [clothingItems, setClothingItems] = useState(0);
  const [clothingPercent, setClothingPercent] = useState(0);
  const [useReferral, setUseReferral] = useState(false);
  const [useClothing, setUseClothing] = useState(false);

  const [adding, setAdding] = useState(false);
  const [newAddrLine, setNewAddrLine] = useState("");
  const [newAddrCity, setNewAddrCity] = useState("Bhubaneswar");
  const [newAddrPin, setNewAddrPin] = useState("");

  const [placing, setPlacing] = useState(false);
  const [error, setError] = useState(null);
  const [isTryOrder, setIsTryOrder] = useState(false);

  // ---- Load cart, addresses, rewards ----
  useEffect(() => {
    if (!userId) {
      navigate("/login");
      return;
    }
    (async () => {
      try {
        const [cartRes, addrRes, rewardRes] = await Promise.all([
          fetch(`${API_API_BASE_URL}/cart/${userId}`),
          fetch(`${API_API_BASE_URL}/checkout/addresses?userId=${userId}`),
          fetch(`${API_API_BASE_URL}/checkout/rewards?userId=${userId}`),
        ]);
        const [cartData, addrData, rewardData] = await Promise.all([
          cartRes.json(),
          addrRes.json(),
          rewardRes.json(),
        ]);
        setItems(cartData.items || []);
        setAddresses(addrData.addresses || []);
        const def = (addrData.addresses || []).find((a) => a.is_default) || (addrData.addresses || [])[0];
        if (def) setSelectedAddressId(def.id);
        if (rewardData.success) {
          setReferralAmount(parseFloat(rewardData.referralAmount) || 0);
          setClothingItems(parseInt(rewardData.clothingItems) || 0);
          setClothingPercent(parseFloat(rewardData.clothingPercent) || 0);
        }
      } catch (e) {
        setError("Could not load checkout. Please try again.");
      }
    })();
  }, [userId, navigate]);

  // ---- Refresh delivery fee when address or items change ----
  const itemsSubtotal = useMemo(
    () => items.reduce((s, it) => s + Number(it.price || 0) * Number(it.quantity || 0), 0),
    [items]
  );

  useEffect(() => {
    if (!selectedAddressId || itemsSubtotal === 0) return;
    (async () => {
      try {
        const res = await fetch(
          `${API_API_BASE_URL}/checkout/delivery-fee?addressId=${selectedAddressId}&subtotal=${itemsSubtotal}`
        );
        const data = await res.json();
        if (data.success) {
          setDeliveryFee(data.fee == null ? 0 : data.fee);
          setDistanceKm(data.distance);
          setFeeWithinRange(!!data.withinRange);
        }
      } catch {}
    })();
  }, [selectedAddressId, itemsSubtotal]);

  const referralDiscount = useReferral ? Math.min(referralAmount, itemsSubtotal) : 0;
  const clothingDiscount = useClothing
    ? Math.round(((itemsSubtotal * Math.min(clothingPercent, 5)) / 100) * 100) / 100
    : 0;
  const discountedSubtotal = Math.max(itemsSubtotal - referralDiscount - clothingDiscount, 0);
  const grandTotal = discountedSubtotal + (feeWithinRange ? deliveryFee : 0);

  const handleAddAddress = async (e) => {
    e?.preventDefault?.();
    if (!newAddrLine.trim() || !newAddrPin.trim()) return;
    try {
      const res = await fetch(`${API_API_BASE_URL}/checkout/addresses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          address_line: newAddrLine,
          city: newAddrCity,
          pincode: newAddrPin,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setAddresses((prev) => [data.address, ...prev]);
        setSelectedAddressId(data.address.id);
        setAdding(false);
        setNewAddrLine("");
        setNewAddrPin("");
      } else {
        setError(data.message || "Could not save address");
      }
    } catch {
      setError("Could not save address");
    }
  };

  const handlePlaceOrder = async () => {
    setError(null);
    if (!selectedAddressId) {
      setError("Please choose a delivery address");
      return;
    }
    if (!items.length) {
      setError("Your cart is empty");
      return;
    }
    if (!feeWithinRange) {
      setError("Sorry, delivery is not available beyond 15 km from our nearest store.");
      return;
    }

    setPlacing(true);
    try {
      const res = await fetch(`${API_API_BASE_URL}/checkout/orders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          addressId: selectedAddressId,
          items: items.map((it) => ({
            variantId: it.variant_id,
            quantity: it.quantity,
            price: it.price,
          })),
          totalAmount: itemsSubtotal,
          isTryOrder,
          useReferralReward: useReferral,
          useClothingReward: useClothing,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setPlacing(false);
        setError(data.message || "Could not place order");
        return;
      }
      // Clear cart on success
      try {
        await fetch(`${API_API_BASE_URL}/cart/clear/${userId}`, { method: "DELETE" });
        window.dispatchEvent(new Event("cart:updated"));
      } catch {}
      navigate(`/orders`);
    } catch {
      setPlacing(false);
      setError("Could not place order. Please try again.");
    }
  };

  return (
    <div className="bf-feature-page">
      <Navbar />
      <div className="bf-feature-shell">
        <div>
          <h1 className="bf-section-title">Checkout</h1>
          <p className="bf-section-subtitle">Review your items and confirm delivery details.</p>
        </div>

        {error && <div className="bf-notice error">⚠️ {error}</div>}

        <div className="bf-checkout-grid">
          {/* LEFT — addresses, items, rewards */}
          <div>
            {/* Addresses */}
            <section className="bf-card-section" style={{ marginBottom: 14 }}>
              <h2 className="bf-card-title">📍 Delivery address</h2>
              {addresses.length === 0 && !adding && (
                <div className="bf-empty" style={{ padding: 20 }}>
                  <p>No saved addresses yet.</p>
                  <button className="bf-btn-primary" onClick={() => setAdding(true)}>
                    Add address
                  </button>
                </div>
              )}
              {addresses.map((addr) => (
                <div
                  key={addr.id}
                  className={`bf-address-card ${selectedAddressId === addr.id ? "selected" : ""}`}
                  onClick={() => setSelectedAddressId(addr.id)}
                >
                  <div className="bf-addr-line">{addr.address_line}</div>
                  <div className="bf-addr-meta">
                    {addr.city} • {addr.pincode}
                    {addr.is_default ? " • Default" : ""}
                  </div>
                </div>
              ))}
              {!adding && addresses.length > 0 && (
                <button
                  className="bf-btn-ghost"
                  style={{ marginTop: 12 }}
                  onClick={() => setAdding(true)}
                >
                  + Add new address
                </button>
              )}
              {adding && (
                <form onSubmit={handleAddAddress} style={{ marginTop: 12 }}>
                  <div className="bf-field">
                    <label>Address line</label>
                    <input
                      type="text"
                      value={newAddrLine}
                      onChange={(e) => setNewAddrLine(e.target.value)}
                      placeholder="House / Flat, street, area"
                      required
                    />
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 10 }}>
                    <div className="bf-field">
                      <label>City</label>
                      <input
                        type="text"
                        value={newAddrCity}
                        onChange={(e) => setNewAddrCity(e.target.value)}
                        required
                      />
                    </div>
                    <div className="bf-field">
                      <label>Pincode</label>
                      <input
                        type="text"
                        value={newAddrPin}
                        onChange={(e) => setNewAddrPin(e.target.value)}
                        inputMode="numeric"
                        maxLength={6}
                        required
                      />
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: 10 }}>
                    <button type="submit" className="bf-btn-primary">Save address</button>
                    <button type="button" className="bf-btn-ghost" onClick={() => setAdding(false)}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>

            {/* Cart items */}
            <section className="bf-card-section" style={{ marginBottom: 14 }}>
              <h2 className="bf-card-title">
                🛍️ Your items <small>({items.length})</small>
              </h2>
              {items.length === 0 ? (
                <div className="bf-empty" style={{ padding: 20 }}>
                  <p>Your cart is empty.</p>
                  <button className="bf-btn-primary" onClick={() => navigate("/shop")}>
                    Continue shopping
                  </button>
                </div>
              ) : (
                items.map((it) => (
                  <div key={it.variant_id} className="bf-order-item">
                    {it.image_url ? (
                      <img src={it.image_url} alt={it.product_name || "Item"} />
                    ) : (
                      <div style={{ width: 64, height: 80, background: "#f3f4f6", borderRadius: 10 }} />
                    )}
                    <div className="bf-oi-info">
                      <h4>{it.product_name || "Item"}</h4>
                      <small>
                        {it.size ? `Size ${it.size}` : ""}
                        {it.color ? ` • ${it.color}` : ""} • Qty {it.quantity}
                      </small>
                      <div className="bf-oi-price">₹{(Number(it.price) * Number(it.quantity)).toFixed(0)}</div>
                    </div>
                  </div>
                ))
              )}
            </section>

            {/* Rewards */}
            {(referralAmount > 0 || clothingItems > 0) && (
              <section className="bf-card-section" style={{ marginBottom: 14 }}>
                <h2 className="bf-card-title">🎁 Use your rewards</h2>

                {referralAmount > 0 && (
                  <div className={`bf-reward-row ${referralAmount === 0 ? "disabled" : ""}`}>
                    <div className="bf-reward-info">
                      <strong>Referral credit</strong>
                      <small>Flat discount earned by inviting friends</small>
                    </div>
                    <div className="bf-reward-info-amount">-₹{referralAmount.toFixed(0)}</div>
                    <div
                      className={`bf-switch ${useReferral ? "is-on" : ""}`}
                      onClick={() => setUseReferral((v) => !v)}
                      role="switch"
                      aria-checked={useReferral}
                    />
                  </div>
                )}

                {clothingItems > 0 && (
                  <div className="bf-reward-row">
                    <div className="bf-reward-info">
                      <strong>Old-clothes credit</strong>
                      <small>{clothingItems} donated item(s) — max 5% on this order</small>
                    </div>
                    <div className="bf-reward-info-amount">-{Math.min(clothingPercent, 5)}%</div>
                    <div
                      className={`bf-switch ${useClothing ? "is-on" : ""}`}
                      onClick={() => setUseClothing((v) => !v)}
                      role="switch"
                      aria-checked={useClothing}
                    />
                  </div>
                )}
              </section>
            )}

            {/* Try & Buy toggle */}
            <section className="bf-card-section" style={{ marginBottom: 14 }}>
              <div className="bf-reward-row">
                <div className="bf-reward-info">
                  <strong>Try & Buy at home</strong>
                  <small>Try the items at delivery; pay only for what you keep</small>
                </div>
                <div
                  className={`bf-switch ${isTryOrder ? "is-on" : ""}`}
                  onClick={() => setIsTryOrder((v) => !v)}
                  role="switch"
                  aria-checked={isTryOrder}
                />
              </div>
            </section>
          </div>

          {/* RIGHT / mobile bottom — bill summary */}
          <div className="bf-cta-bar-desktop">
            <BillSummary
              itemsSubtotal={itemsSubtotal}
              referralDiscount={referralDiscount}
              clothingDiscount={clothingDiscount}
              deliveryFee={feeWithinRange ? deliveryFee : 0}
              distanceKm={distanceKm}
              feeWithinRange={feeWithinRange}
              total={grandTotal}
            />
            <button
              className="bf-btn-primary"
              style={{ width: "100%", marginTop: 14, padding: 14 }}
              disabled={placing || !items.length || !selectedAddressId || !feeWithinRange}
              onClick={handlePlaceOrder}
            >
              {placing ? "Placing order…" : `Place order • ₹${grandTotal.toFixed(0)}`}
            </button>
          </div>
        </div>

        {/* Mobile sticky CTA */}
        <div className="bf-cta-bar bf-hide-mobile-no">
          <div className="bf-cta-amt">
            ₹{grandTotal.toFixed(0)}
            <small>Inclusive of all charges</small>
          </div>
          <button
            className="bf-btn-primary"
            disabled={placing || !items.length || !selectedAddressId || !feeWithinRange}
            onClick={handlePlaceOrder}
          >
            {placing ? "Placing…" : "Place order"}
          </button>
        </div>
      </div>
      <CustomerBottomNav active="categories" />
    </div>
  );
}

function BillSummary({
  itemsSubtotal,
  referralDiscount,
  clothingDiscount,
  deliveryFee,
  distanceKm,
  feeWithinRange,
  total,
}) {
  return (
    <>
      <h2 className="bf-card-title">🧾 Bill summary</h2>
      <div className="bf-bill-row">
        <span>Items subtotal</span>
        <strong>₹{itemsSubtotal.toFixed(0)}</strong>
      </div>
      {referralDiscount > 0 && (
        <div className="bf-bill-row discount">
          <span>Referral credit</span>
          <strong>-₹{referralDiscount.toFixed(0)}</strong>
        </div>
      )}
      {clothingDiscount > 0 && (
        <div className="bf-bill-row discount">
          <span>Old-clothes credit</span>
          <strong>-₹{clothingDiscount.toFixed(0)}</strong>
        </div>
      )}
      <div className="bf-bill-row">
        <span>
          Delivery fee
          {distanceKm != null ? ` (${distanceKm} km)` : ""}
        </span>
        <strong>{deliveryFee === 0 ? "FREE" : `₹${deliveryFee.toFixed(0)}`}</strong>
      </div>
      {!feeWithinRange && (
        <div className="bf-notice error" style={{ marginTop: 8 }}>
          We don't deliver beyond 15 km from our nearest store yet.
        </div>
      )}
      <div className="bf-bill-row total">
        <span>Total</span>
        <strong>₹{total.toFixed(0)}</strong>
      </div>
    </>
  );
}
