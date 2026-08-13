import { API_API_BASE_URL, API_BASE_URL } from './apiBase';

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

async function requestAuth(path, options = {}) {
  const loginPath = path.startsWith('/auth/') ? path.replace('/auth/', '/') : path;
  const candidates = [`/api${path}`, `/login${loginPath}`];
  let lastError = null;

  for (const candidate of candidates) {
    try {
      const res = await fetch(`${API_BASE_URL}${candidate}`, {
        headers: { 'Content-Type': 'application/json' },
        ...options,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const message = data?.message || data?.error || `Request failed (${res.status})`;
        if (res.status !== 404 && res.status !== 405) {
          throw new Error(message);
        }
        lastError = new Error(message);
        continue;
      }
      return data;
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error('Authentication request failed');
}

export const getCategories = () => request('/categories');

export const getProducts = (params = {}) => {
  const query = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();
  return request(`/products${query ? `?${query}` : ''}`);
};

export const getProductById = (id) => request(`/products/${id}`);

export const getBestsellers = (limit = 10) =>
  request(`/products/bestsellers?limit=${limit}`);

export const getBrands = () => request('/brands');

export const getPriceRangeProducts = (minPrice, maxPrice, limit = 10) =>
  request(`/products/price-range?min_price=${minPrice}&max_price=${maxPrice}&limit=${limit}`);

export const authStart = (phone, expectedRole = 'customer') =>
  requestAuth('/auth/start', {
    method: 'POST',
    body: JSON.stringify({ phone, expectedRole }),
  });

export const authVerify = ({ idToken, phone, otp, expectedRole = 'customer' }) =>
  requestAuth('/auth/verify', {
    method: 'POST',
    body: JSON.stringify({ idToken, phone, otp, expectedRole }),
  });

export const authLoginWithEmailPassword = ({ email, password, expectedRole = 'customer' }) =>
  requestAuth('/auth/login-email-password', {
    method: 'POST',
    body: JSON.stringify({ email, password, expectedRole }),
  });

export const authLoginVendorWithEmailPassword = ({ email, password }) =>
  request('/vendor/login-password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });

export const registerUser = (payload) =>
  request('/auth/register', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getAddresses = (userId) =>
  request(`/checkout/addresses?userId=${userId}`);

export const addAddress = (payload) =>
  request('/checkout/addresses', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const placeOrder = (payload) =>
  request('/checkout/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getOrders = (userId) =>
  request(`/checkout/orders?userId=${userId}`);

export const getOrderById = (orderId) =>
  request(`/checkout/orders/${orderId}`);

/* ========== Parcel / Deliver ========== */

/** GET /api/deliver/estimate */
export const estimateParcel = ({
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  city,
  distanceProvider,
} = {}) => {
  const query = new URLSearchParams(
    Object.entries({
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      city,
      distanceProvider,
    }).filter(([, v]) => v !== undefined && v !== null && v !== '')
  ).toString();

  return request(`/deliver/estimate?${query}`);
};

/** POST /api/deliver/request */
export const createParcelRequest = (payload) =>
  request('/deliver/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

/** GET /api/deliver/request/:id */
export const getParcelRequest = (id) =>
  request(`/deliver/request/${id}`);

/** PATCH /api/deliver/request/:id/cancel */
export const cancelParcelRequest = (id) =>
  request(`/deliver/request/${id}/cancel`, {
    method: 'PATCH',
  });