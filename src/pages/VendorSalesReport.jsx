import { useEffect, useState } from "react";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useNavigate } from "react-router-dom";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";
import { fetchVendorProfile } from "../utils/vendorSession";
import "./vendorSalesReport.css";

const getToday = () => new Date().toISOString().slice(0, 10);

export default function VendorSalesReport() {
  const navigate = useNavigate();
  const [vendorId] = useState(() => localStorage.getItem("vendor_id") || "");
  const [storeName, setStoreName] = useState(() => localStorage.getItem("store_name") || "My Store");
  const [orders, setOrders] = useState([]);
  const [totals, setTotals] = useState({ orderCount: 0, itemsSold: 0, totalRevenue: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fromDate, setFromDate] = useState(getToday());
  const [toDate, setToDate] = useState(getToday());

  useEffect(() => {
    if (!vendorId) {
      window.location.href = "/vendor";
      return;
    }

    const loadVendor = async () => {
      const vendor = await fetchVendorProfile(vendorId);
      if (vendor?.store_name) {
        setStoreName(vendor.store_name);
        localStorage.setItem("store_name", vendor.store_name);
      }
    };

    loadVendor();
    loadReport(fromDate, toDate);
  }, [vendorId, fromDate, toDate]);

  const loadReport = async (from, to) => {
    try {
      setLoading(true);
      setError("");
      const query = new URLSearchParams();
      if (from) query.set("from", from);
      if (to) query.set("to", to);

      const response = await fetch(
        `${API_API_BASE_URL}/vendor/${vendorId}/sales-report?${query.toString()}`
      );
      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Unable to load sales report");
      }

      setOrders(Array.isArray(data.orders) ? data.orders : []);
      setTotals({
        orderCount: Number(data.summary?.orderCount || 0),
        itemsSold: Number(data.summary?.itemsSold || 0),
        totalRevenue: Number(data.summary?.totalRevenue || 0),
      });
    } catch (err) {
      console.error("Failed to load vendor sales data:", err);
      setError(err.message || "Unable to load sales data right now.");
      setOrders([]);
      setTotals({ orderCount: 0, itemsSold: 0, totalRevenue: 0 });
    } finally {
      setLoading(false);
    }
  };

  const menuItems = [
    { key: "dashboard", label: "Dashboard", icon: "⌂" },
    { key: "products", label: "Products", icon: "□" },
    { key: "stock", label: "Stock Monitoring", icon: "📦" },
    { key: "analytics", label: "Product Analytics", icon: "📊" },
    { key: "sales", label: "Sales Report", icon: "🧾" },
    { key: "orders", label: "Orders", icon: "◍" },
    { key: "settings", label: "Settings", icon: "⚙" },
  ];

  const handleMenuClick = (item) => {
    if (item.key === "products") navigate("/vendor/add-product");
    if (item.key === "stock") navigate("/vendor/stock-monitoring");
    if (item.key === "analytics") navigate("/vendor/product-analytics");
    if (item.key === "sales") navigate("/vendor/sales-report");
  };

  const handlePdfDownload = () => {
    const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
    const reportDate = new Date().toLocaleString();

    doc.setFontSize(16);
    doc.text("Vendor Sales Report", 40, 40);

    doc.setFontSize(11);
    doc.text(`Store: ${storeName}`, 40, 60);
    doc.text(`Generated: ${reportDate}`, 40, 76);
    doc.text(`Range: ${fromDate || "-"} to ${toDate || "-"}`, 40, 92);
    doc.text(`Orders: ${totals.orderCount}`, 40, 108);
    doc.text(`Items Sold: ${totals.itemsSold}`, 170, 108);
    doc.text(`Revenue: INR ${totals.totalRevenue.toLocaleString("en-IN")}`, 320, 108);

    autoTable(doc, {
      startY: 126,
      head: [["Order ID", "Date", "Status", "Items", "Amount (INR)"]],
      body: orders.map((order) => {
        return [
          String(order.id || "").slice(0, 8).toUpperCase(),
          new Date(order.created_at).toLocaleDateString("en-IN"),
          order.status || "-",
          String(Number(order.items_sold || 0)),
          Number(order.amount || 0).toLocaleString("en-IN"),
        ];
      }),
      styles: {
        fontSize: 10,
      },
      headStyles: {
        fillColor: [15, 143, 56],
      },
    });

    doc.save(`vendor-sales-${fromDate || "all"}-to-${toDate || "all"}.pdf`);
  };

  return (
    <VendorLayout activeKey="sales" storeName={storeName} menuItems={menuItems} onMenuClick={handleMenuClick}>
      <div className="vendor-sales-container">
        <div className="vendor-sales-header">
          <h1>Sales Report</h1>
          <p>Select a date range and download your sales report in PDF format.</p>
        </div>

        <div className="vendor-sales-controls">
          <div className="date-field">
            <label htmlFor="sales-from-date">From</label>
            <input
              id="sales-from-date"
              type="date"
              value={fromDate}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </div>

          <div className="date-field">
            <label htmlFor="sales-to-date">To</label>
            <input
              id="sales-to-date"
              type="date"
              value={toDate}
              onChange={(event) => setToDate(event.target.value)}
            />
          </div>

          <button type="button" className="sales-btn" onClick={handlePdfDownload} disabled={loading}>
            Download PDF
          </button>
        </div>

        {error ? <div className="sales-error">{error}</div> : null}

        {loading ? (
          <div className="sales-loading">Loading sales data...</div>
        ) : (
          <>
            <div className="vendor-sales-summary">
              <div className="sales-stat">
                <span>Total Orders</span>
                <strong>{totals.orderCount}</strong>
              </div>
              <div className="sales-stat">
                <span>Items Sold</span>
                <strong>{totals.itemsSold}</strong>
              </div>
              <div className="sales-stat">
                <span>Total Revenue</span>
                <strong>INR {totals.totalRevenue.toLocaleString("en-IN")}</strong>
              </div>
            </div>

            <div className="vendor-sales-table-wrap">
              <table className="vendor-sales-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Items</th>
                    <th>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    return (
                      <tr key={order.id}>
                        <td>{String(order.id).slice(0, 8).toUpperCase()}</td>
                        <td>{new Date(order.created_at).toLocaleDateString("en-IN")}</td>
                        <td>{order.status || "-"}</td>
                        <td>{Number(order.items_sold || 0)}</td>
                        <td>INR {Number(order.amount || 0).toLocaleString("en-IN")}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {orders.length === 0 ? (
                <div className="sales-empty">No sales found for the selected date range.</div>
              ) : null}
            </div>
          </>
        )}
      </div>
    </VendorLayout>
  );
}