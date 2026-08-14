import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGamificationState, spinWheel } from '../api';
import './OfferFeature.css';

const PRIZES = [
  { label: '5% Off', color: '#22c55e' },
  { label: 'Sorry', color: '#94a3b8' },
  { label: '2% Off', color: '#38bdf8' },
  { label: 'Sorry', color: '#94a3b8' },
  { label: '10% Off', color: '#f59e0b' },
  { label: 'Sorry', color: '#94a3b8' },
  { label: 'Free', color: '#a855f7' },
  { label: 'Free', color: '#ec4899' },
  { label: 'Car', color: '#ef4444' },
  { label: '5% Off', color: '#16a34a' },
];

export default function SpinWheel() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [spinning, setSpinning] = useState(false);
  const [hasSpunToday, setHasSpunToday] = useState(false);
  const [spinRewardPct, setSpinRewardPct] = useState(0);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [rotation, setRotation] = useState(0);
  const wheelRef = useRef(null);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getGamificationState(user.id);
      setHasSpunToday(!!data.hasSpunToday);
      setSpinRewardPct(data.spinRewardPct || 0);
    } catch (err) {
      setError(err.message || 'Failed to load');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isLoggedIn && user?.id) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoggedIn, user?.id]);

  const onSpin = async () => {
    if (!user?.id || spinning || hasSpunToday) return;
    setSpinning(true);
    setError(null);
    setResult(null);
    try {
      const data = await spinWheel(user.id);
      if (!data.success) {
        setError(data.message || 'Already spun today');
        setHasSpunToday(true);
        setSpinning(false);
        return;
      }
      const index = data.spinIndex ?? 0;
      const segment = 360 / PRIZES.length;
      // Point the chosen segment to the top pointer
      const target = 360 * 5 + (360 - index * segment - segment / 2);
      setRotation(target);
      setTimeout(() => {
        setResult({
          label: data.prizeLabel || PRIZES[index]?.label,
          pct: data.rewardPct,
          isSorry: data.isSorry,
        });
        setHasSpunToday(true);
        if (!data.isSorry && data.rewardPct > 0) {
          setSpinRewardPct((p) => p + data.rewardPct);
        }
        setSpinning(false);
      }, 4200);
    } catch (err) {
      setError(err.message || 'Spin failed');
      setSpinning(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="page offer-feature-page">
        <button type="button" className="offer-back" onClick={() => navigate('/offers')}>
          ← Back to Offers
        </button>
        <div className="offer-feature-card">
          <h1>Spin &amp; Win</h1>
          <p>Log in to spin the wheel once a day and win discounts.</p>
          <button type="button" className="primary-btn" onClick={() => navigate('/login')}>
            Log in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page offer-feature-page">
      <button type="button" className="offer-back" onClick={() => navigate('/offers')}>
        ← Back to Offers
      </button>

      <header className="offer-feature-header spin-header">
        <span className="offer-feature-emoji">🎡</span>
        <div>
          <h1>Spin &amp; Win</h1>
          <p>One free spin every day. Win discounts &amp; big prizes!</p>
        </div>
      </header>

      {loading ? (
        <p className="state-msg">Loading…</p>
      ) : (
        <>
          <section className="offer-feature-card spin-card">
            <div className="spin-pointer">▼</div>
            <div
              className="spin-wheel"
              ref={wheelRef}
              style={{
                transform: `rotate(${rotation}deg)`,
                transition: spinning ? 'transform 4s cubic-bezier(0.15, 0.8, 0.1, 1)' : 'none',
              }}
            >
              {PRIZES.map((p, i) => {
                const angle = (360 / PRIZES.length) * i;
                return (
                  <div
                    key={i}
                    className="spin-segment"
                    style={{
                      transform: `rotate(${angle}deg)`,
                      background: p.color,
                    }}
                  >
                    <span>{p.label}</span>
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              className="primary-btn spin-btn"
              onClick={onSpin}
              disabled={spinning || hasSpunToday}
            >
              {spinning ? 'Spinning…' : hasSpunToday ? 'Come back tomorrow' : 'Spin Now'}
            </button>
            {result && (
              <p className={result.isSorry ? 'offer-error' : 'offer-success'}>
                {result.isSorry
                  ? 'Better luck tomorrow!'
                  : `You won: ${result.label}${result.pct ? ` (${result.pct}% off)` : ''}!`}
              </p>
            )}
            {spinRewardPct > 0 && (
              <p className="muted-note">Available spin reward: {spinRewardPct}% off</p>
            )}
          </section>
          {error && <p className="offer-error">{error}</p>}
        </>
      )}
    </main>
  );
}
