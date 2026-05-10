import "./ExploreShops.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";

function ExploreShops() {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState("Detecting your location...");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Stores");
  const [categories, setCategories] = useState([]);
  const [childrenByParent, setChildrenByParent] = useState({});
  const [expandedCategories, setExpandedCategories] = useState({});
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [showLocationModal, setShowLocationModal] = useState(false);
  const [locationInput, setLocationInput] = useState("");
  const [loading, setLoading] = useState(true);
  const [brands, setBrands] = useState([]);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [brandSearch, setBrandSearch] = useState("");
  const [expandedBrands, setExpandedBrands] = useState(false);
  const [stores, setStores] = useState([]);
  const [storesLoading, setStoresLoading] = useState(true);

  // Fetch categories from backend
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const response = await fetch("http://localhost:5000/api/categories");
        const data = await response.json();
        
        // Build hierarchy
        const map = {};
        data.forEach((category) => {
          const parentKey = category.parent_id || "ROOT";
          if (!map[parentKey]) map[parentKey] = [];
          map[parentKey].push(category);
        });
        
        Object.keys(map).forEach((key) => {
          map[key].sort((a, b) => a.name.localeCompare(b.name));
        });
        
        setCategories(data);
        setChildrenByParent(map);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching categories:", err);
        // Fallback flat categories
        setCategories([
          { id: 1, name: "All Stores", parent_id: null },
          { id: 2, name: "Women", parent_id: null },
          { id: 3, name: "Clothing", parent_id: 2 },
          { id: 4, name: "Indian and Festive Wear", parent_id: 2 },
          { id: 5, name: "Men", parent_id: null },
          { id: 6, name: "Footwear", parent_id: null },
          { id: 7, name: "Accessories", parent_id: null }
        ]);
        setLoading(false);
      }
    };
    fetchCategories();
  }, []);

  // Fetch brands from backend
  useEffect(() => {
    fetch("http://localhost:5000/api/brands")
      .then((res) => res.json())
      .then((data) => {
        setBrands(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        console.error("Error fetching brands:", err);
        setBrands([
          { id: 1, name: "Nike" },
          { id: 2, name: "Adidas" },
          { id: 3, name: "Zara" },
          { id: 4, name: "Gucci" },
          { id: 5, name: "Prada" },
          { id: 6, name: "Valentino" }
        ]);
      });
  }, []);

  // Fetch vendors from backend
  useEffect(() => {
    const fetchVendors = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/vendor");
        const data = await res.json();
        const vendorList = Array.isArray(data) ? data : [];

        // Fetch products for each vendor
        const vendorsWithProducts = await Promise.all(
          vendorList.map(async (vendor) => {
            try {
              const pRes = await fetch(`http://localhost:5000/api/vendor/${vendor.id}/products`);
              const products = await pRes.json();
              return { ...vendor, products: Array.isArray(products) ? products : [] };
            } catch {
              return { ...vendor, products: [] };
            }
          })
        );

        setStores(vendorsWithProducts);
      } catch (err) {
        console.error("Error fetching vendors:", err);
        setStores([]);
      } finally {
        setStoresLoading(false);
      }
    };
    fetchVendors();
  }, []);

  // Get user's current location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          // In a real app, use reverse geocoding service to get address
          // For now, we'll use a placeholder
          fetchAddressFromCoordinates(latitude, longitude);
        },
        (error) => {
          console.error("Location error:", error);
          setSelectedCity("Bhubaneswar, Odisha");
        }
      );
    } else {
      setSelectedCity("Bhubaneswar, Odisha");
    }
  }, []);

  // Helper function to fetch address from coordinates
  const fetchAddressFromCoordinates = async (lat, lng) => {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`
      );
      const data = await response.json();
      const address = data.address?.city || data.address?.town || data.address?.village || "Your Location";
      const state = data.address?.state || "";
      setSelectedCity(`${address}${state ? ", " + state : ""}`);
    } catch (err) {
      console.error("Error fetching address:", err);
      setSelectedCity("Bhubaneswar, Odisha");
    }
  };

  const handleLocationChange = () => {
    if (locationInput.trim()) {
      setSelectedCity(locationInput);
      setLocationInput("");
      setShowLocationModal(false);
    }
  };

  const toggleSidebar = () => {
    setSidebarOpen(!sidebarOpen);
  };

  const toggleCategoryExpansion = (categoryId) => {
    setExpandedCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  const getChildren = (parentId) => childrenByParent[parentId] || [];

  const renderCategoryItem = (category) => {
    const children = getChildren(category.id);
    const isExpanded = expandedCategories[category.id];
    
    return (
      <div key={category.id}>
        <div className="category-item-wrapper">
          {children.length > 0 && (
            <button 
              className="category-expand-btn"
              onClick={() => toggleCategoryExpansion(category.id)}
            >
              {isExpanded ? "▼" : "▶"}
            </button>
          )}
          <button
            className={`category-item ${selectedCategory === category.name ? "active" : ""}`}
            onClick={() => setSelectedCategory(category.name)}
          >
            {category.name}
          </button>
        </div>
        {isExpanded && children.length > 0 && (
          <div className="category-children">
            {children.map(child => renderCategoryItem(child))}
          </div>
        )}
      </div>
    );
  };

  const visibleBrands = brands.filter((brand) =>
    brand.name.toLowerCase().includes(brandSearch.toLowerCase())
  );

  const distances = [
    { label: "Nearby (0 - 1 km)", value: "0-1" },
    { label: "1 - 3 km", value: "1-3" },
    { label: "3 - 5 km", value: "3-5" },
    { label: "5+ km", value: "5+" }
  ];

  const popularSearches = [
    "Nike Store",
    "Zara",
    "Sneakers",
    "Ethnic Wear",
    "Beauty Store",
    "Men Clothing",
    "Luxury"
  ];

  return (
    <div className="explore-shops">
      <Navbar />

      <div className="explore-container">
        {/* HAMBURGER TOGGLE */}
        <button className="sidebar-toggle" onClick={toggleSidebar}>
          ☰
        </button>

        {/* SIDEBAR */}
        <aside className={`explore-sidebar ${sidebarOpen ? "open" : "closed"}`}>
          <div className="sidebar-header">
            <h3 style={{ margin: 0 }}>BROWSE</h3>
            <button className="sidebar-close" onClick={toggleSidebar}>✕</button>
          </div>

          <div className="browse-section">
            <h3>CATEGORIES</h3>
            <div className="category-list">
              {loading ? (
                <p style={{ color: "#999", fontSize: "13px" }}>Loading...</p>
              ) : (
                categories
                  .filter(cat => !cat.parent_id)
                  .map(cat => renderCategoryItem(cat))
              )}
            </div>
          </div>

          <div className="brands-section">
            <button
              className="section-header-btn"
              onClick={() => setExpandedBrands(!expandedBrands)}
            >
              <h3>BRANDS</h3>
              <span className="expand-icon">{expandedBrands ? "−" : "+"}</span>
            </button>
            {expandedBrands && (
              <>
                <input
                  type="text"
                  className="brand-search-input"
                  placeholder="Search brands..."
                  value={brandSearch}
                  onChange={(e) => setBrandSearch(e.target.value)}
                />
                <div className="brands-list">
                  {visibleBrands.slice(0, 6).map((brand) => (
                    <label key={brand.id} className={`brand-option ${selectedBrand === brand.name ? "active" : ""}`}>
                      <input
                        type="checkbox"
                        checked={selectedBrand === brand.name}
                        onChange={() => setSelectedBrand(selectedBrand === brand.name ? null : brand.name)}
                      />
                      <span>{brand.name}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="distance-section">
            <h3>DISTANCE</h3>
            <div className="distance-list">
              {distances.map((dist) => (
                <label key={dist.value} className="distance-item">
                  <input type="radio" name="distance" value={dist.value} />
                  <span>{dist.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="clear-filters">Clear All Filters</button>
        </aside>

        {sidebarOpen && <div className="sidebar-overlay" onClick={toggleSidebar}></div>}

        {/* MAIN CONTENT */}
        <main className="explore-main">
          {/* HEADER */}
          <div className="explore-header">
            <h1>Explore Stores Near You</h1>
            <div className="header-controls">
              <button className="location-selector" onClick={() => setShowLocationModal(true)}>
                📍 {selectedCity}
              </button>
              <select className="sort-selector">
                <option>Sort by: Nearest</option>
                <option>Sort by: Rating</option>
                <option>Sort by: Newest</option>
              </select>
            </div>
            <p className="store-count">{storesLoading ? "Loading stores..." : `${stores.length} stores found`}</p>
          </div>

          {/* SEARCH */}
          <div className="explore-search">
            <input
              type="text"
              placeholder="Search stores, brands, styles, categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="search-btn">🔍</button>
          </div>

          {/* POPULAR SEARCHES */}
          <div className="popular-searches">
            <span className="label">Popular searches:</span>
            <div className="search-tags">
              {popularSearches.map((search) => (
                <button key={search} className="search-tag">
                  {search}
                </button>
              ))}
            </div>
          </div>

          {/* STORES GRID */}
          <div className="stores-grid">
            {storesLoading ? (
              <p style={{ color: "#999", padding: "24px 0" }}>Loading stores...</p>
            ) : stores.length === 0 ? (
              <p style={{ color: "#999", padding: "24px 0" }}>No stores found in your area.</p>
            ) : (
              stores.map((store) => (
                <div key={store.id} className="store-card">

                  {/* Store Photo */}
                  <div className="store-image-container">
                    {store.vendor_img_url ? (
                      <img src={store.vendor_img_url} alt={store.store_name} className="store-image" />
                    ) : (
                      <div className="store-image-placeholder">
                        <span>{store.store_name?.charAt(0) || "S"}</span>
                      </div>
                    )}
                  </div>

                  {/* Store Info */}
                  <div className="store-identity">
                    <div className="store-details">
                      <div className="store-name-badge">
                        <span>{store.store_name?.toUpperCase()}</span>
                      </div>
                      <h3>{store.store_name}{store.is_verified ? <span className="verified-badge" aria-label="Verified" title="Verified">✓</span> : ""}</h3>
                      <span className="store-category">{store.description || "Fashion Store"}</span>
                      <div className="store-status">
                        {store.is_active ? (
                          <><span className="open-status">Open</span><span className="close-time"> · Closes 10:00 PM</span></>
                        ) : (
                          <span className="closed-status">Closed</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Products Row */}
                  <div className="store-products">
                    {store.products.length > 0 ? store.products.map((product, idx) => (
                      <div key={idx} className="product-preview">
                        <div className="product-image">
                          {product.image_url ? (
                            <img
                              src={product.image_url}
                              alt={product.name}
                              onError={(e) => {
                                e.target.style.display = "none";
                                e.target.nextSibling.style.display = "flex";
                              }}
                            />
                          ) : null}
                          <div
                            className="product-image-fallback"
                            style={{ display: product.image_url ? "none" : "flex" }}
                          >
                            {product.name?.charAt(0)}
                          </div>
                        </div>
                        <div className="product-price">
                          {product.discount_price
                            ? `₹${Number(product.discount_price).toLocaleString("en-IN")}`
                            : product.price
                            ? `₹${Number(product.price).toLocaleString("en-IN")}`
                            : ""}
                        </div>
                      </div>
                    )) : (
                      <p className="no-products-text">No products listed yet</p>
                    )}
                  </div>

                  {/* Actions Column */}
                  <div className="store-actions-col">
                    {store.address && (
                      <div className="store-distance">
                        <span className="distance-icon">📍</span>
                        <span>{store.address}</span>
                      </div>
                    )}
                    {store.service_radius_km && (
                      <div className="pickup-badge">
                        <span className="pickup-dot">🟢</span>
                        <span>Delivers within {store.service_radius_km} km</span>
                      </div>
                    )}
                    <button
                      className="visit-store-btn"
                      onClick={() => navigate(`/vendor/${store.slug || store.id}`)}
                    >
                      Visit Store →
                    </button>
                  </div>

                </div>
              ))
            )}
          </div>

          {/* LOAD MORE */}
          <div className="load-more-container">
            <button className="load-more-btn">Load More Stores ▼</button>
          </div>
        </main>
      </div>

      {/* LOCATION MODAL */}
      {showLocationModal && (
        <div className="location-modal-overlay">
          <div className="location-modal">
            <div className="modal-header">
              <h2>Change Location</h2>
              <button className="modal-close" onClick={() => setShowLocationModal(false)}>✕</button>
            </div>
            <div className="modal-body">
              <input
                type="text"
                placeholder="Enter city or location..."
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLocationChange()}
              />
              <button className="location-submit-btn" onClick={handleLocationChange}>
                Update Location
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ExploreShops;
