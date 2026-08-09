export const isAdmin = () => localStorage.getItem('is_admin') === 'true';

export const adminEmail = () => localStorage.getItem('admin_email') || 'superadminsatyam@blinkiefash.in';

export const adminHeaders = () => ({ 'x-admin-email': adminEmail() });