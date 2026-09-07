import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import VendorLayout from '../components/VendorLayout';
import { isAdmin, adminHeaders } from '../utils/adminSession';
import { API_API_BASE_URL } from '../apiBase';
import './createVendor.css';

const CreateVendor = () => {
  const navigate = useNavigate();
  const adminMode = isAdmin();

  if (!adminMode) {
    return <div style={{ padding: '20px' }}>Access Denied. Admin only.</div>;
  }

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [vendorForm, setVendorForm] = useState({
    email: '',
    password: '',
    phone: '',
    business_name: '',
    owner_name: '',
    store_name: '',
    lat: '',
    lng: '',
    city: '',
    address: '',
    account_holder_name: '',
    account_number: '',
    ifsc_code: '',
    bank_name: '',
  });

  const [darkStoreForm, setDarkStoreForm] = useState({
    create_new: true,
    dark_store_id: '',
    store_name: 'Dark Store',
  });

  const handleVendorChange = (e) => {
    const { name, value } = e.target;
    setVendorForm(prev => ({ ...prev, [name]: value }));
  };

  const handleDarkStoreChange = (e) => {
    const { name, value, type, checked } = e.target;
    setDarkStoreForm(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const validateStep1 = () => {
    if (!vendorForm.email || !vendorForm.password || !vendorForm.phone) {
      setError('Please fill email, password, and phone');
      return false;
    }
    if (vendorForm.password.length < 8) {
      setError('Password must be at least 8 characters');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!vendorForm.business_name || !vendorForm.owner_name || !vendorForm.store_name) {
      setError('Please fill business name, owner name, and store name');
      return false;
    }
    return true;
  };

  const validateStep3 = () => {
    if (!vendorForm.lat || !vendorForm.lng || !vendorForm.city) {
      setError('Please fill latitude, longitude, and city');
      return false;
    }
    const lat = parseFloat(vendorForm.lat);
    const lng = parseFloat(vendorForm.lng);
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('Invalid coordinates');
      return false;
    }
    return true;
  };

  const validateStep4 = () => {
    if (darkStoreForm.create_new) {
      if (!darkStoreForm.store_name) {
        setError('Please enter dark store name');
        return false;
      }
    } else {
      if (!darkStoreForm.dark_store_id) {
        setError('Please select a dark store');
        return false;
      }
    }
    return true;
  };

  const validateStep5 = () => {
    if (!vendorForm.account_holder_name || !vendorForm.account_number || !vendorForm.ifsc_code || !vendorForm.bank_name) {
      setError('Please fill all bank details');
      return false;
    }
    return true;
  };

  const handleCreateVendor = async () => {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

      const payload = {
        email: vendorForm.email,
        password: vendorForm.password,
        phone: vendorForm.phone,
        business_name: vendorForm.business_name,
        owner_name: vendorForm.owner_name,
        store_name: vendorForm.store_name,
        lat: parseFloat(vendorForm.lat),
        lng: parseFloat(vendorForm.lng),
        city: vendorForm.city,
        address: vendorForm.address,
        account_holder_name: vendorForm.account_holder_name,
        account_number: vendorForm.account_number,
        ifsc_code: vendorForm.ifsc_code,
        bank_name: vendorForm.bank_name,
        create_dark_store: darkStoreForm.create_new,
        dark_store_name: darkStoreForm.create_new ? darkStoreForm.store_name : null,
        dark_store_id: !darkStoreForm.create_new ? darkStoreForm.dark_store_id : null,
      };

      const response = await fetch(`${API_API_BASE_URL}/admin/create-vendor`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...adminHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create vendor');
      }

      setSuccess(`Vendor created successfully! ID: ${data.vendor_id}`);
      setTimeout(() => {
        setStep(1);
        setVendorForm({
          email: '', password: '', phone: '', business_name: '', owner_name: '', store_name: '',
          lat: '', lng: '', city: '', address: '', account_holder_name: '', account_number: '',
          ifsc_code: '', bank_name: '',
        });
        setDarkStoreForm({ create_new: true, dark_store_id: '', store_name: 'Dark Store' });
      }, 2000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    setError('');
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    if (step === 3 && !validateStep3()) return;
    if (step === 4 && !validateStep4()) return;
    if (step === 5 && !validateStep5()) return;
    setStep(prev => prev + 1);
  };

  const handlePrev = () => {
    setError('');
    setStep(prev => prev - 1);
  };

  const handleMenuClick = (item) => {
    if (item.key === 'orders') navigate('/vendor/orders');
    if (item.key === 'products') navigate('/vendor/add-product');
    if (item.key === 'edit') navigate('/vendor/edit-product');
    if (item.key === 'stock') navigate('/vendor/stock-monitoring');
    if (item.key === 'analytics') navigate('/vendor/product-analytics');
    if (item.key === 'profile') navigate('/vendor/profile');
    if (item.key === 'create-vendor') navigate('/vendor/create-vendor');
    if (item.key === 'manage-categories') navigate('/vendor/manage-categories');
  };

  return (
    <VendorLayout activeKey="create-vendor" storeName="Admin Panel" onMenuClick={handleMenuClick}>
      <div className="create-vendor-container">
        <div className="create-vendor-card">
          <h1>Create New Vendor</h1>

          {/* Stepper */}
          <div className="stepper">
            {[1, 2, 3, 4, 5].map(s => (
              <div key={s} className={`step ${step >= s ? 'active' : ''} ${step === s ? 'current' : ''}`}>
                <div className="step-number">{s}</div>
                <div className="step-label">
                  {s === 1 && 'Basic Info'}
                  {s === 2 && 'Business'}
                  {s === 3 && 'Location'}
                  {s === 4 && 'Dark Store'}
                  {s === 5 && 'Bank Details'}
                </div>
              </div>
            ))}
          </div>

          {/* Error & Success Messages */}
          {error && <div className="alert alert-error">{error}</div>}
          {success && <div className="alert alert-success">{success}</div>}

          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="form-section">
              <h2>Step 1: Basic Information</h2>
              <div className="form-group">
                <label>Email *</label>
                <input
                  type="email"
                  name="email"
                  value={vendorForm.email}
                  onChange={handleVendorChange}
                  placeholder="vendor@example.com"
                  required
                />
              </div>
              <div className="form-group">
                <label>Password *</label>
                <input
                  type="password"
                  name="password"
                  value={vendorForm.password}
                  onChange={handleVendorChange}
                  placeholder="Minimum 8 characters"
                  required
                />
              </div>
              <div className="form-group">
                <label>Phone Number *</label>
                <input
                  type="tel"
                  name="phone"
                  value={vendorForm.phone}
                  onChange={handleVendorChange}
                  placeholder="10 digit mobile number"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 2: Business Info */}
          {step === 2 && (
            <div className="form-section">
              <h2>Step 2: Business Information</h2>
              <div className="form-group">
                <label>Business Name *</label>
                <input
                  type="text"
                  name="business_name"
                  value={vendorForm.business_name}
                  onChange={handleVendorChange}
                  placeholder="Your business name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Owner Name *</label>
                <input
                  type="text"
                  name="owner_name"
                  value={vendorForm.owner_name}
                  onChange={handleVendorChange}
                  placeholder="Owner's full name"
                  required
                />
              </div>
              <div className="form-group">
                <label>Store Name *</label>
                <input
                  type="text"
                  name="store_name"
                  value={vendorForm.store_name}
                  onChange={handleVendorChange}
                  placeholder="Store display name"
                  required
                />
              </div>
            </div>
          )}

          {/* Step 3: Location */}
          {step === 3 && (
            <div className="form-section">
              <h2>Step 3: Location & Address</h2>
              <div className="form-row">
                <div className="form-group">
                  <label>Latitude *</label>
                  <input
                    type="number"
                    name="lat"
                    value={vendorForm.lat}
                    onChange={handleVendorChange}
                    placeholder="-90 to 90"
                    step="0.000001"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Longitude *</label>
                  <input
                    type="number"
                    name="lng"
                    value={vendorForm.lng}
                    onChange={handleVendorChange}
                    placeholder="-180 to 180"
                    step="0.000001"
                    required
                  />
                </div>
              </div>
              <div className="form-group">
                <label>City *</label>
                <input
                  type="text"
                  name="city"
                  value={vendorForm.city}
                  onChange={handleVendorChange}
                  placeholder="e.g., Mumbai, Delhi"
                  required
                />
              </div>
              <div className="form-group">
                <label>Address</label>
                <textarea
                  name="address"
                  value={vendorForm.address}
                  onChange={handleVendorChange}
                  placeholder="Full address"
                  rows="3"
                />
              </div>
            </div>
          )}

          {/* Step 4: Dark Store */}
          {step === 4 && (
            <div className="form-section">
              <h2>Step 4: Dark Store Association</h2>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    name="create_new"
                    checked={darkStoreForm.create_new}
                    onChange={handleDarkStoreChange}
                  />
                  Create New Dark Store
                </label>
              </div>

              {darkStoreForm.create_new ? (
                <div className="form-group">
                  <label>Dark Store Name *</label>
                  <input
                    type="text"
                    name="store_name"
                    value={darkStoreForm.store_name}
                    onChange={handleDarkStoreChange}
                    placeholder="e.g., Downtown Dark Store"
                    required
                  />
                </div>
              ) : (
                <div className="form-group">
                  <label>Select Existing Dark Store *</label>
                  <select
                    name="dark_store_id"
                    value={darkStoreForm.dark_store_id}
                    onChange={handleDarkStoreChange}
                    required
                  >
                    <option value="">-- Select Dark Store --</option>
                    <option value="ds-1">Downtown Dark Store</option>
                    <option value="ds-2">Uptown Dark Store</option>
                  </select>
                </div>
              )}
            </div>
          )}

          {/* Step 5: Bank Details */}
          {step === 5 && (
            <div className="form-section">
              <h2>Step 5: Bank Details</h2>
              <div className="form-group">
                <label>Account Holder Name *</label>
                <input
                  type="text"
                  name="account_holder_name"
                  value={vendorForm.account_holder_name}
                  onChange={handleVendorChange}
                  placeholder="Name on bank account"
                  required
                />
              </div>
              <div className="form-group">
                <label>Account Number *</label>
                <input
                  type="text"
                  name="account_number"
                  value={vendorForm.account_number}
                  onChange={handleVendorChange}
                  placeholder="Bank account number"
                  required
                />
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>IFSC Code *</label>
                  <input
                    type="text"
                    name="ifsc_code"
                    value={vendorForm.ifsc_code}
                    onChange={handleVendorChange}
                    placeholder="e.g., SBIN0001234"
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Bank Name *</label>
                  <input
                    type="text"
                    name="bank_name"
                    value={vendorForm.bank_name}
                    onChange={handleVendorChange}
                    placeholder="e.g., State Bank of India"
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="form-buttons">
            {step > 1 && (
              <button className="btn btn-secondary" onClick={handlePrev} disabled={loading}>
                Previous
              </button>
            )}
            {step < 5 && (
              <button className="btn btn-primary" onClick={handleNext} disabled={loading}>
                Next
              </button>
            )}
            {step === 5 && (
              <button
                className="btn btn-success"
                onClick={handleCreateVendor}
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Vendor'}
              </button>
            )}
          </div>
        </div>
      </div>
    </VendorLayout>
  );
};

export default CreateVendor;
