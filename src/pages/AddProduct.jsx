import "./addproduct.css";
import { useState, useEffect } from "react";
import { API_API_BASE_URL } from "../apiBase";
import VendorLayout from "../components/VendorLayout";

export default function AddProduct() {
  const [loading, setLoading] = useState(false);
  const [vendorId] = useState(() => localStorage.getItem("vendor_id") || "");

  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});
  const [darkStores, setDarkStores] = useState([]);

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
    store_id: "",
    is_try_enabled: true,
  });

  const [variants, setVariants] = useState([
    { size: "M", color: "Black", mrp: "", price: "", quantity: "", images: [], imageFiles: [] },
  ]);

  useEffect(() => {
    if (!vendorId) { window.location.href = "/vendor"; return; }
    fetch(`${API_API_BASE_URL}/brands`).then(r => r.json()).then(d => setBrands(d));
    fetch(`${API_API_BASE_URL}/checkout/darkstores`).then(r => r.json()).then(d => setDarkStores(d.stores || []));
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

  const addVariant = () => setVariants([...variants,
    { size: "", color: "", mrp: "", price: "", quantity: "", images: [], imageFiles: [] }]);

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
      const data = await res.json();
      if (data.success) return data.image_urls || [];
      alert(data.error || data.message || "Upload failed");
      return [];
    } catch (err) { console.error(err); alert("Upload error"); return []; }
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
            price: Number(v.price || 0), quantity: Number(v.quantity || 0), images: uploadedImages };
        })
      );
      const payload = {
        product: { vendor_id: vendorId, category_id: form.category_id, brand: form.brand,
          name: form.name, short_description: form.short_description,
          full_description: form.full_description, is_try_enabled: form.is_try_enabled,
          store_id: form.store_id || null },
        variants: preparedVariants,
      };
      const res = await fetch(`${API_API_BASE_URL}/products/create`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!data.success) { alert(`Failed: ${data.message || "Unable to create product"}`); return; }
      alert("Product added successfully!");
      setForm({ brand: "", name: "", short_description: "", full_description: "", category_id: "", store_id: "", is_try_enabled: true });
      setVariants([{ size: "M", color: "Black", mrp: "", price: "", quantity: "", images: [], imageFiles: [] }]);
      setSelectedParent(""); setSelectedChild("");
      setChildCategories([]); setSubChildCategories([]);
    } catch (err) { console.error(err); alert("Server error while creating product");
    } finally { setLoading(false); }
  };

  const finalCategoryName = categories.find((c) => c.id === form.category_id)?.name || "";

  return (
    <>
      {loading && (
        <div className="loader-overlay">
          <div className="loader-box"><p>Uploading and saving...</p><div className="spinner"></div></div>
        </div>
      )}

      <VendorLayout activeKey="products" storeName="Trendy Looks">
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

              {/* ── 2. Dark Store & Availability ───────────────────────────── */}
              <section className="form-section">
                <h4>2. Dark Store &amp; Availability</h4>
                <div className="input-grid">
                  <select value={form.store_id} onChange={(e) => updateForm("store_id", e.target.value)}>
                    <option value="">Select Dark Store (optional)</option>
                    {darkStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — {s.city}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="toggle-row">
                  <label>
                    <input type="checkbox" checked={form.is_try_enabled}
                      onChange={(e) => updateForm("is_try_enabled", e.target.checked)} />
                    Try and Buy Eligible
                  </label>
                </div>
              </section>

              {/* ── 3. Variants ──────────────────────────────────────── */}
              <section className="form-section">
                <h4>3. Variants, Pricing &amp; Inventory</h4>
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

              <div className="summary-line">
                <strong>Final Category:</strong> {finalCategoryName || "Not selected"}
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
