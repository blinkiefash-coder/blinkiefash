import { API_API_BASE_URL } from './apiBase';

async function request(path, options = {}) {
  const res = await fetch(`${API_API_BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data?.message || data?.error || `Request failed (${res.status})`);
  }
  return data;
}

export const getCategories = () => request('/categories');

export const getProducts = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return request(`/products${query ? `?${query}` : ''}`);
};

export const getProductById = (id) => request(`/products/${id}`);

export const getBestsellers = (limit = 10) => request(`/products/bestsellers?limit=${limit}`);

export const getPriceRangeProducts = (minPrice, maxPrice, limit = 10) =>
  request(`/products/price-range?min_price=${minPrice}&max_price=${maxPrice}&limit=${limit}`);

export const authStart = (phone, expectedRole = 'customer') =>
  request('/auth/start', { method: 'POST', body: JSON.stringify({ phone, expectedRole }) });

export const authVerify = ({ phone, otp, expectedRole = 'customer' }) =>
  request('/auth/verify', { method: 'POST', body: JSON.stringify({ phone, otp, expectedRole }) });

export const registerUser = (payload) =>
  request('/auth/register', { method: 'POST', body: JSON.stringify(payload) });

export const getAddresses = (userId) => request(`/checkout/addresses?userId=${userId}`);

export const addAddress = (payload) =>
  request('/checkout/addresses', { method: 'POST', body: JSON.stringify(payload) });

export const placeOrder = (payload) =>
  request('/checkout/orders', { method: 'POST', body: JSON.stringify(payload) });

export const getOrders = (userId) => request(`/checkout/orders?userId=${userId}`);
