// Use Render backend in production, localhost in development
const API_BASE = 
  typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : 'https://blinkiefash-backend.onrender.com';

export const API_BASE_URL = API_BASE;
export const API_API_BASE_URL = `${API_BASE}/api`;

console.log("🔧 API Configuration:", { API_BASE_URL, API_API_BASE_URL, hostname: typeof window !== 'undefined' ? window.location.hostname : 'unknown' });
