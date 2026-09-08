import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  fetchAddresses as apiFetchAddresses,
  addAddress as apiAddAddress,
  updateAddress as apiUpdateAddress,
  deleteAddress as apiDeleteAddress,
} from '../api';
import './SavedAddresses.css';

function cacheKey(userId) {
  return `bfw_addresses_${userId || 'guest'}`;
}
function loadCache(userId) {
  try {
    const raw = localStorage.getItem(cacheKey(userId));
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}
function saveCache(userId, addresses) {
  try {
    localStorage.setItem(cacheKey(userId), JSON.stringify(addresses));
  } catch {
    /* ignore — quota or private mode */
  }
}

const ADDRESS_TYPES = ['Home', 'Work', 'Other'];

function toApiPayload(form) {
  return {
    address_type: form.type.toLowerCase(),
    address_line: form.line1,
    city: form.city,
    pincode: form.pincode,
    lat: form.lat ?? 0,
    lng: form.lng ?? 0,
    name: form.name || undefined,
    phone: form.phone || undefined,
    is_default: form.isDefault,
  };
}

function fromApiRecord(rec) {
  const type = (rec.address_type || rec.type || 'home').toString();
  return {
    id: String(rec.id ?? rec._id ?? `addr_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`),
    type: type.charAt(0).toUpperCase() + type.slice(1),
    line1: rec.address_line || rec.line1 || '',
    city: rec.city || '',
    pincode: rec.pincode || '',
    lat: rec.lat,
    lng: rec.lng,
    name: rec.name || '',
    phone: rec.phone || '',
    isDefault: !!(rec.is_default ?? rec.isDefault),
  };
}

function emptyForm() {
  return {
    type: 'Home',
    line1: '',
    city: '',
    pincode: '',
    lat: null,
    lng: null,
    name: '',
    phone: '',
    isDefault: false,
  };
}

/* ---------- icons ---------- */
const IconChevronRight = () => (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);
const IconHome = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 11.5 12 4l9 7.5" />
    <path d="M5.5 10v9a1 1 0 0 0 1 1h11a1 1 0 0 0 1-1v-9" />
    <path d="M9.5 20v-6h5v6" />
  </svg>
);
const IconBriefcase = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="7" width="18" height="13" rx="2" />
    <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M3 12h18" />
  </svg>
);
const IconMapPin = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconEdit = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z" />
  </svg>
);
const IconTrash = () => (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
  </svg>
);
const IconPlus = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M12 5v14M5 12h14" />
  </svg>
);
const IconBulb = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18h6" />
    <path d="M10 22h4" />
    <path d="M12 2a7 7 0 0 0-4 12.7c.6.5 1 1.2 1 2.3h6c0-1.1.4-1.8 1-2.3A7 7 0 0 0 12 2z" />
  </svg>
);
const IconClock = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
const IconRefreshBadge = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 4v6h-6" />
  </svg>
);
const IconStar = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m12 2 3.1 6.3 6.9 1-5 4.9L18.2 21 12 17.8 5.8 21 7 14.2l-5-4.9 6.9-1z" />
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 3 4 6.5v5c0 5 3.4 8.9 8 9.5 4.6-.6 8-4.5 8-9.5v-5L12 3z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
const IconX = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);
const IconLocateFixed = () => (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    <circle cx="12" cy="12" r="8" />
  </svg>
);

function typeIcon(type) {
  if (type === 'Work') return <IconBriefcase />;
  if (type === 'Other') return <IconMapPin />;
  return <IconHome />;
}

/* ---------- illustration (matches the reference image) ---------- */
const AddressIllustration = () => (
  <svg viewBox="0 0 220 170" width="200" height="154" className="sa-illustration">
    <circle cx="150" cy="90" r="70" fill="#eaf6ee" />
    <g opacity="0.55">
      <rect x="30" y="90" width="26" height="55" rx="2" fill="#bfe6c9" />
      <rect x="60" y="70" width="22" height="75" rx="2" fill="#cdeed4" />
      <rect x="86" y="100" width="20" height="45" rx="2" fill="#bfe6c9" />
    </g>
    <path d="M20 146c40-4 130-4 180 0" stroke="#0d9f4f" strokeWidth="2" opacity="0.35" />
    <g transform="translate(30,95)">
      <ellipse cx="18" cy="46" rx="20" ry="5" fill="#cdeed4" />
      <path d="M18 4c9 0 16 8 16 17 0 12-16 27-16 27S2 33 2 21C2 12 9 4 18 4z" fill="#0d9f4f" />
      <circle cx="18" cy="20" r="7" fill="#fff" />
    </g>
    <g transform="translate(66,20)" stroke="#0b3d1f" strokeWidth="2.4" fill="none" strokeLinecap="round">
      <path d="M0 40h70" />
      <path d="M6 40V16l16-10 16 10v24" fill="#fff" />
      <path d="M22 40V28h10v12" />
      <path d="M56 40V20l14 8v12" fill="#fff" />
    </g>
    <g transform="translate(150,26)" fill="#0d9f4f">
      <path d="M2 8 8 2l6 6-3 3-3-3-3 3z" opacity="0.6" />
    </g>
  </svg>
);

