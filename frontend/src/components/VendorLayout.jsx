import { useState } from "react";
import "./vendorLayout.css";

const DEFAULT_MENU = [
  { key: "dashboard", label: "Dashboard", icon: "⌂" },
  { key: "products", label: "Products", icon: "□" },
  { key: "orders", label: "Orders", icon: "◍" },
  { key: "customers", label: "Customers", icon: "◎" },
  { key: "analytics", label: "Analytics", icon: "◔" },
  { key: "reservations", label: "Store Visit & Reservations", icon: "◈" },
  { key: "profile", label: "Store Profile", icon: "◉" },
  { key: "settings", label: "Settings", icon: "⚙" },
];

export default function VendorLayout({
  activeKey = "products",
  storeName = "Trendy Looks",
  menuItems = DEFAULT_MENU,
  onMenuClick,
  children,
}) {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

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
            title={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? ">" : "<"}
          </button>
        </div>

        <div className="vendor-store-card">
          <strong>My Store</strong>
          <span>{storeName}</span>
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

        <div className="vendor-help-card">Need help? Contact Support</div>
      </aside>

      <main className="vendor-content">{children}</main>
    </div>
  );
}
