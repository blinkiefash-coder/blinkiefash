// Resolves the backend base URL the same way the existing frontend does,
// so blinkiefashwebnew talks to the same Blinkiefash API in every environment.
const getAPIBase = () => {
  const envURL = import.meta.env.VITE_API_BASE_URL?.trim();
  const isLocalHost =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  if (isLocalHost) {
    return envURL || `http://${window.location.hostname}:5000`;
  }

  if (envURL) {
    return envURL.replace(/\/$/, '');
  }

  // In production, prefer same-origin proxy to avoid client-side network/CORS blocks.
  return '/backend-proxy';
};

const API_BASE = getAPIBase();

export const API_BASE_URL = API_BASE;
export const API_API_BASE_URL = `${API_BASE}/api`;
