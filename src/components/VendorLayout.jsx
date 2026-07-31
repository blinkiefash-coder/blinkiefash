import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./vendorLayout.css";
import { API_API_BASE_URL } from "../apiBase";
import { clearVendorPasswordAuth } from "../utils/vendorSession";

const DEFAULT_MENU = [
  { key: "orders",    label: "Orders",           icon: "\u25cd" },
  { key: "products",  label: "Add Product",       icon: "\u25a1" },
  { key: "edit",      label: "Edit Products",     icon: "\u270f" },
  { key: "stock",     label: "Stock Monitoring",  icon: "\ud83d\udce6" },
  { key: "analytics", label: "Product Analytics", icon: "\ud83d\udcca" },
];

export default function VendorLayout({
  activeKey = "orders",
  storeName = "Trendy Looks",
  vendorId = "",
  menuItems = DEFAULT_MENU,
  onMenuClick,
  children,
}) {
  const navigate = useNavigate();
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isOperational, setIsOperational] = useState(null);
  const [togglingOp, setTogglingOp] = useState(false);

  const resolvedVendorId = vendorId || localStorage.getItem("vendor_id") || "";

  useEffect(() => {
    if (!resolvedVendorId) return;
    fetch(`${API_API_BASE_URL}/vendor/${resolvedVendorId}`)
      .then((r) => r.json())
      .then((d) => { if (typeof d.is_operational === "boolean") setIsOperational(d.is_operational); })
      .catch(() => {});
  }, [resolvedVendorId]);

  const toggleOperational = async () => {
    if (!resolvedVendorId || togglingOp) return;
    const next = !isOperational;
    setTogglingOp(true);
    try {
      const res = await fetch(`${API_API_BASE_URL}/vendor/${resolvedVendorId}/operational-status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_operational: next }),
      });
      const data = await res.json();
      if (data.success) setIsOperational(next);
    } catch { }
    finally { setTogglingOp(false); }
  };

  const handleLogout = () => {
    clearVendorPasswordAuth();
    ["vendor_id","user_id","store_name","vendor_name","vendor_store_id","is_admin","admin_email"]
      .forEach((k) => localStorage.removeItem(k));
    navigate("/vendor");
  };

  const pageTitle =
    activeKey === "orders"
      ? "Orders"
      : activeKey === "products"
      ? "Add Product"
      : activeKey === "edit"
      ? "Edit Products"
      : activeKey === "stock"
      ? "Stock Monitoring"
      : activeKey === "analytics"
      ? "Product Analytics"
      : "Vendor Portal";

  return (
    <div className={`vendor-product-shell ${isSidebarCollapsed ? "sidebar-collapsed" : "sidebar-expanded"}`}>
      <aside className={`vendor-left-panel ${isSidebarCollapsed ? "collapsed" : "expanded"}`}>
        <div className="vendor-sidebar-head">
          <div className="vendor-brand">BLINKIEFASH</div>
          <button
            type="button"
            className="vendor-sidebar-toggle"
            onClick={() => setIsSidebarCollapsed((prev) => !prev)}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? ">" : "<"}
          </button>
        </div>

        <div className="vendor-store-card">
          <strong>My Store</strong>
          <span>{storeName}</span>
          {resolvedVendorId && isOperational !== null && (
            <button
              type="button"
              className={`vendor-op-toggle ${isOperational ? "op-on" : "op-off"}`}
              onClick={toggleOperational}
              disabled={togglingOp}
              title={isOperational ? "Store is OPEN — click to close" : "Store is CLOSED — click to open"}
            >
              <span className="op-dot" />
              {isSidebarCollapsed ? "" : (togglingOp ? "…" : isOperational ? "Store Open" : "Store Closed")}
            </button>
          )}
        </div>

        <nav className="vendor-nav-links">
          {menuItems.map((item) => (
            <button
              key={item.key}
              type="button"
              className={item.key === activeKey ? "active" : ""}
              title={item.label}
              onClick={() => onMenuClick?.(item)}
            >
              <span className="vendor-nav-icon">{item.icon}</span>
              {!isSidebarCollapsed ? <span className="vendor-nav-text">{item.label}</span> : null}
            </button>
          ))}
        </nav>

        <div className="vendor-sidebar-footer">
          <div className="vendor-status-card">
            <span className="vendor-status-label">Store status</span>
            <strong>{resolvedVendorId && isOperational !== null ? (isOperational ? "Open for business" : "Paused for now") : "Checking status"}</strong>
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
