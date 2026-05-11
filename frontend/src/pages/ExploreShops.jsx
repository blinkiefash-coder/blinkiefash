import "./ExploreShops.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import logo from "../assets/logo.png";

function ExploreShops() {
  const navigate = useNavigate();
  const [selectedCity, setSelectedCity] = useState("Detecting your location...");
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState(null);
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
  const [userCoords, setUserCoords] = useState(null);
  const [selectedDistanceRange, setSelectedDistanceRange] = useState("all");
  const [selectedSort, setSelectedSort] = useState("nearest");
  const [visibleCount, setVisibleCount] = useState(6);
  const [locationReady, setLocationReady] = useState(false);
  const [locationSearchLoading, setLocationSearchLoading] = useState(false);
  const [locationSuggestions, setLocationSuggestions] = useState([]);
  const MAX_STORE_DISTANCE_KM = 1000;

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
    const locationReadyTimeout = setTimeout(() => {
      setSelectedCity("Bhubaneswar, Odisha");
      setLocationReady(true);
    }, 5000);

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setUserCoords({ lat: latitude, lng: longitude });
          setSelectedCity("Current location");
          setLocationReady(true);
          clearTimeout(locationReadyTimeout);
          // Reverse geocoding updates the label in the background without blocking the UI.
          fetchAddressFromCoordinates(latitude, longitude);
        },
        (error) => {
          // Geolocation failures (e.g. macOS kCLErrorLocationUnknown) are handled gracefully.
          console.warn("Location unavailable, defaulting to Bhubaneswar:", error.message);
          clearTimeout(locationReadyTimeout);
          setSelectedCity("Bhubaneswar, Odisha");
          setLocationReady(true);
        },
        { timeout: 8000, maximumAge: 60000, enableHighAccuracy: false }
      );
    } else {
      clearTimeout(locationReadyTimeout);
      setSelectedCity("Bhubaneswar, Odisha");
      setLocationReady(true);
    }

    return () => clearTimeout(locationReadyTimeout);
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
      setLocationSuggestions([]);
      setShowLocationModal(false);
    }
  };

  const handleSuggestionSelect = (suggestion) => {
    const displayName = suggestion.display_name || suggestion.name || "Selected location";
    const shortName = displayName.split(",").slice(0, 2).join(", ");

    setLocationInput(displayName);
    setSelectedCity(shortName);
    setUserCoords({ lat: Number(suggestion.lat), lng: Number(suggestion.lon) });
    setLocationSuggestions([]);
    setShowLocationModal(false);
    setLocationReady(true);
  };

  const useCurrentLocation = () => {
    setLocationInput("");
    setLocationSuggestions([]);
    setSelectedCity("Current location");
    setShowLocationModal(false);
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

  const getDescendantCategoryIds = (categoryId) => {
    if (!categoryId) return [];

    const ids = [categoryId];
    const queue = [categoryId];

    while (queue.length > 0) {
      const currentId = queue.shift();
      const children = getChildren(currentId);
      children.forEach((child) => {
        ids.push(child.id);
        queue.push(child.id);
      });
    }

    return ids;
  };

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
            className={`category-item ${selectedCategoryId === category.id ? "active" : ""}`}
            onClick={() =>
              setSelectedCategoryId((prev) => (prev === category.id ? null : category.id))
            }
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

  const getDistanceFromUserKm = (store) => {
    if (!userCoords || store?.lat == null || store?.lng == null) return null;

    const toRad = (deg) => (deg * Math.PI) / 180;
    const storeLat = Number(store.lat);
    const storeLng = Number(store.lng);
    if (Number.isNaN(storeLat) || Number.isNaN(storeLng)) return null;

    const earthRadiusKm = 6371;
    const dLat = toRad(storeLat - userCoords.lat);
    const dLng = toRad(storeLng - userCoords.lng);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(userCoords.lat)) * Math.cos(toRad(storeLat)) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  };

  const distances = [
    { label: "Any distance", value: "all" },
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

  const clearAllFilters = () => {
    setSearchTerm("");
    setSelectedCategoryId(null);
    setSelectedBrand(null);
    setBrandSearch("");
    setSelectedDistanceRange("all");
    setSelectedSort("nearest");
    setVisibleCount(6);
  };

  const selectedCategoryTreeIds = selectedCategoryId
    ? getDescendantCategoryIds(selectedCategoryId)
    : [];

  const selectedCategoryNameSet = new Set(
    categories
      .filter((cat) => selectedCategoryTreeIds.includes(cat.id))
      .map((cat) => cat.name?.toLowerCase())
      .filter(Boolean)
  );

  const matchesDistanceFilter = (store) => {
    const distance = getDistanceFromUserKm(store);

    // No user coords or store coords — only exclude when a specific distance range is active.
    if (distance === null) return selectedDistanceRange === "all";
    if (distance > MAX_STORE_DISTANCE_KM) return false;

    if (selectedDistanceRange === "all") return true;

    if (selectedDistanceRange === "0-1") return distance <= 1;
    if (selectedDistanceRange === "1-3") return distance > 1 && distance <= 3;
    if (selectedDistanceRange === "3-5") return distance > 3 && distance <= 5;
    if (selectedDistanceRange === "5+") return distance > 5;
    return true;
  };

  const filteredStores = stores
    .filter((store) => {
      const search = searchTerm.trim().toLowerCase();
      const searchMatch =
        search.length === 0 ||
        store.store_name?.toLowerCase().includes(search) ||
        store.description?.toLowerCase().includes(search) ||
        store.city?.toLowerCase().includes(search) ||
        store.address?.toLowerCase().includes(search) ||
        (store.products || []).some((p) =>
          p.name?.toLowerCase().includes(search) ||
          p.brand_name?.toLowerCase().includes(search) ||
          p.category_name?.toLowerCase().includes(search)
        );

      const categoryMatch =
        !selectedCategoryId ||
        (store.products || []).some((p) => {
          const productCategoryId = p.category_id;
          const productCategoryName = p.category_name?.toLowerCase();

          return (
            (productCategoryId && selectedCategoryTreeIds.includes(productCategoryId)) ||
            (productCategoryName && selectedCategoryNameSet.has(productCategoryName))
          );
        });

      const brandMatch =
        !selectedBrand ||
        (store.products || []).some(
          (p) => p.brand_name?.toLowerCase() === selectedBrand.toLowerCase()
        );

      return searchMatch && categoryMatch && brandMatch && matchesDistanceFilter(store);
    })
    .sort((a, b) => {
      if (selectedSort === "newest") {
        return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }

      if (selectedSort === "rating") {
        return Number(b.is_verified) - Number(a.is_verified);
      }

      // nearest (default)
      const aDist = getDistanceFromUserKm(a);
      const bDist = getDistanceFromUserKm(b);
      if (aDist === null && bDist === null) return 0;
      if (aDist === null) return 1;
      if (bDist === null) return -1;
      return aDist - bDist;
    });

  const visibleStores = filteredStores.slice(0, visibleCount);

  useEffect(() => {
    if (!showLocationModal) {
      setLocationSuggestions([]);
      setLocationSearchLoading(false);
      return;
    }

    const query = locationInput.trim();
    if (query.length < 3) {
      setLocationSuggestions([]);
      setLocationSearchLoading(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        setLocationSearchLoading(true);
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(query)}&limit=6&addressdetails=1&countrycodes=in`
        );
        const data = await response.json();
        setLocationSuggestions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Error fetching location suggestions:", err);
        setLocationSuggestions([]);
      } finally {
        setLocationSearchLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [locationInput, showLocationModal]);

  return (
    <div className="explore-shops">
      <Navbar />

      {!locationReady && (
        <div className="explore-loading-overlay">
          <div className="explore-loading-card">
            <div className="explore-loading-spinner" />
            <h2>Finding your location</h2>
            <p>Fetching nearby stores and the best distance match.</p>
          </div>
        </div>
      )}

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
                  <input
                    type="radio"
                    name="distance"
                    value={dist.value}
                    checked={selectedDistanceRange === dist.value}
                    onChange={(e) => setSelectedDistanceRange(e.target.value)}
                  />
                  <span>{dist.label}</span>
                </label>
              ))}
            </div>
          </div>

          <button className="clear-filters" onClick={clearAllFilters}>Clear All Filters</button>
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
              <select
                className="sort-selector"
                value={selectedSort}
                onChange={(e) => setSelectedSort(e.target.value)}
              >
                <option value="nearest">Sort by: Nearest</option>
                <option value="rating">Sort by: Rating</option>
                <option value="newest">Sort by: Newest</option>
              </select>
            </div>
            <p className="store-count">
              {storesLoading ? "Loading stores..." : `${filteredStores.length} stores found`}
            </p>
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
                <button
                  key={search}
                  className={`search-tag ${searchTerm.toLowerCase() === search.toLowerCase() ? "active" : ""}`}
                  onClick={() => setSearchTerm(search)}
                >
                  {search}
                </button>
              ))}
            </div>
          </div>

          {/* STORES GRID */}
          <div className="stores-grid">
            {storesLoading ? (
              <p style={{ color: "#999", padding: "24px 0" }}>Loading stores...</p>
            ) : filteredStores.length === 0 ? (
              <p style={{ color: "#999", padding: "24px 0" }}>No stores found in your area.</p>
            ) : (
              visibleStores.map((store) => {
                const deviceDistanceKm = getDistanceFromUserKm(store);
                const categoryPreview = [
                  ...new Set(
                    store.products
                      .map((product) => product.category_name)
                      .filter(Boolean)
                  ),
                ]
                  .slice(0, 4)
                  .join(" · ");
                const reviewCount = Math.max(28, store.products.length * 7);
                const happyCustomers = `${Math.max(450, store.products.length * 110)}+`;
                const offerCount = Math.max(4, Math.min(24, store.products.length + 6));

                return (
                <div key={store.id} className="store-card">

                  {/* Store Photo */}
                  <div className="store-image-container">
                    {store.is_verified ? <span className="store-featured-tag">FEATURED STORE</span> : null}
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
                      <div className="store-details-top">
                        <h3>{store.store_name}{store.is_verified ? <span className="verified-badge" aria-label="Verified" title="Verified">✓</span> : ""}</h3>
                        <span className="store-category">{categoryPreview || store.description || "Men · Women · Kids · Beauty"}</span>
                        <div className="store-stat-row">
                          <span className="store-rating-value">★ 4.6</span>
                          <span className="store-stat-muted">({reviewCount})</span>
                          <span className="store-stat-divider">|</span>
                          <span className="store-stat-muted">{happyCustomers} Happy Customers</span>
                        </div>
                        <div className="store-status">
                          {store.is_active ? (
                            <><span className="open-status">Open</span><span className="close-time"> · Closes 10:00 PM</span></>
                          ) : (
                            <span className="closed-status">Closed</span>
                          )}
                        </div>
                      </div>
                      <div className="store-details-centered">
                        <div className="store-feature-row">
                          <div className="store-feature-item">
                            <strong>
                              <span className="store-feature-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="1" y="6" width="13" height="10" rx="1.5" />
                                  <path d="M14 9h4l4 4v3h-8z" />
                                  <circle cx="6" cy="18" r="2" />
                                  <circle cx="18" cy="18" r="2" />
                                </svg>
                              </span>
                              60 Min Delivery
                            </strong>
                            <span>In your location</span>
                          </div>
                          <div className="store-feature-item">
                            <strong>
                              <span className="store-feature-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M3 7h8a6 6 0 1 1 0 12H6" />
                                  <path d="M6 4 2 8l4 4" />
                                </svg>
                              </span>
                              Easy Returns
                            </strong>
                            <span>Hassle-free</span>
                          </div>
                          <div className="store-feature-item">
                            <strong>
                              <span className="store-feature-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="4" y="10" width="16" height="10" rx="2" />
                                  <path d="M8 10V8a4 4 0 1 1 8 0v2" />
                                </svg>
                              </span>
                              Secure Payments
                            </strong>
                            <span>100% Secure</span>
                          </div>
                          <div className="store-feature-item">
                            <strong>
                              <span className="store-feature-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M6 8h12l-1 11H7L6 8z" />
                                  <path d="M9 8a3 3 0 0 1 6 0" />
                                </svg>
                              </span>
                              Store Pickup
                            </strong>
                            <span>Free & Fast</span>
                          </div>
                        </div>

                        <div className="store-bottom-meta-row">
                          <div className="store-bottom-meta-item">
                            <strong className="store-bottom-meta-line">
                              <span className="store-bottom-meta-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M12 21s-6-5.4-6-10a6 6 0 1 1 12 0c0 4.6-6 10-6 10z" />
                                  <circle cx="12" cy="11" r="2" />
                                </svg>
                              </span>
                              {store.address || store.city || "Location unavailable"}
                            </strong>
                            {deviceDistanceKm !== null ? (
                              <span className="store-bottom-meta-line">
                                <span className="store-bottom-meta-icon" aria-hidden="true">
                                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                    <circle cx="12" cy="12" r="9" />
                                    <path d="m12 8 2.5 3.5L12 16l-2.5-4.5z" />
                                  </svg>
                                </span>
                                {deviceDistanceKm.toFixed(1)} km from your location
                              </span>
                            ) : (
                              <span className="store-bottom-meta-line">
                                <span className="store-bottom-meta-icon" aria-hidden="true">•</span>
                                Distance unavailable
                              </span>
                            )}
                          </div>
                          <div className="store-bottom-meta-item">
                            <strong className="store-bottom-meta-line">
                              <span className="store-bottom-meta-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <circle cx="12" cy="12" r="9" />
                                  <path d="M12 7v5l3 2" />
                                </svg>
                              </span>
                              09:00 AM - 10:00 PM
                            </strong>
                            <span className="store-bottom-meta-line">
                              <span className="store-bottom-meta-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M16 3v4" />
                                  <path d="M8 3v4" />
                                  <rect x="4" y="5" width="16" height="15" rx="2" />
                                  <path d="M4 10h16" />
                                </svg>
                              </span>
                              All Days Open
                            </span>
                          </div>
                          <div className="store-bottom-meta-item">
                            <strong className="store-bottom-meta-line">
                              <span className="store-bottom-meta-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M20 12 12 20H5a2 2 0 0 1-2-2v-7l8-8 9 9z" />
                                  <circle cx="7.5" cy="7.5" r="1.2" />
                                </svg>
                              </span>
                              {offerCount}+ Offers
                            </strong>
                            <span className="store-bottom-meta-line">
                              <span className="store-bottom-meta-icon" aria-hidden="true">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M5 12h14" />
                                  <path d="m13 6 6 6-6 6" />
                                </svg>
                              </span>
                              View Offers
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Products Row */}
                  <div className="store-products">
                    {store.products.length > 0 ? store.products.slice(0, 4).map((product, idx) => (
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
                    <button
                      className="visit-store-btn"
                      onClick={() => navigate(`/vendor/${store.slug || store.id}`)}
                    >
                      Explore Store
                    </button>
                    {deviceDistanceKm !== null && (
                      <div className="device-distance-badge">
                        <span>📍</span>
                        <span>{deviceDistanceKm.toFixed(1)} km from your location</span>
                      </div>
                    )}
                  </div>

                </div>
              );
              })
            )}
          </div>

          {/* LOAD MORE */}
          {visibleStores.length < filteredStores.length && (
            <div className="load-more-container">
              <button className="load-more-btn" onClick={() => setVisibleCount((prev) => prev + 6)}>
                Load More Stores ▼
              </button>
            </div>
          )}
        </main>
      </div>

      <footer className="explore-footer">
        <div className="explore-footer-main">
          <div className="explore-footer-brand-col">
            <div className="explore-footer-brand">
              <img src={logo} alt="Blinkiefash Logo" className="explore-footer-logo-img" />
              <h1 className="explore-footer-logo-text">
                BLINKIE<span>FASH</span>
              </h1>
            </div>
            <p className="explore-footer-copyright">© 2024 BlinkieFash. All rights reserved.</p>
          </div>

          <div className="explore-footer-col">
            <h3>CUSTOMER SERVICE</h3>
            <ul>
              <li>Contact Us</li>
              <li>FAQs</li>
              <li>Shipping &amp; Delivery</li>
              <li>Returns &amp; Refunds</li>
            </ul>
          </div>

          <div className="explore-footer-col">
            <h3>COMPANY</h3>
            <ul>
              <li>About Us</li>
              <li>Careers</li>
              <li>Blinkie Blog</li>
              <li>Press &amp; Media</li>
            </ul>
          </div>

          <div className="explore-footer-col">
            <h3>POLICIES</h3>
            <ul>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
              <li>Cancellation Policy</li>
              <li>EPR Compliance</li>
              <li className="explore-footer-seller-link" onClick={() => navigate("/vendor")}>Become a Seller</li>
            </ul>
          </div>

          <div className="explore-footer-col explore-footer-app-col">
            <h3>GET THE APP</h3>
            <div className="explore-app-buttons">
              <button className="explore-store-badge" type="button">
                <span className="explore-store-badge-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M16.84 12.94c-.02-2.32 1.9-3.43 1.98-3.48-1.08-1.58-2.76-1.8-3.36-1.82-1.43-.14-2.8.84-3.52.84-.73 0-1.85-.82-3.04-.8-1.56.02-3 .91-3.8 2.31-1.62 2.81-.41 6.98 1.16 9.25.77 1.11 1.69 2.35 2.89 2.31 1.16-.05 1.6-.75 3-.75 1.41 0 1.8.75 3.03.72 1.25-.02 2.03-1.12 2.79-2.24.88-1.29 1.24-2.54 1.26-2.6-.03-.01-2.41-.92-2.43-3.74Zm-1.79-6.42c.63-.77 1.06-1.84.94-2.91-.91.04-2.01.61-2.66 1.38-.58.67-1.08 1.75-.95 2.79 1.01.08 2.04-.51 2.67-1.26Z" />
                  </svg>
                </span>
                <span className="explore-store-badge-text">
                  <small>Download on the</small>
                  <strong>App Store</strong>
                </span>
              </button>
              <button className="explore-store-badge" type="button">
                <span className="explore-store-badge-icon" aria-hidden="true">
                  <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M3.61 2.23 13.8 12 3.61 21.77c-.29-.19-.48-.52-.48-.9V3.13c0-.38.19-.71.48-.9Zm11.58 11.1 2.6 2.49-10.5 5.92 7.9-8.41Zm3.56-2.01 2.48 1.4c.84.47.84 1.68 0 2.15l-2.48 1.4L15.7 12l3.05-1.68ZM7.29 2.26l10.5 5.92-2.6 2.49-7.9-8.41Z" />
                  </svg>
                </span>
                <span className="explore-store-badge-text">
                  <small>GET IT ON</small>
                  <strong>Google Play</strong>
                </span>
              </button>
            </div>
          </div>

          <div className="explore-footer-col explore-footer-social-col">
            <h3>FOLLOW US</h3>
            <div className="explore-footer-socials">
              <button className="explore-social-icon" type="button" aria-label="Facebook">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M13.5 21v-7.26h2.44l.37-2.83H13.5V9.11c0-.82.23-1.38 1.4-1.38h1.5V5.19c-.26-.03-1.16-.11-2.21-.11-2.19 0-3.69 1.34-3.69 3.79v2.04H8v2.83h2.5V21h3Z" />
                </svg>
              </button>
              <button className="explore-social-icon" type="button" aria-label="Instagram">
                <svg viewBox="0 0 24 24" fill="none">
                  <rect x="3.5" y="3.5" width="17" height="17" rx="4.5" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.8" />
                  <circle cx="17.3" cy="6.7" r="1.1" fill="currentColor" />
                </svg>
              </button>
              <button className="explore-social-icon" type="button" aria-label="Twitter">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M18.9 7.14c.01.16.01.32.01.48 0 4.91-3.74 10.57-10.57 10.57-2.1 0-4.06-.62-5.7-1.67.29.03.58.04.88.04 1.74 0 3.35-.59 4.62-1.59-1.63-.03-3-1.11-3.47-2.59.23.04.46.07.7.07.33 0 .65-.04.95-.13-1.7-.34-2.98-1.84-2.98-3.64v-.05c.5.28 1.08.45 1.69.47-1-.67-1.65-1.8-1.65-3.08 0-.68.18-1.31.5-1.85 1.83 2.25 4.57 3.73 7.66 3.88-.06-.27-.1-.55-.1-.84 0-2.03 1.65-3.68 3.69-3.68 1.06 0 2.02.45 2.69 1.17.84-.16 1.63-.47 2.34-.89-.28.86-.86 1.57-1.63 2.02.75-.09 1.47-.29 2.13-.59-.5.75-1.12 1.41-1.84 1.94Z" />
                </svg>
              </button>
              <button className="explore-social-icon" type="button" aria-label="YouTube">
                <svg viewBox="0 0 24 24" fill="currentColor">
                  <path d="M21.58 7.19a2.98 2.98 0 0 0-2.1-2.11C17.63 4.5 12 4.5 12 4.5s-5.63 0-7.48.58a2.98 2.98 0 0 0-2.1 2.11A31.2 31.2 0 0 0 2 12a31.2 31.2 0 0 0 .42 4.81 2.98 2.98 0 0 0 2.1 2.11C6.37 19.5 12 19.5 12 19.5s5.63 0 7.48-.58a2.98 2.98 0 0 0 2.1-2.11c.28-1.58.42-3.18.42-4.81s-.14-3.23-.42-4.81ZM10 15.5v-7l6 3.5-6 3.5Z" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </footer>

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
                placeholder="Search city, landmark or area..."
                value={locationInput}
                onChange={(e) => setLocationInput(e.target.value)}
                onKeyPress={(e) => e.key === "Enter" && handleLocationChange()}
              />
              <div className="location-helper-card">
                <div className="location-helper-visual">
                  <span className="location-helper-pin">📍</span>
                </div>
                <div className="location-helper-text">
                  <strong>Update location</strong>
                  <span>Search a place or use your current position.</span>
                </div>
              </div>

              <button className="location-current-btn" onClick={useCurrentLocation} type="button">
                Use Current Location
              </button>

              <div className="location-suggestions-shell">
                <div className="location-suggestions-header">
                  <span>Suggestions</span>
                  {locationSearchLoading && <span className="location-suggestions-loading">Loading...</span>}
                </div>
                <div className="location-suggestions-list">
                  {locationSuggestions.length > 0 ? (
                    locationSuggestions.map((suggestion) => (
                      <button
                        key={`${suggestion.place_id}-${suggestion.lat}-${suggestion.lon}`}
                        type="button"
                        className="location-suggestion-item"
                        onClick={() => handleSuggestionSelect(suggestion)}
                      >
                        <span className="location-suggestion-icon">📌</span>
                        <span className="location-suggestion-text">{suggestion.display_name}</span>
                      </button>
                    ))
                  ) : (
                    <p className="location-suggestions-empty">
                      Type at least 3 characters to see suggestions.
                    </p>
                  )}
                </div>
              </div>

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
