import { useState } from 'react';
import './LocationModal.css';

const POPULAR = [
  'Bhubaneswar', 'Cuttack', 'Hyderabad', 'Bengaluru',
  'Mumbai', 'Delhi', 'Chennai', 'Pune',
];

export default function LocationModal({ onClose, onSelect }) {
  const [query, setQuery] = useState('');
  const [detecting, setDetecting] = useState(false);

  const filtered = POPULAR.filter(c => c.toLowerCase().includes(query.toLowerCase()));

  const detect = () => {
    setDetecting(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&format=json`
          );
          const d = await r.json();
          const city = d.address?.city || d.address?.town || d.address?.village || d.address?.state || 'Your location';
          onSelect(city);
          onClose();
        } catch {
          onSelect('Your location');
          onClose();
        }
        setDetecting(false);
      },
      () => { setDetecting(false); alert('Location permission denied. Please select manually.'); }
    );
  };

  return (
    <div className="locmodal__overlay" onClick={onClose}>
      <div className="locmodal__sheet" onClick={e => e.stopPropagation()}>
        <div className="locmodal__header">
          <h3>Select your location</h3>
          <button onClick={onClose} className="locmodal__close">✕</button>
        </div>

        <button className="locmodal__detect" onClick={detect} disabled={detecting}>
          <span>📍</span>
          {detecting ? 'Detecting…' : 'Use my current location'}
        </button>

        <input
          className="locmodal__search"
          placeholder="Search city…"
          value={query}
          onChange={e => setQuery(e.target.value)}
          autoFocus
        />

        <p className="locmodal__label">Popular cities</p>
        <div className="locmodal__grid">
          {filtered.map(city => (
            <button
              key={city}
              className="locmodal__city"
              onClick={() => { onSelect(city); onClose(); }}
            >
              {city}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