export default function SavedAddresses() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.id != null ? String(user.id) : null;

  const [addresses, setAddresses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [errorMsg, setErrorMsg] = useState('');
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await apiFetchAddresses(userId);
      if (cancelled) return;

      if (result.success) {
        const list = (result.addresses || []).map(fromApiRecord);
        setAddresses(list);
        saveCache(userId, list);
      } else {
        // API not reachable yet — fall back to whatever was cached locally
        // so the page still shows something useful.
        setAddresses(loadCache(userId));
      }
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const openAddModal = () => {
    setEditingId(null);
    setForm(emptyForm());
    setErrorMsg('');
    setModalOpen(true);
  };

  const openEditModal = (addr) => {
    setEditingId(addr.id);
    setForm({
      type: addr.type,
      line1: addr.line1,
      city: addr.city,
      pincode: addr.pincode,
      lat: addr.lat ?? null,
      lng: addr.lng ?? null,
      name: addr.name || '',
      phone: addr.phone || '',
      isDefault: !!addr.isDefault,
    });
    setErrorMsg('');
    setModalOpen(true);
  };

  const closeModal = () => {
    if (saving) return;
    setModalOpen(false);
    setErrorMsg('');
  };

  const handleFormChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  /* ---------- GPS detect + reverse geocode, mirrors the mobile
     AddAddressScreen's "Use Current Location" card ---------- */
  const handleDetectLocation = () => {
    if (!('geolocation' in navigator)) {
      setErrorMsg('Location detection is not supported on this browser.');
      return;
    }
    setLocating(true);
    setErrorMsg('');

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        handleFormChange('lat', latitude);
        handleFormChange('lng', longitude);

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1`,
            { headers: { Accept: 'application/json' } }
          );
          const data = await res.json();
          const addr = data?.address || {};
          const street = [addr.road, addr.neighbourhood, addr.suburb]
            .filter(Boolean)
            .slice(0, 2)
            .join(', ');
          const city = addr.city || addr.town || addr.state_district || addr.state || '';
          const pincode = addr.postcode || '';

          setForm((f) => ({
            ...f,
            line1: street || f.line1,
            city: city || f.city,
            pincode: pincode || f.pincode,
          }));
        } catch {
          // Reverse geocoding failed — coordinates are still saved,
          // person can fill the rest in manually.
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setErrorMsg('Could not access your location. You can enter the address manually.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  };

  const handleSubmit = async () => {
    const line1 = form.line1.trim();
    const city = form.city.trim();
    const pincode = form.pincode.trim();

    if (!line1 || !city || !pincode) {
      setErrorMsg('Please fill in the address, city and pincode.');
      return;
    }
    if (!/^\d{4,10}$/.test(pincode)) {
      setErrorMsg('Please enter a valid pincode.');
      return;
    }

    setSaving(true);
    setErrorMsg('');
    const cleanForm = { ...form, line1, city, pincode };
    const payload = { ...toApiPayload(cleanForm), userId };

    if (editingId) {
      const result = await apiUpdateAddress(editingId, payload);
      const updated = result.success && result.address
        ? fromApiRecord(result.address)
        : { ...cleanForm, id: editingId };

      const next = addresses.map((a) =>
        a.id === editingId ? updated : cleanForm.isDefault ? { ...a, isDefault: false } : a
      );
      setAddresses(next);
      saveCache(userId, next);
    } else {
      const result = await apiAddAddress(payload);
      const created = result.success && result.address
        ? fromApiRecord(result.address)
        : { ...cleanForm, id: `local_${Date.now()}` };

      const next = cleanForm.isDefault
        ? [...addresses.map((a) => ({ ...a, isDefault: false })), created]
        : [...addresses, created];
      setAddresses(next);
      saveCache(userId, next);
    }

    setSaving(false);
    setModalOpen(false);
  };

  const askDelete = (id) => setConfirmDeleteId(id);
  const cancelDelete = () => setConfirmDeleteId(null);
  const confirmDelete = async () => {
    const id = confirmDeleteId;
    setConfirmDeleteId(null);
    // Optimistic removal — keeps the button responsive even if the
    // API call is slow or the route isn't live yet.
    const next = addresses.filter((a) => a.id !== id);
    setAddresses(next);
    saveCache(userId, next);
    await apiDeleteAddress(id);
  };

  return (
    <div className="sa-page">
      <div className="sa-breadcrumb">
        <button type="button" className="sa-breadcrumb-link" onClick={() => navigate('/')}>
          Home
        </button>
        <IconChevronRight />
        <button type="button" className="sa-breadcrumb-link" onClick={() => navigate('/account')}>
          My Account
        </button>
        <IconChevronRight />
        <span>Saved Addresses</span>
      </div>

      <div className="sa-header">
        <div className="sa-header-text">
          <h1>Saved Addresses</h1>
          <p>Manage your saved addresses for a faster checkout.</p>
        </div>
        <AddressIllustration />
      </div>

      <div className="sa-layout">
        <div className="sa-list-col">
          {loading ? (
            <div className="sa-empty">
              <p className="sa-empty-title">Loading your addresses…</p>
            </div>
          ) : addresses.length === 0 ? (
            <div className="sa-empty">
              <p className="sa-empty-title">No saved addresses yet</p>
              <p className="sa-empty-sub">Add an address to check out faster next time.</p>
            </div>
          ) : (
            <div className="sa-list">
              {addresses.map((addr) => (
                <div className="sa-card" key={addr.id}>
                  <span className="sa-card-icon">{typeIcon(addr.type)}</span>
                  <div className="sa-card-body">
                    <span className="sa-card-type">
                      {addr.type}
                      {addr.isDefault && <span className="sa-default-badge">Default</span>}
                    </span>
                    <span className="sa-card-line1">{addr.line1}</span>
                    <span className="sa-card-line2">
                      {[addr.city, addr.pincode].filter(Boolean).join(', ')}
                    </span>
                  </div>
                  <div className="sa-card-actions">
                    <button type="button" className="sa-action-btn" onClick={() => openEditModal(addr)}>
                      <IconEdit />
                      Edit
                    </button>
                    <button
                      type="button"
                      className="sa-action-btn sa-action-danger"
                      onClick={() => askDelete(addr.id)}
                    >
                      <IconTrash />
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <button type="button" className="sa-add-btn" onClick={openAddModal}>
            <IconPlus />
            Add New Address
          </button>
        </div>

        <div className="sa-side-col">
          <div className="sa-tips-card">
            <p className="sa-tips-title">
              <IconBulb />
              Address Tips
            </p>
            <div className="sa-tip">
              <span className="sa-tip-icon sa-tip-icon-clock">
                <IconClock />
              </span>
              <div>
                <p className="sa-tip-t">Save time at checkout</p>
                <p className="sa-tip-s">Your saved addresses help you place orders faster.</p>
              </div>
            </div>
            <div className="sa-tip">
              <span className="sa-tip-icon sa-tip-icon-refresh">
                <IconRefreshBadge />
              </span>
              <div>
                <p className="sa-tip-t">Keep it updated</p>
                <p className="sa-tip-s">Make sure your address and contact details are always up to date.</p>
              </div>
            </div>
            <div className="sa-tip">
              <span className="sa-tip-icon sa-tip-icon-star">
                <IconStar />
              </span>
              <div>
                <p className="sa-tip-t">Set default address</p>
                <p className="sa-tip-s">You can set a default address from the edit option.</p>
              </div>
            </div>
          </div>

          <div className="sa-secure-card">
            <span className="sa-secure-icon">
              <IconShield />
            </span>
            <div>
              <p className="sa-secure-t">100% Safe &amp; Secure</p>
              <p className="sa-secure-s">Your addresses are encrypted and secure with us.</p>
            </div>
          </div>
        </div>
      </div>

      {modalOpen && (
        <div className="sa-modal-overlay" onClick={closeModal}>
          <div className="sa-modal" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>{editingId ? 'Edit Address' : 'Add New Address'}</h3>
              <button type="button" className="sa-modal-close" onClick={closeModal} aria-label="Close">
                <IconX />
              </button>
            </div>

            <button
              type="button"
              className="sa-locate-card"
              onClick={handleDetectLocation}
              disabled={locating}
            >
              <span className="sa-locate-icon">
                <IconLocateFixed />
              </span>
              <span className="sa-locate-text">
                <span className="t">Use Current Location</span>
                <span className="s">{locating ? 'Detecting…' : 'Detect via GPS'}</span>
              </span>
              {locating && <span className="sa-locate-spinner" />}
            </button>

            <p className="sa-modal-label">Address Type</p>
            <div className="sa-type-row">
              {ADDRESS_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={`sa-type-chip${form.type === t ? ' active' : ''}`}
                  onClick={() => handleFormChange('type', t)}
                >
                  {t}
                </button>
              ))}
            </div>

            <label className="sa-field-label" htmlFor="sa-line1">
              Address
            </label>
            <input
              id="sa-line1"
              className="sa-input"
              type="text"
              placeholder="House no., building, street"
              value={form.line1}
              onChange={(e) => handleFormChange('line1', e.target.value)}
            />

            <div className="sa-input-row">
              <div className="sa-input-col">
                <label className="sa-field-label" htmlFor="sa-city">
                  City / District
                </label>
                <input
                  id="sa-city"
                  className="sa-input"
                  type="text"
                  placeholder="City"
                  value={form.city}
                  onChange={(e) => handleFormChange('city', e.target.value)}
                />
              </div>
              <div className="sa-input-col">
                <label className="sa-field-label" htmlFor="sa-pincode">
                  Pincode
                </label>
                <input
                  id="sa-pincode"
                  className="sa-input"
                  type="text"
                  inputMode="numeric"
                  placeholder="751024"
                  value={form.pincode}
                  onChange={(e) => handleFormChange('pincode', e.target.value)}
                />
              </div>
            </div>

            <div className="sa-input-row">
              <div className="sa-input-col">
                <label className="sa-field-label" htmlFor="sa-name">
                  Recipient name (optional)
                </label>
                <input
                  id="sa-name"
                  className="sa-input"
                  type="text"
                  placeholder="Name"
                  value={form.name}
                  onChange={(e) => handleFormChange('name', e.target.value)}
                />
              </div>
              <div className="sa-input-col">
                <label className="sa-field-label" htmlFor="sa-phone">
                  Phone (optional)
                </label>
                <input
                  id="sa-phone"
                  className="sa-input"
                  type="tel"
                  placeholder="10-digit number"
                  value={form.phone}
                  onChange={(e) => handleFormChange('phone', e.target.value)}
                />
              </div>
            </div>

            <label className="sa-checkbox-row">
              <input
                type="checkbox"
                checked={form.isDefault}
                onChange={(e) => handleFormChange('isDefault', e.target.checked)}
              />
              Set as default address
            </label>

            {errorMsg && <p className="sa-modal-error">{errorMsg}</p>}

            <div className="sa-modal-actions">
              <button type="button" className="sa-modal-cancel" onClick={closeModal} disabled={saving}>
                Cancel
              </button>
              <button type="button" className="sa-modal-save" onClick={handleSubmit} disabled={saving}>
                {saving ? 'Saving…' : editingId ? 'Save Changes' : 'Save Address'}
              </button>
            </div>
          </div>
        </div>
      )}

      {confirmDeleteId && (
        <div className="sa-modal-overlay" onClick={cancelDelete}>
          <div className="sa-modal sa-modal-sm" onClick={(e) => e.stopPropagation()}>
            <div className="sa-modal-header">
              <h3>Delete Address</h3>
              <button type="button" className="sa-modal-close" onClick={cancelDelete} aria-label="Close">
                <IconX />
              </button>
            </div>
            <p className="sa-modal-sub">
              This address will be removed from your saved addresses. This can&apos;t be undone.
            </p>
            <div className="sa-modal-actions">
              <button type="button" className="sa-modal-cancel" onClick={cancelDelete}>
                Cancel
              </button>
              <button type="button" className="sa-modal-save sa-modal-danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}