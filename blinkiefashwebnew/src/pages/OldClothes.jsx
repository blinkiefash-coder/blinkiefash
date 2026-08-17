import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getOldClothes, requestClothesPickup, getAddresses } from '../api';
import './OfferFeature.css';

export default function OldClothes() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();

  // Start as true only when we actually need to fetch
  const [loading, setLoading] = useState(() => isLoggedIn && !!user?.id);
  const [submitting, setSubmitting] = useState(false);
  const [pickups, setPickups] = useState([]);
  const [availablePercent, setAvailablePercent] = useState(0);
  const [availableItems, setAvailableItems] = useState(0);
  const [addresses, setAddresses] = useState([]);
  const [addressId, setAddressId] = useState('');
  const [itemCount, setItemCount] = useState(5);
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Not logged in → nothing to fetch, just leave loading as false
    if (!isLoggedIn || !user?.id) {
      return;
    }

    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);

      try {
        const [clothes, addrs] = await Promise.all([
          getOldClothes(user.id),
          getAddresses(user.id).catch(() => ({ addresses: [] })),
        ]);

        if (cancelled) return;

        setPickups(clothes.pickups || []);
        setAvailableItems(clothes.availableItems || 0);
        setAvailablePercent(clothes.availablePercent || 0);

        const list = addrs.addresses || addrs || [];
        setAddresses(Array.isArray(list) ? list : []);

        // Only set addressId if we don't already have one selected
        setAddressId((prev) => {
          if (prev) return prev;
          return list[0]?.id || list[0]?.address_id || '';
        });
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id]);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (!user?.id || !addressId) {
      setError('Please select an address');
      return;
    }

    setSubmitting(true);
    setError(null);
    setMessage(null);

    try {
      const res = await requestClothesPickup({
        userId: user.id,
        addressId,
        itemCount: Number(itemCount),
        notes: notes.trim() || undefined,
      });

      if (res.success) {
        setMessage('Pickup scheduled successfully!');
        setNotes('');

        // Refresh pickups list
        try {
          const clothes = await getOldClothes(user.id);
          setPickups(clothes.pickups || []);
          setAvailableItems(clothes.availableItems || 0);
          setAvailablePercent(clothes.availablePercent || 0);
        } catch {
          // ignore refresh error
        }
      } else {
        setError(res.message || 'Could not schedule pickup');
      }
    } catch (err) {
      setError(err.message || 'Could not schedule pickup');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="page offer-feature-page">
        <button type="button" className="offer-back" onClick={() => navigate('/offers')}>
          ← Back to Offers
        </button>
        <div className="offer-feature-card">
          <h1>Donate Old Clothes</h1>
          <p>Log in to schedule a pickup and earn up to 5% off.</p>
          <button type="button" className="primary-btn" onClick={() => navigate('/login')}>
            Log in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page offer-feature-page">
      <button type="button" className="offer-back" onClick={() => navigate('/offers')}>
        ← Back to Offers
      </button>

      <header className="offer-feature-header clothes-header">
        <span className="offer-feature-emoji">♻️</span>
        <div>
          <h1>Donate Old Clothes</h1>
          <p>Give back old clothes and earn up to 5% off on your next orders.</p>
        </div>
      </header>

      {loading ? (
        <p className="state-msg">Loading…</p>
      ) : (
        <>
          <section className="offer-feature-card">
            <div className="refer-stats">
              <div>
                <strong>{availablePercent}%</strong>
                <span>Available discount</span>
              </div>
              <div>
                <strong>{availableItems}</strong>
                <span>Items credited</span>
              </div>
            </div>
          </section>

          <section className="offer-feature-card">
            <h2>Schedule a pickup</h2>
            <p className="muted-note">Max 5 pieces per pickup. Available after your first order.</p>

            <form className="clothes-form" onSubmit={onSubmit}>
              <label>
                Address
                <select
                  value={addressId}
                  onChange={(e) => setAddressId(e.target.value)}
                  required
                >
                  <option value="">Select address</option>
                  {addresses.map((a) => (
                    <option key={a.id || a.address_id} value={a.id || a.address_id}>
                      {[a.address_line, a.city, a.pincode].filter(Boolean).join(', ') ||
                        a.label ||
                        'Address'}
                    </option>
                  ))}
                </select>
              </label>

              {addresses.length === 0 && (
                <p className="muted-note">
                  No saved addresses.{' '}
                  <button
                    type="button"
                    className="link-btn"
                    onClick={() => navigate('/checkout')}
                  >
                    Add one
                  </button>
                </p>
              )}

              <label>
                Number of items (1–5)
                <input
                  type="number"
                  min={1}
                  max={5}
                  value={itemCount}
                  onChange={(e) => setItemCount(e.target.value)}
                />
              </label>

              <label>
                Notes (optional)
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g. leave at gate"
                />
              </label>

              <button
                type="submit"
                className="primary-btn"
                disabled={submitting || !addressId}
              >
                {submitting ? 'Scheduling…' : 'Schedule pickup'}
              </button>
            </form>
          </section>

          {pickups.length > 0 && (
            <section className="offer-feature-card">
              <h2>Your pickups</h2>
              <ul className="pickup-list">
                {pickups.map((p) => (
                  <li key={p.id}>
                    <span>
                      {p.item_count} items · {p.status}
                    </span>
                    <small>
                      {p.created_at ? new Date(p.created_at).toLocaleDateString() : ''}
                      {p.address_line ? ` · ${p.address_line}` : ''}
                    </small>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {message && <p className="offer-success">{message}</p>}
          {error && <p className="offer-error">{error}</p>}
        </>
      )}
    </main>
  );
}