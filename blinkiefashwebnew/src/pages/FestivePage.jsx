import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import { MdChevronRight, MdTune, MdKeyboardArrowDown, MdClose } from 'react-icons/md';

import Loader from '../components/Loader';
import Footer from '../components/Footer';
import PageSEO from '../components/PageSEO';
import Navbar from '../components/Navbar';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import { getProducts, getCategories } from '../api';
import { API_BASE_URL } from '../apiBase';

// NOTE: swap these two paths for whatever your actual festive/ethnic banner
// assets are named. `womenethnicbanner.jpg` already exists (used on the
// Women page) — add a matching `menethnicbanner.jpg` for the men's banner,
// or point this at whichever file you're using for men's festive wear.
import womenFestiveBanner from '../assets/womenethnicbanner.jpg';
import menFestiveBanner from '../assets/traditional.jpeg';

import './festive.css';

const PAGE_SIZE = 18;
const FETCH_LIMIT_PER_CATEGORY = 100;

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'bestseller', label: 'Popularity' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'discount', label: 'Discount: High to Low' },
];

// Keyword match used to pick out festive/ethnic subcategories under
// whichever root (Women / Men) category is resolved. Keyword-based so it
// automatically picks up new subcategory names from the backend without
// needing a hardcoded label list.
const FESTIVE_KEYWORDS = [
  'ethnic',
  'kurti',
  'kurta',
  'saree',
  'sari',
  'suit',
  'lehenga',
  'salwar',
  'dupatta',
  'chikankari',
  'anarkali',
  'sharara',
  'dhoti',
  'indo western',
  'indo-western',
  'fusion wear',
  'sherwani',
  'bandhgala',
  'nehru jacket',
  'mundu',
  'festive',
];

const GENDER_CONFIG = {
  women: {
    label: 'Women',
    shopPath: '/women',
    rootNames: ['Women', 'Woman', 'Ladies', 'Womens'],
    banner: womenFestiveBanner,
    heading: "Women's Festive Fits",
    tagline: 'Traditional roots, modern style.',
  },
  men: {
    label: 'Men',
    shopPath: '/men',
    rootNames: ['Men', 'Man', 'Mens', 'Gents'],
    banner: menFestiveBanner,
    heading: "Men's Festive Fits",
    tagline: 'Festive fits, made for him.',
  },
};

function resolveImageUrl(raw) {
  const value = (raw ?? '').toString().trim();
  if (!value) return null;
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  if (payload && Array.isArray(payload.bestsellers)) return payload.bestsellers;
  return [];
}

function rootIdForAny(allCats, names) {
  const needles = (Array.isArray(names) ? names : [names])
    .map((n) => (n || '').toString().toLowerCase().trim())
    .filter(Boolean);
  if (!needles.length) return null;

  const exact = allCats.find((c) => {
    if (c.parent_id) return false;
    const name = (c?.name || '').toString().toLowerCase().trim();
    return needles.some((needle) => name === needle);
  });
  if (exact) return exact.id;

  const loose = allCats.find((c) => {
    if (c.parent_id) return false;
    const name = (c?.name || '').toString().toLowerCase().trim();
    return needles.some((needle) => name.includes(needle) || needle.includes(name));
  });
  return loose?.id || null;
}

function childCatsFor(allCats, rootId) {
  if (!rootId) return [];
  return allCats
    .filter((c) => String(c.parent_id) === String(rootId))
    .map((c) => ({
      id: c.id,
      name: (c?.name || '').toString().trim(),
    }))
    .filter((c) => c.name);
}

function normalizeProduct(p) {
  const salePrice = Number(p.discount_price ?? p.price ?? 0);
  const originalPrice = Number(p.price ?? p.original_price ?? p._mrp ?? salePrice);
  const discount =
    originalPrice > salePrice
      ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
      : 0;

  const image = resolveImageUrl(p.image || p.image_url || p.thumbnail);

  return {
    ...p,
    id: p.id,
    name: p.name,
    brand: p.brand,
    image,
    image_url: image,
    price: originalPrice,
    discount_price: salePrice,
    _mrp: originalPrice,
    _price: salePrice,
    category_id: p.category_id,
    in_stock: p.in_stock !== false,
    available: p.available !== false,
    sold_count: p.sold_count ?? p.sales_count ?? 0,
    discount,
  };
}

