import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import './ProductCard.css';

export default function ProductCard({ product }) {
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const wishlisted = isWishlisted(product.id);
  const price = Number(product.discount_price ?? product.price ?? 0);
  const mrp = Number(product.price ?? product.original_price ?? price);
  const hasDiscount = mrp > price;

  return (
    <div className="product-card" onClick={() => navigate(`/product/${product.id}`)}>
      <div className="pc-media">
        {product.image ? (
          <img src={product.image} alt={product.name} loading="lazy" />
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
          {wishlisted ? '\u2665' : '\u2661'}
        </button>
      </div>
      <div className="pc-body">
        {product.brand && <p className="pc-brand">{product.brand}</p>}
        <p className="pc-name">{product.name}</p>
        <div className="pc-price-row">
          <span className="pc-price">₹{price}</span>
          {hasDiscount && <span className="pc-mrp">₹{mrp}</span>}
        </div>
      </div>
    </div>
  );
}
