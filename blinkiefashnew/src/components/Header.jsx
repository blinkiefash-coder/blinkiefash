import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './Header.css';

const PLAY_STORE = 'https://play.google.com/store/apps/details?id=com.blinkiefash.app&pcampaignid=web_share';

export default function Header({ location, onLocationClick }) {
  const [scrolled, setScrolled] = useState(false);
  const [cartCount] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchVal, setSearchVal] = useState('');
  const searchRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (searchOpen) searchRef.current?.focus();
  }, [searchOpen]);

  const handleSearch = e => {
    e.preventDefault();
    if (searchVal.trim()) {
      navigate(`/explore?q=${encodeURIComponent(searchVal.trim())}`);
      setSearchOpen(false);
      setSearchVal('');
    }
  };

  return (
    <header className={`hdr ${scrolled ? 'hdr--shadow' : ''}`}>
      {/* ── Row 1: Logo | Search bar | Icons ── */}
      <div className="hdr__main">
        {/* Logo */}
        <Link to="/" className="hdr__logo">
          <img src="/images/logo.png" alt="BlinkieFash" />
          <span className="hdr__brand">BLINKIE<b>FASH</b></span>
        </Link>

        {/* Search bar (desktop) */}
        <form className="hdr__search-bar" onSubmit={handleSearch}>
          <span className="hdr__search-icon">🔍</span>
          <input
            type="text"
            placeholder="Search for brands, products and more…"
            value={searchVal}
            onChange={e => setSearchVal(e.target.value)}
          />
          {searchVal && (
            <button type="button" className="hdr__search-clear" onClick={() => setSearchVal('')}>✕</button>
          )}
        </form>

        {/* Right icons */}
        <div className="hdr__icons">
          {/* Search icon (mobile) */}
          <button className="hdr__icon-btn hdr__icon-btn--mobile" onClick={() => setSearchOpen(s => !s)} aria-label="Search">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.35-4.35"/></svg>
          </button>

          {/* Explore */}
          <Link to="/explore" className="hdr__icon-btn" title="Explore">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            <span>Explore</span>
          </Link>

          {/* Wishlist */}
          <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="hdr__icon-btn" title="Wishlist">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z"/></svg>
            <span>Wishlist</span>
          </a>

          {/* Cart */}
          <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="hdr__icon-btn hdr__cart-btn" title="Cart">
            <span className="hdr__cart-wrap">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 2L3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 01-8 0"/></svg>
              {cartCount > 0 && <span className="hdr__cart-badge">{cartCount}</span>}
            </span>
            <span>Bag</span>
          </a>

          {/* Profile / Login */}
          <Link to="/vendor" className="hdr__icon-btn" title="Account">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            <span>Account</span>
          </Link>
        </div>
      </div>

      {/* ── Row 2: Location + Store buttons ── */}
      <div className="hdr__location-bar">
        <button className="hdr__loc-pill" onClick={onLocationClick}>
          <svg className="hdr__loc-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z"/><circle cx="12" cy="9" r="2.5"/></svg>
          <div className="hdr__loc-text">
            <span className="hdr__loc-label">Deliver in 60 mins to</span>
            <span className="hdr__loc-city">
              {location || 'Set your location'}
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="hdr__loc-arrow"><path d="M6 9l6 6 6-6"/></svg>
            </span>
          </div>
        </button>

        {/* Store download buttons */}
        <div className="hdr__store-btns">
          <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="hdr__store-btn">
            <img src="/images/google.png" alt="Google Play" />
            <div>
              <span>GET IT ON</span>
              <strong>Google Play</strong>
            </div>
          </a>
          <a href={PLAY_STORE} target="_blank" rel="noopener noreferrer" className="hdr__store-btn hdr__store-btn--apple">
            <img src="/images/apple-logo.png" alt="App Store" />
            <div>
              <span>DOWNLOAD ON THE</span>
              <strong>App Store</strong>
            </div>
          </a>
        </div>
      </div>

      {/* Mobile search overlay */}
      {searchOpen && (
        <form className="hdr__mobile-search" onSubmit={handleSearch}>
          <input ref={searchRef} value={searchVal} onChange={e => setSearchVal(e.target.value)} placeholder="Search brands, products…" />
          <button type="submit">🔍</button>
          <button type="button" onClick={() => { setSearchOpen(false); setSearchVal(''); }}>✕</button>
        </form>
      )}
    </header>
  );
}
