import { NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import './BottomNav.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '\u2302', end: true },
  { to: '/shop', label: 'Categories', icon: '\u25A6' },
  { to: '/cart', label: 'Cart', icon: '\uD83D\uDECD', showBadge: 'cart' },
  { to: '/wishlist', label: 'Wishlist', icon: '\u2661', showBadge: 'wishlist' },
  { to: '/account', label: 'Account', icon: '\u263A' },
];

export default function BottomNav() {
  const { count: cartCount } = useCart();
  const { items: wishlistItems } = useWishlist();
  const wishlistCount = wishlistItems.length;

  const getBadge = (type) => {
    if (type === 'cart') return cartCount;
    if (type === 'wishlist') return wishlistCount;
    return 0;
  };

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => {
        const badgeCount = getBadge(item.showBadge);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
          >
            <span className="bn-icon">
              {item.icon}
              {/* Only show badge when count > 0 */}
              {item.showBadge && badgeCount > 0 && (
                <span className="bn-badge" aria-label={`${badgeCount} items`}>
                  {badgeCount > 99 ? '99+' : badgeCount}
                </span>
              )}
            </span>
            <span className="bn-label">{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}