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
      <div className="page">
        <h1 className="cart-title">Wishlist</h1>
        <p className="state-msg">You haven't saved anything yet.</p>
        <button type="button" className="primary-btn" onClick={() => navigate('/shop')}>
          Explore products
        </button>
      </div>
    );
  }

  return (
    <div className="page">
      <h1 className="cart-title">Wishlist ({items.length})</h1>
      <div className="wishlist-grid">
        {items.map((item) => (
          <div className="wishlist-card" key={item.productId}>
            <div
              className="wishlist-media"
              onClick={() => navigate(`/product/${item.productId}`)}
              role="button"
              tabIndex={0}
            >
              {item.image ? <img src={item.image} alt={item.name} /> : null}
            </div>
            <p className="wishlist-name">{item.name}</p>
            <p className="wishlist-price">₹{item.price}</p>
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
  );
}
