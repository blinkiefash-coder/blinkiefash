import { NavLink } from 'react-router-dom';
import { useCart } from '../context/CartContext';
import './BottomNav.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home', icon: '\u2302', end: true },
  { to: '/shop', label: 'Categories', icon: '\u25A6' },
  { to: '/cart', label: 'Cart', icon: '\uD83D\uDECD', showBadge: true },
  { to: '/wishlist', label: 'Wishlist', icon: '\u2661' },
  { to: '/account', label: 'Account', icon: '\u263A' },
];

export default function BottomNav() {
  const { count } = useCart();

  return (
    <nav className="bottom-nav" aria-label="Primary">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `bottom-nav-item${isActive ? ' active' : ''}`}
        >
          <span className="bn-icon">
            {item.icon}
            {item.showBadge && count > 0 && <span className="bn-badge">{count}</span>}
          </span>
          <span className="bn-label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}
