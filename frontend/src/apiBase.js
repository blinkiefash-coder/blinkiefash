const envApiBase = (import.meta.env.VITE_API_BASE_URL || "").trim();

const isLocalHost =
	typeof window !== "undefined" &&
	["localhost", "127.0.0.1"].includes(window.location.hostname);

const fallbackApiBase = isLocalHost
	? "http://localhost:5000"
	: "https://blinkiefash.onrender.com";

const API_BASE = (envApiBase || fallbackApiBase).replace(/\/$/, "");

export const API_BASE_URL = API_BASE;
export const API_API_BASE_URL = `${API_BASE}/api`;
