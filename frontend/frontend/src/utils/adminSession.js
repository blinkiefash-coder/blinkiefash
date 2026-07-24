// Shared admin session helpers used across vendor pages.
export const isAdmin = () => localStorage.getItem("is_admin") === "true";
export const adminEmail = () => localStorage.getItem("admin_email") || "satyxalka@blinkiefash.in";
export const adminHeaders = () => ({ "x-admin-email": adminEmail() });
