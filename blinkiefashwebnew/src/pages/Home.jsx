import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import AppHeader from '../components/AppHeader';
import ProductCard from '../components/ProductCard';
import Loader from '../components/Loader';
import { getCategories, getPriceRangeProducts, getBestsellers } from '../api';
import './Home.css';

const QUICK_OPTIONS = [
  { title: 'Orders', subtitle: 'Track and reorder', to: '/orders' },
  { title: 'Wishlist', subtitle: 'Your saved picks', to: '/wishlist' },
  { title: 'Refer & Earn', subtitle: 'Invite and reward', to: '/account' },
  { title: 'Support', subtitle: 'We are here to help', to: '/account' },
];

export default function Home() {
  const navigate = useNavigate();
  const [categories, setCategories] = useState([]);
  const [under999, setUnder999] = useState([]);
  const [under1999, setUnder1999] = useState([]);
  const [bestsellers, setBestsellers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [catRes, u999, u1999, best] = await Promise.all([
          getCategories(),
          getPriceRangeProducts(0, 999, 10),
          getPriceRangeProducts(1000, 1999, 10),
          getBestsellers(10),
        ]);
        if (cancelled) return;
        setCategories((Array.isArray(catRes) ? catRes : []).filter((c) => !c.parent_id).slice(0, 10));
        setUnder999(u999.products || []);
        setUnder1999(u1999.products || []);
        setBestsellers(best.bestsellers || best.products || []);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the home feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="page home-page">
      <AppHeader />

      <div className="hp-hero" onClick={() => navigate('/shop')} role="button" tabIndex={0}>
        <div className="hp-hero-copy">
          <p className="hp-eyebrow">TRENDING NOW</p>
          <h1>Fashion delivered fast</h1>
          <p>Try at home, keep what you love.</p>
          <button
            type="button"
            className="primary-btn"
            onClick={(e) => {
              e.stopPropagation();
              navigate('/shop');
            }}
          >
            Shop now
          </button>
        </div>
      </div>

      <section className="hp-feature-row" aria-label="Shopping features">
        <article>
          <strong>60 MIN</strong>
          <span>Fast delivery</span>
        </article>
        <article>
          <strong>TRY &amp; BUY</strong>
          <span>At-home fitting</span>
        </article>
        <article>
          <strong>EASY</strong>
          <span>Quick returns</span>
        </article>
        <article>
          <strong>SECURE</strong>
          <span>Safe payments</span>
        </article>
      </section>

      <section className="section">
        <div className="section-head">
          <h2>Quick options</h2>
        </div>
        <div className="hp-options-grid">
          {QUICK_OPTIONS.map((item) => (
            <button
              key={item.title}
              type="button"
              className="hp-option-card"
              onClick={() => navigate(item.to)}
            >
              <strong>{item.title}</strong>
              <span>{item.subtitle}</span>
            </button>
          ))}
        </div>
      </section>

      {error && <p className="state-msg">{error}</p>}

      {categories.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Explore categories</h2>
            <button type="button" onClick={() => navigate('/shop')}>
              View all
            </button>
          </div>
          <div className="hp-category-strip">
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="hp-category-chip"
                onClick={() => navigate(`/shop?category_id=${cat.id}`)}
              >
                <span className="hp-category-media">{cat.name.slice(0, 1)}</span>
                <span>{cat.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {loading && <Loader label="Loading todays picks..." />}

      {bestsellers.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Bestsellers</h2>
            <button type="button" onClick={() => navigate('/shop?sort=bestseller')}>
              View all
            </button>
          </div>
          <div className="product-row">
            {bestsellers.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {under999.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Under ₹999</h2>
            <button type="button" onClick={() => navigate('/shop?max_price=999')}>
              View all
            </button>
          </div>
          <div className="product-row">
            {under999.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}

      {under1999.length > 0 && (
        <section className="section">
          <div className="section-head">
            <h2>Under ₹1999</h2>
            <button type="button" onClick={() => navigate('/shop?max_price=1999')}>
              View all
            </button>
          </div>
          <div className="product-row">
            {under1999.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
