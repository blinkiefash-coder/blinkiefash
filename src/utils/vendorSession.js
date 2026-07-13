import { API_API_BASE_URL } from "../apiBase";

export const fetchVendorProfile = async (vendorId) => {
  if (!vendorId) {
    return null;
  }

  try {
    const response = await fetch(`${API_API_BASE_URL}/vendor/${vendorId}`);
    if (!response.ok) {
      return null;
    }

    const vendor = await response.json();
    return vendor && typeof vendor === "object" ? vendor : null;
  } catch (err) {
    console.error("Failed to load vendor profile:", err);
    return null;
  }
};