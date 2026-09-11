import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { MdLocalFireDepartment, MdTune, MdClose } from 'react-icons/md';

import Loader from '../components/Loader';
import Footer from '../components/Footer';
import PageSEO from '../components/PageSEO';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { getCategories, getProducts, getBrands } from '../api';

import './dealsoftheday.css';

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { id: 'discount', label: 'Highest Discount' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
];

// Desired display order for top-level category chips.
const CATEGORY_ORDER = [
  'MEN',
  'WOMEN',
  'KIDS',
  'FOOTWEAR',
  'ELECTRONICS',
  'TRAVEL AND BACKPACK',
];

let dealsPageCache = null;

function getCategoryRank(name) {
  const normalized = String(name || '').trim().toUpperCase();
  const idx = CATEGORY_ORDER.indexOf(normalized);
  return idx === -1 ? CATEGORY_ORDER.length : idx;
}

function withDiscount(item) {
  const price = Number(item?.discount_price ?? item?.price ?? 0);
  const mrp = Number(item?.price ?? item?.original_price ?? price);
  const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return { ...item, _price: price, _mrp: mrp, _discount: discount };
}

function mixBrands(list) {
  const brandQueues = new Map();
  const brandOrder = [];

  list.forEach((item) => {
    const brand = String(item.brand || item.brand_name || 'Other').trim() || 'Other';
    if (!brandQueues.has(brand)) {
      brandQueues.set(brand, []);
      brandOrder.push(brand);
    }
    brandQueues.get(brand).push(item);
  });

  const mixed = [];
  let remaining = list.length;
  while (remaining > 0) {
    brandOrder.forEach((brand) => {
      const queue = brandQueues.get(brand);
      if (!queue.length) return;
      mixed.push(queue.shift());
      remaining -= 1;
    });
  }
  return mixed;
}

/** Walk up parent_id links to find each product's top-level (root) category. */
function buildRootCategoryMap(allCats) {
  const byId = new Map(allCats.map((c) => [String(c.id), c]));
  const rootCache = new Map();

  const findRoot = (catId) => {
    const key = String(catId);
    if (rootCache.has(key)) return rootCache.get(key);
    let cur = byId.get(key);
    const seen = new Set();
    while (cur && cur.parent_id && !seen.has(String(cur.id))) {
      seen.add(String(cur.id));
      cur = byId.get(String(cur.parent_id));
    }
    const root = cur || null;
    rootCache.set(key, root);
    return root;
  };

  return findRoot;
}

function getMsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, midnight.getTime() - now.getTime());
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export default function DealsOfTheDay() {
  const location = useLocation();
  const initialCategoryId = new URLSearchParams(location.search).get('category_id') || '';
  const [categories, setCategories] = useState(() => dealsPageCache?.categories ?? []);
  const [activeCategoryId, setActiveCategoryId] = useState(initialCategoryId);
  const [sortBy, setSortBy] = useState('discount');
  const [allDeals, setAllDeals] = useState(() => dealsPageCache?.allDeals ?? []);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(!dealsPageCache);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(() => formatCountdown(getMsUntilMidnight()));

  // ---- Filters (Brand) ----
  // `brands` holds every fashion brand in the catalog (not just brands that
  // happen to have a deal today), fetched separately from /brands so the
  // list is always complete. `draftBrand` is the live checkbox state inside
  // the panel; it only takes effect on products once "Apply Filters" is
  // pressed, at which point it's copied into `appliedBrand`.
  const [brands, setBrands] = useState(() => dealsPageCache?.brands ?? []);
  const [brandSearch, setBrandSearch] = useState('');
  const [draftBrand, setDraftBrand] = useState([]);
  const [appliedBrand, setAppliedBrand] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    if (!showFilters) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [showFilters]);

  useEffect(() => {
    if (dealsPageCache?.brands) return undefined;
    let cancelled = false;
    getBrands()
      .then((data) => {
        if (!cancelled) {
          const nextBrands = Array.isArray(data) ? data : [];
          setBrands(nextBrands);
          dealsPageCache = { ...(dealsPageCache || {}), brands: nextBrands };
        }
      })
      .catch((err) => console.error('[DealsOfTheDay] Could not load brands', err));
    return () => {
      cancelled = true;
    };
  }, []);

  const visibleBrands = useMemo(
    () =>
      brands.filter((brand) =>
        String(brand?.name || '').toLowerCase().includes(brandSearch.toLowerCase())
      ),
    [brands, brandSearch]
  );

  const toggleDraftBrand = (name) => {
    setDraftBrand((prev) =>
      prev.includes(name) ? prev.filter((item) => item !== name) : [...prev, name]
    );
  };

  const applyFilters = () => {
    setAppliedBrand(draftBrand);
    setVisibleCount(PAGE_SIZE);
    setShowFilters(false);
  };

  const clearFilters = () => {
    setDraftBrand([]);
    setAppliedBrand([]);
    setBrandSearch('');
    setVisibleCount(PAGE_SIZE);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(formatCountdown(getMsUntilMidnight()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (dealsPageCache?.allDeals) return undefined;
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const [catRes, sortedBatches] = await Promise.all([
          getCategories(),
          Promise.all(
            ['newest', 'discount', 'price_asc'].map((sort) =>
              Promise.all(
                Array.from({ length: 8 }, (_, page) =>
                  getProducts({ sort, limit: 100, offset: page * 100 })
                )
              )
            )
          ),
        ]);
        const allCats = Array.isArray(catRes) ? catRes : [];
        const findRoot = buildRootCategoryMap(allCats);

        // Pull a large pool of products, paginated, then keep ONLY the
        // ones that actually carry a real discount. Fetch from multiple batches
        // and sorts to ensure brand diversity (not just Puma, but also The Souled Store, US Polo, etc.)
        const pool = [];
        const seen = new Set();
        
        sortedBatches.flat().forEach((res) => {
          const batch = res?.products || (Array.isArray(res) ? res : []);
          if (!Array.isArray(batch)) return;
          batch.forEach((item) => {
            const key = String(item?.id ?? '');
            if (!key || seen.has(key)) return;
            seen.add(key);
            pool.push(item);
          });
        });

        const discountedOnly = pool
          .map(withDiscount)
          .filter((item) => item._discount > 0)
          .map((item) => {
            const root = findRoot(item.category_id);
            return { ...item, _rootCategoryId: root?.id ?? null, _rootCategoryName: root?.name ?? null };
          });

        if (cancelled) return;
        const rootCategories = allCats.filter((c) => !c.parent_id);
        setCategories(rootCategories);
        setAllDeals(discountedOnly);
        dealsPageCache = { ...(dealsPageCache || {}), categories: rootCategories, allDeals: discountedOnly };
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load deals');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Only show category chips that actually have at least one discounted item,
  // ordered per CATEGORY_ORDER (MEN, WOMEN, KIDS, FOOTWEAR, ELECTRONICS, TRAVEL AND BACKPACK).
  const categoriesWithDeals = useMemo(() => {
    const idsPresent = new Set(allDeals.map((p) => String(p._rootCategoryId)));
    return categories
      .filter((c) => idsPresent.has(String(c.id)))
      .sort((a, b) => {
        const rankA = getCategoryRank(a.name);
        const rankB = getCategoryRank(b.name);
        if (rankA !== rankB) return rankA - rankB;
        // Fallback for categories not in the priority list (or ties): alphabetical.
        return String(a.name).localeCompare(String(b.name));
      });
  }, [categories, allDeals]);

  const filteredDeals = useMemo(() => {
    let list = activeCategoryId
      ? allDeals.filter((item) => String(item._rootCategoryId) === String(activeCategoryId))
      : allDeals;

    if (appliedBrand.length > 0) {
      const wanted = appliedBrand.map((b) => String(b).trim().toLowerCase());
      list = list.filter((item) => {
        const itemBrand = String(item.brand || item.brand_name || '').trim().toLowerCase();
        return itemBrand && wanted.includes(itemBrand);
      });
    }

    list = [...list];
    if (sortBy === 'price_asc') list.sort((a, b) => a._price - b._price);
    else if (sortBy === 'price_desc') list.sort((a, b) => b._price - a._price);
    else list.sort((a, b) => b._discount - a._discount);

    return mixBrands(list);
  }, [allDeals, activeCategoryId, sortBy, appliedBrand]);

  const visibleDeals = filteredDeals.slice(0, visibleCount);
  const hasMore = visibleCount < filteredDeals.length;

  return (
    <div className="dotd">
      <PageSEO
        title="Deals of the Day — Discounted Fashion | Blinkiefash"
        description="Only discounted fashion picks, refreshed daily. Shop today's top deals across every category."
        path="/deals-of-the-day"
      />
      <Navbar />

      {/* ---- Hero ---- */}
      <section className="dotd-hero">
        <div className="dotd-hero-inner">
          <div className="dotd-hero-copy">
            <span className="dotd-hero-eyebrow">
              <MdLocalFireDepartment /> Today only
            </span>
            <h1 className="dotd-hero-title">Deals of the Day</h1>
            <p className="dotd-hero-subtitle">Only discounted products — refreshed every day at midnight.</p>
          </div>

          <div className="dotd-hero-meta">
            <div className="dotd-timer">
              <span className="dotd-timer-label">Refreshes in</span>
              <span className="dotd-timer-value">{countdown}</span>
            </div>
            {!loading && (
              <div className="dotd-count-chip">{filteredDeals.length} deals live</div>
            )}
          </div>
        </div>
      </section>

      <main className="dotd-main">
        {/* ---- Sticky filter bar ---- */}
        <div className="dotd-filterbar">
          {categoriesWithDeals.length > 0 && (
            <div className="dotd-cats" role="list">
              <button
                type="button"
                className={`dotd-cat-chip${!activeCategoryId ? ' active' : ''}`}
                role="listitem"
                onClick={() => {
                  setActiveCategoryId('');
                  setVisibleCount(PAGE_SIZE);
                }}
              >
                All
              </button>
              {categoriesWithDeals.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  className={`dotd-cat-chip${String(activeCategoryId) === String(cat.id) ? ' active' : ''}`}
                  role="listitem"
                  onClick={() => {
                    setActiveCategoryId(cat.id);
                    setVisibleCount(PAGE_SIZE);
                  }}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          <div className="dotd-sort">
            <label htmlFor="dotd-sort-select" className="dotd-sort-label">Sort</label>
            <select
              id="dotd-sort-select"
              className="dotd-sort-select"
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setVisibleCount(PAGE_SIZE);
              }}
            >
              {SORT_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>{opt.label}</option>
              ))}
            </select>

            <button
              type="button"
              className={`dotd-filter-toggle${showFilters ? ' active' : ''}`}
              onClick={() => {
                // Reopening should reflect whatever's actually applied, not
                // whatever was left mid-edit the last time the panel closed.
                if (!showFilters) setDraftBrand(appliedBrand);
                setShowFilters((prev) => !prev);
              }}
            >
              <MdTune /> Filters
              {appliedBrand.length > 0 ? (
                <span className="dotd-filter-count">{appliedBrand.length}</span>
              ) : null}
            </button>
          </div>
        </div>

        {showFilters ? (
          <section className="dotd-filters-panel">
            <div className="dotd-filters-panel-header">
              <h3>Filters</h3>
              <div className="dotd-filters-panel-header-actions">
                {(draftBrand.length > 0 || appliedBrand.length > 0) ? (
                  <button type="button" className="dotd-filters-clear" onClick={clearFilters}>
                    Clear
                  </button>
                ) : null}
                <button
                  type="button"
                  className="dotd-filters-close"
                  onClick={() => setShowFilters(false)}
                  aria-label="Close filters"
                >
                  <MdClose />
                </button>
              </div>
            </div>

            <div className="dotd-filter-col">
              <h4>
                Brand
                {brands.length > 0 ? (
                  <span className="dotd-filter-col-count"> ({brands.length})</span>
                ) : null}
              </h4>
              <input
                className="dotd-filter-search"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Search brand"
              />
              <div className="dotd-filter-list">
                {visibleBrands.map((brand) => (
                  <label key={brand.id}>
                    <input
                      type="checkbox"
                      checked={draftBrand.includes(brand.name)}
                      onChange={() => toggleDraftBrand(brand.name)}
                    />
                    <span>{brand.name}</span>
                  </label>
                ))}
                {visibleBrands.length === 0 ? (
                  <p className="dotd-filter-empty">No brands match "{brandSearch}"</p>
                ) : null}
              </div>
            </div>

            <div className="dotd-filters-footer">
              <button type="button" className="dotd-filters-apply" onClick={applyFilters}>
                Apply Filters
              </button>
            </div>
          </section>
        ) : null}

        {error && <p className="state-msg">{error}</p>}

        {loading ? (
          <Loader label="Loading today's deals..." />
        ) : (
          <>
            {visibleDeals.length > 0 ? (
              <div className="dotd-grid" role="list">
                {visibleDeals.map((p, idx) => (
                  <ProductCard key={`dotd-${p.id}-${idx}`} product={p} />
                ))}
              </div>
            ) : (
              <p className="dotd-empty">No discounted products in this category right now — check back soon.</p>
            )}

            {hasMore && (
              <button
                type="button"
                className="dotd-load-more"
                onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              >
                Show More Deals
              </button>
            )}
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}