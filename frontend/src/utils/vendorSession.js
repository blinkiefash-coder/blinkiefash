import { API_API_BASE_URL } from '../apiBase';

export const markVendorPasswordAuth = () => {
  localStorage.setItem('vendor_auth_method', 'password');
};

export const clearVendorPasswordAuth = () => {
  localStorage.removeItem('vendor_auth_method');
};

export const hasVendorPasswordAuth = () => {
  const vendorId = localStorage.getItem('vendor_id');
  const authMethod = localStorage.getItem('vendor_auth_method');
  return Boolean(vendorId) && authMethod === 'password';
};

export const fetchVendorProfile = async (vendorId) => {
  if (!vendorId) return null;

  try {
    const response = await fetch(`${API_API_BASE_URL}/vendor/${vendorId}`);
    if (!response.ok) return null;
    const vendor = await response.json();
    return vendor && typeof vendor === 'object' ? vendor : null;
  } catch (err) {
    console.error('Failed to load vendor profile:', err);
    return null;
  }
};