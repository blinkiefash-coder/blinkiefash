import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import "./stockMonitoring.css";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";
import { fetchVendorProfile } from "../utils/vendorSession";
import { adminHeaders, isAdmin } from "../utils/adminSession";

export default function StockMonitoring() {
  const navigate = useNavigate();
  const adminMode = isAdmin();
  const [storeName, setStoreName] = useState(() => localStorage.getItem("store_name") || "My Store");
  const [vendorId] = useState(() => localStorage.getItem("vendor_id") || "");
  const [darkStores, setDarkStores] = useState([]);
  const [selectedStoreId, setSelectedStoreId] = useState("");
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (adminMode) {
      loadDarkStores();
      return;
    }

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

        // Vendor mode should always show all products owned by the vendor account.
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
  }, [adminMode, vendorId]);

  useEffect(() => {
    if (!adminMode || !selectedStoreId) {
      return;
    }
    loadProductsForStore(selectedStoreId);
  }, [adminMode, selectedStoreId, darkStores.length]);

  const loadDarkStores = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_API_BASE_URL}/checkout/darkstores`, {
        headers: adminHeaders(),
      });
      const data = await res.json();
      const stores = Array.isArray(data?.stores) ? data.stores : [];
      setDarkStores(stores);
      // Default to "All" so admin sees everything at once
      setSelectedStoreId("all");
    } catch (err) {
      console.error("Failed to load dark stores:", err);
      setDarkStores([]);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const loadProductsForStore = async (storeId) => {
    try {
      setLoading(true);
      if (storeId === "all") {
        // Fetch all stores in parallel and merge products
        const allStoreIds = darkStores.map(s => s.id);
        const results = await Promise.all(
          allStoreIds.map(id =>
            fetch(`${API_API_BASE_URL}/checkout/darkstore/${id}/products`, { headers: adminHeaders() })
              .then(r => r.json()).catch(() => [])
          )
        );
        const seen = new Set();
        const merged = [];
        results.flat().forEach(p => {
          if (!seen.has(p.id)) { seen.add(p.id); merged.push(p); }
        });
        setProducts(merged);
      } else {
        const res = await fetch(
          `${API_API_BASE_URL}/checkout/darkstore/${storeId}/products`,
          { headers: adminHeaders() }
        );
        const productsData = await res.json();
        setProducts(Array.isArray(productsData) ? productsData : []);
      }
    } catch (err) {
      console.error("Failed to load products for dark store:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  const filteredProducts = products.filter(
    (product) =>
      (product.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (product.brand_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
      (product.variants || []).some((v) =>
        (v.barcode?.toLowerCase() || "").includes(searchTerm.toLowerCase())
      )
  );

  const getTotalStock = (product) => {
    return (product.variants || []).reduce(
      (sum, v) => sum + (Number(v.quantity) || Number(v.stock) || 0),
      0
    );
  };

  const getStockStatus = (quantity) => {
    if (quantity === 0) return "out-of-stock";
    if (quantity < 10) return "low-stock";
    if (quantity < 25) return "medium-stock";
    return "good-stock";
  };

  const menuItems = [
    { key: "orders",   label: "Orders",             icon: "\u25cd" },
    { key: "products", label: "Add Product",       icon: "\u25a1" },
    { key: "edit",     label: "Edit Products",      icon: "\u270f" },
    { key: "stock",    label: "Stock Monitoring",   icon: "\ud83d\udce6" },
    { key: "analytics",label: "Product Analytics",  icon: "\ud83d\udcca" },
  ];

  const handleMenuClick = (item) => {
    if (item.key === "orders")   navigate("/vendor/orders");
    if (item.key === "products") navigate("/vendor/add-product");
    if (item.key === "edit")     navigate("/vendor/edit-product");
    if (item.key === "analytics") navigate("/vendor/product-analytics");
    if (item.key === "stock") navigate("/vendor/stock-monitoring");
  };

  const selectedStore = darkStores.find((store) => String(store.id) === String(selectedStoreId));

  const downloadExcel = () => {
    const storeName_ = selectedStoreId === "all" ? "All Stores" : (selectedStore?.name || "Store");
    const rows = [
      ["Product Name", "Brand", "Category", "Price (₹)", "Total Stock", "Size", "Color", "Barcode", "Variant Stock"],
    ];
    filteredProducts.forEach((p) => {
      const variants = p.variants || [];
      if (variants.length === 0) {
        rows.push([p.name, p.brand_name || "", p.category_name || "", p.price || "", getTotalStock(p), "", "", "", ""]);
      } else {
        variants.forEach((v, i) => {
          rows.push([
            i === 0 ? p.name : "",
            i === 0 ? (p.brand_name || "") : "",
            i === 0 ? (p.category_name || "") : "",
            i === 0 ? (p.price || "") : "",
            i === 0 ? getTotalStock(p) : "",
            v.size || "", v.color || "", v.barcode || "",
            Number(v.quantity) || 0,
          ]);
        });
      }
    });
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `stock_${storeName_.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <VendorLayout activeKey="stock" storeName={storeName} menuItems={menuItems} onMenuClick={handleMenuClick}>
      <div className="stock-container">
        <div className="stock-header">
          <h1>📦 Stock Monitoring</h1>
          <p>{adminMode ? "Admin view: monitor stock by dark store" : "View inventory for your vendor store only"}</p>
          {!loading && filteredProducts.length > 0 && (
            <button
              onClick={downloadExcel}
              style={{ marginTop: 8, padding: "6px 14px", background: "#16a34a", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: 600 }}
            >
              ⬇ Download Excel
            </button>
          )}
        </div>

        <div className="stock-controls">
          <div className="store-selector">
            <label>{adminMode ? "Dark Store:" : "Vendor:"}</label>
            {adminMode ? (
              <select
                value={selectedStoreId}
                onChange={(e) => setSelectedStoreId(e.target.value)}
                disabled={darkStores.length === 0}
              >
                <option value="all">All Stores</option>
                {darkStores.map((store) => (
                  <option key={store.id} value={String(store.id)}>
                    {store.name}{store.city ? ` - ${store.city}` : ""}
                  </option>
                ))}
              </select>
            ) : (
              <div className="vendor-store-name">{storeName}</div>
            )}
          </div>

          <div className="search-box">
            <input
              type="text"
              placeholder="Search by name, brand or barcode..."
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
                <h3>{filteredProducts.reduce((sum, p) => sum + (p.variants || []).length, 0)}</h3>
                <p>Total Variants</p>
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
                    <th>Image</th>
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
                        <td data-label="Image">
                          {product.image_url
                            ? <img src={product.image_url} alt="" className="stock-product-img" />
                            : <div className="stock-product-img-placeholder" />}
                        </td>
                        <td className="product-name" data-label="Product">
                          {product.name || "N/A"}
                          {product.variants?.[0]?.barcode && (
                            <span className="barcode-tag"> ({product.variants[0].barcode})</span>
                          )}
                        </td>
                        <td data-label="Brand">{product.brand_name || "N/A"}</td>
                        <td data-label="Category">{product.category_name || "N/A"}</td>
                        <td data-label="Price">₹{product.price || "0"}</td>
                        <td className="total-stock" data-label="Stock">
                          <strong>{totalStock}</strong>
                        </td>
                        <td data-label="Variants">
                          <div className="variants-list">
                            {(product.variants || []).map((variant, vidx) => (
                              <div key={vidx} className="variant-item">
                                <span>{variant.size} / {variant.color}</span>
                                <span className="qty">×{Number(variant.quantity) || Number(variant.stock) || 0}</span>
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
                  <p>
                    {adminMode
                      ? `No products found${selectedStore?.name ? ` for ${selectedStore.name}` : " in this dark store"}.`
                      : "No products found for this vendor yet."}
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </VendorLayout>
  );
}
