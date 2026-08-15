import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { updateUserProfile } from '../api';
import logo from '../assets/logo.png';
import './Account.css';

/* ---------- icons ---------- */
const IconOrders = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 2h12l1 7H5L6 2z" />
    <path d="M5 9h14v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9z" />
    <path d="M9 13h6" />
  </svg>
);
const IconHeart = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);
const IconTag = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z" />
    <circle cx="7.5" cy="7.5" r="1.5" />
  </svg>
);
const IconTeam = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconMap = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);
const IconSupport = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 18v-6a9 9 0 0 1 18 0v6" />
    <path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3zM3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3z" />
  </svg>
);
const IconDoc = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
  </svg>
);
const IconShield = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);
const IconBuilding = () => (
  <svg viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" />
  </svg>
);
const IconLogout = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
  </svg>
);
const IconChevron = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18l6-6-6-6" />
  </svg>
);
const IconEdit = () => (
  <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2.4">
    <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />
  </svg>
);
const IconSearch = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="7" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);
const IconBell = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.7 21a2 2 0 0 1-3.4 0" />
  </svg>
);
const IconWishlistNav = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z" />
  </svg>
);
const IconCart = () => (
  <svg viewBox="0 0 24 24" width="19" height="19" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M6 6h15l-1.5 9h-12z" />
    <path d="M6 6 5 3H2" />
    <circle cx="9.5" cy="20" r="1.3" />
    <circle cx="17.5" cy="20" r="1.3" />
  </svg>
);

/* ---------- trust footer icons ---------- */
const IconClock = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 3" />
  </svg>
);
const IconCheckCircle = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <path d="m8.5 12.5 2.3 2.3L16 10" />
  </svg>
);
const IconRefresh = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 12a9 9 0 1 1-2.64-6.36" />
    <path d="M21 4v6h-6" />
  </svg>
);

/* ---------- section config ---------- */
const SECTIONS = [
  {
    id: 'activity',
    title: 'MY ACTIVITY',
    items: [
      { label: 'My Orders', subtitle: 'Track, return or buy again', to: '/orders', icon: <IconOrders />, color: '#fce4ec', iconColor: '#c2185b' },
      { label: 'Wishlist', subtitle: 'Products you have saved', to: '/wishlist', icon: <IconHeart />, color: '#e8eaf6', iconColor: '#3f51b5' },
      { label: 'My Offers', subtitle: 'Coupons, rewards & referrals', to: '/offers', icon: <IconTag />, color: '#fff8e1', iconColor: '#f9a825' },
    ],
  },
  {
    id: 'account',
    title: 'MY ACCOUNT',
    items: [
      { label: 'Manage Account', subtitle: 'Name, email, phone', to: '/account', icon: <IconTeam />, color: '#e8eaf6', iconColor: '#3f51b5' },
      { label: 'Saved Addresses', subtitle: 'Home, work and other addresses', to: '/account/addresses', icon: <IconMap />, color: '#e0f7fa', iconColor: '#00838f' },
    ],
  },
  {
    id: 'help',
    title: 'HELP & SUPPORT',
    items: [
      { label: 'Help & Query', subtitle: 'Call, WhatsApp, email & ticket', to: '/help-support', icon: <IconSupport />, color: '#e0f2f1', iconColor: '#00796b' },
    ],
  },
  {
    id: 'legal',
    title: 'LEGAL & POLICIES',
    items: [
      { label: 'Terms & Conditions', subtitle: '', to: '/terms', icon: <IconDoc />, color: '#f3e5f5', iconColor: '#7b1fa2' },
      { label: 'Privacy Policy', subtitle: '', to: '/privacy-policy', icon: <IconShield />, color: '#eceff1', iconColor: '#455a64' },
      { label: 'Company Policy', subtitle: '', to: '/account', icon: <IconBuilding />, color: '#eceff1', iconColor: '#455a64' },
    ],
  },
];

