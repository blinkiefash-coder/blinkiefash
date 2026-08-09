import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_BASE_URL } from "../apiBase";
import "./PartnerModal.css";

const CITIES = ["Cuttack", "Bhubaneswar", "Berhampur", "Rourkela", "Sambalpur", "Puri", "Balasore", "Bhadrak", "Angul", "Jeypore", "Other"];
const STORE_CATEGORIES = ["Men's Fashion", "Women's Fashion", "Kids' Fashion", "Ethnic Wear", "Western Wear", "Footwear", "Accessories", "Jewellery", "Multi-category", "Other"];
const VEHICLE_TYPES = ["Bike", "Scooter", "Electric Scooter", "Cycle", "Other"];

export default function PartnerModal({ type, onClose }) {
  const navigate = useNavigate();
  const [tab, setTab] = useState(type || "store");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(null);
  const [error, setError] = useState("");

  const [storeForm, setStoreForm] = useState({
    store_name: "", owner_name: "", email: "", phone: "",
    city: "", address: "", pincode: "",
    store_category: "", store_size: "", years_in_business: "",
    gst_number: "", message: "",
  });

  const [deliveryForm, setDeliveryForm] = useState({
    full_name: "", email: "", phone: "", city: "", pincode: "",
    vehicle_type: "", driving_license: "", availability: "",
    experience_years: "", message: "",
  });

  const updateStore = (e) => setStoreForm(p => ({ ...p, [e.target.name]: e.target.value }));
  const updateDelivery = (e) => setDeliveryForm(p => ({ ...p, [e.target.name]: e.target.value }));

  const submitStore = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/partners/store`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(storeForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSuccess({ id: data.application.id, type: "store" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const submitDelivery = async (e) => {
    e.preventDefault();
    setError(""); setLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/api/partners/delivery`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(deliveryForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Submission failed");
      setSuccess({ id: data.application.id, type: "delivery" });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="pm-overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="pm-modal">
        {/* Header */}
        <div className="pm-header">
          <div className="pm-tabs">
            <button className={tab === "store" ? "pm-tab active" : "pm-tab"} onClick={() => { setTab("store"); setSuccess(null); setError(""); }}>
              🏪 Store Partner
            </button>
            <button className={tab === "delivery" ? "pm-tab active" : "pm-tab"} onClick={() => { setTab("delivery"); setSuccess(null); setError(""); }}>
              🚴 Delivery Partner
            </button>
          </div>
          <button className="pm-close" onClick={onClose}>✕</button>
        </div>

        {/* Success state */}
        {success ? (
          <div className="pm-success">
            <div className="pm-success-icon">✓</div>
            <h3>Application Submitted!</h3>
            <p>Thank you for your interest in joining BlinkieFash as a {success.type === "store" ? "store" : "delivery"} partner.</p>
            <p className="pm-ref">Reference ID: <strong>{success.id}</strong></p>
            <p>Our team will review your application and reach out within <strong>2–3 business days</strong>.</p>
            <button className="pm-submit-btn" onClick={onClose}>Done</button>
          </div>
        ) : (
          <div className="pm-body">
            {tab === "store" ? (
              <>
                <div className="pm-intro">
                  <h3>Join as a Fashion Store Partner</h3>
                  <p>Reach thousands of customers and grow your sales with BlinkieFash.</p>
                  <button
                    type="button"
                    className="pm-submit-btn"
                    onClick={() => {
                      onClose();
                      navigate("/vendor");
                    }}
                    style={{ marginTop: "12px" }}
                  >
                    Existing vendor? Login with password
                  </button>
                </div>
                <form onSubmit={submitStore} className="pm-form">
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>Store Name *</label>
                      <input name="store_name" value={storeForm.store_name} onChange={updateStore} placeholder="e.g. Trendz Fashion" required />
                    </div>
                    <div className="pm-field">
                      <label>Owner Name *</label>
                      <input name="owner_name" value={storeForm.owner_name} onChange={updateStore} placeholder="Your full name" required />
                    </div>
                  </div>
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>Email *</label>
                      <input type="email" name="email" value={storeForm.email} onChange={updateStore} placeholder="store@email.com" required />
                    </div>
                    <div className="pm-field">
                      <label>Phone *</label>
                      <input type="tel" name="phone" value={storeForm.phone} onChange={updateStore} placeholder="+91 XXXXX XXXXX" required />
                    </div>
                  </div>
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>City *</label>
                      <select name="city" value={storeForm.city} onChange={updateStore} required>
                        <option value="">Select city</option>
                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="pm-field">
                      <label>Pincode</label>
                      <input name="pincode" value={storeForm.pincode} onChange={updateStore} placeholder="e.g. 751001" maxLength={6} />
                    </div>
                  </div>
                  <div className="pm-field pm-field-full">
                    <label>Store Address</label>
                    <input name="address" value={storeForm.address} onChange={updateStore} placeholder="Street address / shop number" />
                  </div>
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>Store Category</label>
                      <select name="store_category" value={storeForm.store_category} onChange={updateStore}>
                        <option value="">Select category</option>
                        {STORE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="pm-field">
                      <label>Store Size</label>
                      <select name="store_size" value={storeForm.store_size} onChange={updateStore}>
                        <option value="">Select size</option>
                        <option value="small">Small (under 500 sq ft)</option>
                        <option value="medium">Medium (500–2000 sq ft)</option>
                        <option value="large">Large (2000+ sq ft)</option>
                      </select>
                    </div>
                  </div>
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>Years in Business</label>
                      <input type="number" name="years_in_business" value={storeForm.years_in_business} onChange={updateStore} placeholder="e.g. 3" min={0} max={100} />
                    </div>
                    <div className="pm-field">
                      <label>GST Number (optional)</label>
                      <input name="gst_number" value={storeForm.gst_number} onChange={updateStore} placeholder="e.g. 21AAAAA0000A1Z5" />
                    </div>
                  </div>
                  <div className="pm-field pm-field-full">
                    <label>Message (optional)</label>
                    <textarea name="message" value={storeForm.message} onChange={updateStore} placeholder="Tell us about your store..." rows={3} />
                  </div>
                  {error && <p className="pm-error">{error}</p>}
                  <button type="submit" className="pm-submit-btn" disabled={loading}>
                    {loading ? "Submitting…" : "Submit Application →"}
                  </button>
                </form>
              </>
            ) : (
              <>
                <div className="pm-intro">
                  <h3>Join as a Delivery Partner</h3>
                  <p>Earn flexible income by delivering fashion in your city.</p>
                </div>
                <form onSubmit={submitDelivery} className="pm-form">
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>Full Name *</label>
                      <input name="full_name" value={deliveryForm.full_name} onChange={updateDelivery} placeholder="Your full name" required />
                    </div>
                    <div className="pm-field">
                      <label>Phone *</label>
                      <input type="tel" name="phone" value={deliveryForm.phone} onChange={updateDelivery} placeholder="+91 XXXXX XXXXX" required />
                    </div>
                  </div>
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>Email *</label>
                      <input type="email" name="email" value={deliveryForm.email} onChange={updateDelivery} placeholder="you@email.com" required />
                    </div>
                    <div className="pm-field">
                      <label>City *</label>
                      <select name="city" value={deliveryForm.city} onChange={updateDelivery} required>
                        <option value="">Select city</option>
                        {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>Pincode</label>
                      <input name="pincode" value={deliveryForm.pincode} onChange={updateDelivery} placeholder="e.g. 751001" maxLength={6} />
                    </div>
                    <div className="pm-field">
                      <label>Vehicle Type *</label>
                      <select name="vehicle_type" value={deliveryForm.vehicle_type} onChange={updateDelivery} required>
                        <option value="">Select vehicle</option>
                        {VEHICLE_TYPES.map(v => <option key={v} value={v}>{v}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="pm-row">
                    <div className="pm-field">
                      <label>Driving License No.</label>
                      <input name="driving_license" value={deliveryForm.driving_license} onChange={updateDelivery} placeholder="e.g. OD0120220000001" />
                    </div>
                    <div className="pm-field">
                      <label>Availability</label>
                      <select name="availability" value={deliveryForm.availability} onChange={updateDelivery}>
                        <option value="">Select availability</option>
                        <option value="full-time">Full-time</option>
                        <option value="part-time">Part-time</option>
                        <option value="weekends">Weekends only</option>
                        <option value="flexible">Flexible</option>
                      </select>
                    </div>
                  </div>
                  <div className="pm-field pm-field-full">
                    <label>Delivery Experience (years)</label>
                    <input type="number" name="experience_years" value={deliveryForm.experience_years} onChange={updateDelivery} placeholder="0 if fresher" min={0} max={50} />
                  </div>
                  <div className="pm-field pm-field-full">
                    <label>Message (optional)</label>
                    <textarea name="message" value={deliveryForm.message} onChange={updateDelivery} placeholder="Anything you'd like us to know…" rows={3} />
                  </div>
                  {error && <p className="pm-error">{error}</p>}
                  <button type="submit" className="pm-submit-btn" disabled={loading}>
                    {loading ? "Submitting…" : "Apply Now →"}
                  </button>
                </form>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
