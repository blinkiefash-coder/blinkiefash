const envApiBase = (import.meta.env.VITE_API_BASE_URL || "").trim();

const useLocalApi = String(import.meta.env.VITE_USE_LOCAL_API || "false").toLowerCase() === "true";
const fallbackApiBase = useLocalApi
	? "http://localhost:5000"
	: "https://blinkiefash.onrender.com";

const API_BASE = (envApiBase || fallbackApiBase).replace(/\/$/, "");

export const API_BASE_URL = API_BASE;
export const API_API_BASE_URL = `${API_BASE}/api`;