export default function AccountPage() {
  const navigate = useNavigate();
  const { user, isLoggedIn, logout, updateUser } = useAuth();

  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState('');
  const [profileEmail, setProfileEmail] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [profileError, setProfileError] = useState('');

  const handleOpenProfile = () => {
    setProfileName(user?.name || '');
    setProfileEmail(user?.email || '');
    setProfileError('');
    setProfileOpen(true);
  };

  const handleCloseProfile = () => {
    setProfileOpen(false);
    setSavingProfile(false);
    setProfileError('');
  };

  const handleSaveProfile = async () => {
    const trimmedName = profileName.trim();
    if (!trimmedName) {
      setProfileError('Name is required');
      return;
    }
    setSavingProfile(true);
    setProfileError('');

    try {
      const result = await updateUserProfile({
        userId: user?.id,
        name: trimmedName,
        email: profileEmail.trim(),
      });

      if (result.success) {
        updateUser({ name: trimmedName, email: profileEmail.trim() });
        setProfileOpen(false);
      } else {
        setProfileError(result.message || 'Could not update profile');
      }
    } catch (e) {
      console.error('Profile update error:', e);
      setProfileError('Something went wrong. Please try again.');
    } finally {
      setSavingProfile(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <div className="acct-page">
        <div className="acct-guest">
          <h1>My Account</h1>
          <p>Log in to manage your orders, wishlist and addresses.</p>
          <div className="acct-guest-actions">
            <button type="button" className="primary-btn" onClick={() => navigate('/login')}>
              Log in
            </button>
            <button type="button" className="secondary-btn" onClick={() => navigate('/signup')}>
              Create account
            </button>
          </div>
        </div>
      </div>
    );
  }

  const initial = (user?.name || '?').slice(0, 1).toUpperCase();

  return (
    <div className="acct-page">
      {/* top nav */}
      <nav className="acct-topnav">
        <div className="acct-topnav-inner">
          <div className="acct-logo">
            <img src={logo} alt="BlinkieFash" className="acct-logo-img" />
            <div className="acct-logo-text-wrap">
              <span className="acct-logo-text">
                BLINKIE<span className="fash">FASH</span>
              </span>
              <span className="acct-logo-sub">DELIVERED IN 60 MIN</span>
            </div>
          </div>

          <div className="acct-nav-row">
            <div className="acct-nav-search">
              <IconSearch />
              <span>Search Home Decor…</span>
            </div>

            <div className="acct-nav-links">
              <a href="/">Home</a>
              <a href="/shop">Categories</a>
              <a href="/orders">Orders</a>
              <a href="/parcel">Parcel</a>
              <a href="/account" className="active">
                Profile
              </a>
            </div>

            <div className="acct-nav-icons">
              <IconBell />
              <IconWishlistNav />
              <IconCart />
            </div>
          </div>
        </div>
      </nav>

      <div className="acct-content">
        {/* Profile banner */}
        <div className="acct-profile-banner">
          <div className="acct-avatar-wrap">
            <div className="acct-avatar">{initial}</div>
            <button
              type="button"
              className="acct-avatar-edit"
              onClick={handleOpenProfile}
              aria-label="Edit profile"
            >
              <IconEdit />
            </button>
          </div>

          <div className="acct-profile-info">
            <h1>{user?.name || 'User'}</h1>
            <p className="acct-phone">{user?.phone || '—'}</p>
            <button type="button" className="acct-edit-btn" onClick={handleOpenProfile}>
              Edit Profile
            </button>
          </div>
        </div>

        {/* Sections — each is one card, items laid out in a row inside it */}
        {SECTIONS.map((section) => (
          <section key={section.id} id={section.id} className="acct-section">
            <p className="acct-section-title">{section.title}</p>
            <div className="acct-section-card">
              {section.items.map((item) => (
                <button
                  key={item.label}
                  type="button"
                  className="acct-item-row"
                  onClick={() =>
                    item.label === 'Manage Account' ? handleOpenProfile() : navigate(item.to)
                  }
                >
                  <span className="acct-ic" style={{ background: item.color, color: item.iconColor }}>
                    {item.icon}
                  </span>
                  <span className="acct-item-text">
                    <span className="t">{item.label}</span>
                    {item.subtitle ? <span className="s">{item.subtitle}</span> : null}
                  </span>
                  <span className="acct-chev">
                    <IconChevron />
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}

        {/* Footer trust bar */}
        <div className="acct-trust-bar">
          <div className="acct-trust-item">
            <IconClock />
            <div>
              <span>60 Min Delivery</span>
              <small>Lightning fast delivery</small>
            </div>
          </div>
          <div className="acct-trust-item">
            <IconCheckCircle />
            <div>
              <span>Try Before You Buy</span>
              <small>100% satisfaction</small>
            </div>
          </div>
          <div className="acct-trust-item">
            <IconRefresh />
            <div>
              <span>Easy Returns</span>
              <small>Hassle free returns</small>
            </div>
          </div>
          <div className="acct-trust-item">
            <IconSupport />
            <div>
              <span>Support 24/7</span>
              <small>We are here to help</small>
            </div>
          </div>
        </div>

        <button type="button" className="acct-logout-btn" onClick={logout}>
          <IconLogout />
          Log Out
        </button>

        <footer className="acct-footer">
          <p className="acct-copyright">© 2024 BlinkieFash. All rights reserved. · BlinkieFash v2.0</p>
        </footer>
      </div>

      {profileOpen && (
        <div className="acct-modal-overlay" onClick={handleCloseProfile}>
          <div className="acct-modal" onClick={(e) => e.stopPropagation()}>
            <h3>My Profile</h3>

            <label className="acct-field-label">Full Name</label>
            <input
              className="acct-input"
              type="text"
              value={profileName}
              onChange={(e) => setProfileName(e.target.value)}
              placeholder="Full Name"
              disabled={savingProfile}
            />

            <label className="acct-field-label">Email (optional)</label>
            <input
              className="acct-input"
              type="email"
              value={profileEmail}
              onChange={(e) => setProfileEmail(e.target.value)}
              placeholder="Email (optional)"
              disabled={savingProfile}
            />

            <p className="acct-phone-readonly">Phone: {user?.phone || '—'}</p>

            {profileError && <p className="acct-modal-error">{profileError}</p>}

            <div className="acct-modal-actions">
              <button
                type="button"
                className="acct-modal-cancel"
                onClick={handleCloseProfile}
                disabled={savingProfile}
              >
                Cancel
              </button>
              <button
                type="button"
                className="acct-modal-save"
                onClick={handleSaveProfile}
                disabled={savingProfile}
              >
                {savingProfile ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}