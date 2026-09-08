import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { useNavigate, useParams, useSearchParams, Link } from 'react-router-dom';
import { MdChevronRight, MdTune, MdKeyboardArrowDown, MdClose } from 'react-icons/md';

import Loader from '../components/Loader';
import Footer from '../components/Footer';
import PageSEO from '../components/PageSEO';
import Navbar from '../components/Navbar';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import { getBrands, getProducts, getCategories } from '../api';
import { API_BASE_URL } from '../apiBase';
import { getBrandBanner } from '../utils/brandVisuals';

import './brand.css';

const PAGE_SIZE = 18;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'bestseller', label: 'Popularity' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'discount', label: 'Discount: High to Low' },
];

function resolveImageUrl(raw) {
  const value = (raw ?? '').toString().trim();
  if (!value) return null;
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

function normalizeBrandName(value) {
  return (value || '').toString().toLowerCase().replace(/\./g, '').trim();
}

export default function BrandPage() {
  const navigate = useNavigate();
  const { brandName: brandParam } = useParams();
  const [searchParams] = useSearchParams();

  // Brand can arrive as a route param (/brands/:brandName) or a query string
  // (?brand=Puma), so support both without caring which one the link used.
  const brandName = useMemo(() => {
    const fromParam = brandParam ? decodeURIComponent(brandParam) : '';
    const fromQuery = searchParams.get('brand') || searchParams.get('search') || '';
    return (fromParam || fromQuery || '').trim();
  }, [brandParam, searchParams]);

  const [brandInfo, setBrandInfo] = useState(null);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [sort, setSort] = useState('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [appliedPriceRange, setAppliedPriceRange] = useState({ min: '', max: '' });
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');

  const sortMenuRef = useRef(null);

  // Close the sort dropdown on outside click.
  useEffect(() => {
    function handleClick(e) {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setSortOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Look up this brand's banner/logo once from the brands list.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [brandsRes, catRes] = await Promise.all([getBrands(), getCategories()]);
        if (cancelled) return;
        const list = Array.isArray(brandsRes)
          ? brandsRes
          : Array.isArray(brandsRes?.brands)
            ? brandsRes.brands
            : [];
        const needle = normalizeBrandName(brandName);
        const match = list.find((b) => normalizeBrandName(b.name) === needle);
        setBrandInfo(match || { name: brandName });
        setCategories((Array.isArray(catRes) ? catRes : []).filter((c) => !c.parent_id));
      } catch {
        if (!cancelled) setBrandInfo({ name: brandName });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [brandName]);

  const fetchPage = useCallback(
    async (nextOffset, { append } = {}) => {
      if (!brandName) return;
      append ? setLoadingMore(true) : setLoading(true);
      setError('');
      try {
        const res = await getProducts({
          search: brandName,
          category_id: selectedCategoryId || undefined,
          min_price: appliedPriceRange.min || undefined,
          max_price: appliedPriceRange.max || undefined,
          sort,
          limit: PAGE_SIZE,
          offset: nextOffset,
        });
        const items = res?.products || (Array.isArray(res) ? res : []);
        const totalCount = Number.isFinite(res?.total) ? res.total : nextOffset + items.length;
        setProducts((prev) => (append ? [...prev, ...items] : items));
        setTotal(totalCount);
        setOffset(nextOffset + items.length);
      } catch (err) {
        setError(err.message || 'Could not load products for this brand.');
        if (!append) setProducts([]);
      } finally {
        append ? setLoadingMore(false) : setLoading(false);
      }
    },
    [brandName, sort, selectedCategoryId, appliedPriceRange]
  );

  // Re-fetch from the top whenever brand, sort, or filters change.
  // Routed through setTimeout so the setState calls inside fetchPage are an
  // indirect, callback-triggered update rather than a synchronous call from
  // the effect body itself (see react-hooks/set-state-in-effect).
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchPage(0, { append: false });
    }, 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandName, sort, selectedCategoryId, appliedPriceRange]);

  const handleApplyFilters = () => {
    setAppliedPriceRange({ min: priceRange.min, max: priceRange.max });
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    setPriceRange({ min: '', max: '' });
    setAppliedPriceRange({ min: '', max: '' });
    setSelectedCategoryId('');
    setFilterOpen(false);
  };

  const activeFilterCount =
    (appliedPriceRange.min || appliedPriceRange.max ? 1 : 0) + (selectedCategoryId ? 1 : 0);

  const bannerUrl = resolveImageUrl(getBrandBanner(brandInfo) || brandInfo?.logo_url);

  const displayName = brandInfo?.name || brandName || 'Brand';
  const currentSortLabel =
    SORT_OPTIONS.find((o) => o.value === sort)?.label || 'Sort';
  const showingFrom = products.length > 0 ? 1 : 0;
  const showingTo = products.length;
  const hasMore = offset < total;

  return (
    <div className="bp">
      <PageSEO
        title={`${displayName} — Shop the Collection`}
        description={`Shop the latest ${displayName} collection. Fast delivery across Odisha.`}
        path={`/brands/${encodeURIComponent(displayName)}`}
      />

      <Navbar />

      <main className="bp-main">
        <nav className="bp-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <MdChevronRight aria-hidden="true" />
          <Link to="/shop">Shop by Brands</Link>
          <MdChevronRight aria-hidden="true" />
          <span aria-current="page">{displayName}</span>
        </nav>

        {bannerUrl ? (
          <section className="bp-banner">
            <img src={bannerUrl} alt={`${displayName} banner`} loading="lazy" />
          </section>
        ) : null}

        <section className="bp-toolbar">
          <div className="bp-toolbar-heading">
            <h1>{displayName}</h1>
            <p>
              {loading
                ? 'Loading products…'
                : total > 0
                ? `Showing ${showingFrom} - ${showingTo} of ${total} products`
                : 'No products found'}
            </p>
          </div>

          <div className="bp-toolbar-actions">
            <div className="bp-sort" ref={sortMenuRef}>
              <button
                type="button"
                className="bp-sort-trigger"
                onClick={() => setSortOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
              >
                <span className="bp-sort-trigger-label">Sort by:</span>
                <span className="bp-sort-trigger-value">{currentSortLabel}</span>
                <MdKeyboardArrowDown aria-hidden="true" />
              </button>
              {sortOpen ? (
                <ul className="bp-sort-menu" role="listbox">
                  {SORT_OPTIONS.map((opt) => (
                    <li key={opt.value} role="option" aria-selected={opt.value === sort}>
                      <button
                        type="button"
                        className={`bp-sort-option${opt.value === sort ? ' active' : ''}`}
                        onClick={() => {
                          setSort(opt.value);
                          setSortOpen(false);
                        }}
                      >
                        {opt.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            <button
              type="button"
              className={`bp-filter-trigger${activeFilterCount > 0 ? ' active' : ''}`}
              onClick={() => setFilterOpen(true)}
            >
              <MdTune aria-hidden="true" />
              Filter
              {activeFilterCount > 0 ? (
                <span className="bp-filter-count">{activeFilterCount}</span>
              ) : null}
            </button>
          </div>
        </section>

        {error ? <p className="bp-state-msg">{error}</p> : null}

        {loading ? (
          <div className="bp-grid">
            {Array.from({ length: 12 }).map((_, idx) => (
              <ProductCardSkeleton key={`bp-skeleton-${idx}`} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="bp-grid" role="list">
              {products.map((p, idx) => (
                <ProductCard key={`bp-${p.id}-${idx}`} product={p} />
              ))}
            </div>

            {hasMore ? (
              <button
                type="button"
                className="bp-load-more"
                onClick={() => fetchPage(offset, { append: true })}
                disabled={loadingMore}
              >
                {loadingMore ? 'Loading…' : 'Show More Products'}
              </button>
            ) : null}
          </>
        ) : (
          <div className="bp-empty">
            <p>We couldn&apos;t find any {displayName} products right now.</p>
            <button type="button" onClick={() => navigate('/shop')}>
              Browse all products
            </button>
          </div>
        )}

        <Footer />
      </main>

      {filterOpen ? (
        <div className="bp-filter-backdrop" onClick={() => setFilterOpen(false)}>
          <div className="bp-filter-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="bp-filter-head">
              <h3>Filters</h3>
              <button
                type="button"
                className="bp-filter-close"
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
              >
                <MdClose />
              </button>
            </div>

            <div className="bp-filter-section">
              <h4>Price</h4>
              <div className="bp-filter-price-row">
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Min"
                  value={priceRange.min}
                  onChange={(e) => setPriceRange((p) => ({ ...p, min: e.target.value }))}
                />
                <span>to</span>
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Max"
                  value={priceRange.max}
                  onChange={(e) => setPriceRange((p) => ({ ...p, max: e.target.value }))}
                />
              </div>
            </div>

            {categories.length > 0 ? (
              <div className="bp-filter-section">
                <h4>Category</h4>
                <div className="bp-filter-chip-list">
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`bp-filter-chip${
                        String(selectedCategoryId) === String(cat.id) ? ' active' : ''
                      }`}
                      onClick={() =>
                        setSelectedCategoryId((prev) =>
                          String(prev) === String(cat.id) ? '' : cat.id
                        )
                      }
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="bp-filter-footer">
              <button type="button" className="bp-filter-clear" onClick={handleClearFilters}>
                Clear all
              </button>
              <button type="button" className="bp-filter-apply" onClick={handleApplyFilters}>
                Apply Filters
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {loading && products.length === 0 ? <Loader overlay /> : null}
    </div>
  );
}