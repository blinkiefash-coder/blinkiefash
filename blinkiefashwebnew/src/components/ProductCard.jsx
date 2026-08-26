import { useNavigate } from 'react-router-dom';
import { MdFavorite, MdFavoriteBorder, MdLocalShipping, MdAddShoppingCart, MdStar } from 'react-icons/md';
import { FaFire } from 'react-icons/fa';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import { productImageUrl, productImageSrcSet } from '../utils/cloudinaryImage';
import './ProductCard.css';

// "1245" -> "1.2K+ sold", "82" -> "82+ sold"
function formatSoldCount(n) {
  const count = Number(n) || 0;
  if (count <= 0) return null;
  if (count >= 1000) {
    const k = count / 1000;
    return `${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}K+ sold`;
  }
  return `${count}+ sold`;
}

/**
 * ProductCard — reads only fields your current backend already returns
 * (id, name, brand, image, color, category_name, price, discount_price,
 * is_bestseller, variant_id). Nothing below needs a backend change to work.
 *
 * Three fields are OPTIONAL and purely additive:
 *   product.rating        (number, e.g. 4.6)
 *   product.review_count  (number, e.g. 128)
 *   product.sold_count    (number, e.g. 1245)
 *
 * If your API doesn't send them today, the card just hides that part
 * (no rating/sold row). The moment your backend starts including them
 * on a product — however you decide to compute them — this component
 * picks them up automatically, no frontend change required.
 */
export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { addToCart, getCartQty } = useCart();

  const wishlisted = isWishlisted(product.id);
  const cartQty = getCartQty(product.variant_id || product.id);
  const price = Number(product.discount_price ?? product.price ?? 0);
  const mrp = Number(product.price ?? product.original_price ?? price);
  const hasDiscount = mrp > price;
  const discountPct = hasDiscount ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const isHotDeal = product.is_bestseller === true || discountPct >= 30;

  const rating = Number(product.rating) || 0;
  const reviewCount = Number(product.review_count) || 0;
  const soldLabel = formatSoldCount(product.sold_count);

  const subtitleParts = [product.color, product.category_name].filter(Boolean);

  const handleAddToCart = (e) => {
    e.stopPropagation();
    addToCart({
      productId: product.id,
      variantId: product.variant_id,
      name: product.name,
      image: product.image,
      price,
      qty: 1,
    });
  };

  return (
    <div className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
      <div className="pc-media">
        {isHotDeal && (
          <span className="pc-ribbon">
            <FaFire aria-hidden="true" /> Hot Deal
          </span>
        )}

        {product.image ? (
          <img
            src={productImageUrl(product.image, 400)}
            srcSet={productImageSrcSet(product.image)}
            sizes="(max-width: 640px) 46vw, (max-width: 1024px) 30vw, 24vw"
            alt={product.name}
            loading="lazy"
            width="400"
            height="533"
          />
        ) : (
          <div className="pc-placeholder">No image</div>
        )}

        <button
          type="button"
          className={`pc-wishlist${wishlisted ? ' active' : ''}`}
          onClick={(e) => {
            e.stopPropagation();
            toggleWishlist({
              productId: product.id,
              name: product.name,
              image: product.image,
              price,
            });
          }}
          aria-label="Toggle wishlist"
        >
          {wishlisted ? <MdFavorite /> : <MdFavoriteBorder />}
        </button>

        <div className="pc-delivery-pill">
          <MdLocalShipping aria-hidden="true" />
          <span className="pc-delivery-pill-label">Delivered in</span>
          <strong>60</strong>
          <span className="pc-delivery-pill-label">minutes</span>
        </div>
      </div>

      <div className="pc-body">
        {product.brand && <p className="pc-brand">{product.brand}</p>}
        <p className="pc-name">{product.name}</p>
        {subtitleParts.length > 0 && (
          <p className="pc-subtitle">{subtitleParts.join(' \u2022 ')}</p>
        )}

        <div className="pc-price-row">
          <span className="pc-price">₹{price}</span>
          {hasDiscount && <span className="pc-mrp">₹{mrp}</span>}
          {hasDiscount && <span className="pc-discount-badge">{discountPct}% OFF</span>}
        </div>

        <div className="pc-meta-row">
          <div className="pc-meta-left">
            {rating > 0 && (
              <span className="pc-rating">
                <MdStar aria-hidden="true" /> {rating.toFixed(1)}
                {reviewCount > 0 && <span className="pc-review-count"> ({reviewCount})</span>}
              </span>
            )}
            {rating > 0 && soldLabel && <span className="pc-meta-sep">|</span>}
            {soldLabel && <span className="pc-sold">{soldLabel}</span>}
          </div>
          <button
            type="button"
            className={`pc-cart-btn${cartQty > 0 ? ' in-cart' : ''}`}
            onClick={handleAddToCart}
            aria-label={cartQty > 0 ? `In cart, quantity ${cartQty}` : 'Add to cart'}
          >
            {cartQty > 0 ? <span className="pc-cart-qty">+{cartQty}</span> : <MdAddShoppingCart />}
          </button>
        </div>

        <div className="pc-delivery-banner">
          <MdLocalShipping aria-hidden="true" />
          <span>
            Delivery in <strong>60 Minutes</strong>
            <br />
            <span className="pc-delivery-sub">Or it&apos;s free!</span>
          </span>
        </div>
      </div>
    </div>
  );
}