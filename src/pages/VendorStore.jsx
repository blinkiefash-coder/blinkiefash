import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import { API_API_BASE_URL } from '../apiBase';
import './VendorStore.css';

const normalizeText = (value) => (value || '').toString().toLowerCase().trim();

export default function VendorStore() {
  const navigate = useNavigate();
  const { identifier } = useParams();

  const [vendor, setVendor] = useState(null);
  const [vendors, setVendors] = useState([]);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [brandSearchTerm, setBrandSearchTerm] = useState('');
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [activeBrand, setActiveBrand] = useState(null);
  const [sortBy, setSortBy] = useState('newest');

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError('');

        if (identifier === 'all') {
          const vendorsRes = await fetch(`${API_API_BASE_URL}/vendor`);
          const categoriesRes = await fetch(`${API_API_BASE_URL}/categories`);
          const brandsRes = await fetch(`${API_API_BASE_URL}/brands`);
          const vendorsData = await vendorsRes.json();
          const categoriesData = await categoriesRes.json();
          const brandsData = await brandsRes.json();
          const vendorList = Array.isArray(vendorsData) ? vendorsData : [];
          setVendors(vendorList);
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
          setBrands(Array.isArray(brandsData) ? brandsData : []);
          setProducts([]);
          setVendor({ store_name: 'Admin — All Vendors', description: 'Browse products from every vendor.', is_verified: true });
        } else {
          const [vendorResponse, categoriesResponse, brandsResponse] = await Promise.all([
            fetch(`${API_API_BASE_URL}/vendor/${identifier}`),
            fetch(`${API_API_BASE_URL}/categories`),
            fetch(`${API_API_BASE_URL}/brands`),
          ]);

          if (!vendorResponse.ok) throw new Error('Vendor not found');

          const vendorData = await vendorResponse.json();
          setVendor(vendorData);

          const [productsResponse, categoriesData, brandsData] = await Promise.all([
            fetch(`${API_API_BASE_URL}/vendor/${vendorData.id}/products`),
            categoriesResponse.json(),
            brandsResponse.json(),
          ]);

          const productsData = await productsResponse.json();
          setProducts(Array.isArray(productsData) ? productsData : []);
          setCategories(Array.isArray(categoriesData) ? categoriesData : []);
          setBrands(Array.isArray(brandsData) ? brandsData : []);
        }
      } catch (err) {
        console.error('Failed to load vendor store:', err);
        setError('Unable to load vendor panel right now.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [identifier]);

  const filteredProducts = useMemo(() => {
    const search = normalizeText(searchTerm);
    return products
      .filter((product) => {
        const matchesSearch =
          search.length === 0 ||
          normalizeText(product.name).includes(search) ||
          normalizeText(product.brand).includes(search) ||
          normalizeText(product.category_name).includes(search) ||
          normalizeText(product.store_name).includes(search);

        const matchesBrand = !activeBrand || normalizeText(product.brand) === normalizeText(activeBrand);
        const matchesCategory = !activeCategoryId || String(product.category_id) === String(activeCategoryId);

        return matchesSearch && matchesBrand && matchesCategory;
      })
      .sort((a, b) => {
        const aPrice = Number(a.discount_price ?? a.price ?? 0);
        const bPrice = Number(b.discount_price ?? b.price ?? 0);
        if (sortBy === 'price-low') return aPrice - bPrice;
        if (sortBy === 'price-high') return bPrice - aPrice;
        return String(b.id).localeCompare(String(a.id));
      });
  }, [products, searchTerm, activeBrand, activeCategoryId, sortBy]);

  const categoryRoots = useMemo(() => categories.filter((category) => !category.parent_id), [categories]);

  if (loading) {
    return (
      <div className="vendor-store-page">
        <AppHeader showSearch={false} />
        <div className="vendor-store-loading">Loading vendor panel...</div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="vendor-store-page">
        <AppHeader showSearch={false} />
        <div className="vendor-store-error">
          <h2>Vendor panel not found</h2>
          <p>{error || 'This vendor could not be loaded.'}</p>
          <button onClick={() => navigate('/vendor')}>Back to Vendor Login</button>
        </div>
      </div>
    );
  }

  return (
    <div className="vendor-store-page">
      <AppHeader showSearch={false} />

      <div className="vendor-store-shell">
        <aside className="vendor-store-sidebar">
          <div className="vendor-sidebar-group">
            <div className="vendor-sidebar-title">SEARCH</div>
            <input className="vendor-brand-search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder="Search products..." />
          </div>

          <div className="vendor-sidebar-group">
            <div className="vendor-sidebar-title">CATEGORIES</div>
            <button className={`vendor-sidebar-chip ${!activeCategoryId ? 'active' : ''}`} onClick={() => setActiveCategoryId(null)}>All Products</button>
            {categoryRoots.slice(0, 12).map((category) => (
              <button key={category.id} className={`vendor-sidebar-chip ${String(activeCategoryId) === String(category.id) ? 'active' : ''}`} onClick={() => setActiveCategoryId((prev) => (String(prev) === String(category.id) ? null : category.id))}>{category.name}</button>
            ))}
          </div>

          <div className="vendor-sidebar-group">
            <div className="vendor-sidebar-title">BRANDS</div>
            <input className="vendor-brand-search" placeholder="Search brands..." value={brandSearchTerm} onChange={(e) => setBrandSearchTerm(e.target.value)} />
            <div className="vendor-sidebar-list">
              {brands.filter((brand) => normalizeText(brand.name).includes(normalizeText(brandSearchTerm))).slice(0, 20).map((brand) => (
                <label key={brand.id} className={`vendor-sidebar-option ${normalizeText(activeBrand) === normalizeText(brand.name) ? 'active' : ''}`}>
                  <input type="checkbox" checked={normalizeText(activeBrand) === normalizeText(brand.name)} onChange={() => setActiveBrand((prev) => (normalizeText(prev) === normalizeText(brand.name) ? null : brand.name))} />
                  <span>{brand.name}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="vendor-sidebar-group">
            <div className="vendor-sidebar-title">SORT</div>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="price-low">Price: Low → High</option>
              <option value="price-high">Price: High → Low</option>
            </select>
          </div>

          <button className="vendor-clear-btn" onClick={() => { setSearchTerm(''); setBrandSearchTerm(''); setActiveCategoryId(null); setActiveBrand(null); setSortBy('newest'); }}>Clear All Filters</button>
        </aside>

        <main className="vendor-store-main">
          <div className="vendor-store-hero">
            <div className="vendor-store-hero-left">
              <div className="vendor-breadcrumbs">Vendor Panel &nbsp;›&nbsp; {vendor.store_name}</div>
              <div className="vendor-store-headline">
                <div className="vendor-store-logo-wrap">
                  {vendor.vendor_img_url ? <img src={vendor.vendor_img_url} alt={vendor.store_name} /> : <div className="vendor-store-logo-fallback">{(vendor.store_name || 'V').charAt(0)}</div>}
                </div>
                <div className="vendor-store-headline-copy">
                  <h1>{vendor.store_name}{vendor.is_verified ? <span className="vendor-verified-badge">✓</span> : null}</h1>
                  <p>{vendor.description || 'Vendor storefront and management view.'}</p>
                  <div className="vendor-store-meta-row"><span>{identifier === 'all' ? `${vendors.length} vendors` : 'Active store'}</span></div>
                </div>
              </div>
              <div className="vendor-top-actions">
                <button className="vendor-visit-btn" onClick={() => navigate('/vendor/register')}>New Vendor Registration</button>
                <button className="vendor-visit-btn secondary" onClick={() => navigate('/')}>Back to Home</button>
              </div>
            </div>
            <div className="vendor-store-sidecard">
              <div className="vendor-sidecard-title">Store Summary</div>
              <p>{filteredProducts.length} products visible with current filters.</p>
              <button className="vendor-directions-btn" onClick={() => navigate('/shop')}>Open Shop View</button>
            </div>
          </div>

          <section id="product-sections" className="vendor-products-section">
            <div className="vendor-products-header">
              <h2>Products</h2>
              <p>{filteredProducts.length} items</p>
            </div>

            <div className="vendor-product-grid">
              {filteredProducts.map((product) => {
                const image = product.image || product.image_url || product.product_image || '';
                return (
                  <article key={product.id} className="vendor-product-card" onClick={() => navigate(`/product/${product.id}`)}>
                    <div className="vendor-product-image-wrap">
                      {image ? <img src={image} alt={product.name} loading="lazy" /> : <div className="vendor-product-image-fallback">No image</div>}
                    </div>
                    <div className="vendor-product-copy">
                      <p className="vendor-product-brand">{product.brand || product.brand_name || product.store_name || 'Blinkiefash'}</p>
                      <h3>{product.name}</h3>
                      <div className="vendor-product-price-row">
                        <strong>₹{product.discount_price || product.price || 0}</strong>
                        {product.price && product.discount_price && Number(product.price) > Number(product.discount_price) ? <span>₹{product.price}</span> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}