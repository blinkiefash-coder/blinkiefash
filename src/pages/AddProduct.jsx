import "./addproduct.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";
import VendorLayout from "../components/VendorLayout";
import { fetchVendorProfile } from "../utils/vendorSession";

export default function AddProduct() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [vendorId] = useState(() => localStorage.getItem("vendor_id") || "");
  const [storeName, setStoreName] = useState(() => localStorage.getItem("store_name") || "My Store");

  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});

  const [parentCategories, setParentCategories] = useState([]);
  const [childCategories, setChildCategories] = useState([]);
  const [subChildCategories, setSubChildCategories] = useState([]);

  const [selectedParent, setSelectedParent] = useState("");
  const [selectedChild, setSelectedChild] = useState("");

  const getChildren = (parentId) => childrenByParent[parentId] || [];

  const buildChildrenMap = (data) => {
    const map = {};
    data.forEach((category) => {
      const parentKey = category.parent_id || "ROOT";
      if (!map[parentKey]) map[parentKey] = [];
      map[parentKey].push(category);
    });
    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => a.name.localeCompare(b.name));
    });
    return map;
  };

  const [form, setForm] = useState({
    brand: "",
    name: "",
    short_description: "",
    full_description: "",
    category_id: "",
    is_try_enabled: true,
  });

  const [variants, setVariants] = useState([
    { size: "M", color: "Black", mrp: "", price: "", quantity: "", barcode: "", images: [], imageFiles: [] },
  ]);

  const [bundleOffers, setBundleOffers] = useState({
    buy_2_at_999: false,
    buy_3_at_999: false,
    buy_4_at_999: false,
  });


  useEffect(() => {
    if (!vendorId) { window.location.href = "/vendor"; return; }

    const loadVendor = async () => {
      const vendor = await fetchVendorProfile(vendorId);
      if (vendor?.store_name) {
        setStoreName(vendor.store_name);
        localStorage.setItem("store_name", vendor.store_name);
      }
      if (vendor?.owner_name) {
        localStorage.setItem("vendor_name", vendor.owner_name);
      }
    };

    loadVendor();
    fetch(`${API_API_BASE_URL}/brands`).then(r => r.json()).then(d => setBrands(d));
    fetch(`${API_API_BASE_URL}/categories`).then(r => r.json()).then(d => {
      setCategories(d);
      const map = buildChildrenMap(d);
      setChildrenByParent(map);
      setParentCategories(map.ROOT || []);
    });
  }, [vendorId]);

  const updateForm = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const updateVariant = (index, key, value) => {
    const updated = [...variants];
    updated[index][key] = value;
    setVariants(updated);
  };

  const addVariant = () => {
    const last = variants[variants.length - 1];
    setVariants([...variants, {
      size: last.size || "",
      color: last.color || "",
      mrp: last.mrp || "",
      price: last.price || "",
      quantity: last.quantity || "",
      barcode: last.barcode || "",
      images: [],
      imageFiles: [],
    }]);
  };

  const removeVariant = (index) => setVariants(variants.filter((_, i) => i !== index));

  const setVariantImageFiles = (index, files) => {
    const updated = [...variants];
    updated[index].imageFiles = [...(updated[index].imageFiles || []), ...files];
    setVariants(updated);
  };

  const removeImageFile = (variantIndex, imgIndex) => {
    const updated = [...variants];
    updated[variantIndex].imageFiles = updated[variantIndex].imageFiles.filter((_, i) => i !== imgIndex);
    setVariants(updated);
  };

  const uploadImages = async (files = []) => {
    if (!files.length) return [];
    const formData = new FormData();
    files.forEach((f) => formData.append("image", f));
    try {
      const res = await fetch(`${API_API_BASE_URL}/upload`, { method: "POST", body: formData });
      const contentType = res.headers.get("content-type") || "";
      const raw = await res.text();
      const data = contentType.includes("application/json")
        ? JSON.parse(raw || "{}")
        : null;

      if (res.ok && data?.success) return data.image_urls || [];

      const fallback = !res.ok
        ? `Upload failed (${res.status})`
        : "Upload failed";
      const message =
        data?.error ||
        data?.message ||
        (raw && raw.slice(0, 180)) ||
        fallback;
      alert(message);
      return [];
    } catch (err) {
      console.error(err);
      alert("Upload error. Please check backend/CORS and try again.");
      return [];
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.category_id) { alert("Please select a final category"); return; }
    setLoading(true);
    try {
      const preparedVariants = await Promise.all(
        variants.map(async (v) => {
          const uploadedImages = await uploadImages(v.imageFiles || []);
          return { size: v.size, color: v.color, mrp: Number(v.mrp || 0),
            price: Number(v.price || 0), quantity: Number(v.quantity || 0),
            barcode: (v.barcode || "").trim() || null,
            images: uploadedImages };
        })
      );
      const payload = {
        product: { vendor_id: vendorId, category_id: form.category_id, brand: form.brand,
          name: form.name, short_description: form.short_description,
          full_description: form.full_description, is_try_enabled: form.is_try_enabled,
          store_id: null },
        variants: preparedVariants,
        bundleOffers: Object.entries(bundleOffers)
          .filter(([_, enabled]) => enabled)
          .map(([key, _]) => {
            const mapping = {
              buy_2_at_999: { quantity_min: 2, quantity_max: 2, discount_value: 999 },
              buy_3_at_999: { quantity_min: 3, quantity_max: 3, discount_value: 999 },
              buy_4_at_999: { quantity_min: 4, quantity_max: null, discount_value: 999 },
            };
            return mapping[key] || {};
          }),
      };
      const res = await fetch(`${API_API_BASE_URL}/products/create`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) { alert(`Failed: ${data.message || "Unable to create product"}`); return; }
      alert("Product added successfully!");
      setForm({ brand: "", name: "", short_description: "", full_description: "", category_id: "", is_try_enabled: true });
      setVariants([{ size: "M", color: "Black", mrp: "", price: "", quantity: "", barcode: "", images: [], imageFiles: [] }]);
      setBundleOffers({ buy_2_at_999: false, buy_3_at_999: false, buy_4_at_999: false });
      setSelectedParent(""); setSelectedChild("");
      setChildCategories([]); setSubChildCategories([]);
    } catch (err) { console.error(err); alert("Server error while creating product");
    } finally { setLoading(false); }
  };

  const finalCategoryName = categories.find((c) => c.id === form.category_id)?.name || "";

  const handleMenuClick = (item) => {
    if (item.key === "stock") navigate("/vendor/stock-monitoring");
    if (item.key === "analytics") navigate("/vendor/product-analytics");
    if (item.key === "products") navigate("/vendor/add-product");
    if (item.key === "orders") navigate("/vendor/orders");
  };

  return (
    <>
      {loading && (
        <div className="loader-overlay">
          <div className="loader-box"><p>Uploading and saving...</p><div className="spinner"></div></div>
        </div>
      )}

      <VendorLayout activeKey="products" storeName={storeName} onMenuClick={handleMenuClick}>
        <main className="add-product-page">
          <div className="add-product-card">
            <div className="add-product-topbar">
              <div><h2>Add New Product</h2><p>Fill the details to list your product</p></div>
            </div>

            <form onSubmit={handleSubmit}>
              {/* ── 1. Basic Details ──────────────────────────────────── */}
              <section className="form-section">
                <h4>1. Basic Product Details</h4>
                <div className="input-grid">
                  <select value={selectedParent} onChange={(e) => {
                    const id = e.target.value; setSelectedParent(id); setSelectedChild("");
                    const children = getChildren(id);
                    setChildCategories(children); setSubChildCategories([]);
                    updateForm("category_id", children.length ? "" : id);
                  }}>
                    <option value="">Select Main Category</option>
                    {parentCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  <select value={selectedChild} onChange={(e) => {
                    const id = e.target.value; setSelectedChild(id);
                    const sub = getChildren(id); setSubChildCategories(sub);
                    updateForm("category_id", sub.length ? "" : id);
                  }}>
                    <option value="">Select Sub Category</option>
                    {childCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>

                  {subChildCategories.length > 0 && (
                    <select value={form.category_id} onChange={(e) => updateForm("category_id", e.target.value)}>
                      <option value="">Select Final Category</option>
                      {subChildCategories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  )}

                  <input placeholder="Product Name *" required value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)} />

                  <input list="brand-options" placeholder="Brand" value={form.brand}
                    onChange={(e) => updateForm("brand", e.target.value)} />
                  <datalist id="brand-options">
                    {brands.map((b) => <option key={b.id} value={b.name} />)}
                  </datalist>

                  <input placeholder="Short Description" value={form.short_description}
                    onChange={(e) => updateForm("short_description", e.target.value)} />

                  <textarea className="full-width" rows={3} placeholder="Full Description"
                    value={form.full_description} onChange={(e) => updateForm("full_description", e.target.value)} />
                </div>
              </section>

              {/* ── 2. Variants ──────────────────────────────────────── */}
              <section className="form-section">
                <h4>2. Variants, Pricing &amp; Inventory</h4>
                {variants.map((v, i) => (
                  <div key={i} className="variant-block">
                    <div className="variant-block-header">
                      <strong>Variant {i + 1}</strong>
                      {variants.length > 1 && (
                        <button type="button" className="remove-btn" onClick={() => removeVariant(i)}>✕ Remove</button>
                      )}
                    </div>
                    <div className="variant-box variant-box-extended">
                      <input placeholder="Size *" value={v.size} onChange={(e) => updateVariant(i, "size", e.target.value)} />
                      <input placeholder="Color *" value={v.color} onChange={(e) => updateVariant(i, "color", e.target.value)} />
                      <input type="number" min="0" placeholder="MRP (original price)" value={v.mrp}
                        onChange={(e) => updateVariant(i, "mrp", e.target.value)} />
                      <input type="number" min="0" placeholder="Selling Price *" value={v.price}
                        onChange={(e) => updateVariant(i, "price", e.target.value)} />
                      <input type="number" min="0" placeholder="Stock Quantity" value={v.quantity}
                        onChange={(e) => updateVariant(i, "quantity", e.target.value)} />
                    </div>
                    <div className="barcode-row">
                      <input
                        className="barcode-input"
                        placeholder="Barcode (optional)"
                        value={v.barcode || ""}
                        onChange={(e) => updateVariant(i, "barcode", e.target.value)}
                      />
                      <button
                        type="button"
                        className="barcode-gen-btn"
                        onClick={() => {
                          const ts = Date.now().toString(36).toUpperCase();
                          const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
                          updateVariant(i, "barcode", `BF-${ts}-${rand}`);
                        }}
                      >
                        ⚡ Generate
                      </button>
                    </div>
                    <div className="variant-image-row">
                      <label className="image-upload-label">
                        <input type="file" multiple accept="image/*"
                          onChange={(e) => setVariantImageFiles(i, [...(e.target.files || [])])} />
                        + Add Images
                      </label>
                      <small>First image = primary.</small>
                    </div>
                    {v.imageFiles?.length > 0 && (
                      <div className="variant-preview-row">
                        {v.imageFiles.map((img, idx) => (
                          <div key={`${i}-${idx}`} className="preview-thumb">
                            <img src={URL.createObjectURL(img)} height="70" alt="preview" />
                            <button type="button" className="remove-img-btn" onClick={() => removeImageFile(i, idx)}>✕</button>
                            {idx === 0 && <span className="primary-badge">Primary</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
                <button type="button" className="add-variant-btn" onClick={addVariant}>+ Add Another Variant</button>
              </section>

              {/* ── 3. Bundle Pricing Offers (Optional) ────────────────────────────── */}
              <section className="form-section">
                <h4>3. Bundle Pricing Offers (Optional) - Buy More, Save More</h4>
                <p style={{ fontSize: "12px", color: "#666", marginBottom: "12px" }}>
                  Enable special bundle pricing for customers who buy multiple items (e.g., Buy 2 at ₹999, Buy 3 at ₹999)
                </p>
                <div className="toggle-row">
                  <label>
                    <input type="checkbox" checked={bundleOffers.buy_2_at_999}
                      onChange={(e) => setBundleOffers({ ...bundleOffers, buy_2_at_999: e.target.checked })} />
                    Buy 2 at ₹999
                  </label>
                </div>
                <div className="toggle-row">
                  <label>
                    <input type="checkbox" checked={bundleOffers.buy_3_at_999}
                      onChange={(e) => setBundleOffers({ ...bundleOffers, buy_3_at_999: e.target.checked })} />
                    Buy 3 at ₹999
                  </label>
                </div>
                <div className="toggle-row">
                  <label>
                    <input type="checkbox" checked={bundleOffers.buy_4_at_999}
                      onChange={(e) => setBundleOffers({ ...bundleOffers, buy_4_at_999: e.target.checked })} />
                    Buy 4+ at ₹999
                  </label>
                </div>
              </section>

              <div className="summary-line">
                <strong>Final Category:</strong> {finalCategoryName || "Not selected"}
              </div>

              <div className="summary-line">
                <strong>Vendor:</strong> {storeName || "My Store"}
              </div>

              <button className="submit-btn" type="submit" disabled={loading}>
                {loading ? "Uploading & Saving..." : "Submit Product"}
              </button>
            </form>
          </div>
        </main>
      </VendorLayout>
    </>
  );
}
