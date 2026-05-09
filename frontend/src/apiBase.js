const API_BASE = (import.meta.env.VITE_API_BASE_URL || "http://localhost:5000").replace(/\/$/, "");

export const API_BASE_URL = API_BASE;
export const API_API_BASE_URL = `${API_BASE}/api`;
