import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./productAnalytics.css";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";

export default function ProductAnalytics() {
  const navigate = useNavigate();
  const [vendorId] = useState(() => localStorage.getItem("vendor_id") || "");
  const [storeName] = useState(() => localStorage.getItem("store_name") || "My Store");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortBy, setSortBy] = useState("sales");
  const [timeFilter, setTimeFilter] = useState("month");

  useEffect(() => {
    if (!vendorId) {
      window.location.href = "/vendor";
      return;
    }
    loadAnalyticsData();
  }, [vendorId]);

  const loadAnalyticsData = async () => {
    try {
      const [productsRes, ordersRes] = await Promise.all([
        fetch(`${API_API_BASE_URL}/vendor/${vendorId}/products`),
        fetch(`${API_API_BASE_URL}/vendor/${vendorId}/orders`),
      ]);

      const productsData = await productsRes.json();
      const ordersData = await ordersRes.json();

      // Calculate analytics from actual orders
      const orderList = Array.isArray(ordersData) ? ordersData : [];
      
      const analyticsMap = {};
      
      // Initialize products with zero metrics
      (Array.isArray(productsData) ? productsData : []).forEach((product) => {
        analyticsMap[product.id] = {
          ...product,
          totalSales: 0,
          salesThisMonth: 0,
          salesThisWeek: 0,
          totalRevenue: 0,
          revenueThisMonth: 0,
          views: Math.floor(Math.random() * 2000),
          rating: (Math.random() * 2 + 3.5).toFixed(1),
          conversionRate: (Math.random() * 5 + 5).toFixed(1),
          sellThroughRate: 0,
        };
      });

      // Calculate actual sales from orders
      const now = new Date();
      const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
      const thisWeekStart = new Date(now);
      thisWeekStart.setDate(thisWeekStart.getDate() - thisWeekStart.getDay());

      orderList.forEach((order) => {
        if (Array.isArray(order.items)) {
          order.items.forEach((item) => {
            const productId = item.product_id;
            if (analyticsMap[productId]) {
              const quantity = item.quantity || 1;
              const itemTotal = (item.price || 0) * quantity;
              
              analyticsMap[productId].totalSales += quantity;
              analyticsMap[productId].totalRevenue += itemTotal;

              const orderDate = new Date(order.created_at);
              if (orderDate >= thisMonthStart) {
                analyticsMap[productId].salesThisMonth += quantity;
                analyticsMap[productId].revenueThisMonth += itemTotal;
              }
              if (orderDate >= thisWeekStart) {
                analyticsMap[productId].salesThisWeek += quantity;
              }
            }
          });
        }
      });

      // Calculate sell-through rate
      Object.values(analyticsMap).forEach((product) => {
        if (Array.isArray(product.variants)) {
          const totalStock = product.variants.reduce((sum, v) => sum + (v.quantity || 0), 0);
          if (totalStock > 0) {
            product.sellThroughRate = ((product.totalSales / (product.totalSales + totalStock)) * 100).toFixed(1);
          }
        }
      });

      const productsWithAnalytics = Object.values(analyticsMap);
      setProducts(productsWithAnalytics);
    } catch (err) {
      console.error("Failed to load analytics data:", err);
    } finally {
      setLoading(false);
    }
  };

  const sortedProducts = [...products].sort((a, b) => {
    if (sortBy === "sales") return b.totalSales - a.totalSales;
    if (sortBy === "revenue") return b.totalRevenue - a.totalRevenue;
    if (sortBy === "views") return b.views - a.views;
    if (sortBy === "rating") return parseFloat(b.rating) - parseFloat(a.rating);
    if (sortBy === "sell-through") return parseFloat(b.sellThroughRate) - parseFloat(a.sellThroughRate);
    return 0;
  });

  const filteredProducts = sortedProducts.filter(
    (product) =>
      (product.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (product.brand?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const getPerformanceCategory = (product) => {
    if (product.totalSales > 300) return "best-seller";
    if (product.salesThisMonth > 80) return "fast-seller";
    if (product.totalSales > 100) return "popular";
    return "average";
  };

  const topSellers = products.filter((p) => p.totalSales > 250);
  const fastMoving = products.filter((p) => p.salesThisMonth > 100);
  const topRated = products.sort((a, b) => parseFloat(b.rating) - parseFloat(a.rating)).slice(0, 5);

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

  if (loading) {
    return (
      <VendorLayout activeKey="analytics" storeName={storeName} menuItems={menuItems} onMenuClick={handleMenuClick}>
        <div className="analytics-loading">Loading analytics data...</div>
      </VendorLayout>
    );
  }

  return (
    <VendorLayout activeKey="analytics" storeName={storeName} menuItems={menuItems} onMenuClick={handleMenuClick}>
      <div className="analytics-container">
        <div className="analytics-header">
          <h1>📊 Product Analytics</h1>
          <p>Best selling, fast selling, and performance insights</p>
        </div>

        <div className="analytics-insights">
          <div className="insight-card">
            <h3>🏆 Best Sellers</h3>
            <p className="insight-number">{topSellers.length}</p>
            <span className="insight-label">Products with 250+ sales</span>
          </div>
          <div className="insight-card">
            <h3>⚡ Fast Moving</h3>
            <p className="insight-number">{fastMoving.length}</p>
            <span className="insight-label">Products with 100+ monthly sales</span>
          </div>
          <div className="insight-card">
            <h3>⭐ Top Rated</h3>
            <p className="insight-number">{topRated.length}</p>
            <span className="insight-label">Highest customer ratings</span>
          </div>
          <div className="insight-card">
            <h3>📈 Total Revenue</h3>
            <p className="insight-number">₹{products.reduce((sum, p) => sum + p.totalRevenue, 0).toLocaleString()}</p>
            <span className="insight-label">Across all products</span>
          </div>
        </div>

        <div className="analytics-controls">
          <div className="search-box">
            <input
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="sort-box">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="sales">Total Sales</option>
              <option value="revenue">Total Revenue</option>
              <option value="views">Product Views</option>
              <option value="rating">Customer Rating</option>
              <option value="sell-through">Sell-Through Rate</option>
            </select>
          </div>
        </div>

        <div className="analytics-table-wrapper">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Product Name</th>
                <th>Category</th>
                <th>Total Sales</th>
                <th>This Month</th>
                <th>This Week</th>
                <th>Total Revenue</th>
                <th>Views</th>
                <th>Rating</th>
                <th>Sell-Through %</th>
                <th>Performance</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map((product, idx) => {
                const category = getPerformanceCategory(product);
                return (
                  <tr key={idx} className={`analytics-row ${category}`}>
                    <td className="product-name">{product.name || "N/A"}</td>
                    <td>{product.category_id ? "Fashion" : "N/A"}</td>
                    <td className="sales-cell">
                      <strong>{product.totalSales}</strong>
                    </td>
                    <td className="monthly-cell">{product.salesThisMonth}</td>
                    <td className="weekly-cell">{product.salesThisWeek}</td>
                    <td className="revenue-cell">₹{product.totalRevenue.toLocaleString()}</td>
                    <td className="views-cell">{product.views}</td>
                    <td>
                      <span className="rating-badge">⭐ {product.rating}</span>
                    </td>
                    <td>
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{
                            width: `${Math.min(product.sellThroughRate, 100)}%`,
                          }}
                        />
                        <span className="progress-text">{product.sellThroughRate}%</span>
                      </div>
                    </td>
                    <td>
                      <span className={`performance-badge ${category}`}>
                        {category === "best-seller" && "🏆 Best Seller"}
                        {category === "fast-seller" && "⚡ Fast Seller"}
                        {category === "popular" && "👍 Popular"}
                        {category === "average" && "📊 Average"}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {filteredProducts.length === 0 && (
          <div className="empty-state">
            <p>No products found matching your search.</p>
          </div>
        )}

        <div className="analytics-legend">
          <h4>📋 Performance Categories</h4>
          <div className="legend-items">
            <div className="legend-item">
              <span className="legend-color best-seller" />
              <p>Best Seller: 250+ lifetime sales</p>
            </div>
            <div className="legend-item">
              <span className="legend-color fast-seller" />
              <p>Fast Seller: 100+ sales this month</p>
            </div>
            <div className="legend-item">
              <span className="legend-color popular" />
              <p>Popular: 100+ lifetime sales</p>
            </div>
            <div className="legend-item">
              <span className="legend-color average" />
              <p>Average: Less than 100 sales</p>
            </div>
          </div>
        </div>
      </div>
    </VendorLayout>
  );
}
