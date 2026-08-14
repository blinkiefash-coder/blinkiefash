import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGamificationState, spinWheel } from '../api';
import './OfferFeature.css';
import './SpinWheel.css';

const PRIZES = [
  { label: 'FREE\nSMARTWATCH', short: 'Smartwatch', icon: '🎧' },
  { label: 'LOCK', short: 'Locked', icon: '🔒' },
  { label: 'DISCOUNT', short: 'Discount', icon: '🏷️' },
  { label: '5%\nDISCOUNT', short: '5% Off', icon: '5%' },
  { label: '2%\nDISCOUNT', short: '2% Off', icon: '2%' },
  { label: '10%\nDISCOUNT', short: '10% Off', icon: '⚡' },
  { label: 'TRY\nAGAIN', short: 'Try Again', icon: '🔄' },
  { label: 'FREE\nT-SHIRT', short: 'T-Shirt', icon: '👕' },
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

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!isLoggedIn || !user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await getGamificationState(user.id);
        if (cancelled) return;
        setHasSpunToday(!!data.hasSpunToday);
        setSpinRewardPct(data.spinRewardPct || 0);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
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

      // Land the center of the winning segment under the top pointer
      const target = 360 * 6 + (360 - (index * segment + segment / 2));
      setRotation(target);

      setTimeout(() => {
        setResult({
          label: data.prizeLabel || PRIZES[index]?.short,
          pct: data.rewardPct,
          isSorry: data.isSorry,
        });
        setHasSpunToday(true);
        if (!data.isSorry && data.rewardPct > 0) {
          setSpinRewardPct((p) => p + data.rewardPct);
        }
        setSpinning(false);
      }, 4500);
    } catch (err) {
      setError(err.message || 'Spin failed');
      setSpinning(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="page offer-feature-page spin-page">
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
    <main className="page offer-feature-page spin-page">
      <div className="spin-breadcrumb">Home &nbsp;›&nbsp; Spin &amp; Win</div>

      <div className="spin-layout">
        {/* LEFT */}
        <div className="spin-left">
          <header className="spin-title-block">
            <h1>
              Spin &amp; <span className="accent">Win</span>
              <span className="sparkle">✨</span>
            </h1>
            <p>Spin the wheel and win exciting rewards!</p>
          </header>

          <section className="spin-card">
            {loading ? (
              <p className="state-msg">Loading…</p>
            ) : (
              <>
                <div className="wheel-wrapper">
                  <div className="spin-pointer">
                    <div className="pointer-triangle"></div>
                    <div className="pointer-hub">✦</div>
                  </div>

                  <div className="wheel-outer">
                    <div
                      className="spin-wheel"
                      ref={wheelRef}
                      style={{
                        transform: `rotate(${rotation}deg)`,
                        transition: spinning
                          ? 'transform 4.2s cubic-bezier(0.15, 0.75, 0.1, 1)'
                          : 'none',
                      }}
                    >
                      {PRIZES.map((p, i) => {
                        const slice = 360 / PRIZES.length;
                        const angle = slice * i + slice / 2;

                        return (
                          <div
                            key={i}
                            className="spin-label"
                            style={{
                              transform: `rotate(${angle}deg) translateY(-110px)`,
                            }}
                          >
                            <div
                              className="spin-label-inner"
                              style={{ transform: `rotate(${-angle}deg)` }}
                            >
                              <span className="segment-icon">{p.icon}</span>
                              <span className="segment-label">{p.label}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    <div className="wheel-center">
                      <div className="wheel-center-inner"></div>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="spin-cta"
                  onClick={onSpin}
                  disabled={spinning || hasSpunToday}
                >
                  <span className="dice">🎲</span>
                  {spinning
                    ? 'SPINNING…'
                    : hasSpunToday
                    ? 'COME BACK TOMORROW'
                    : 'SPIN FOR REWARD'}
                </button>

                <p className="spin-secure">
                  <span>🛡️</span> Win rewards instantly • No hidden charges
                </p>

                {result && (
                  <p className={`spin-result ${result.isSorry ? 'sorry' : 'win'}`}>
                    {result.isSorry
                      ? 'Better luck tomorrow!'
                      : `You won: ${result.label}${result.pct ? ` (${result.pct}% off)` : ''}!`}
                  </p>
                )}
                {error && <p className="spin-result sorry">{error}</p>}
                {spinRewardPct > 0 && (
                  <p className="spin-reward-note">
                    Available spin reward: {spinRewardPct}% off
                  </p>
                )}
              </>
            )}
          </section>
        </div>

        {/* RIGHT */}
        <div className="spin-right">
          <div className="spin-banner">
            <div className="banner-icon">🎁</div>
            <div>
              <strong>Your daily luck window is open!</strong>
              <p>Spin now and grab exciting rewards.</p>
            </div>
            <div className="banner-gifts">🎁 🪙 🏷️</div>
          </div>

          <div className="rewards-panel">
            <h3>
              <span>🎁</span> Possible Rewards
            </h3>
            <div className="rewards-grid">
              <div className="reward-card">
                <span className="r-icon">🏷️</span>
                <span>1% Discount</span>
              </div>
              <div className="reward-card">
                <span className="r-icon">%</span>
                <span>2% Discount</span>
              </div>
              <div className="reward-card">
                <span className="r-icon">🏅</span>
                <span>5% Discount</span>
              </div>
              <div className="reward-card">
                <span className="r-icon">⚡</span>
                <span>10% Discount</span>
              </div>
              <div className="reward-card">
                <span className="r-icon">👕</span>
                <span>Free T-shirt</span>
              </div>
              <div className="reward-card">
                <span className="r-icon">⌚</span>
                <span>Free Smartwatch</span>
              </div>
            </div>

            <div className="locked-row">
              <div className="locked-item">
                <span>🔄</span> Try Again Tomorrow
              </div>
              <div className="locked-item locked">
                <span>🔒</span> Car Locked
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Trust bar */}
      <div className="spin-trust">
        <div>
          <span>🛡️</span>
          <div>
            <strong>100% Safe & Secure</strong>
            <p>Your data is protected</p>
          </div>
        </div>
        <div>
          <span>⚡</span>
          <div>
            <strong>Instant Rewards</strong>
            <p>Rewards are credited instantly</p>
          </div>
        </div>
        <div>
          <span>🔗</span>
          <div>
            <strong>Easy to Share</strong>
            <p>Share with friends & family</p>
          </div>
        </div>
        <div>
          <span>🏷️</span>
          <div>
            <strong>Best Deals Everyday</strong>
            <p>Use rewards on any order</p>
          </div>
        </div>
      </div>
    </main>
  );
}