import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";
import { fetchVendorProfile } from "../utils/vendorSession";
import { isAdmin, adminHeaders } from "../utils/adminSession";
import "./editProduct.css";

const EMPTY_VARIANT = { size: "", color: "", price: "", mrp: "", barcode: "", quantity: "", imageFiles: [] };

export default function EditProduct() {
  const navigate = useNavigate();
  const adminMode = isAdmin();
  const [vendorId] = useState(() => localStorage.getItem("vendor_id") || "");
  const [storeName, setStoreName] = useState(() => localStorage.getItem("store_name") || "My Store");
  const [vendorStoreId, setVendorStoreId] = useState(() => localStorage.getItem("vendor_store_id") || null);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [expandedId, setExpandedId] = useState(null);
  const [stockEdits, setStockEdits] = useState({});
  const [priceEdits, setPriceEdits] = useState({});
  const [saving, setSaving] = useState(null);
  const [savingAll, setSavingAll] = useState(false);
  const [addingTo, setAddingTo] = useState(null);
  const [newVariant, setNewVariant] = useState(EMPTY_VARIANT);
  const [addSaving, setAddSaving] = useState(false);
  // Admin mode: vendor picker
  const [adminVendors, setAdminVendors] = useState([]);
  const [selectedAdminVendorId, setSelectedAdminVendorId] = useState("");

  const menuItems = [
    { key: "orders",   label: "Orders",             icon: "\u25cd" },
    { key: "products", label: "Add Product",       icon: "\u25a1" },
    { key: "edit",     label: "Edit Products",      icon: "\u270f" },
    { key: "stock",    label: "Stock Monitoring",   icon: "\ud83d\udce6" },
    { key: "analytics",label: "Product Analytics",  icon: "\ud83d\udcca" },
  ];

  const handleMenuClick = (item) => {
    if (item.key === "orders")   navigate("/vendor/orders");
    if (item.key === "products")  navigate("/vendor/add-product");
    if (item.key === "stock")     navigate("/vendor/stock-monitoring");
    if (item.key === "analytics") navigate("/vendor/product-analytics");
    if (item.key === "orders")    navigate("/vendor/orders");
  };

  useEffect(() => {
    if (adminMode) {
      fetch(`${API_API_BASE_URL}/admin/vendors`, { headers: adminHeaders() })
        .then((r) => r.json())
        .then((d) => {
          const list = Array.isArray(d.vendors) ? d.vendors : [];
          setAdminVendors(list);
          // Default to "all" so admin sees everything at once
          setSelectedAdminVendorId("all");
          loadProducts("all", list);
        })
        .catch(() => setLoading(false));
      return;
    }
    if (!vendorId) { window.location.href = "/vendor"; return; }
    fetchVendorProfile(vendorId).then((v) => {
      if (v?.store_name) { setStoreName(v.store_name); localStorage.setItem("store_name", v.store_name); }
      if (v?.dark_store_id) {
        setVendorStoreId(v.dark_store_id);
        localStorage.setItem("vendor_store_id", String(v.dark_store_id));
      }
    });
    loadProducts(vendorId);
  }, [vendorId, adminMode]);

  useEffect(() => {
    if (adminMode && selectedAdminVendorId) {
      loadProducts(selectedAdminVendorId);
    }
  }, [selectedAdminVendorId]);

  const resolveVariantPrice = (rawValue, mrpValue) => {
    const text = String(rawValue ?? "").trim();
    if (!text) return null;

    const percentMatch = text.match(/^(-?\d+(?:\.\d+)?)\s*%$/);
    if (percentMatch) {
      const percent = Number(percentMatch[1]);
      const baseMrp = Number(mrpValue ?? 0);
      if (!Number.isFinite(baseMrp) || baseMrp <= 0) return null;
      return Math.round(baseMrp * (1 - percent / 100));
    }

    const numericValue = Number(text.replace(/[^\d.-]/g, ""));
    return Number.isFinite(numericValue) ? Math.round(numericValue) : null;
  };

  const loadProducts = async (vid, vendorList) => {
    if (!vid) return;
    setLoading(true);
    try {
      let list = [];
      if (vid === "all") {
        // Fetch all vendors' products in parallel and merge
        const vendors = vendorList || adminVendors;
        const results = await Promise.all(
          vendors.map(v => fetch(`${API_API_BASE_URL}/vendor/${v.id}/products`).then(r => r.json()).catch(() => []))
        );
        list = results.flat().filter(p => p?.id);
        // Deduplicate by product id
        const seen = new Set();
        list = list.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true; });
      } else {
        const res = await fetch(`${API_API_BASE_URL}/vendor/${vid}/products`);
        const data = await res.json();
        list = Array.isArray(data) ? data : [];
      }
      setProducts(list);
      const stockMap = {};
      const priceMap = {};
      list.forEach((p) => (p.variants || []).forEach((v) => {
        stockMap[v.id] = v.quantity ?? 0;
        priceMap[v.id] = v.price ?? "";
      }));
      setStockEdits(stockMap);
      setPriceEdits(priceMap);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const filtered = products.filter((p) =>
    (p.name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (p.brand_name?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (p.variants || []).some((v) => (v.barcode?.toLowerCase() || "").includes(searchTerm.toLowerCase()))
  );

  const getVendorIdForProduct = (productId) => {
    if (!adminMode || selectedAdminVendorId !== "all") return adminMode ? selectedAdminVendorId : vendorId;
    const p = products.find(x => x.id === productId);
    return p?.vendor_id || selectedAdminVendorId;
  };

  const saveVariant = async (variantId, variantMeta) => {
    const activeVendorId = getVendorIdForProduct(variantMeta.product_id);
    setSaving(variantId);
    try {
      const resolvedPrice = resolveVariantPrice(priceEdits[variantId] ?? variantMeta.price, variantMeta.mrp);
      const body = {
        stock: Number(stockEdits[variantId] ?? 0),
        store_id: vendorStoreId,
      };
      if (resolvedPrice !== null) body.price = resolvedPrice;

      const res = await fetch(`${API_API_BASE_URL}/vendor/${activeVendorId}/variants/${variantId}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed");
    } catch (err) {
      throw err;
    } finally {
      setSaving(null);
    }
  };

  // Collect all variants from currently visible products and save in one shot
  const saveAll = async () => {
    setSavingAll(true);
    const allVariants = filtered.flatMap(p =>
      (p.variants || []).map(v => ({ ...v, product_id: v.product_id || p.id }))
    );
    const errors = [];
    for (const v of allVariants) {
      try { await saveVariant(v.id, v); }
      catch (e) { errors.push(`${v.size}/${v.color}: ${e.message}`); }
    }
    await loadProducts(selectedAdminVendorId || vendorId);
    setSavingAll(false);
    if (errors.length) alert(`Some variants failed to save:\n${errors.join("\n")}`);
    else alert("All variants saved successfully!");
  };

  const removeVariant = async (variantId, productId) => {
    const activeVendorId = getVendorIdForProduct(productId);
    if (!window.confirm("Remove this variant? It will be hidden from the store.")) return;
    try {
      const res = await fetch(`${API_API_BASE_URL}/vendor/${activeVendorId}/variants/${variantId}`, { method: "DELETE" });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed");
      await loadProducts(selectedAdminVendorId || vendorId);
    } catch (err) {
      alert(`Remove failed: ${err.message}`);
    }
  };

  const uploadImages = async (files) => {
    if (!files.length) return [];
    const fd = new FormData();
    files.forEach((f) => fd.append("image", f));
    try {
      const res = await fetch(`${API_API_BASE_URL}/upload`, { method: "POST", body: fd });
      const data = await res.json();
      return data.image_urls || [];
    } catch { return []; }
  };

  const addVariant = async (productId) => {
    const activeVendorId = adminMode ? selectedAdminVendorId : vendorId;
    if (!newVariant.size.trim() || !newVariant.color.trim()) { alert("Size and Color are required"); return; }
    const resolvedPrice = resolveVariantPrice(newVariant.price, newVariant.mrp);
    if (resolvedPrice === null) { alert("Price is required. Enter a value like 499 or a percentage such as 40%."); return; }
    setAddSaving(true);
    try {
      const uploadedImages = await uploadImages(newVariant.imageFiles || []);
      const res = await fetch(`${API_API_BASE_URL}/vendor/${activeVendorId}/products/${productId}/variants`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...newVariant, price: resolvedPrice, images: uploadedImages, store_id: vendorStoreId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message || "Failed");
      setAddingTo(null);
      setNewVariant(EMPTY_VARIANT);
      await loadProducts(activeVendorId);
    } catch (err) {
      alert(`Add variant failed: ${err.message}`);
    } finally {
      setAddSaving(false);
    }
  };

  return (
    <VendorLayout activeKey="edit" storeName={storeName} menuItems={menuItems} onMenuClick={handleMenuClick}>
      <div className="ep-container">
        <div className="ep-header">
          <h1>✏ Edit Products</h1>
          <p>{adminMode ? "Admin view: select a vendor to edit their products" : "Search, update stock, add or remove variants for your store"}</p>
        </div>

        {adminMode && (
          <div className="ep-search" style={{ marginBottom: 8 }}>
            <select
              value={selectedAdminVendorId}
              onChange={(e) => setSelectedAdminVendorId(e.target.value)}
              style={{ padding: "8px 12px", borderRadius: 6, fontSize: 14, minWidth: 240 }}
            >
              <option value="all">All Vendors</option>
              {adminVendors.length === 0 && <option value="" disabled>No vendors found</option>}
              {adminVendors.map((v) => (
                <option key={v.id} value={String(v.id)}>{v.store_name || v.name || v.id}</option>
              ))}
            </select>
          </div>
        )}

        <div className="ep-search">
          <input
            type="text"
            placeholder="Search by product name, brand or barcode..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <span className="ep-count">{filtered.length} product{filtered.length !== 1 ? "s" : ""}</span>
          {!loading && filtered.length > 0 && (
            <button
              className="ep-save-all-btn"
              disabled={savingAll}
              onClick={saveAll}
            >
              {savingAll ? "Saving all…" : "✓ Save All Changes"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="ep-loading">Loading products…</div>
        ) : filtered.length === 0 ? (
          <div className="ep-empty">No products found.</div>
        ) : (
          <div className="ep-list">
            {filtered.map((product) => {
              const isOpen = expandedId === product.id;
              const totalStock = (product.variants || []).reduce(
                (s, v) => s + (Number(stockEdits[v.id] ?? v.quantity) || 0), 0
              );
              return (
                <div key={product.id} className={`ep-card ${isOpen ? "ep-card--open" : ""}`}>
                  <button
                    className="ep-card-header"
                    onClick={() => setExpandedId(isOpen ? null : product.id)}
                  >
                    <div className="ep-card-meta">                    {product.image_url && (
                      <img src={product.image_url} alt="" className="ep-product-thumb" />
                    )}                      <span className="ep-product-name">{product.name}</span>
                      {product.brand_name && <span className="ep-brand">{product.brand_name}</span>}
                    </div>
                    <div className="ep-card-summary">
                      <span className="ep-total-stock">{totalStock} units</span>
                      <span className="ep-variant-count">{(product.variants || []).length} variants</span>
                      <span className="ep-chevron">{isOpen ? "▲" : "▼"}</span>
                    </div>
                  </button>

                  {isOpen && (
                    <div className="ep-card-body">
                      <div className="ep-table-wrapper">
                        <table className="ep-table">
                          <thead>
                            <tr>
                              <th>Size</th>
                              <th>Color</th>
                              <th>Barcode</th>
                              <th>Price</th>
                              <th>MRP</th>
                              <th>Stock</th>
                              <th></th>
                            </tr>
                          </thead>
                          <tbody>
                            {(product.variants || []).map((v) => (
                              <tr key={v.id}>
                                <td>{v.size}</td>
                                <td>{v.color}</td>
                                <td className="ep-mono">{v.barcode || "—"}</td>
                                <td>
                                  <input
                                    type="text"
                                    className="ep-price-input"
                                    value={priceEdits[v.id] ?? v.price ?? ""}
                                    onChange={(e) => setPriceEdits((s) => ({ ...s, [v.id]: e.target.value }))}
                                    placeholder="499 or 40%"
                                  />
                                </td>
                                <td>₹{v.mrp}</td>
                                <td>
                                  <input
                                    type="number"
                                    min="0"
                                    className="ep-stock-input"
                                    value={stockEdits[v.id] ?? v.quantity ?? 0}
                                    onChange={(e) =>
                                      setStockEdits((s) => ({ ...s, [v.id]: e.target.value }))
                                    }
                                  />
                                </td>
                                <td className="ep-row-actions">
                                  <button
                                    className="ep-save-btn"
                                    disabled={saving === v.id || savingAll}
                                    onClick={async () => {
                                      try { await saveVariant(v.id, v); await loadProducts(selectedAdminVendorId || vendorId); }
                                      catch (e) { alert(`Save failed: ${e.message}`); }
                                    }}
                                  >
                                    {saving === v.id ? "…" : "Save"}
                                  </button>
                                  <button
                                    className="ep-remove-btn"
                                    title="Remove variant"
                                    onClick={() => removeVariant(v.id, product.id)}
                                  >
                                    ✕
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {addingTo === product.id ? (
                        <div className="ep-add-form">
                          <h4>Add New Variant</h4>
                          <div className="ep-add-grid">
                            <label>
                              Size *
                              <input placeholder="e.g. M" value={newVariant.size} onChange={(e) => setNewVariant((s) => ({ ...s, size: e.target.value }))} />
                            </label>
                            <label>
                              Color *
                              <input placeholder="e.g. Black" value={newVariant.color} onChange={(e) => setNewVariant((s) => ({ ...s, color: e.target.value }))} />
                            </label>
                            <label>
                              Barcode
                              <input placeholder="optional" value={newVariant.barcode} onChange={(e) => setNewVariant((s) => ({ ...s, barcode: e.target.value }))} />
                            </label>
                            <label>
                              Price / % *
                              <input type="text" value={newVariant.price} onChange={(e) => setNewVariant((s) => ({ ...s, price: e.target.value }))} placeholder="499 or 40%" />
                            </label>
                            <label>
                              MRP ₹
                              <input type="number" min="0" value={newVariant.mrp} onChange={(e) => setNewVariant((s) => ({ ...s, mrp: e.target.value }))} />
                            </label>
                            <label>
                              Stock qty
                              <input type="number" min="0" value={newVariant.quantity} onChange={(e) => setNewVariant((s) => ({ ...s, quantity: e.target.value }))} />
                            </label>
                          </div>
                          <div className="ep-add-images">
                            <label className="ep-add-images-label">
                              Images
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                onChange={(e) => {
                                  const files = Array.from(e.target.files || []);
                                  setNewVariant((s) => ({ ...s, imageFiles: [...(s.imageFiles || []), ...files] }));
                                  e.target.value = "";
                                }}
                              />
                            </label>
                            {(newVariant.imageFiles || []).length > 0 && (
                              <div className="ep-img-previews">
                                {newVariant.imageFiles.map((f, i) => (
                                  <div key={i} className="ep-img-thumb">
                                    <img src={URL.createObjectURL(f)} alt="preview" />
                                    <button
                                      type="button"
                                      className="ep-img-remove"
                                      onClick={() => setNewVariant((s) => ({ ...s, imageFiles: s.imageFiles.filter((_, idx) => idx !== i) }))}
                                    >✕</button>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                          <div className="ep-add-actions">
                            <button className="ep-confirm-btn" disabled={addSaving} onClick={() => addVariant(product.id)}>
                              {addSaving ? "Saving…" : "✓ Save Variant"}
                            </button>
                            <button className="ep-cancel-btn" onClick={() => { setAddingTo(null); setNewVariant(EMPTY_VARIANT); }}>
                              Cancel
                            </button>
                          </div>
                        </div>
                      ) : (
                        <button className="ep-add-variant-btn" onClick={() => {
                          // Pre-fill from last existing variant so user only changes what's different
                          const last = (product.variants || []).slice(-1)[0];
                          setNewVariant(last ? {
                            size: "", color: last.color || "",
                            price: String(last.price || ""), mrp: String(last.mrp || ""),
                            barcode: "", quantity: "", imageFiles: []
                          } : EMPTY_VARIANT);
                          setAddingTo(product.id);
                        }}>
                          + Add Variant
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </VendorLayout>
  );
}
