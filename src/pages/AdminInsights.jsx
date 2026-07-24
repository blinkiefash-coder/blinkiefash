import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";
import { isAdmin, adminHeaders } from "../utils/adminSession";
import "./AdminInsights.css";

export default function AdminInsights() {
  const navigate = useNavigate();
  const [storeName] = useState(
    () => localStorage.getItem("store_name") || "Admin — All Vendors"
  );
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const menuItems = [
    { key: "insights",  label: "Insights",         icon: "📊" },
    { key: "orders",    label: "Orders",            icon: "◍"  },
    { key: "products",  label: "Products",          icon: "□"  },
    { key: "stock",     label: "Stock Monitoring",  icon: "📦" },
    { key: "analytics", label: "Analytics",         icon: "📈" },
  ];

  const handleMenuClick = (item) => {
    if (item.key === "orders")    navigate("/vendor/orders");
    if (item.key === "products")  navigate("/vendor/add-product");
    if (item.key === "stock")     navigate("/vendor/stock-monitoring");
    if (item.key === "analytics") navigate("/vendor/product-analytics");
  };

  useEffect(() => {
    if (!isAdmin()) {
      window.location.href = "/vendor";
      return;
    }
    fetch(`${API_API_BASE_URL}/admin/insights`, { headers: adminHeaders() })
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setData(d);
        else setError(d.message || "Failed to load");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const fmt = (n) =>
    Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 0 });

  const fmtRs = (n) => `₹${fmt(n)}`;

  return (
    <VendorLayout
      activeKey="insights"
      storeName={storeName}
      menuItems={menuItems}
      onMenuClick={handleMenuClick}
    >
      <div className="ai-page">
        <h2 className="ai-title">
          📊 Admin Insights
          <span className="ai-badge">All Vendors</span>
        </h2>

        {loading && <div className="ai-loading">Loading insights…</div>}
        {error   && <div className="ai-error">{error}</div>}

        {data && (
          <>
            {/* Summary cards */}
            <div className="ai-cards">
              {[
                { label: "Total Revenue",     value: fmtRs(data.summary.total_revenue),    icon: "💰" },
                { label: "Revenue (30d)",      value: fmtRs(data.summary.revenue_last_30d), icon: "📅" },
                { label: "Revenue Today",      value: fmtRs(data.summary.revenue_today),    icon: "🌅" },
                { label: "Total Orders",       value: fmt(data.summary.total_orders),        icon: "🛒" },
                { label: "New Orders",         value: fmt(data.summary.new_orders),          icon: "🔔", alert: data.summary.new_orders > 0 },
                { label: "Delivered",          value: fmt(data.summary.delivered_orders),    icon: "✅" },
                { label: "Cancelled",          value: fmt(data.summary.cancelled_orders),    icon: "❌" },
              ].map((c) => (
                <div key={c.label} className={`ai-card ${c.alert ? "ai-card-alert" : ""}`}>
                  <span className="ai-card-icon">{c.icon}</span>
                  <div className="ai-card-value">{c.value}</div>
                  <div className="ai-card-label">{c.label}</div>
                </div>
              ))}
            </div>

            {/* Revenue by day */}
            {data.revenueByDay?.length > 0 && (
              <div className="ai-section">
                <h3 className="ai-section-title">Revenue — Last 14 Days</h3>
                <div className="ai-chart">
                  {data.revenueByDay.map((d) => {
                    const max = Math.max(...data.revenueByDay.map((r) => r.revenue), 1);
                    const pct = (d.revenue / max) * 100;
                    return (
                      <div key={d.date} className="ai-bar-wrap">
                        <div className="ai-bar" style={{ height: `${Math.max(pct, 4)}%` }} title={`₹${fmt(d.revenue)}`} />
                        <div className="ai-bar-label">{d.date.slice(5)}</div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="ai-two-col">
              {/* Vendor breakdown */}
              <div className="ai-section">
                <h3 className="ai-section-title">Vendor Breakdown</h3>
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>Store</th>
                      <th>Products</th>
                      <th>Orders</th>
                      <th>Revenue</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.vendors.map((v) => (
                      <tr key={v.id}>
                        <td>
                          <div className="ai-vendor-name">{v.store_name || "—"}</div>
                          <div className="ai-vendor-owner">{v.owner_name || ""}</div>
                        </td>
                        <td>{v.product_count}</td>
                        <td>{v.order_count}</td>
                        <td>{fmtRs(v.revenue)}</td>
                        <td>
                          <span className={`ai-status ${v.is_operational ? "ai-on" : "ai-off"}`}>
                            {v.is_operational ? "ON" : "OFF"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Top products */}
              <div className="ai-section">
                <h3 className="ai-section-title">Top Products</h3>
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th>Product</th>
                      <th>Vendor</th>
                      <th>Units</th>
                      <th>Revenue</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.topProducts.map((p, i) => (
                      <tr key={i}>
                        <td>{p.name}</td>
                        <td className="ai-vendor-owner">{p.vendor_name}</td>
                        <td>{p.units_sold}</td>
                        <td>{fmtRs(p.revenue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </div>
    </VendorLayout>
  );
}
