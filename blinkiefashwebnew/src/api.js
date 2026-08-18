import { API_API_BASE_URL, API_BASE_URL } from './apiBase';

async function request(path, options = {}) {
  const token = localStorage.getItem('bfw_token') || localStorage.getItem('token');
  const { headers: customHeaders, ...rest } = options;

  const res = await fetch(`${API_API_BASE_URL}${path}`, {
    ...rest,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(customHeaders || {}),
    },
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

/* ========== Addresses ========== */
export const fetchAddresses = async (userId) => {
  try {
    const data = await request(`/addresses?userId=${encodeURIComponent(userId)}`);
    return { success: true, addresses: data?.addresses || data || [] };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to load addresses' };
  }
};
export const addAddress = async (payload) => {
  try {
    const data = await request('/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: true, address: data?.address || data };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to save address' };
  }
};
export const updateAddress = async (addressId, payload) => {
  try {
    const data = await request(`/addresses/${addressId}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
    return { success: true, address: data?.address || data };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to update address' };
  }
};
export const deleteAddress = async (addressId) => {
  try {
    await request(`/addresses/${addressId}`, { method: 'DELETE' });
    return { success: true };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to delete address' };
  }
};

export const placeOrder = (payload) =>
  request('/checkout/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getOrders = (userId) =>
  request(`/checkout/orders?userId=${userId}`);

export const getOrderById = (orderId) =>
  request(`/checkout/orders/${orderId}`);

export const cancelOrder = (orderId, cancelReason) =>
  request(`/checkout/orders/${orderId}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'cancelled', cancelReason }),
  });

/* ========== Parcel / Deliver ========== */

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

export const createParcelRequest = (payload) =>
  request('/deliver/request', {
    method: 'POST',
    body: JSON.stringify(payload),
  });

export const getParcelRequest = (id) =>
  request(`/deliver/request/${id}`);

export const cancelParcelRequest = (id) =>
  request(`/deliver/request/${id}/cancel`, {
    method: 'PATCH',
  });

/* ========== Referrals ========== */

export const getReferralInfo = (userId) => request(`/referrals/${userId}`);

export const validateReferralCode = (code) =>
  request(`/referrals/validate/${encodeURIComponent(code)}`);

export const applyReferralCode = (userId, referralCode) =>
  request(`/users/${userId}/apply-referral-code`, {
    method: 'POST',
    body: JSON.stringify({ referralCode }),
  });

/* ========== Old clothes ========== */

export const getOldClothes = (userId) => request(`/old-clothes/${userId}`);

export const requestClothesPickup = (payload) =>
  request('/old-clothes', {
    method: 'POST',
    body: JSON.stringify(payload),
  });


/* ========== Support Tickets ========== */

export const submitSupportTicket = async (payload) => {
  try {
    const ticket = await request('/support-tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    return { success: true, ticket };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to submit ticket' };
  }
};

/* ========== Gamification (spin + quest) ========== */

export const getGamificationState = (userId) =>
  request(`/gamification/state?userId=${encodeURIComponent(userId)}`);

export const spinWheel = (userId) =>
  request('/gamification/spin', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

export const completeQuestLevel = (userId) =>
  request('/gamification/quest/complete-level', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });

/* ========== Profile ========== */

export const updateUserProfile = async ({ userId, name, email }) => {
  try {
    const data = await request('/auth/update-profile', {
      method: 'PUT',
      body: JSON.stringify({ userId, name, email }),
    });
    return { success: true, user: data?.user || data, message: data?.message };
  } catch (error) {
    return { success: false, error: error.message || 'Failed to update profile' };
  }
};