export default function FestivePage() {
  const navigate = useNavigate();
  const { gender: genderParam } = useParams();
  const gender = (genderParam || 'women').toLowerCase() === 'men' ? 'men' : 'women';
  const config = GENDER_CONFIG[gender];

  const [rootId, setRootId] = useState(null);
  const [festiveSubcats, setFestiveSubcats] = useState([]);
  const [rootResolved, setRootResolved] = useState(false);

  const [allProducts, setAllProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const [sort, setSort] = useState('newest');
  const [sortOpen, setSortOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [appliedPriceRange, setAppliedPriceRange] = useState({ min: '', max: '' });
  const [selectedCategoryId, setSelectedCategoryId] = useState('');

  // Track last gender so we can reset UI state during render when the
  // route param changes (React-recommended alternative to setState-in-effect).
  const [prevGender, setPrevGender] = useState(gender);
  if (gender !== prevGender) {
    setPrevGender(gender);
    setVisibleCount(PAGE_SIZE);
    setSort('newest');
    setPriceRange({ min: '', max: '' });
    setAppliedPriceRange({ min: '', max: '' });
    setSelectedCategoryId('');
    setSortOpen(false);
    setFilterOpen(false);
  }

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

  // Scroll to top when gender changes (DOM side-effect only — no setState).
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, [gender]);

  // Resolve the gender's root category + which of its subcategories count
  // as festive/ethnic wear.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setRootResolved(false);
      let allCats = [];
      try {
        const res = await getCategories();
        if (Array.isArray(res)) allCats = res;
      } catch {
        // keep []
      }
      const root = rootIdForAny(allCats, config.rootNames);
      const children = childCatsFor(allCats, root).filter((c) => {
        const name = c.name.toLowerCase();
        return FESTIVE_KEYWORDS.some((kw) => name.includes(kw));
      });
      if (cancelled) return;
      setRootId(root);
      setFestiveSubcats(children);
      setRootResolved(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [gender, config.rootNames]);

  // Pool every festive/ethnic product across the matched subcategories.
  useEffect(() => {
    if (!rootResolved) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError('');
      try {
        let merged = [];

        if (festiveSubcats.length) {
          const perCat = await Promise.all(
            festiveSubcats.map((cat) =>
              getProducts({
                category_id: cat.id,
                sort: 'newest',
                limit: FETCH_LIMIT_PER_CATEGORY,
              }).catch(() => [])
            )
          );
          merged = perCat.flatMap(extractProducts);
        }

        const seen = new Set();
        merged = merged.filter((p) => {
          const key = String(p?.id ?? '');
          if (!key || seen.has(key)) return false;
          seen.add(key);
          return true;
        });

        // No festive subcategories resolved — fall back to a keyword search
        // scoped to this gender.
        if (!merged.length) {
          try {
            const res = await getProducts({
              category_id: rootId || undefined,
              search: rootId ? 'festive' : `${config.label} festive ethnic`,
              sort: 'newest',
              limit: FETCH_LIMIT_PER_CATEGORY,
            });
            extractProducts(res).forEach((p) => {
              const key = String(p?.id ?? '');
              if (key && !seen.has(key)) {
                seen.add(key);
                merged.push(p);
              }
            });
          } catch {
            // ignore, use whatever we already have
          }
        }

        if (!cancelled) setAllProducts(merged.map(normalizeProduct));
      } catch {
        if (!cancelled) {
          setError('Could not load festive products right now.');
          setAllProducts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [rootResolved, festiveSubcats, rootId, config.label]);

  // Filter + sort the pool client-side (everything's already fetched, so
  // "Load More" just reveals more of this array rather than re-hitting
  // the API).
  const filteredSorted = useMemo(() => {
    let list = allProducts;

    if (selectedCategoryId) {
      list = list.filter((p) => String(p.category_id) === String(selectedCategoryId));
    }

    const min = appliedPriceRange.min !== '' ? Number(appliedPriceRange.min) : null;
    const max = appliedPriceRange.max !== '' ? Number(appliedPriceRange.max) : null;
    if (min != null || max != null) {
      list = list.filter((p) => {
        const price = Number(p.discount_price || p.price || 0);
        if (min != null && price < min) return false;
        if (max != null && price > max) return false;
        return true;
      });
    }

    const sorted = [...list];
    switch (sort) {
      case 'price_asc':
        sorted.sort((a, b) => (a.discount_price || a.price || 0) - (b.discount_price || b.price || 0));
        break;
      case 'price_desc':
        sorted.sort((a, b) => (b.discount_price || b.price || 0) - (a.discount_price || a.price || 0));
        break;
      case 'discount':
        sorted.sort((a, b) => (b.discount || 0) - (a.discount || 0));
        break;
      case 'bestseller':
        sorted.sort((a, b) => (b.sold_count || 0) - (a.sold_count || 0));
        break;
      case 'newest':
      default:
        sorted.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
        break;
    }
    return sorted;
  }, [allProducts, selectedCategoryId, appliedPriceRange, sort]);

  const products = filteredSorted.slice(0, visibleCount);
  const total = filteredSorted.length;
  const hasMore = visibleCount < total;

  const handleApplyFilters = () => {
    setAppliedPriceRange(priceRange);
    setVisibleCount(PAGE_SIZE);
    setFilterOpen(false);
  };

  const handleClearFilters = () => {
    setPriceRange({ min: '', max: '' });
    setAppliedPriceRange({ min: '', max: '' });
    setSelectedCategoryId('');
    setVisibleCount(PAGE_SIZE);
    setFilterOpen(false);
  };

  const handleSortChange = (value) => {
    setSort(value);
    setVisibleCount(PAGE_SIZE);
    setSortOpen(false);
  };

  const handleCategoryToggle = (catId) => {
    setSelectedCategoryId((prev) => (String(prev) === String(catId) ? '' : catId));
    setVisibleCount(PAGE_SIZE);
  };

  const activeFilterCount =
    (appliedPriceRange.min || appliedPriceRange.max ? 1 : 0) + (selectedCategoryId ? 1 : 0);

  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sort)?.label || 'Sort';
  const showingFrom = products.length > 0 ? 1 : 0;
  const showingTo = products.length;

  return (
    <div className="fp">
      <PageSEO
        title={`${config.heading} — Festive & Ethnic Wear`}
        description={`Shop ${config.label.toLowerCase()}'s festive and ethnic wear collection at Blinkiefash — delivered fast across Odisha.`}
        path={`/festive/${gender}`}
      />

      <Navbar activeTab={config.label} />

      <main className="fp-main">
        <nav className="fp-breadcrumb" aria-label="Breadcrumb">
          <Link to="/">Home</Link>
          <MdChevronRight aria-hidden="true" />
          <Link to={config.shopPath}>{config.label}</Link>
          <MdChevronRight aria-hidden="true" />
          <span aria-current="page">Festive Edit</span>
        </nav>

        <section className="fp-banner">
          <img src={config.banner} alt={`${config.heading} banner`} loading="lazy" />
        </section>

        <section className="fp-toolbar">
          <div className="fp-toolbar-heading">
            <h1>{config.heading}</h1>
            <p>
              {loading
                ? 'Loading products…'
                : total > 0
                ? `Showing ${showingFrom} - ${showingTo} of ${total} products`
                : 'No products found'}
            </p>
          </div>

          <div className="fp-toolbar-actions">
            <div className="fp-sort" ref={sortMenuRef}>
              <button
                type="button"
                className="fp-sort-trigger"
                onClick={() => setSortOpen((v) => !v)}
                aria-haspopup="listbox"
                aria-expanded={sortOpen}
              >
                <span className="fp-sort-trigger-label">Sort by:</span>
                <span className="fp-sort-trigger-value">{currentSortLabel}</span>
                <MdKeyboardArrowDown aria-hidden="true" />
              </button>
              {sortOpen ? (
                <ul className="fp-sort-menu" role="listbox">
                  {SORT_OPTIONS.map((opt) => (
                    <li key={opt.value} role="option" aria-selected={opt.value === sort}>
                      <button
                        type="button"
                        className={`fp-sort-option${opt.value === sort ? ' active' : ''}`}
                        onClick={() => handleSortChange(opt.value)}
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
              className={`fp-filter-trigger${activeFilterCount > 0 ? ' active' : ''}`}
              onClick={() => setFilterOpen(true)}
            >
              <MdTune aria-hidden="true" />
              Filter
              {activeFilterCount > 0 ? <span className="fp-filter-count">{activeFilterCount}</span> : null}
            </button>
          </div>
        </section>

        {error ? <p className="fp-state-msg">{error}</p> : null}

        {loading ? (
          <div className="fp-grid">
            {Array.from({ length: 12 }).map((_, idx) => (
              <ProductCardSkeleton key={`fp-skeleton-${idx}`} />
            ))}
          </div>
        ) : products.length > 0 ? (
          <>
            <div className="fp-grid" role="list">
              {products.map((p, idx) => (
                <ProductCard key={`fp-${p.id}-${idx}`} product={p} />
              ))}
            </div>

            {hasMore ? (
              <button
                type="button"
                className="fp-load-more"
                onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
              >
                Show More Products
              </button>
            ) : null}
          </>
        ) : (
          <div className="fp-empty">
            <p>We couldn&apos;t find any {config.label.toLowerCase()}&apos;s festive products right now.</p>
            <button type="button" onClick={() => navigate(config.shopPath)}>
              Browse all {config.label.toLowerCase()}&apos;s products
            </button>
          </div>
        )}

        <Footer />
      </main>

      {filterOpen ? (
        <div className="fp-filter-backdrop" onClick={() => setFilterOpen(false)}>
          <div className="fp-filter-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="fp-filter-head">
              <h3>Filters</h3>
              <button
                type="button"
                className="fp-filter-close"
                onClick={() => setFilterOpen(false)}
                aria-label="Close filters"
              >
                <MdClose />
              </button>
            </div>

            <div className="fp-filter-section">
              <h4>Price</h4>
              <div className="fp-filter-price-row">
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

            {festiveSubcats.length > 0 ? (
              <div className="fp-filter-section">
                <h4>Category</h4>
                <div className="fp-filter-chip-list">
                  {festiveSubcats.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      className={`fp-filter-chip${
                        String(selectedCategoryId) === String(cat.id) ? ' active' : ''
                      }`}
                      onClick={() => handleCategoryToggle(cat.id)}
                    >
                      {cat.name}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="fp-filter-footer">
              <button type="button" className="fp-filter-clear" onClick={handleClearFilters}>
                Clear all
              </button>
              <button type="button" className="fp-filter-apply" onClick={handleApplyFilters}>
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