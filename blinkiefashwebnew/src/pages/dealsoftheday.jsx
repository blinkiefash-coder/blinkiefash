import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MdArrowBack, MdLocalFireDepartment } from 'react-icons/md';

import Loader from '../components/Loader';
import Footer from '../components/Footer';
import PageSEO from '../components/PageSEO';
import Navbar from '../components/Navbar';
import ProductCard from '../components/ProductCard';
import { getCategories, getProducts } from '../api';

import './dealsoftheday.css';

const PAGE_SIZE = 24;

const SORT_OPTIONS = [
  { id: 'discount', label: 'Highest Discount' },
  { id: 'price_asc', label: 'Price: Low to High' },
  { id: 'price_desc', label: 'Price: High to Low' },
];

function withDiscount(item) {
  const price = Number(item?.discount_price ?? item?.price ?? 0);
  const mrp = Number(item?.price ?? item?.original_price ?? price);
  const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  return { ...item, _price: price, _mrp: mrp, _discount: discount };
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
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [sortBy, setSortBy] = useState('discount');
  const [allDeals, setAllDeals] = useState([]);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(() => formatCountdown(getMsUntilMidnight()));

  useEffect(() => {
    const interval = setInterval(() => {
      setCountdown(formatCountdown(getMsUntilMidnight()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const catRes = await getCategories();
        const allCats = Array.isArray(catRes) ? catRes : [];
        const findRoot = buildRootCategoryMap(allCats);

        // Pull a large pool of products, paginated, then keep ONLY the
        // ones that actually carry a real discount. Fetch from multiple batches
        // and sorts to ensure brand diversity (not just Puma, but also The Souled Store, US Polo, etc.)
        const pool = [];
        const seen = new Set();
        
        // Try multiple sort options to get diverse brands
        const sortOptions = ['newest', 'discount', 'price_asc'];
        for (const sortBy of sortOptions) {
          let offset = 0;
          for (let i = 0; i < 8; i += 1) {
            const res = await getProducts({ sort: sortBy, limit: 100, offset });
            const batch = res?.products || (Array.isArray(res) ? res : []);
            if (!Array.isArray(batch) || batch.length === 0) break;
            batch.forEach((item) => {
              const key = String(item?.id ?? '');
              if (!key || seen.has(key)) return;
              seen.add(key);
              pool.push(item);
            });
            if (batch.length < 100) break;
            offset += 100;
          }
        }

        const discountedOnly = pool
          .map(withDiscount)
          .filter((item) => item._discount > 0)
          .map((item) => {
            const root = findRoot(item.category_id);
            return { ...item, _rootCategoryId: root?.id ?? null, _rootCategoryName: root?.name ?? null };
          });

        if (cancelled) return;
        setCategories(allCats.filter((c) => !c.parent_id));
        setAllDeals(discountedOnly);
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

  // Only show category chips that actually have at least one discounted item.
  const categoriesWithDeals = useMemo(() => {
    const idsPresent = new Set(allDeals.map((p) => String(p._rootCategoryId)));
    return categories.filter((c) => idsPresent.has(String(c.id)));
  }, [categories, allDeals]);

  const filteredDeals = useMemo(() => {
    let list = activeCategoryId
      ? allDeals.filter((item) => String(item._rootCategoryId) === String(activeCategoryId))
      : allDeals;

    list = [...list];
    if (sortBy === 'price_asc') list.sort((a, b) => a._price - b._price);
    else if (sortBy === 'price_desc') list.sort((a, b) => b._price - a._price);
    else list.sort((a, b) => b._discount - a._discount);

    return list;
  }, [allDeals, activeCategoryId, sortBy]);

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
          <button type="button" className="dotd-back" onClick={() => navigate(-1)} aria-label="Go back">
            <MdArrowBack />
          </button>

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
          </div>
        </div>

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