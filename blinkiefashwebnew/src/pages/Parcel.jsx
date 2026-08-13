import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { estimateParcel, createParcelRequest } from '../api';
import AppHeader from '../components/AppHeader';
import './Parcel.css';

export default function Parcel() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();

  const [pickup, setPickup] = useState({
    text: '',
    lat: null,
    lng: null,
    status: 'Idle',
  });
  const [drop, setDrop] = useState({
    text: '',
    lat: null,
    lng: null,
    status: 'Idle',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const canContinue =
    Boolean(pickup.text) &&
    Boolean(drop.text) &&
    pickup.lat != null &&
    pickup.lng != null &&
    drop.lat != null &&
    drop.lng != null;

  const useMyLocationForPickup = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported on this device.');
      return;
    }

    setGeoLoading(true);
    setError('');
    setPickup((p) => ({ ...p, status: 'Locating…' }));

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        let text = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
            { headers: { Accept: 'application/json' } }
          );
          const data = await res.json();
          if (data?.display_name) text = data.display_name;
        } catch {
          // keep coordinate text
        }

        setPickup({ text, lat, lng, status: 'Current location' });
        setGeoLoading(false);
      },
      (err) => {
        setError(err.message || 'Unable to get your location');
        setPickup((p) => ({ ...p, status: 'Idle' }));
        setGeoLoading(false);
      },
      { enableHighAccuracy: true, timeout: 12000 }
    );
  };

  const setPickupOnMap = () => {
    setPickup((p) => ({
      ...p,
      text: p.text || 'Mahura, Cuttack',
      lat: 20.4625,
      lng: 85.883,
      status: 'Pinned on map',
    }));
  };

  const setDropOnMap = () => {
    setDrop((d) => ({
      ...d,
      text: d.text || 'Master Canteen, Bhubaneswar',
      lat: 20.2961,
      lng: 85.8245,
      status: 'Pinned on map',
    }));
  };

  const handleContinue = async () => {
    setError('');

    if (!canContinue) {
      setError('Set both locations (coordinates required). Use map or current location.');
      return;
    }

    if (!isLoggedIn) {
      navigate('/login', { state: { from: '/parcel' } });
      return;
    }

    setLoading(true);
    try {
      const estimate = await estimateParcel({
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropLat: drop.lat,
        dropLng: drop.lng,
        city: 'cuttack',
      });

      const created = await createParcelRequest({
        userId: user?.id || user?.userId || localStorage.getItem('userUuid'),
        pickupText: pickup.text,
        dropText: drop.text,
        pickupLat: pickup.lat,
        pickupLng: pickup.lng,
        dropLat: drop.lat,
        dropLng: drop.lng,
        city: 'cuttack',
      });

      const id = created?.request?.id || created?.id || created?.data?.id;

      if (id) {
        navigate(`/parcel/${id}`, {
          state: { pickup, drop, estimate, created },
        });
      } else {
        navigate('/parcel/details', {
          state: { pickup, drop, estimate, created },
        });
      }
    } catch (e) {
      setError(e.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="parcel-page">
      <AppHeader showSearch />

      <section className="parcel-hero" aria-labelledby="parcel-title">
        <div>
          <h1 id="parcel-title">Parcel Service</h1>
          <p>
            Send parcels from one place to another with quick local pickup and
            drop.
          </p>
        </div>
      </section>

      <section className="parcel-card" aria-label="Parcel locations">
        <label className="parcel-label" htmlFor="pickup-input">
          Starting location
        </label>
        <div className="parcel-input-row">
          <input
            id="pickup-input"
            value={pickup.text}
            onChange={(e) =>
              setPickup((p) => ({ ...p, text: e.target.value }))
            }
            placeholder="Enter starting location"
            aria-describedby="pickup-status"
          />
          <button
            type="button"
            aria-label="Clear starting location"
            onClick={() =>
              setPickup({ text: '', lat: null, lng: null, status: 'Idle' })
            }
          >
            ×
          </button>
        </div>
        <p id="pickup-status" className="parcel-status">
          {pickup.status}
          {pickup.lat != null && (
            <span className="parcel-coords">
              {' '}
              · {Number(pickup.lat).toFixed(5)}, {Number(pickup.lng).toFixed(5)}
            </span>
          )}
        </p>
        <div className="parcel-map-actions">
          <button
            type="button"
            className="parcel-map-link"
            onClick={useMyLocationForPickup}
            disabled={geoLoading}
          >
            {geoLoading ? 'Getting location…' : 'Use my current location'}
          </button>
          <button
            type="button"
            className="parcel-map-link"
            onClick={setPickupOnMap}
          >
            Set Starting on map
          </button>
        </div>

        <hr />

        <label className="parcel-label" htmlFor="drop-input">
          Destination location
        </label>
        <div className="parcel-input-row">
          <input
            id="drop-input"
            value={drop.text}
            onChange={(e) =>
              setDrop((d) => ({ ...d, text: e.target.value }))
            }
            placeholder="Enter destination location"
            aria-describedby="drop-status"
          />
          <button
            type="button"
            aria-label="Clear destination"
            onClick={() =>
              setDrop({ text: '', lat: null, lng: null, status: 'Idle' })
            }
          >
            ×
          </button>
        </div>
        <p id="drop-status" className="parcel-status">
          {drop.status}
          {drop.lat != null && (
            <span className="parcel-coords">
              {' '}
              · {Number(drop.lat).toFixed(5)}, {Number(drop.lng).toFixed(5)}
            </span>
          )}
        </p>
        <button
          type="button"
          className="parcel-map-link"
          onClick={setDropOnMap}
        >
          Set Destination on map
        </button>

        {error ? (
          <p className="parcel-error" role="alert">
            {error}
          </p>
        ) : null}

        <button
          type="button"
          className="parcel-cta"
          disabled={loading || !canContinue}
          onClick={handleContinue}
        >
          {loading ? 'Please wait…' : 'Continue to Parcel Details'}
        </button>
      </section>

      <ul className="parcel-trust">
        <li>
          <strong>Quick Pickup & Drop</strong>
          <span>Fast and reliable service</span>
        </li>
        <li>
          <strong>Safe & Secure</strong>
          <span>Your parcels are in safe hands</span>
        </li>
        <li>
          <strong>Affordable Pricing</strong>
          <span>Best prices for local delivery</span>
        </li>
        <li>
          <strong>Support 24/7</strong>
          <span>We are here to help you</span>
        </li>
      </ul>
    </div>
  );
}