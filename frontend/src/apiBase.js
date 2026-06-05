// Force localhost for local development - NEVER use production URL
const API_BASE = "http://localhost:5000";

export const API_BASE_URL = API_BASE;
export const API_API_BASE_URL = `${API_BASE}/api`;

console.log("🔧 API Configuration:", { API_BASE_URL, API_API_BASE_URL });
