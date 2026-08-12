import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { hasVendorPasswordAuth } from '../utils/vendorSession';
import './Account.css';

const MENU = [
  { label: 'Orders', to: '/orders' },
  { label: 'Wishlist', to: '/wishlist' },
  { label: 'Addresses', to: '/checkout' },
  { label: 'Refer & Earn', to: '/account' },
  { label: 'Support', to: '/account' },
  { label: 'Policies', to: '/account' },
];

export default function Account() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout } = useAuth();
  const canSwitchToVendor = user?.role === 'vendor' && hasVendorPasswordAuth();

  if (!isLoggedIn) {
    return (
      <div className="page account-page">
        <h1 className="cart-title">Account</h1>
        <p className="state-msg">Log in to manage your orders, wishlist and addresses.</p>
        <div className="account-auth-actions">
          <button type="button" className="primary-btn" onClick={() => navigate('/login')}>
            Log in
          </button>
          <button type="button" className="secondary-btn" onClick={() => navigate('/signup')}>
            Create account
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page account-page">
      <div className="account-profile">
        <div className="account-avatar">{(user.name || '?').slice(0, 1).toUpperCase()}</div>
        <div>
          <p className="account-name">{user.name}</p>
          <p className="account-phone">{user.phone}</p>
        </div>
      </div>

      {canSwitchToVendor ? (
        <button type="button" className="primary-btn" onClick={() => navigate('/vendor/orders')}>
          Switch to Vendor Dashboard
        </button>
      ) : null}

      <div className="account-menu">
        {MENU.map((item) => (
          <button key={item.label} type="button" className="account-menu-item" onClick={() => navigate(item.to)}>
            {item.label}
            <span>&rarr;</span>
          </button>
        ))}
      </div>

      <button type="button" className="secondary-btn account-logout" onClick={logout}>
        Log out
      </button>
    </div>
  );
}
