import "./addproduct.css";
import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";
import { API_API_BASE_URL } from "../apiBase";

export default function AddProduct() {
const [loading, setLoading] = useState(false);
  /* ================= VENDOR ================= */
  const [vendorId, setVendorId] = useState("");

  /* ================= IMAGES ================= */
  const [images, setImages] = useState([]);
  const [imageUrls, setImageUrls] = useState([]);

  /* ================= DROPDOWN ================= */
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

  /* ================= FORM ================= */
  const [form, setForm] = useState({
    name: "",
    description: "",
    gender: "Women",
    material: "",
    brand_id: "",
    category_id: ""
  });

  /* ================= VARIANTS ================= */
  const [variants, setVariants] = useState([
    { size: "", color: "", price: "", discount_price: "", stock: "" }
  ]);

  /* ================= INIT ================= */
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

  /* ================= UPDATE FORM ================= */
  const updateForm = (key, value) => {
    setForm(prev => ({
      ...prev,
      [key]: value
    }));
  };

  /* ================= VARIANTS ================= */
  const updateVariant = (index, key, value) => {
    const updated = [...variants];
    updated[index][key] = value;
    setVariants(updated);
  };

  const addVariant = () => {
    setVariants([
      ...variants,
      { size: "", color: "", price: "", discount_price: "", stock: "" }
    ]);
  };

  const removeVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  /* ================= IMAGE UPLOAD ================= */
  const uploadImages = async () => {
    if (images.length === 0) return [];

    const formData = new FormData();

    images.forEach((file) => {
      formData.append("image", file);
    });

    try {
      const res = await fetch(
        `${API_API_BASE_URL}/upload`,
        {
          method: "POST",
          body: formData
        }
      );

      const data = await res.json();

      if (data.success) {
        setImageUrls(data.image_urls);
        return data.image_urls;
      } else {
        alert("Upload failed");
        return [];
      }

    } catch (err) {
      console.log(err);
      alert("Upload error");
      return [];
    }
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
  e.preventDefault();

  setLoading(true);   // ✅ START LOADING

  let finalImages = imageUrls;

  if (images.length > 0 && imageUrls.length === 0) {
    finalImages = await uploadImages();
  }

  const payload = {
    ...form,
    images: finalImages,
    variants,
    vendor_id: vendorId
  };

  try {
    const res = await fetch(
      `${API_API_BASE_URL}/products/create`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();

    if (data.success) {

      alert("✅ Product Added Successfully");

      // ✅ RESET FORM COMPLETELY
      setForm({
        name: "",
        description: "",
        gender: "Women",
        material: "",
        brand_id: "",
        category_id: ""
      });

      setVariants([
        { size: "", color: "", price: "", discount_price: "", stock: "" }
      ]);

      setImages([]);
      setImageUrls([]);

      setSelectedParent("");
      setSelectedChild("");

      setChildCategories([]);
      setSubChildCategories([]);

    } else {
      alert("❌ Failed: " + data.message);
    }

  } catch (err) {
    console.log(err);
    alert("❌ Server Error");
  }

  setLoading(false);  // ✅ STOP LOADING
};


  /* ================= UI ================= */


  return (
    <>

{/* ✅ GLOBAL LOADER (FULL SCREEN) */}
    {loading && (
      <div className="loader-overlay">
        <div className="loader-box">
          <p>Uploading & Saving...</p>
          <div className="spinner"></div>
        </div>
      </div>
    )}

      <Navbar />

      <div className="add-product-page">
        <div className="add-product-card">

          <h2>Add Product</h2>

          <form onSubmit={handleSubmit}>

            {/* PRODUCT */}
            <h4>Product Info</h4>

            <div className="input-grid">
              <input placeholder="Product Name"
                value={form.name} 
                onChange={(e)=>updateForm("name", e.target.value)}
                />

              <input placeholder="Material"
              value={form.material}
                onChange={(e)=>updateForm("material", e.target.value)} />

              <select 
              value={form.gender}
              onChange={(e)=>updateForm("gender", e.target.value)}>
                <option>Women</option>
                <option>Men</option>
                <option>Kids</option>
                <option>Unisex</option>
              </select>

              <textarea
                placeholder="Description"
                value={form.description}
                onChange={(e)=>updateForm("description", e.target.value)}
              />
            </div>

            {/* BRAND */}
            <h4>Brand</h4>
            <select 
            value={form.brand_id}
            onChange={(e)=>updateForm("brand_id", e.target.value)}>
              <option>Select Brand</option>
              {brands.map(b=>(
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>

            {/* CATEGORY */}
            <h4>Category</h4>

            <div className="input-grid">

              <select value={selectedParent}
                onChange={(e)=>{
                  const id=e.target.value;
                  setSelectedParent(id);
                  setSelectedChild("");

                  const children = getChildren(id);
                  setChildCategories(children);

                  const hasChildren = children.length > 0;
                  setSubChildCategories([]);

                  updateForm("category_id", hasChildren ? "" : id);
                }}>
                <option>Select Main Category</option>
                {parentCategories.map(c=>(
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

              <select value={selectedChild}
                onChange={(e)=>{
                  const id=e.target.value;
                  setSelectedChild(id);

                  const sub = getChildren(id);
                  setSubChildCategories(sub);

                  const hasSubCategories = sub.length > 0;
                  updateForm("category_id", hasSubCategories ? "" : id);
                }}>
                <option>Select Sub Category</option>
                {childCategories.map(c=>(
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
                {subChildCategories.map(c=>(
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>

            </div>

            {/* VARIANTS */}
            <h4>Variants</h4>

            {variants.map((v,i)=>(
              <div key={i} className="variant-box">

                <input placeholder="Size"
                value={v.size}
                  onChange={e=>updateVariant(i,"size",e.target.value)} />

                <input placeholder="Color"
                value={v.color}
                  onChange={e=>updateVariant(i,"color",e.target.value)} />

                <input type="number" placeholder="Price"
                value={v.price}
                  onChange={e=>updateVariant(i,"price",e.target.value)} />

                <input type="number" placeholder="Discount"
                value={v.discount_price}
                  onChange={e=>updateVariant(i,"discount_price",e.target.value)} />

                <input type="number" placeholder="Stock"
                value={v.stock}
                  onChange={e=>updateVariant(i,"stock",e.target.value)} />

                {variants.length>1 && (
                  <button type="button"
                    onClick={()=>removeVariant(i)}>✕</button>
                )}

              </div>
            ))}

            <button type="button" onClick={addVariant}>
              + Add Variant
            </button>

            {/* IMAGE */}
            <h4>Upload Images</h4>

            <input
              type="file"
              multiple
              onChange={(e)=>setImages([...e.target.files])}
            />

           <div style={{ display:"flex", gap:"10px", marginTop:"10px" }}>
  {images.map((img, i) => (
    <img
      key={i}
      src={URL.createObjectURL(img)}
      height="80"
      alt="preview"
    />
  ))}
</div>


{/* SUBMIT */}
<button
  className="submit-btn"
  disabled={loading}
>
  {loading ? "Adding Product..." : "Submit Product ✅"}
</button>


          </form>

        </div>
      </div>
    </>
  );
}
