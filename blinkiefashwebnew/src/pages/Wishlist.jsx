import { useNavigate } from 'react-router-dom';
import { useWishlist } from '../context/WishlistContext';
import { useCart } from '../context/CartContext';
import './Wishlist.css';

export default function Wishlist() {
  const navigate = useNavigate();
  const { items, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();

  if (items.length === 0) {
    return (
      <div className="page wishlist-page">
        <div className="wishlist-inner">
          <div className="wishlist-empty">
            <div className="wishlist-empty-icon">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                  d="M12 21s-7.5-4.6-10-9.2C.5 8.2 2 4.5 5.6 4c2-.3 3.8.6 4.9 2.2C11.6 4.6 13.4 3.7 15.4 4c3.6.5 5.1 4.2 3.6 7.8-2.5 4.6-10 9.2-10 9.2z"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
            <p className="wishlist-empty-title">Your wishlist is empty</p>
            <p className="wishlist-empty-subtitle">
              Save items you love and they'll show up here.
            </p>
            <button type="button" className="primary-btn" onClick={() => navigate('/shop')}>
              Explore products
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page wishlist-page">
      <div className="wishlist-inner">
        <div className="wishlist-header">
          <span className="wishlist-title">Wishlist</span>
          <span className="wishlist-count">({items.length})</span>
        </div>
        <div className="wishlist-grid">
          {items.map((item) => (
            <div className="wishlist-card" key={item.productId}>
              <div
                className="wishlist-media"
                onClick={() => navigate(`/product/${item.productId}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    navigate(`/product/${item.productId}`);
                  }
                }}
              >
                {item.image ? <img src={item.image} alt={item.name} /> : null}
                <button
                  type="button"
                  className="wishlist-remove"
                  aria-label={`Remove ${item.name} from wishlist`}
                  onClick={(e) => {
                    e.stopPropagation();
                    removeFromWishlist(item.productId);
                  }}
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </div>
              <div className="wishlist-body">
                <p className="wishlist-name">{item.name}</p>
                <p className="wishlist-price">₹{item.price}</p>
              </div>
              <div className="wishlist-actions">
                <button
                  type="button"
                  className="primary-btn"
                  onClick={() => {
                    addToCart({ productId: item.productId, name: item.name, image: item.image, price: item.price });
                    removeFromWishlist(item.productId);
                  }}
                >
                  Move to cart
                </button>
                <button type="button" className="secondary-btn" onClick={() => removeFromWishlist(item.productId)}>
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}