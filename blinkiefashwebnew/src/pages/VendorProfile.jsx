import { useEffect, useState } from 'react';
import VendorLayout from '../components/VendorLayout';
import { API_API_BASE_URL } from '../apiBase';
import { fetchVendorProfile } from '../utils/vendorSession';
import './vendorDashboard.css';

export default function VendorProfile() {
  const [vendorId] = useState(() => localStorage.getItem('vendor_id') || '');
  const [storeName, setStoreName] = useState(() => localStorage.getItem('store_name') || 'My Store');
  const [vendor, setVendor] = useState(null);
  const [darkStoreId, setDarkStoreId] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const menuItems = [
    { key: 'orders', label: 'Orders', icon: '◍' },
    { key: 'products', label: 'Add Product', icon: '□' },
    { key: 'edit', label: 'Edit Products', icon: '✏' },
    { key: 'stock', label: 'Stock Monitoring', icon: '📦' },
    { key: 'analytics', label: 'Product Analytics', icon: '📊' },
    { key: 'profile', label: 'Store / Profile', icon: '👤' },
  ];

  const handleMenuClick = (item) => {
    if (item.key === 'orders') window.location.href = '/vendor/orders';
    if (item.key === 'products') window.location.href = '/vendor/add-product';
    if (item.key === 'edit') window.location.href = '/vendor/edit-product';
    if (item.key === 'stock') window.location.href = '/vendor/stock-monitoring';
    if (item.key === 'analytics') window.location.href = '/vendor/product-analytics';
  };

  useEffect(() => {
    if (!vendorId) {
      window.location.href = '/vendor';
      return;
    }

    const load = async () => {
      try {
        const data = await fetchVendorProfile(vendorId);
        if (data) {
          setVendor(data);
          if (data.store_name) {
            setStoreName(data.store_name);
            localStorage.setItem('store_name', data.store_name);
          }
          setDarkStoreId(data.dark_store_id || '');
        }
      } catch {
        setError('Unable to load vendor profile.');
      }
    };

    load();
  }, [vendorId]);

  const saveProfile = async () => {
    if (!vendorId) return;
    setSaving(true);
    setMessage('');
    setError('');
    try {
      const res = await fetch(`${API_API_BASE_URL}/vendor/${vendorId}/store`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dark_store_id: darkStoreId || null }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || 'Unable to save profile');
      setMessage('Profile saved successfully.');
      const refreshed = await fetchVendorProfile(vendorId);
      setVendor(refreshed);
    } catch (err) {
      setError(err.message || 'Unable to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <VendorLayout activeKey="profile" storeName={storeName} menuItems={menuItems} onMenuClick={handleMenuClick}>
      <div className="vd-page">
        <section className="vd-hero">
          <div>
            <p className="vd-small" style={{ color: '#bbf7d0', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.2em', fontWeight: 700 }}>Store / Profile</p>
            <h1>Manage your store connection</h1>
            <p>Review your vendor profile and link it to a dark store when needed.</p>
          </div>
          <div className="vd-actions">
            <button className="vd-btn secondary" type="button" onClick={() => window.location.href = '/vendor/orders'}>Back to Orders</button>
            <button className="vd-btn" type="button" onClick={saveProfile} disabled={saving}>{saving ? 'Saving…' : 'Save Profile'}</button>
          </div>
        </section>

        {message ? <div className="vd-loading">{message}</div> : null}
        {error ? <div className="vd-error">{error}</div> : null}

        <section className="vd-grid cols-2">
          <div className="vd-panel">
            <div className="vd-small">Vendor ID</div>
            <h2 style={{ marginTop: 4 }}>{vendor?.id || vendorId}</h2>
            <div className="vd-small" style={{ marginTop: 12 }}>Store name</div>
            <h3 style={{ marginTop: 4 }}>{vendor?.store_name || storeName}</h3>
            <div className="vd-small" style={{ marginTop: 12 }}>Linked store</div>
            <div style={{ marginTop: 4 }}>{vendor?.linked_store_name || 'Not linked'}</div>
            <div className="vd-small" style={{ marginTop: 12 }}>City</div>
            <div style={{ marginTop: 4 }}>{vendor?.city || vendor?.linked_store_city || '—'}</div>
          </div>

          <div className="vd-panel vd-form">
            <div className="vd-field">
              <label>Dark store ID</label>
              <input className="vd-input" value={darkStoreId} onChange={(e) => setDarkStoreId(e.target.value)} placeholder="Enter dark store id or leave blank" />
            </div>
            <div className="vd-small">This updates the vendor-to-store link using the existing backend route.</div>
          </div>
        </section>
      </div>
    </VendorLayout>
  );
}