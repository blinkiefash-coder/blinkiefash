import { NavLink } from 'react-router-dom';
import {
  MdOutlineHome,
  MdHome,
  MdOutlineGridView,
  MdGridView,
  MdOutlineShoppingCart,
  MdShoppingCart,
  MdFavoriteBorder,
  MdFavorite,
  MdOutlinePerson,
  MdPerson,
} from 'react-icons/md';
import { useCart } from '../context/CartContext';
import './BottomNav.css';

const NAV_ITEMS = [
  { to: '/', label: 'Home', Icon: MdOutlineHome, ActiveIcon: MdHome, end: true },
  { to: '/shop', label: 'Categories', Icon: MdOutlineGridView, ActiveIcon: MdGridView },
  { to: '/cart', label: 'Cart', Icon: MdOutlineShoppingCart, ActiveIcon: MdShoppingCart, showBadge: true },
  { to: '/wishlist', label: 'Wishlist', Icon: MdFavoriteBorder, ActiveIcon: MdFavorite },
  { to: '/account', label: 'Account', Icon: MdOutlinePerson, ActiveIcon: MdPerson },
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
          {({ isActive }) => {
            const ItemIcon = isActive ? item.ActiveIcon : item.Icon;
            return (
              <>
                <span className="bn-icon">
                  <ItemIcon />
                  {item.showBadge && count > 0 && <span className="bn-badge">{count}</span>}
                </span>
                <span className="bn-label">{item.label}</span>
              </>
            );
          }}
        </NavLink>
      ))}
    </nav>
  );
}

