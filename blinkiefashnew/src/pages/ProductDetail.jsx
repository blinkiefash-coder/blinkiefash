import { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { API } from '../apiBase.js';
import './ProductDetail.css';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share';
const SIZE_ORDER = ['XS','S','M','L','XL','XXL','XXXL','Free Size','28','30','32','34','36','38','40','42'];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [selectedSize, setSelectedSize] = useState(null);
  const [selectedColor, setSelectedColor] = useState(null);
  const [descExpanded, setDescExpanded] = useState(false);
  const [wishlisted, setWishlisted] = useState(false);
  const [similar, setSimilar] = useState([]);

  useEffect(() => {
    setLoading(true);
    setActiveImg(0);
    fetch(`${API}/products/${id}`)
      .then(r => r.json())
      .then(d => {
        setData(d);
        if (d.variants?.length) {
          setSelectedColor(d.variants[0].color);
          setSelectedSize(d.variants[0].size);
        }
        // Fetch similar products
        if (d.product?.category_id) {
          fetch(`${API}/products?category_id=${d.product.category_id}&limit=8`)
            .then(r => r.json())
            .then(s => setSimilar((s.products || []).filter(p => p.id !== id).slice(0, 6)))
            .catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSkeleton />;
  if (!data?.product) return (
    <div className="pd-err">
      <p>Product not found</p>
      <button onClick={() => navigate(-1)}>← Go Back</button>
    </div>
  );

  const { product, images = [], variants = [] } = data;
  const imgs = images.map(i => i.url);

  // Get unique colors and sizes
  const colors = [...new Set(variants.map(v => v.color).filter(Boolean))];
  const sizes = [...new Set(variants.map(v => v.size).filter(Boolean))]
    .sort((a, b) => {
      const ai = SIZE_ORDER.indexOf(a), bi = SIZE_ORDER.indexOf(b);
      if (ai >= 0 && bi >= 0) return ai - bi;
      return a.localeCompare(b);
    });

  // Active variant
  const activeVariant = variants.find(v =>
    (!selectedColor || v.color === selectedColor) &&
    (!selectedSize || v.size === selectedSize)
  ) || variants[0];

  const mrp = Number(activeVariant?.price || 0);
  const sell = Number(activeVariant?.discount_price || mrp);
  const discount = mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : 0;
  const inStock = (activeVariant?.available_stock || 0) > 0;

  return (
    <div className="pd-page">
      {/* Breadcrumb */}
      <nav className="pd-breadcrumb container">
        <Link to="/">Home</Link> /
        <Link to="/explore"> {product.category_name || 'Products'}</Link> /
        <span> {product.name}</span>
      </nav>

      <div className="pd-layout container">
        {/* ── Left: Image Gallery ── */}
        <div className="pd-gallery">
          <div className="pd-gallery__thumbs">
            {imgs.map((url, i) => (
              <button
                key={i}
                className={`pd-thumb ${i === activeImg ? 'pd-thumb--on' : ''}`}
                onClick={() => setActiveImg(i)}
              >
                <img src={url} alt={`View ${i + 1}`} />
              </button>
            ))}
          </div>
          <div className="pd-gallery__main">
            <img
              src={imgs[activeImg] || '/images/logo.png'}
              alt={product.name}
              className="pd-gallery__img"
              key={activeImg}
            />
            {/* Nav arrows on image */}
            {imgs.length > 1 && (
              <>
                <button className="pd-img-arrow pd-img-arrow--l" onClick={() => setActiveImg(i => Math.max(0, i - 1))}>‹</button>
                <button className="pd-img-arrow pd-img-arrow--r" onClick={() => setActiveImg(i => Math.min(imgs.length - 1, i + 1))}>›</button>
              </>
            )}
            {discount > 0 && <div className="pd-img-badge">{discount}% OFF</div>}
            <button className="pd-wish-btn" onClick={() => setWishlisted(v => !v)} aria-label="Wishlist">
              {wishlisted ? '❤️' : '🤍'}
            </button>
            {/* Dot indicators */}
            <div className="pd-img-dots">
              {imgs.map((_, i) => <span key={i} className={`pd-img-dot ${i === activeImg ? 'pd-img-dot--on' : ''}`} />)}
            </div>
          </div>
        </div>

        {/* ── Right: Product Info ── */}
        <div className="pd-info">
          <p className="pd-info__brand">{product.brand}</p>
          <h1 className="pd-info__name">{product.name}</h1>

          {/* Ratings placeholder */}
          <div className="pd-ratings">
            <span className="pd-ratings__stars">★★★★☆</span>
            <span className="pd-ratings__count">4.2 (128 ratings)</span>
          </div>

          {/* Price */}
          <div className="pd-price-block">
            <span className="pd-price__sell">₹{sell.toLocaleString('en-IN')}</span>
            {mrp > sell && <span className="pd-price__mrp">₹{mrp.toLocaleString('en-IN')}</span>}
            {discount > 0 && <span className="pd-price__off">{discount}% off</span>}
          </div>
          {!inStock && <p className="pd-oos">Out of stock</p>}

          {/* Try & Buy */}
          {product.is_try_enabled && (
            <div className="pd-try-banner">
              <span>👗</span>
              <div>
                <b>Try Before You Buy</b>
                <p>20-min trial at home. Return in 90 seconds if not happy.</p>
              </div>
            </div>
          )}

          {/* Color */}
          {colors.length > 0 && (
            <div className="pd-selector">
              <p className="pd-selector__label">Colour: <b>{selectedColor}</b></p>
              <div className="pd-colors">
                {colors.map(c => (
                  <button
                    key={c}
                    className={`pd-color-chip ${selectedColor === c ? 'pd-color-chip--on' : ''}`}
                    onClick={() => setSelectedColor(c)}
                    title={c}
                  >
                    <span style={{ background: colorHex(c) }} />
                    <span>{c}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Size */}
          {sizes.length > 0 && (
            <div className="pd-selector">
              <div className="pd-selector__hd">
                <p className="pd-selector__label">Size: <b>{selectedSize}</b></p>
                <button className="pd-size-guide">Size Guide</button>
              </div>
              <div className="pd-sizes">
                {sizes.map(s => {
                  const v = variants.find(vv => vv.size === s && (!selectedColor || vv.color === selectedColor));
                  const avail = (v?.available_stock || 0) > 0;
                  return (
                    <button
                      key={s}
                      className={`pd-size-chip ${selectedSize === s ? 'pd-size-chip--on' : ''} ${!avail ? 'pd-size-chip--oos' : ''}`}
                      onClick={() => avail && setSelectedSize(s)}
                      title={!avail ? 'Out of stock' : s}
                    >
                      {s}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* CTAs */}
          <div className="pd-ctas">
            <a
              href={PLAY_STORE}
              target="_blank"
              rel="noopener noreferrer"
              className="pd-btn pd-btn--cart"
            >
              🛒 Add to Cart — Open in App
            </a>
            <a
              href={PLAY_STORE}
              target="_blank"
              rel="noopener noreferrer"
              className="pd-btn pd-btn--buy"
            >
              ⚡ Buy Now
            </a>
          </div>
          {product.is_try_enabled && (
            <a
              href={PLAY_STORE}
              target="_blank"
              rel="noopener noreferrer"
              className="pd-btn pd-btn--try"
            >
              👗 Try &amp; Buy — 20 min home trial
            </a>
          )}

          {/* Delivery info */}
          <div className="pd-delivery">
            <div className="pd-delivery__item">
              <span>⚡</span><span><b>60-Minute Delivery</b><br /><small>Order via the BlinkieFash app</small></span>
            </div>
            <div className="pd-delivery__item">
              <span>🔄</span><span><b>Easy Returns</b><br /><small>90-second return process</small></span>
            </div>
            <div className="pd-delivery__item">
              <span>✅</span><span><b>Authentic Product</b><br /><small>Verified vendor guaranteed</small></span>
            </div>
          </div>

          {/* Description */}
          <div className="pd-desc">
            <h3>Product Details</h3>
            <div className={`pd-desc__text ${descExpanded ? 'pd-desc__text--open' : ''}`}>
              {(product.description || product.short_description || '').split('\n').map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
            <button className="pd-desc__toggle" onClick={() => setDescExpanded(v => !v)}>
              {descExpanded ? 'Show Less ▲' : 'Read More ▼'}
            </button>
          </div>
        </div>
      </div>

      {/* Similar Products */}
      {similar.length > 0 && (
        <section className="pd-similar container">
          <h2>Similar Products</h2>
          <div className="pd-similar__grid">
            {similar.map(p => {
              const smrp = Number(p.price || 0);
              const ssell = Number(p.discount_price || p.price || 0);
              const sdisc = smrp > ssell ? Math.round(((smrp - ssell) / smrp) * 100) : 0;
              return (
                <Link key={p.id} className="pd-sim-card" to={`/product/${p.id}`}>
                  <div className="pd-sim-img">
                    {p.image ? <img src={p.image} alt={p.name} loading="lazy" /> : <span>👗</span>}
                    {sdisc > 0 && <span className="pd-sim-off">-{sdisc}%</span>}
                  </div>
                  <div className="pd-sim-info">
                    <p className="pd-sim-brand">{p.brand}</p>
                    <p className="pd-sim-name">{p.name}</p>
                    <div className="pd-sim-prices">
                      <b>₹{ssell.toLocaleString('en-IN')}</b>
                      {smrp > ssell && <s>₹{smrp.toLocaleString('en-IN')}</s>}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}

function colorHex(name = '') {
  const map = {
    black:'#111',white:'#e8e8e8',red:'#e53e3e',blue:'#3182ce',green:'#38a169',
    yellow:'#ecc94b',pink:'#ed64a6',purple:'#805ad5',orange:'#ed8936',grey:'#718096',
    gray:'#718096',brown:'#b7791f',navy:'#1a365d',wine:'#722f37',beige:'#f5f0e8',
    maroon:'#800000',cream:'#fffdd0',mustard:'#e3a020',teal:'#319795',coral:'#f56565',
  };
  return map[name.toLowerCase()] || '#94a3b8';
}

function LoadingSkeleton() {
  return (
    <div className="pd-page pd-page--loading container">
      <div className="pd-skel-gallery" />
      <div className="pd-skel-info">
        <div className="pd-skel-line pd-skel-line--sm" />
        <div className="pd-skel-line pd-skel-line--lg" />
        <div className="pd-skel-line pd-skel-line--md" />
        <div className="pd-skel-line pd-skel-line--sm" />
      </div>
    </div>
  );
}
