import "./addproduct.css";
import Navbar from "../components/Navbar";
import { useState, useEffect } from "react";

export default function AddProduct() {

  /* ================= VENDOR ================= */
  const [vendorId, setVendorId] = useState("");

  /* ================= DROPDOWN DATA ================= */
  const [brands, setBrands] = useState([]);
  const [categories, setCategories] = useState([]);

  const [parentCategories, setParentCategories] = useState([]);
  const [childCategories, setChildCategories] = useState([]);
  const [subChildCategories, setSubChildCategories] = useState([]);

  const [selectedParent, setSelectedParent] = useState("");
  const [selectedChild, setSelectedChild] = useState("");

  /* ================= FORM ================= */
  const [form, setForm] = useState({
    name: "",
    description: "",
    gender: "Women",
    material: "",
    brand_id: "",
    category_id: "",
    image_url: ""
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

    /* ✅ FETCH BRANDS */
    fetch("https://blinkiefash.onrender.com/api/brands")
      .then(res => res.json())
      .then(data => setBrands(data));

    /* ✅ FETCH CATEGORIES */
    fetch("https://blinkiefash.onrender.com/api/categories")
      .then(res => res.json())
      .then(data => {
        setCategories(data);

        const parents = data.filter(c => c.parent_id === null);
        setParentCategories(parents);
      });

  }, []);

  /* ================= UPDATE FUNCTIONS ================= */
  const updateForm = (key, value) => {
    setForm(prev => ({
      ...prev,
      value     // ✅ FIXED
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
      { size: "", color: "", price: "", discount_price: "", stock: "" }
    ]);
  };

  const removeVariant = (index) => {
    setVariants(variants.filter((_, i) => i !== index));
  };

  /* ================= SUBMIT ================= */
  const handleSubmit = async (e) => {
    e.preventDefault();

    const payload = {
      ...form,
      variants,
      vendor_id: vendorId
    };

    console.log("✅ FINAL PAYLOAD →", payload);

    try {
      const res = await fetch(
        "https://blinkiefash.onrender.com/api/products/create",
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
      } else {
        alert("❌ Failed: " + data.message);
      }

    } catch (err) {
      console.log(err);
      alert("❌ Server Error");
    }
  };

  /* ================= UI ================= */
  return (
    <>
      <Navbar />

      <div className="add-product-page">
        <div className="add-product-card">

          <h2>Add Product</h2>

          <form onSubmit={handleSubmit}>

            {/* ================= PRODUCT ================= */}
            <h4>Product Info</h4>

            <div className="input-grid">

              <input
                placeholder="Product Name"
                onChange={(e) => updateForm("name", e.target.value)}
              />

              <input
                placeholder="Material"
                onChange={(e) => updateForm("material", e.target.value)}
              />

              <select
                onChange={(e) => updateForm("gender", e.target.value)}
              >
                <option>Women</option>
                <option>Men</option>
                <option>Kids</option>
                <option>Unisex</option>
              </select>

              <textarea
                className="full-width"
                placeholder="Description"
                onChange={(e) => updateForm("description", e.target.value)}
              />

            </div>

            {/* ================= BRAND ================= */}
            <h4>Brand</h4>

            <select
              onChange={(e) => updateForm("brand_id", e.target.value)}
            >
              <option value="">Select Brand</option>

              {brands.map(b => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}

            </select>

            {/* ================= CATEGORY ================= */}
            <h4>Category</h4>

            <div className="input-grid">

              {/* ✅ MAIN CATEGORY */}
              <select
                value={selectedParent}
                onChange={(e) => {
                  const parentId = e.target.value;

                  setSelectedParent(parentId);
                  setSelectedChild("");

                  const children = categories.filter(
                    c => c.parent_id === parentId
                  );

                  setChildCategories(children);
                  setSubChildCategories([]);
                }}
              >
                <option value="">Select Main Category</option>

                {parentCategories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}

              </select>

              {/* ✅ SUB CATEGORY */}
              <select
                value={selectedChild}
                onChange={(e) => {
                  const subId = e.target.value;

                  setSelectedChild(subId);

                  const subChild = categories.filter(
                    c => c.parent_id === subId
                  );

                  setSubChildCategories(subChild);
                }}
              >
                <option value="">Select Sub Category</option>

                {childCategories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}

              </select>

              {/* ✅ SUB-SUB CATEGORY */}
              <select
                onChange={(e) =>
                  updateForm("category_id", e.target.value)
                }
              >
                <option value="">Select Final Category</option>

                {subChildCategories.map(c => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}

              </select>

            </div>

            {/* ================= VARIANTS ================= */}
            <h4>Variants</h4>

            {variants.map((v, index) => (
              <div key={index} className="variant-box">

                <input
                  placeholder="Size"
                  value={v.size}
                  onChange={(e) =>
                    updateVariant(index, "size", e.target.value)
                  }
                />

                <input
                  placeholder="Color"
                  value={v.color}
                  onChange={(e) =>
                    updateVariant(index, "color", e.target.value)
                  }
                />

                <input
                  type="number"
                  placeholder="Price"
                  value={v.price}
                  onChange={(e) =>
                    updateVariant(index, "price", e.target.value)
                  }
                />

                <input
                  type="number"
                  placeholder="Discount"
                  value={v.discount_price}
                  onChange={(e) =>
                    updateVariant(index, "discount_price", e.target.value)
                  }
                />

                <input
                  type="number"
                  placeholder="Stock"
                  value={v.stock}
                  onChange={(e) =>
                    updateVariant(index, "stock", e.target.value)
                  }
                />

                {variants.length > 1 && (
                  <button
                    type="button"
                    className="remove-btn"
                    onClick={() => removeVariant(index)}
                  >
                    ✕
                  </button>
                )}

              </div>
            ))}

            <button
              type="button"
              className="add-variant-btn"
              onClick={addVariant}
            >
              + Add Variant
            </button>

            {/* ================= IMAGE ================= */}
            <h4>Image</h4>

            <input
              className="full-width"
              placeholder="Image URL"
              onChange={(e) => updateForm("image_url", e.target.value)}
            />

            {/* ================= SUBMIT ================= */}
            <button className="submit-btn" type="submit">
              Submit Product ✅
            </button>

          </form>

        </div>
      </div>
    </>
  );
}