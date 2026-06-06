import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./stockMonitoring.css";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";

export default function StockMonitoring() {
  const navigate = useNavigate();
  const [storeName] = useState(() => localStorage.getItem("store_name") || "Dark Store Manager");
  const [products, setProducts] = useState([]);
  const [darkStores, setDarkStores] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    loadDarkStores();
  }, []);

  useEffect(() => {
    if (selectedStoreId) {
      loadProductsForStore(selectedStoreId);
    }
  }, [selectedStoreId]);

  const loadDarkStores = async () => {
    try {
      console.log("🔹 Loading dark stores from:", `${API_API_BASE_URL}/checkout/darkstores`);
      const res = await fetch(`${API_API_BASE_URL}/checkout/darkstores`);
      const text = await res.text();
      
      console.log("🔹 Response status:", res.status);
      console.log("🔹 Response headers:", {
        'content-type': res.headers.get('content-type'),
        'access-control-allow-origin': res.headers.get('access-control-allow-origin')
      });
      console.log("🔹 Response text (first 300 chars):", text.substring(0, 300));
      
      const data = JSON.parse(text);
      
      const stores = data.stores || [];
      setDarkStores(stores);
      
      // Auto-select first store
      if (stores.length > 0) {
        setSelectedStoreId(stores[0].id);
      }
    } catch (err) {
      console.error("❌ Failed to load dark stores:", err);
      console.error("❌ Error details:", { message: err.message, stack: err.stack });
    }
  };

  const loadProductsForStore = async (storeId) => {
    try {
      setLoading(true);
      const url = `${API_API_BASE_URL}/checkout/darkstore/${storeId}/products`;
      console.log("📦 Fetching products from:", url);
      
      const res = await fetch(url);
      const productsData = await res.json();
      
      console.log("📦 API Response:", { storeId, status: res.status, dataType: typeof productsData, isArray: Array.isArray(productsData), count: Array.isArray(productsData) ? productsData.length : 0, data: productsData });
      
      setProducts(Array.isArray(productsData) ? productsData : []);
    } catch (err) {
      console.error("Failed to load products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

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
  };

  return (
    <VendorLayout activeKey="stock" storeName={storeName} menuItems={menuItems} onMenuClick={handleMenuClick}>
      <div className="stock-container">
        <div className="stock-header">
          <h1>📦 Stock Monitoring by Dark Store</h1>
          <p>View inventory levels across all dark stores</p>
        </div>

        <div className="stock-controls">
          <div className="store-selector">
            <label>Select Dark Store:</label>
            <select 
              value={selectedStoreId} 
              onChange={(e) => setSelectedStoreId(e.target.value)}
            >
              {darkStores.map((store) => (
                <option key={store.id} value={store.id}>
                  {store.name} - {store.city}
                </option>
              ))}
            </select>
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
                  <p>No products found in this dark store.</p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </VendorLayout>
  );
}
