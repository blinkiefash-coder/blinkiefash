import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./stockMonitoring.css";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";
import { fetchVendorProfile } from "../utils/vendorSession";

export default function StockMonitoring() {
  const navigate = useNavigate();
  const [storeName, setStoreName] = useState(() => localStorage.getItem("store_name") || "My Store");
  const [vendorId] = useState(() => localStorage.getItem("vendor_id") || "");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (!vendorId) {
      window.location.href = "/vendor";
      return;
    }

    const loadVendorData = async () => {
      try {
        const vendor = await fetchVendorProfile(vendorId);
        if (vendor?.store_name) {
          setStoreName(vendor.store_name);
          localStorage.setItem("store_name", vendor.store_name);
        }
        if (vendor?.owner_name) {
          localStorage.setItem("vendor_name", vendor.owner_name);
        }

        const res = await fetch(`${API_API_BASE_URL}/vendor/${vendorId}/products`);
        const productsData = await res.json();
        setProducts(Array.isArray(productsData) ? productsData : []);
      } catch (err) {
        console.error("Failed to load vendor stock:", err);
        setProducts([]);
      } finally {
        setLoading(false);
      }
    };

    loadVendorData();
  }, [vendorId]);

  const filteredProducts = products.filter(
    (product) =>
      (product.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (product.brand_name?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  const getTotalStock = (product) => {
    return (product.variants || []).reduce((sum, v) => sum + (v.quantity || 0), 0);
  };

  const getStockStatus = (quantity) => {
    if (quantity === 0) return "out-of-stock";
    if (quantity < 10) return "low-stock";
    if (quantity < 25) return "medium-stock";
    return "good-stock";
  };

  const menuItems = [
    { key: "dashboard", label: "Dashboard", icon: "⌂" },
    { key: "products", label: "Products", icon: "□" },
    { key: "stock", label: "Stock Monitoring", icon: "📦" },
    { key: "analytics", label: "Product Analytics", icon: "📊" },
    { key: "orders", label: "Orders", icon: "◍" },
    { key: "settings", label: "Settings", icon: "⚙" },
  ];

  const handleMenuClick = (item) => {
    if (item.key === "products") navigate("/vendor/add-product");
    if (item.key === "analytics") navigate("/vendor/product-analytics");
    if (item.key === "stock") navigate("/vendor/stock-monitoring");
    if (item.key === "orders") navigate("/vendor/orders");
  };

  return (
    <VendorLayout activeKey="stock" storeName={storeName} menuItems={menuItems} onMenuClick={handleMenuClick}>
      <div className="stock-container">
        <div className="stock-header">
          <h1>📦 Stock Monitoring</h1>
          <p>View inventory for your vendor store only</p>
        </div>

        <div className="stock-controls">
          <div className="store-selector">
            <label>Vendor:</label>
            <div className="vendor-store-name">{storeName}</div>
          </div>

          <div className="search-box">
            <input
              type="text"
              placeholder="Search products by name or brand..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        {loading ? (
          <div className="stock-loading">Loading products...</div>
        ) : (
          <>
            <div className="stock-summary">
              <div className="summary-card">
                <h3>{filteredProducts.length}</h3>
                <p>Products in Store</p>
              </div>
              <div className="summary-card">
                <h3>{filteredProducts.reduce((sum, p) => sum + getTotalStock(p), 0)}</h3>
                <p>Total Stock Units</p>
              </div>
              <div className="summary-card">
                <h3>{filteredProducts.filter((p) => getTotalStock(p) === 0).length}</h3>
                <p>Out of Stock</p>
              </div>
              <div className="summary-card">
                <h3>{filteredProducts.filter((p) => getTotalStock(p) > 0 && getTotalStock(p) < 10).length}</h3>
                <p>Low Stock</p>
              </div>
            </div>

            <div className="stock-table-wrapper">
              <table className="stock-table">
                <thead>
                  <tr>
                    <th>Product Name</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Price</th>
                    <th>Total Stock</th>
                    <th>Variants</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product, idx) => {
                    const totalStock = getTotalStock(product);
                    const status = getStockStatus(totalStock);
                    return (
                      <tr key={idx} className={`stock-row ${status}`}>
                        <td className="product-name" data-label="Product">{product.name || "N/A"}</td>
                        <td data-label="Brand">{product.brand_name || "N/A"}</td>
                        <td data-label="Category">{product.category_name || "N/A"}</td>
                        <td data-label="Price">₹{product.price || "0"}</td>
                        <td className="total-stock" data-label="Stock">
                          <strong>{totalStock}</strong>
                        </td>
                        <td data-label="Variants">
                          <div className="variants-list">
                            {(product.variants || []).filter(v => v.quantity > 0).map((variant, vidx) => (
                              <div key={vidx} className="variant-item">
                                <span>{variant.size} / {variant.color}</span>
                                <span className="qty">×{variant.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </td>
                        <td data-label="Status">
                          <span className={`status-badge ${status}`}>
                            {status === "out-of-stock" && "Out of Stock"}
                            {status === "low-stock" && "Low Stock"}
                            {status === "medium-stock" && "Medium"}
                            {status === "good-stock" && "Good Stock"}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {filteredProducts.length === 0 && (
                <div className="empty-state">
                  <p>No products found for this vendor yet.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </VendorLayout>
  );
}
