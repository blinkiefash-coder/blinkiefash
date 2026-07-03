const getAPIBase = () => {
  if (typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return 'http://localhost:5000';
  }
  return 'https://blinkiefash.onrender.com';
};

export const API_BASE = getAPIBase();
export const API = `${API_BASE}/api`;

// Compatibility aliases used by copied pages
export const API_BASE_URL = API_BASE;
export const API_API_BASE_URL = API;
