import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import './vendorLayout.css';
import { API_API_BASE_URL } from '../apiBase';
import { clearVendorPasswordAuth } from '../utils/vendorSession';
import { isAdmin } from '../utils/adminSession';

const DEFAULT_MENU = [
  { key: 'orders', label: 'Orders', icon: '◍' },
  { key: 'products', label: 'Add Product', icon: '□' },
  { key: 'edit', label: 'Edit Products', icon: '✏' },
  { key: 'stock', label: 'Stock Monitoring', icon: '📦' },
  { key: 'analytics', label: 'Product Analytics', icon: '📊' },
  { key: 'profile', label: 'Store / Profile', icon: '👤' },
];

const ADMIN_MENU = [
  { key: 'create-vendor', label: 'Create Vendor', icon: '➕', isAdmin: true },
  { key: 'manage-categories', label: 'Manage Catalog', icon: '📚', isAdmin: true },
];

export default function VendorLayout({
  activeKey = 'orders',
  storeName = 'My Store',
  vendorId = '',
  menuItems = DEFAULT_MENU,
  onMenuClick,
  children,
}) {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOperational, setIsOperational] = useState(null);
  const [togglingOp, setTogglingOp] = useState(false);

  const resolvedVendorId = vendorId || localStorage.getItem('vendor_id') || '';
  const isAdminMode = isAdmin();

  useEffect(() => {
    // Skip operational status fetch for admin users (no vendor_id)
    if (!resolvedVendorId || isAdminMode) return;
    fetch(`${API_API_BASE_URL}/vendor/${resolvedVendorId}`)
      .then((r) => r.json())
      .then((d) => {
        if (typeof d.is_operational === 'boolean') setIsOperational(d.is_operational);
      })
      .catch(() => {});
  }, [resolvedVendorId, isAdminMode]);

  const toggleOperational = async () => {
    if (!resolvedVendorId || togglingOp || isOperational === null) return;
    const next = !isOperational;
    setTogglingOp(true);
    try {
      const res = await fetch(`${API_API_BASE_URL}/vendor/${resolvedVendorId}/operational-status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_operational: next }),
      });
      const data = await res.json();
      if (data.success) setIsOperational(next);
    } catch {
      // ignore status toggle failures
    } finally {
      setTogglingOp(false);
    }
  };

  const handleLogout = () => {
    clearVendorPasswordAuth();
    ['vendor_id', 'user_id', 'store_name', 'vendor_name', 'vendor_store_id', 'is_admin', 'admin_email'].forEach((key) =>
      localStorage.removeItem(key)
    );
    navigate('/vendor');
  };

  const pageTitle =
    activeKey === 'orders'
      ? 'Orders'
      : activeKey === 'products'
        ? 'Add Product'
        : activeKey === 'edit'
          ? 'Edit Products'
          : activeKey === 'stock'
            ? 'Stock Monitoring'
            : activeKey === 'analytics'
              ? 'Product Analytics'
              : activeKey === 'profile'
                ? 'Store / Profile'
                : activeKey === 'create-vendor'
                  ? 'Create Vendor'
                  : activeKey === 'manage-categories'
                    ? 'Manage Catalog'
                    : 'Vendor Portal';

  // Build menu with admin items if user is admin
  const finalMenuItems = menuItems === DEFAULT_MENU && isAdmin()
    ? [...DEFAULT_MENU, ...ADMIN_MENU]
    : menuItems;

  return (
    <div className={`vendor-product-shell ${isSidebarCollapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
      <aside className={`vendor-left-panel ${isSidebarCollapsed ? 'collapsed' : 'expanded'}`}>
        <div className="vendor-sidebar-head">
          <div className="vendor-brand">BLINKIEFASH</div>
          <button
            type="button"
            className="vendor-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isSidebarCollapsed ? '>' : '<'}
          </button>
        </div>

        <div className="vendor-store-card">
          <strong>{isAdminMode ? 'Admin Panel' : 'My Store'}</strong>
          <span>{storeName}</span>
          {!isAdminMode && resolvedVendorId && isOperational !== null ? (
            <div className="vendor-op-toggle-row">
              <span className={`vendor-op-label ${isOperational ? 'op-live' : 'op-paused'}`}>
                {togglingOp ? 'Updating…' : isOperational ? '🟢 Store Live' : '🔴 Store Paused'}
              </span>
              <button
                type="button"
                role="switch"
                aria-checked={isOperational}
                disabled={togglingOp}
                onClick={toggleOperational}
                className={`vendor-toggle-switch ${isOperational ? 'toggle-on' : 'toggle-off'}`}
                title={isOperational ? 'Click to pause store' : 'Click to go live'}
              >
                <span className="vendor-toggle-knob" />
              </button>
            </div>
          ) : null}
        </div>

        <nav className="vendor-nav-links">
          {finalMenuItems.map((item, index) => {
            // Add separator before admin items
            const isAdminItem = item.isAdmin;
            const prevItem = index > 0 ? finalMenuItems[index - 1] : null;
            const showSeparator = isAdminItem && prevItem && !prevItem.isAdmin;

            return (
              <div key={item.key}>
                {showSeparator && (
                  <div className="vendor-nav-separator">
                    <span className="vendor-nav-section-label">Admin</span>
                  </div>
                )}
                <button
                  type="button"
                  className={`${item.key === activeKey ? 'active' : ''} ${isAdminItem ? 'admin-item' : ''}`}
                  title={item.label}
                  onClick={() => onMenuClick?.(item)}
                >
                  <span className="vendor-nav-icon">{item.icon}</span>
                  {!isSidebarCollapsed ? <span className="vendor-nav-text">{item.label}</span> : null}
                </button>
              </div>
            );
          })}
        </nav>

        <div className="vendor-sidebar-footer">
          <div className="vendor-status-card">
            <span className="vendor-status-label">{isAdminMode ? 'Mode' : 'Store status'}</span>
            <strong>{isAdminMode ? 'Admin' : (resolvedVendorId && isOperational !== null ? (isOperational ? 'Open for business' : 'Paused for now') : 'Checking status')}</strong>
          </div>
        </div>
      </aside>

      <main className="vendor-content">
        <div className="vendor-topbar">
          <div>
            <div className="vendor-topbar-title">{pageTitle}</div>
            <div className="vendor-topbar-subtitle">{storeName}</div>
          </div>
          <button type="button" className="vendor-topbar-logout" onClick={handleLogout} title="Logout">
            <span>↵</span>
            Logout
          </button>
        </div>
        <div className="vendor-content-body">{children}</div>
      </main>
    </div>
  );
}