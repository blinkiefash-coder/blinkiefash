import "./addproduct.css";
import { useState, useEffect } from "react";
import { API_API_BASE_URL } from "../apiBase";
import VendorLayout from "../components/VendorLayout";

export default function AddProduct() {
  const [loading, setLoading] = useState(false);
  const [vendorId, setVendorId] = useState("");

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

      if (!map[parentKey]) {
        map[parentKey] = [];
      }

      map[parentKey].push(category);
    });

    Object.keys(map).forEach((key) => {
      map[key].sort((a, b) => a.name.localeCompare(b.name));
    });

    return map;
  };

  const [form, setForm] = useState({
    main_category: "Men",
    sub_category: "",
    brand: "",
    name: "",
    short_description: "",
    full_description: "",
    category_id: "",
    fabric: "",
    fit: "",
    pattern: "",
    sleeve_type: "",
    neck_type: "",
    occasion: "",
    season: "",
    age_group: "",
    tags: "",
    is_delivery_available: true,
    is_store_available: true,
    is_try_enabled: true,
  });

  const [variants, setVariants] = useState([
    {
      size: "M",
      color: "Black",
      color_code: "#000000",
      mrp: "",
      price: "",
      discount_price: "",
      low_stock_alert: "10",
      images: [],
      imageFiles: [],
    },
  ]);

  useEffect(() => {
    const id = localStorage.getItem("vendor_id");

    if (!id) {
      window.location.href = "/vendor";
    } else {
      setVendorId(id);
    }

    fetch(`${API_API_BASE_URL}/brands`)
      .then(res => res.json())
      .then(data => setBrands(data));

    fetch(`${API_API_BASE_URL}/categories`)
      .then(res => res.json())
      .then(data => {
        setCategories(data);
        const map = buildChildrenMap(data);
        setChildrenByParent(map);

        const parents = map.ROOT || [];
        setParentCategories(parents);
      });
  }, []);

  const updateForm = (key, value) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const updateVariant = (index, key, value) => {
    const updated = [...variants];
    updated[index][key] = value;
    setVariants(updated);
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      {
        size: "",
        color: "",
        color_code: "",
        mrp: "",
        price: "",
        discount_price: "",
        low_stock_alert: "10",
        images: [],
        imageFiles: [],
      },
    ]);
  };

  const removeVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  const setVariantImageFiles = (index, files) => {
    const updated = [...variants];
    updated[index].imageFiles = files;
    setVariants(updated);
  };

  const uploadImages = async (files = []) => {
    if (!files.length) return [];

    const formData = new FormData();
    files.forEach((file) => {
      formData.append("image", file);
    });

    try {
      const res = await fetch(`${API_API_BASE_URL}/upload`, {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (data.success) return data.image_urls || [];
      alert("Upload failed");
      return [];
    } catch (err) {
      console.log(err);
      alert("Upload error");
      return [];
    }
  };

  const normalizeMainCategory = (value) => {
    if (!value) return "Men";
    const v = String(value).trim().toLowerCase();
    if (v === "home-living") return "Home";
    return v.charAt(0).toUpperCase() + v.slice(1);
  };

  const tagsArray = (value) =>
    String(value || "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!form.category_id) {
      alert("Please select a final category");
      return;
    }

    setLoading(true);

    try {
      const preparedVariants = await Promise.all(
        variants.map(async (variant) => {
          const uploadedImages = await uploadImages(variant.imageFiles || []);
          return {
            size: variant.size,
            color: variant.color,
            color_code: variant.color_code,
            mrp: Number(variant.mrp || 0),
            price: Number(variant.price || 0),
            discount_price: Number(variant.discount_price || 0),
            low_stock_alert: Number(variant.low_stock_alert || 10),
            images: uploadedImages,
          };
        })
      );

      const payload = {
        product: {
          vendor_id: vendorId,
          category_id: form.category_id,
          main_category: normalizeMainCategory(form.main_category),
          sub_category: form.sub_category,
          brand: form.brand,
          name: form.name,
          short_description: form.short_description,
          full_description: form.full_description,
          fabric: form.fabric,
          fit: form.fit,
          pattern: form.pattern,
          sleeve_type: form.sleeve_type,
          neck_type: form.neck_type,
          occasion: form.occasion,
          season: form.season,
          age_group: form.age_group || null,
          tags: tagsArray(form.tags),
          is_delivery_available: form.is_delivery_available,
          is_store_available: form.is_store_available,
          is_try_enabled: form.is_try_enabled,
        },
        variants: preparedVariants,
      };

      const res = await fetch(`${API_API_BASE_URL}/products/create-full`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!data.success) {
        alert(`Failed: ${data.message || "Unable to create product"}`);
        return;
      }

      alert("Product added successfully");

      setForm({
        main_category: "Men",
        sub_category: "",
        brand: "",
        name: "",
        short_description: "",
        full_description: "",
        category_id: "",
        fabric: "",
        fit: "",
        pattern: "",
        sleeve_type: "",
        neck_type: "",
        occasion: "",
        season: "",
        age_group: "",
        tags: "",
        is_delivery_available: true,
        is_store_available: true,
        is_try_enabled: true,
      });
      setVariants([
        {
          size: "M",
          color: "Black",
          color_code: "#000000",
          mrp: "",
          price: "",
          discount_price: "",
          low_stock_alert: "10",
          images: [],
          imageFiles: [],
        },
      ]);
      setSelectedParent("");
      setSelectedChild("");
      setChildCategories([]);
      setSubChildCategories([]);
    } catch (err) {
      console.log(err);
      alert("Server error while creating product");
    } finally {
      setLoading(false);
    }
  };

  const finalCategoryName = categories.find((c) => c.id === form.category_id)?.name || "";


  return (
    <>
      {loading && (
        <div className="loader-overlay">
          <div className="loader-box">
            <p>Uploading and saving...</p>
            <div className="spinner"></div>
          </div>
        </div>
      )}

      <VendorLayout activeKey="products" storeName="Trendy Looks">
        <main className="add-product-page">
          <div className="add-product-card">
            <div className="add-product-topbar">
              <div>
                <h2>Add New Product</h2>
                <p>Fill the details to list your product</p>
              </div>
              <button type="button" className="draft-btn">Save as Draft</button>
            </div>

            <div className="add-product-steps">
              <div className="step-item active"><span>1</span>Product Info</div>
              <div className="step-item"><span>2</span>Variants & Inventory</div>
              <div className="step-item"><span>3</span>Delivery & Review</div>
            </div>

            <form onSubmit={handleSubmit}>
              <section className="form-section">
                <h4>1. Basic Product Details</h4>

                <div className="input-grid">
                  <select
                    value={form.main_category}
                    onChange={(e) => updateForm("main_category", e.target.value)}
                  >
                    <option>Men</option>
                    <option>Women</option>
                    <option>Kids</option>
                    <option>Home</option>
                    <option>Beauty</option>
                  </select>

                  <input
                    placeholder="Subcategory (e.g. Casual Wear)"
                    value={form.sub_category}
                    onChange={(e) => updateForm("sub_category", e.target.value)}
                  />

                  <select
                    value={selectedParent}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedParent(id);
                      setSelectedChild("");

                      const children = getChildren(id);
                      setChildCategories(children);

                      const hasChildren = children.length > 0;
                      setSubChildCategories([]);

                      updateForm("category_id", hasChildren ? "" : id);
                    }}>
                    <option>Select Main Category</option>
                    {parentCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={selectedChild}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedChild(id);

                      const sub = getChildren(id);
                      setSubChildCategories(sub);

                      const hasSubCategories = sub.length > 0;
                      updateForm("category_id", hasSubCategories ? "" : id);
                    }}>
                    <option>Select Sub Category</option>
                    {childCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <select
                    value={form.category_id}
                    onChange={(e)=>updateForm("category_id", e.target.value)}
                    disabled={subChildCategories.length === 0}
                  >
                    <option>
                      {subChildCategories.length > 0
                        ? "Select Final Category"
                        : "No deeper category available"}
                    </option>
                    {subChildCategories.map((c) => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>

                  <input
                    placeholder="Product Name"
                    value={form.name}
                    onChange={(e) => updateForm("name", e.target.value)}
                  />

                  <input
                    list="brand-options"
                    placeholder="Brand"
                    value={form.brand}
                    onChange={(e) => updateForm("brand", e.target.value)}
                  />
                  <datalist id="brand-options">
                    {brands.map((b) => (
                      <option key={b.id} value={b.name} />
                    ))}
                  </datalist>

                  <input
                    placeholder="Short Description"
                    value={form.short_description}
                    onChange={(e) => updateForm("short_description", e.target.value)}
                  />

                  <textarea
                    className="full-width"
                    placeholder="Full Description"
                    value={form.full_description}
                    onChange={(e) => updateForm("full_description", e.target.value)}
                  />
                </div>
              </section>

              <section className="form-section">
                <h4>2. Product Attributes</h4>
                <div className="input-grid">
                  <input placeholder="Fabric" value={form.fabric} onChange={(e) => updateForm("fabric", e.target.value)} />
                  <input placeholder="Fit" value={form.fit} onChange={(e) => updateForm("fit", e.target.value)} />
                  <input placeholder="Pattern" value={form.pattern} onChange={(e) => updateForm("pattern", e.target.value)} />
                  <input placeholder="Sleeve Type" value={form.sleeve_type} onChange={(e) => updateForm("sleeve_type", e.target.value)} />
                  <input placeholder="Neck Type" value={form.neck_type} onChange={(e) => updateForm("neck_type", e.target.value)} />
                  <input placeholder="Occasion" value={form.occasion} onChange={(e) => updateForm("occasion", e.target.value)} />
                  <input placeholder="Season" value={form.season} onChange={(e) => updateForm("season", e.target.value)} />
                  <input placeholder="Age Group (optional)" value={form.age_group} onChange={(e) => updateForm("age_group", e.target.value)} />
                  <input
                    className="full-width"
                    placeholder="Tags (comma separated, e.g. casual,summer,new)"
                    value={form.tags}
                    onChange={(e) => updateForm("tags", e.target.value)}
                  />
                </div>
              </section>

              <section className="form-section">
                <h4>3. Store Availability</h4>
                <div className="toggle-row">
                  <label>
                    <input
                      type="checkbox"
                      checked={form.is_delivery_available}
                      onChange={(e) => updateForm("is_delivery_available", e.target.checked)}
                    />
                    Available for Delivery
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.is_store_available}
                      onChange={(e) => updateForm("is_store_available", e.target.checked)}
                    />
                    Available in Store
                  </label>
                  <label>
                    <input
                      type="checkbox"
                      checked={form.is_try_enabled}
                      onChange={(e) => updateForm("is_try_enabled", e.target.checked)}
                    />
                    Try and Buy Eligible
                  </label>
                </div>
              </section>

              <section className="form-section">
                <h4>4. Variants, Pricing and Inventory</h4>

                {variants.map((v, i) => (
                  <div key={i} className="variant-block">
                    <div className="variant-box variant-box-extended">
                      <input placeholder="Size" value={v.size} onChange={(e) => updateVariant(i, "size", e.target.value)} />
                      <input placeholder="Color" value={v.color} onChange={(e) => updateVariant(i, "color", e.target.value)} />
                      <input placeholder="Color Code (#000000)" value={v.color_code} onChange={(e) => updateVariant(i, "color_code", e.target.value)} />
                      <input type="number" placeholder="MRP" value={v.mrp} onChange={(e) => updateVariant(i, "mrp", e.target.value)} />
                      <input type="number" placeholder="Selling Price" value={v.price} onChange={(e) => updateVariant(i, "price", e.target.value)} />
                      <input type="number" placeholder="Discount Price" value={v.discount_price} onChange={(e) => updateVariant(i, "discount_price", e.target.value)} />
                      <input type="number" placeholder="Low Stock Alert" value={v.low_stock_alert} onChange={(e) => updateVariant(i, "low_stock_alert", e.target.value)} />
                      {variants.length > 1 ? (
                        <button type="button" className="remove-btn" onClick={() => removeVariant(i)}>✕</button>
                      ) : (
                        <span />
                      )}
                    </div>

                    <div className="variant-image-row">
                      <input
                        type="file"
                        multiple
                        onChange={(e) => setVariantImageFiles(i, [...(e.target.files || [])])}
                      />
                      <small>Upload variant images (first image becomes primary)</small>
                    </div>

                    {v.imageFiles?.length ? (
                      <div className="variant-preview-row">
                        {v.imageFiles.map((img, idx) => (
                          <img key={`${i}-${idx}`} src={URL.createObjectURL(img)} height="70" alt="variant preview" />
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}

                <button type="button" className="add-variant-btn" onClick={addVariant}>
                  + Add Variant
                </button>
              </section>

              <div className="summary-line">
                <strong>Final Category:</strong> {finalCategoryName || "Not selected"}
              </div>

              <button className="submit-btn" disabled={loading}>
                {loading ? "Saving Product..." : "Submit Product"}
              </button>
            </form>

          </div>
        </main>
      </VendorLayout>
    </>
  );
}
