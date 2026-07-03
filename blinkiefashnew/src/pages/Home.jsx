import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Header from '../components/Header.jsx';
import Footer from '../components/Footer.jsx';
import LocationModal from '../components/LocationModal.jsx';
import { API } from '../apiBase.js';
import './Home.css';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share';
const QR_URL = `https://api.qrserver.com/v1/create-qr-code/?size=140x140&data=${encodeURIComponent(PLAY_STORE)}&bgcolor=ffffff&color=16a34a&margin=8`;
const HERO_IMGS = ['/images/hero.png', '/images/hero1.png', '/images/hero2.png', '/images/hero3.png'];
const CAT_EMOJI = { Women: '👩‍🦰', Men: '👔', Kids: '🧒', Beauty: '💄', 'Home Living': '🏠', Accessories: '👜', Footwear: '👟', Sports: '🏃' };

export default function Home() {
  const navigate = useNavigate();
  const [slide, setSlide] = useState(0);
  const [location, setLocation] = useState('');
  const [showLocModal, setShowLocModal] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef(null);

  /* ── Hero auto-slide ── */
  useEffect(() => {
    timerRef.current = setInterval(() => setSlide(s => (s + 1) % HERO_IMGS.length), 4000);
    return () => clearInterval(timerRef.current);
  }, []);

  const goSlide = (i) => { clearInterval(timerRef.current); setSlide(i); timerRef.current = setInterval(() => setSlide(s => (s + 1) % HERO_IMGS.length), 4000); };

  /* ── Saved location ── */
  useEffect(() => {
    const saved = localStorage.getItem('bf_location');
    if (saved) setLocation(saved);
  }, []);
  const handleLocSelect = (city) => { setLocation(city); localStorage.setItem('bf_location', city); };

  /* ── Fetch ── */
  useEffect(() => {
    fetch(`${API}/categories`)
      .then(r => r.json())
      .then(d => setCategories(Array.isArray(d) ? d.filter(c => !c.parent_id) : []))
      .catch(() => {});
    fetch(`${API}/products?limit=12`)
      .then(r => r.json())
      .then(d => setProducts(d.products || (Array.isArray(d) ? d : [])))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <Header location={location} onLocationClick={() => setShowLocModal(true)} />
      {showLocModal && <LocationModal onClose={() => setShowLocModal(false)} onSelect={handleLocSelect} />}

      {/* Announcement marquee */}
      <div className="announce">
        <div className="announce__track">
          {['⚡ 60-Minute Delivery', '👗 Try Before You Buy', '🔄 90-Second Returns', '✅ Verified Vendors', '📱 Download the App', '🎁 Exclusive App Deals',
            '⚡ 60-Minute Delivery', '👗 Try Before You Buy', '🔄 90-Second Returns', '✅ Verified Vendors'].map((t, i) => <span key={i}>{t}</span>)}
        </div>
      </div>

      <main>
        {/* ── HERO SLIDER ── */}
        <section className="hero-slider">
          <div className="hero-slider__track">
            {HERO_IMGS.map((img, i) => (
              <div key={i} className={`hero-slide ${i === slide ? 'hero-slide--active' : ''}`}>
                <img src={img} alt={`Hero ${i + 1}`} loading={i === 0 ? 'eager' : 'lazy'} />
              </div>
            ))}
          </div>
          {/* Dots */}
          <div className="hero-slider__dots">
            {HERO_IMGS.map((_, i) => (
              <button key={i} className={`hero-slider__dot ${i === slide ? 'hero-slider__dot--on' : ''}`} onClick={() => goSlide(i)} />
            ))}
          </div>
          {/* Arrows */}
          <button className="hero-slider__arr hero-slider__arr--l" onClick={() => goSlide((slide - 1 + HERO_IMGS.length) % HERO_IMGS.length)}>‹</button>
          <button className="hero-slider__arr hero-slider__arr--r" onClick={() => goSlide((slide + 1) % HERO_IMGS.length)}>›</button>
        </section>

        {/* ── FEATURE STRIP ── */}
        <div className="fstrip">
          {[['⚡','60-Min Delivery','Select areas'],['👗','Try Before Buy','20-min window'],['🔄','Easy Returns','90 seconds'],['✅','Verified Vendors','Quality assured'],['🔒','Secure Pay','UPI & Cards']].map(f => (
            <div className="fstrip__item" key={f[1]}><span>{f[0]}</span><div><b>{f[1]}</b><small>{f[2]}</small></div></div>
          ))}
        </div>

        {/* ── CATEGORIES ── */}
        <section className="sec" id="categories">
          <div className="container">
            <div className="sec__hd">
              <h2>Shop by Category</h2>
              <Link to="/explore" className="sec__more">All →</Link>
            </div>
            <div className="cat-row no-scrollbar">
              {(categories.length ? categories : [
                {id:'1',name:'Women'},{id:'2',name:'Men'},{id:'3',name:'Kids'},
                {id:'4',name:'Beauty'},{id:'5',name:'Home Living'},{id:'6',name:'Accessories'},
              ]).map(cat => (
                <button
                  key={cat.id}
                  className="cat-pill"
                  onClick={() => navigate(`/explore?category=${cat.id}`)}
                >
                  {cat.category_url
                    ? <img src={cat.category_url} alt={cat.name} className="cat-pill__img" />
                    : <span className="cat-pill__emoji">{CAT_EMOJI[cat.name] || '🛒'}</span>
                  }
                  <span>{cat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* ── TRENDING NOW — horizontal slider ── */}
        <section className="sec sec--grey" id="products">
          <div className="container">
            <div className="sec__hd">
              <h2>Trending Now</h2>
              <Link to="/explore" className="sec__more">See all →</Link>
            </div>
            {loading ? (
              <div className="hscroll no-scrollbar">
                {[...Array(6)].map((_, i) => <div key={i} className="hscroll__skel" />)}
              </div>
            ) : products.length ? (
              <div className="hscroll no-scrollbar">
                {products.map(p => <PCard key={p.variant_id || p.id} product={p} />)}
              </div>
            ) : (
              <div className="empty"><span>🛍️</span><p>No products found</p><Link to="/explore" className="btn-green">Browse All</Link></div>
            )}
          </div>
        </section>

        {/* ── APP DOWNLOAD ── */}
        <section className="appdown">
          <div className="appdown__inner container">
            <div className="appdown__left">
              <span className="appdown__pill">📱 Download the App</span>
              <h2>Get the full BlinkieFash<br />experience on mobile</h2>
              <p>Real-time tracking, Try & Buy, app-only deals & faster checkout — all in your pocket.</p>
              <div className="appdown__stores">
                <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="appdown__store-btn">
                  <img src="/images/google.png" alt="Google Play" />
                  <div><small>GET IT ON</small><strong>Google Play</strong></div>
                </a>
                <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="appdown__store-btn appdown__store-btn--apple">
                  <img src="/images/apple-logo.png" alt="App Store" />
                  <div><small>DOWNLOAD ON THE</small><strong>App Store</strong></div>
                </a>
              </div>
              <div className="appdown__qr-row">
                <img src={QR_URL} alt="Scan to download" className="appdown__qr-code" />
                <div>
                  <p className="appdown__qr-label">Scan QR to download</p>
                  <small className="appdown__qr-sub">Works for Android & iOS</small>
                </div>
              </div>
            </div>
            <div className="appdown__right">
              {[
                ['📍','Live Order Tracking','Watch your rider on a live map'],
                ['👗','Try Before You Buy','20-min home trial, 90-sec return'],
                ['🎁','App-Only Deals','Exclusive flash sales & early access'],
                ['⚡','60-Min Delivery','Fastest fashion delivery guaranteed'],
                ['💳','One-Tap Checkout','Saved addresses & instant payment'],
                ['🔔','Smart Alerts','Restocks, sales & size notifications'],
              ].map(([icon, title, desc]) => (
                <div className="appdown__feature" key={title}>
                  <span>{icon}</span>
                  <div><b>{title}</b><p>{desc}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── STATS ── */}
        <div className="stats-bar">
          <div className="stats-bar__inner container">
            {[['60 Min','Delivery time'],['10,000+','Products listed'],['500+','Verified vendors'],['20 Min','Try & Buy window']].map(([n,l]) => (
              <div className="stats-bar__item" key={l}><span>{n}</span><small>{l}</small></div>
            ))}
          </div>
        </div>

        {/* ── WHY US ── */}
        <section className="sec" id="why">
          <div className="container">
            <div className="sec__hd sec__hd--center">
              <h2>Why BlinkieFash?</h2>
              <p className="sec__sub">India's first hyper-local fashion delivery platform</p>
            </div>
            <div className="why-grid">
              {[
                ['⚡','60-Minute Delivery','Order your favourite outfit and get it in 60 minutes — no more waiting days.'],
                ['👗','Try Before You Buy','20-minute home trial. Love it? Keep it. Return in 90 seconds.'],
                ['✅','Verified Vendors','Every vendor manually verified. Authentic products guaranteed.'],
                ['📍','Hyper-Local','Connecting you to vendors in your own city. Supporting local.'],
                ['🔒','Secure & Safe','Bank-grade encryption on every payment. Your choice of method.'],
                ['🎁','Exclusive Deals','App-only flash sales, early access drops and personalised offers.'],
              ].map(([emoji, title, desc]) => (
                <div className="why-card" key={title}>
                  <div className="why-card__icon">{emoji}</div>
                  <h4>{title}</h4>
                  <p>{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

      </main>

      <Footer />
    </>
  );
}

/* Inline product card for the slider */
function PCard({ product }) {
  const mrp = Number(product?.price || 0);
  const sell = Number(product?.discount_price || product?.price || 0);
  const disc = mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : 0;
  return (
    <Link className="pcard-h" to={`/product/${product?.id}`}>
      <div className="pcard-h__img">
        {product?.image
          ? <img src={product.image} alt={product.name} loading="lazy" />
          : <span>👗</span>
        }
        {disc > 0 && <span className="pcard-h__off">-{disc}%</span>}
        {product?.is_try_and_buy && <span className="pcard-h__try">Try</span>}
        <button className="pcard-h__wish" onClick={e => e.preventDefault()}>♡</button>
      </div>
      <div className="pcard-h__info">
        <p className="pcard-h__brand">{product?.brand || 'BlinkieFash'}</p>
        <p className="pcard-h__name">{product?.name}</p>
        <div className="pcard-h__price">
          <b>₹{sell.toLocaleString('en-IN')}</b>
          {mrp > sell && <s>₹{mrp.toLocaleString('en-IN')}</s>}
          {disc > 0 && <em>{disc}% off</em>}
        </div>
      </div>
    </Link>
  );
}
