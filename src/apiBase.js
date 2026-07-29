// Determine API base URL based on environment
const getAPIBase = () => {
  const envURL = import.meta.env.VITE_API_BASE_URL?.trim();

  // In development
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    return envURL || 'http://localhost:5000';
  }

  if (envURL) {
    return envURL.replace(/\/$/, '');
  }

  // In production, route backend traffic through the same-origin Vercel rewrite.
  return '/backend-proxy';
};

const API_BASE = getAPIBase();

export const API_BASE_URL = API_BASE;
export const API_API_BASE_URL = `${API_BASE}/api`;

console.log("🔧 API Configuration:", { 
  API_BASE_URL, 
  API_API_BASE_URL, 
  hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown',
  protocol: typeof window !== 'undefined' ? window.location.protocol : 'unknown'
});
