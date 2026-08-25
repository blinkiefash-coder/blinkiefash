import { useNavigate } from 'react-router-dom';
import './AppHeader.css';

export default function AppHeader({ showSearch = true }) {
  const navigate = useNavigate();
  const city = localStorage.getItem('bfw_city') || 'Bhubaneswar';

  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.elements.q.value.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
  };

  return (
    <header className="app-header">
      <div className="ah-location" onClick={() => navigate('/account')} role="button" tabIndex={0}>
        <div>
          <p className="ah-location-label">Deliver in 60 mins to</p>
          <p className="ah-location-city">{city}</p>
        </div>
        <span className="ah-pill">DISTANCE-BASED DELIVERY</span>
      </div>
      {showSearch && (
        <form className="ah-search" onSubmit={handleSearch}>
          <span className="ah-search-icon">🔍</span>
          <input name="q" type="text" placeholder="Search for products, brands..." />
        </form>
      )}
    </header>
  );
}
