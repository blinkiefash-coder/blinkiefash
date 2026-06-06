import "./VendorStore.css";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Navbar from "../components/Navbar";
import logo from "../assets/logo.png";
import { API_API_BASE_URL } from "../apiBase";

const API_BASE = API_API_BASE_URL;

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

export default function VendorStore() {
  const navigate = useNavigate();
  const { identifier } = useParams();

  const [vendor, setVendor] = useState(null);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const [brandSearchTerm, setBrandSearchTerm] = useState("");
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeBrand, setActiveBrand] = useState(null);
  const [sortBy, setSortBy] = useState("popularity");
  const [selectedPriceBand, setSelectedPriceBand] = useState("all");
  const [userCoords, setUserCoords] = useState(null);
  const [locationLabel, setLocationLabel] = useState("Detecting location...");
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    const loadVendorData = async () => {
      try {
        const vendorResponse = await fetch(`${API_BASE}/vendor/${identifier}`);
        if (!vendorResponse.ok) throw new Error("Vendor not found");

        const vendorData = await vendorResponse.json();
        setVendor(vendorData);

        const [productsResponse, categoriesResponse, brandsResponse] = await Promise.all([
          fetch(`${API_BASE}/vendor/${vendorData.id}/products`),
          fetch(`${API_BASE}/categories`),
          fetch(`${API_BASE}/brands`),
        ]);

        const productsData = await productsResponse.json();
        const categoriesData = await categoriesResponse.json();
        const brandsData = await brandsResponse.json();

        setProducts(Array.isArray(productsData) ? productsData : []);
        const safeCategories = Array.isArray(categoriesData) ? categoriesData : [];
        setCategories(safeCategories);
        setChildrenByParent(buildChildrenMap(safeCategories));
        setBrands(Array.isArray(brandsData) ? brandsData : []);
      } catch (err) {
        console.error("Failed to load vendor store:", err);
        setError("Unable to load store right now.");
      } finally {
        setLoading(false);
      }
    };

    loadVendorData();
  }, [identifier]);

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocationLabel("Location unavailable");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        setLocationLabel("Current location");
      },
      () => setLocationLabel("Location unavailable"),
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 60000 }
    );
  }, []);

  const getChildren = (parentId) => childrenByParent[parentId] || [];

  const getDescendantCategoryIds = (categoryId) => {
    if (!categoryId) return [];
    const ids = [categoryId];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      getChildren(currentId).forEach((child) => {
        ids.push(child.id);
        queue.push(child.id);
      });
    }

    return ids;
  };

  const getDistanceFromUserKm = (lat, lng) => {
    if (!userCoords || lat == null || lng == null) return null;
    const storeLat = Number(lat);
    const storeLng = Number(lng);
    if (Number.isNaN(storeLat) || Number.isNaN(storeLng)) return null;

    const toRad = (deg) => (deg * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(storeLat - userCoords.lat);
    const dLng = toRad(storeLng - userCoords.lng);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(userCoords.lat)) * Math.cos(toRad(storeLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return earthRadiusKm * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
  };

  const rootCategories = useMemo(() => {
    const rootList = categories.filter((category) => !category.parent_id);
    const categoryIdsWithProducts = new Set(products.map((product) => product.category_id));

    return rootList.filter((rootCategory) => {
      const descendants = new Set(getDescendantCategoryIds(rootCategory.id));
      for (const id of categoryIdsWithProducts) {
        if (descendants.has(id)) return true;
      }
      return false;
    });
  }, [categories, products, childrenByParent]);

  const selectedCategoryIds = activeCategoryId ? new Set(getDescendantCategoryIds(activeCategoryId)) : null;

  const filteredProducts = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();

    return products
      .filter((product) => {
        const matchesSearch =
          search.length === 0 ||
          product.name?.toLowerCase().includes(search) ||
          product.brand_name?.toLowerCase().includes(search) ||
          product.category_name?.toLowerCase().includes(search);

        const matchesCategory =
          !selectedCategoryIds ||
          (product.category_id && selectedCategoryIds.has(product.category_id));

        const matchesBrand =
          !activeBrand ||
          product.brand_name?.toLowerCase() === activeBrand.toLowerCase();

        const price = Number(product.discount_price || product.price || 0);
        const matchesPriceBand =
          selectedPriceBand === "all" ||
          (selectedPriceBand === "under-1000" && price < 1000) ||
          (selectedPriceBand === "1000-2500" && price >= 1000 && price <= 2500) ||
          (selectedPriceBand === "2500-5000" && price > 2500 && price <= 5000) ||
          (selectedPriceBand === "5000-plus" && price > 5000);

        return matchesSearch && matchesCategory && matchesBrand && matchesPriceBand;
      })
      .sort((a, b) => {
        if (sortBy === "price-low") return Number(a.discount_price || a.price || 0) - Number(b.discount_price || b.price || 0);
        if (sortBy === "price-high") return Number(b.discount_price || b.price || 0) - Number(a.discount_price || a.price || 0);
        return Number(b.id) - Number(a.id);
      });
  }, [products, searchTerm, selectedCategoryIds, activeBrand, selectedPriceBand, sortBy]);

  const groupedProducts = useMemo(() => {
    const groups = new Map();

    filteredProducts.forEach((product) => {
      const categoryName = product.category_name || "Other";
      if (!groups.has(categoryName)) groups.set(categoryName, []);
      groups.get(categoryName).push(product);
    });

    return Array.from(groups.entries()).map(([name, items]) => ({ name, items }));
  }, [filteredProducts]);

  const mainCategories = useMemo(() => {
    const map = new Map();
    categories.forEach((category) => map.set(category.id, category));

    return groupedProducts
      .map((group) => {
        const sample = products.find((product) => (product.category_name || "Other") === group.name);
        const category = sample?.category_id ? map.get(sample.category_id) : null;
        const rootCategory = (() => {
          let current = category;
          while (current?.parent_id) {
            current = map.get(current.parent_id);
          }
          return current;
        })();

        return {
          id: rootCategory?.id || group.name,
          name: rootCategory?.name || group.name,
          count: group.items.length,
        };
      })
      .filter((item, index, array) => array.findIndex((candidate) => String(candidate.id) === String(item.id)) === index);
  }, [groupedProducts, categories, products]);

  const clearFilters = () => {
    setSearchTerm("");
    setBrandSearchTerm("");
    setActiveCategoryId(null);
    setActiveBrand(null);
    setSelectedPriceBand("all");
    setSortBy("popularity");
  };

  const formatDistance = (distance) => (distance == null ? null : `${distance.toFixed(1)} km away`);

  const storeDistance = vendor?.lat && vendor?.lng ? getDistanceFromUserKm(vendor.lat, vendor.lng) : null;

  if (loading) {
    return (
      <div className="vendor-store-page">
        <Navbar />
        <div className="vendor-store-loading">Loading store...</div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="vendor-store-page">
        <Navbar />
        <div className="vendor-store-error">
          <h2>Store not found</h2>
          <p>{error || "This store could not be loaded."}</p>
          <button onClick={() => navigate("/explore-shops")}>Back to Explore Stores</button>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-store-page">
      <Navbar />

      <div className="vendor-store-shell">
        <aside className={`vendor-store-sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="vendor-sidebar-header">
            <button className="vendor-sidebar-back" onClick={() => navigate(-1)}>
              ← Back
            </button>
            <button className="vendor-sidebar-toggle" onClick={() => setSidebarOpen((prev) => !prev)}>
              ☰
            </button>
          </div>

          <div className="vendor-sidebar-group">
            <div className="vendor-sidebar-title">CATEGORIES</div>
            <button
              className={`vendor-sidebar-chip ${!activeCategoryId ? "active" : ""}`}
              onClick={() => setActiveCategoryId(null)}
            >
              All Products
            </button>
            {rootCategories.map((category) => (
              <button
                key={category.id}
                className={`vendor-sidebar-chip ${activeCategoryId === category.id ? "active" : ""}`}
                onClick={() => setActiveCategoryId((prev) => (prev === category.id ? null : category.id))}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="vendor-sidebar-group">
            <div className="vendor-sidebar-title">BRANDS</div>
            <input
              type="text"
              className="vendor-brand-search"
              placeholder="Search brands..."
              value={brandSearchTerm}
              onChange={(e) => setBrandSearchTerm(e.target.value)}
            />
            <div className="vendor-sidebar-list">
              {brands
                .filter((brand) =>
                  brand.name.toLowerCase().includes(brandSearchTerm.toLowerCase())
                )
                .map((brand) => (
                  <label key={brand.id} className={`vendor-sidebar-option ${activeBrand === brand.name ? "active" : ""}`}>
                    <input
                      type="checkbox"
                      checked={activeBrand === brand.name}
                      onChange={() => setActiveBrand((prev) => (prev === brand.name ? null : brand.name))}
                    />
                    <span>{brand.name}</span>
                  </label>
                ))}
            </div>
          </div>

          <div className="vendor-sidebar-group">
            <div className="vendor-sidebar-title">PRICE</div>
            <select value={selectedPriceBand} onChange={(e) => setSelectedPriceBand(e.target.value)}>
              <option value="all">All Prices</option>
              <option value="under-1000">Under ₹1,000</option>
              <option value="1000-2500">₹1,000 - ₹2,500</option>
              <option value="2500-5000">₹2,500 - ₹5,000</option>
              <option value="5000-plus">₹5,000+</option>
            </select>
          </div>

          <div className="vendor-sidebar-group">
            <div className="vendor-sidebar-title">LOCATION</div>
            <div className="vendor-location-copy">{locationLabel}</div>
            {storeDistance !== null && (
              <div className="vendor-distance-highlight">{formatDistance(storeDistance)}</div>
            )}
          </div>

          <button className="vendor-clear-btn" onClick={clearFilters}>Clear All Filters</button>
        </aside>

        <main className="vendor-store-main">
          <div className="vendor-store-hero">
            <div className="vendor-store-hero-left">
              <div className="vendor-breadcrumbs">Explore Stores &nbsp;›&nbsp; {vendor.store_name}</div>

              <div className="vendor-store-headline">
                <div className="vendor-store-logo-wrap">
                  {vendor.vendor_img_url ? (
                    <img src={vendor.vendor_img_url} alt={vendor.store_name} />
                  ) : (
                    <div className="vendor-store-logo-fallback">{vendor.store_name?.charAt(0) || "S"}</div>
                  )}
                </div>

                <div className="vendor-store-headline-copy">
                  <h1>
                    {vendor.store_name}
                    {vendor.is_verified ? <span className="vendor-verified-badge">✓</span> : null}
                  </h1>
                  <p>{vendor.description || "Premium Fashion Store"}</p>
                  <div className="vendor-store-meta-row">
                    <span>Open</span>
                    <span>• Closes 10:00 PM</span>
                    {storeDistance !== null && <span>• {storeDistance.toFixed(1)} km away</span>}
                    <span>• 100% Original Products</span>
                  </div>
                </div>
              </div>

              <div className="vendor-top-actions">
                <button className="vendor-visit-btn" onClick={() => document.getElementById("product-sections")?.scrollIntoView({ behavior: "smooth" })}>
                  Visit Store
                </button>
              </div>
            </div>

            <div className="vendor-store-sidecard">
              <div className="vendor-sidecard-title">Store Visit</div>
              <p>Visit the store to explore and buy your favorite products.</p>
              <button className="vendor-directions-btn" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${vendor.store_name} ${vendor.city || ""}`)}`, "_blank")}>Get Directions</button>
            </div>
          </div>

          <div className="vendor-toolbar">
            <input
              className="vendor-search"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search products in this store..."
            />
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="popularity">Sort by: Popular</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="newest">Newest</option>
            </select>
            <button className="vendor-toolbar-clear" onClick={clearFilters}>Clear All</button>
          </div>

          <div className="vendor-category-tabs">
            <button className={`vendor-category-tab ${!activeCategoryId ? "active" : ""}`} onClick={() => setActiveCategoryId(null)}>All</button>
            {rootCategories.map((category) => (
              <button
                key={category.id}
                className={`vendor-category-tab ${activeCategoryId === category.id ? "active" : ""}`}
                onClick={() => setActiveCategoryId((prev) => (prev === category.id ? null : category.id))}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div id="product-sections" className="vendor-product-sections">
            {groupedProducts.length === 0 ? (
              <div className="vendor-empty-state">No matching products found.</div>
            ) : (
              groupedProducts.map((group) => (
                <section key={group.name} className="vendor-product-section">
                  <div className="vendor-product-section-header">
                    <h2>{group.name}</h2>
                    <span>{group.items.length} items</span>
                  </div>
                  <div className="vendor-product-grid">
                    {group.items.map((product) => (
                      <article
                        key={product.id}
                        className="vendor-product-card"
                        onClick={() => navigate(`/product/${product.id}`)}
                        style={{ cursor: "pointer" }}
                      >
                        <div className="vendor-product-image">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.name} />
                          ) : (
                            <div className="vendor-product-fallback">{product.name?.charAt(0) || "P"}</div>
                          )}
                        </div>
                        <div className="vendor-product-copy">
                          <h3>{product.name}</h3>
                          <div className="vendor-product-brand">{product.brand_name || "Brand"}</div>
                          <div className="vendor-product-price">
                            {product.discount_price
                              ? `₹${Number(product.discount_price).toLocaleString("en-IN")}`
                              : `₹${Number(product.price).toLocaleString("en-IN")}`}
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>
                </section>
              ))
            )}
          </div>
        </main>

        <aside className="vendor-store-rail">
          <div className="vendor-rail-card">
            <div className="vendor-rail-title">Why shop from {vendor.store_name}?</div>
            <ul>
              <li>100% Original Products</li>
              <li>Easy Returns</li>
              <li>Secure Payments</li>
              <li>Customer Support</li>
            </ul>
          </div>

          <div className="vendor-rail-promo">
            <div className="vendor-rail-promo-copy">
              <strong>New Arrivals</strong>
              <span>Fresh styles just landed.</span>
            </div>
            <button onClick={() => document.getElementById("product-sections")?.scrollIntoView({ behavior: "smooth" })}>
              Explore Collection
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
}