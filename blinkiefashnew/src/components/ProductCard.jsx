import { Link } from 'react-router-dom';
import './ProductCard.css';

function colorHex(name = '') {
  const map = {
    black:'#111', white:'#e8e8e8', red:'#e53e3e', blue:'#3182ce',
    green:'#38a169', yellow:'#ecc94b', pink:'#ed64a6', purple:'#805ad5',
    orange:'#ed8936', grey:'#718096', gray:'#718096', brown:'#b7791f',
    navy:'#1a365d', wine:'#722f37', beige:'#f5f0e8', maroon:'#800000',
    cream:'#fffdd0', mustard:'#e3a020', teal:'#319795', coral:'#f56565',
  };
  return map[name.toLowerCase()] || '#94a3b8';
}

export default function ProductCard({ product }) {
  const img = product?.image || null;
  const mrp = Number(product?.price || 0);
  const sell = Number(product?.discount_price || product?.price || 0);
  const discount = mrp > sell ? Math.round(((mrp - sell) / mrp) * 100) : 0;
  const isTry = product?.is_try_and_buy || product?.is_try_enabled;

  return (
    <Link className="pcard" to={`/product/${product?.id}`}>
      <div className="pcard__img-wrap">
        {img
          ? <img src={img} alt={product?.name} loading="lazy" />
          : <div className="pcard__img-ph">👗</div>
        }
        {discount > 0 && <span className="pcard__off">-{discount}%</span>}
        {isTry && <span className="pcard__try-tag">Try &amp; Buy</span>}
        <button className="pcard__wish" onClick={e => e.preventDefault()} aria-label="Wishlist">♡</button>
      </div>
      <div className="pcard__info">
        <p className="pcard__brand">{product?.brand || 'BlinkieFash'}</p>
        <p className="pcard__name">{product?.name}</p>
        <div className="pcard__prices">
          <span className="pcard__sell">₹{sell.toLocaleString('en-IN')}</span>
          {mrp > sell && <span className="pcard__mrp">₹{mrp.toLocaleString('en-IN')}</span>}
          {discount > 0 && <span className="pcard__pct">{discount}% off</span>}
        </div>
        {product?.color && (
          <div className="pcard__color-row">
            <span className="pcard__color-dot" style={{ background: colorHex(product.color) }} />
            <span className="pcard__color-lbl">{product.color}</span>
          </div>
        )}
      </div>
    </Link>
  );
}
