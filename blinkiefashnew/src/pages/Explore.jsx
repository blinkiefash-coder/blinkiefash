import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { API } from '../apiBase.js';
import ProductCard from '../components/ProductCard.jsx';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import LocationModal from '../components/LocationModal.jsx';
import './Explore.css';

const SORT_OPTIONS = [
  { label: 'Newest First', value: 'newest' },
  { label: 'Price: Low to High', value: 'price_asc' },
  { label: 'Price: High to Low', value: 'price_desc' },
  { label: 'Discount', value: 'discount' },
];

export default function Explore() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [location, setLocation] = useState(() => localStorage.getItem('bf_location') || '');
  const [showLocModal, setShowLocModal] = useState(false);

  const catId = searchParams.get('category') || '';
  const sort = searchParams.get('sort') || 'newest';
  const search = searchParams.get('q') || '';

  const [searchInput, setSearchInput] = useState(search);

  const PER_PAGE = 20;

  const loadProducts = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ limit: PER_PAGE, offset: (page - 1) * PER_PAGE });
    if (catId) params.set('category_id', catId);
    if (search) params.set('search', search);
    fetch(`${API}/products?${params}`)
      .then(r => r.json())
      .then(d => {
        let prods = d.products || (Array.isArray(d) ? d : []);
        // Client-side sort
        if (sort === 'price_asc') prods = [...prods].sort((a, b) => Number(a.discount_price) - Number(b.discount_price));
        if (sort === 'price_desc') prods = [...prods].sort((a, b) => Number(b.discount_price) - Number(a.discount_price));
        if (sort === 'discount') prods = [...prods].sort((a, b) => {
          const da = Number(a.price) - Number(a.discount_price);
          const db = Number(b.price) - Number(b.discount_price);
          return db - da;
        });
        setProducts(prods);
        setTotal(d.total || prods.length);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [catId, sort, search, page]);

  useEffect(() => {
    fetch(`${API}/categories`)
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d.filter(c => !c.parent_id) : []))
      .catch(() => {});
  }, []);

  useEffect(() => { loadProducts(); }, [loadProducts]);

  const setParam = (key, val) => {
    const p = new URLSearchParams(searchParams);
    if (val) p.set(key, val); else p.delete(key);
    p.delete('page');
    setPage(1);
    setSearchParams(p);
  };

  const handleSearch = e => {
    e.preventDefault();
    setParam('q', searchInput.trim());
  };

  const activeCat = categories.find(c => c.id === catId);

  return (
    <>
      <Header location={location} onLocationClick={() => setShowLocModal(true)} />
      {showLocModal && <LocationModal onClose={() => setShowLocModal(false)} onSelect={city => { setLocation(city); localStorage.setItem('bf_location', city); }} />}

      <main className="explore">
        {/* ── Top bar ── */}
        <div className="explore__topbar">
          <div className="container explore__topbar-inner">
            <h1 className="explore__title">
              {activeCat ? activeCat.name : search ? `"${search}"` : 'All Products'}
              <span className="explore__count">{total > 0 ? `${total} items` : ''}</span>
            </h1>
            <form onSubmit={handleSearch} className="explore__search">
              <input
                value={searchInput}
                onChange={e => setSearchInput(e.target.value)}
                placeholder="Search products…"
              />
              <button type="submit">🔍</button>
            </form>
          </div>
        </div>

        <div className="container explore__body">
          {/* ── Sidebar ── */}
          <aside className="explore__sidebar">
            <div className="explore__filter-group">
              <h4>Categories</h4>
              <button
                className={`explore__cat-btn ${!catId ? 'explore__cat-btn--on' : ''}`}
                onClick={() => setParam('category', '')}
              >All</button>
              {categories.map(c => (
                <button
                  key={c.id}
                  className={`explore__cat-btn ${catId === c.id ? 'explore__cat-btn--on' : ''}`}
                  onClick={() => setParam('category', c.id)}
                >
                  {c.category_url && <img src={c.category_url} alt="" />}
                  {c.name}
                </button>
              ))}
            </div>

            <div className="explore__filter-group">
              <h4>Sort By</h4>
              {SORT_OPTIONS.map(opt => (
                <button
                  key={opt.value}
                  className={`explore__sort-btn ${sort === opt.value ? 'explore__sort-btn--on' : ''}`}
                  onClick={() => setParam('sort', opt.value)}
                >
                  {sort === opt.value ? '✓ ' : ''}{opt.label}
                </button>
              ))}
            </div>
          </aside>

          {/* ── Product Grid ── */}
          <div className="explore__main">
            {/* Active filter chips */}
            {(catId || search || sort !== 'newest') && (
              <div className="explore__chips">
                {activeCat && <span className="explore__chip">{activeCat.name} <button onClick={() => setParam('category', '')}>×</button></span>}
                {search && <span className="explore__chip">"{search}" <button onClick={() => { setSearchInput(''); setParam('q', ''); }}>×</button></span>}
                {sort !== 'newest' && <span className="explore__chip">{SORT_OPTIONS.find(o => o.value === sort)?.label} <button onClick={() => setParam('sort', 'newest')}>×</button></span>}
                <button className="explore__clear" onClick={() => { setSearchInput(''); setSearchParams({}); setPage(1); }}>Clear all</button>
              </div>
            )}

            {loading ? (
              <div className="explore__grid">
                {[...Array(12)].map((_, i) => <div key={i} className="explore__skel" />)}
              </div>
            ) : products.length === 0 ? (
              <div className="explore__empty">
                <span>🔍</span>
                <p>No products found.</p>
                <button onClick={() => { setSearchInput(''); setSearchParams({}); }}>Clear filters</button>
              </div>
            ) : (
              <>
                <div className="explore__grid">
                  {products.map(p => <ProductCard key={p.variant_id || p.id} product={p} />)}
                </div>
                {products.length >= PER_PAGE && (
                  <div className="explore__pagination">
                    <button disabled={page === 1} onClick={() => setPage(p => p - 1)}>← Prev</button>
                    <span>Page {page}</span>
                    <button onClick={() => setPage(p => p + 1)}>Next →</button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
