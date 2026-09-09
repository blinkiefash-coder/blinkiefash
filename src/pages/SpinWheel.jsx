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
  { label: '5%\nDISCOUNT', short: '5% Off', icon: '💰' },
  { label: '2%\nDISCOUNT', short: '2% Off', icon: '🏷️' },
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
        if (!cancelled) {
          setError(err.message || 'Failed to load');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    load();

    return () => {
      cancelled = true;
    };
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

      /*
       * Place the center of the winning segment
       * directly under the top pointer.
       */
      const target =
        360 * 6 + (360 - (index * segment + segment / 2));

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
        <button
          type="button"
          className="offer-back"
          onClick={() => navigate('/offers')}
        >
          ← Back to Offers
        </button>

        <div className="offer-feature-card">
          <h1>Spin &amp; Win</h1>

          <p>
            Log in to spin the wheel once a day and win discounts.
          </p>

          <button
            type="button"
            className="primary-btn"
            onClick={() => navigate('/login')}
          >
            Log in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="page offer-feature-page spin-page">

      <div className="spin-breadcrumb">
        Home <span>›</span> Spin &amp; Win
      </div>

      <div className="spin-layout">

        {/* ================= LEFT ================= */}

        <div className="spin-left">

          <header className="spin-title-block">
            <h1>
              Spin &amp; <span className="accent">Win</span>
              <span className="sparkle">✨</span>
            </h1>

            <p>
              Spin the wheel and win exciting rewards!
            </p>
          </header>

          <section className="spin-card">

            {loading ? (
              <p className="state-msg">
                Loading…
              </p>
            ) : (
              <>
                {/* ================= WHEEL ================= */}

                <div className="wheel-wrapper">

                  {/* Pointer */}
                  <div className="spin-pointer">
                    <div className="pointer-triangle" />

                    <div className="pointer-hub">
                      <span>✦</span>
                    </div>
                  </div>

                  {/* Outer Wheel */}
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

                      {PRIZES.map((prize, index) => {
                        const angle =
                          (360 / PRIZES.length) * index;

                        const lines = prize.label.split('\n');

                        return (
                          <div
                            key={index}
                            className="spin-label"
                            style={{
                              '--angle': `${angle}deg`,
                            }}
                          >
                            <div className="spin-label-inner">

                              <div className="segment-icon">
                                {prize.icon}
                              </div>

                              <div className="segment-label">
                                {lines.map((line, lineIndex) => (
                                  <span key={lineIndex}>
                                    {line}
                                  </span>
                                ))}
                              </div>

                            </div>
                          </div>
                        );
                      })}

                    </div>

                    {/* Center Hub */}
                    <div className="wheel-center">
                      <div className="wheel-center-inner" />
                    </div>

                  </div>
                </div>

                {/* ================= CTA ================= */}

                <button
                  type="button"
                  className="spin-cta"
                  onClick={onSpin}
                  disabled={spinning || hasSpunToday}
                >
                  <span className="dice">🎲</span>

                  <span>
                    {spinning
                      ? 'SPINNING…'
                      : hasSpunToday
                      ? 'COME BACK TOMORROW'
                      : 'SPIN FOR REWARD'}
                  </span>
                </button>

                {/* Secure text */}
                <p className="spin-secure">
                  <span className="secure-icon">🛡️</span>

                  <span>
                    Win rewards instantly
                    <b>•</b>
                    No hidden charges
                  </span>
                </p>

                {/* Result */}
                {result && (
                  <p
                    className={`spin-result ${
                      result.isSorry ? 'sorry' : 'win'
                    }`}
                  >
                    {result.isSorry
                      ? 'Better luck tomorrow!'
                      : `You won: ${result.label}${
                          result.pct
                            ? ` (${result.pct}% off)`
                            : ''
                        }!`}
                  </p>
                )}

                {/* Error */}
                {error && (
                  <p className="spin-result sorry">
                    {error}
                  </p>
                )}

                {/* Available reward */}
                {spinRewardPct > 0 && (
                  <p className="spin-reward-note">
                    Available spin reward:{' '}
                    <strong>{spinRewardPct}% off</strong>
                  </p>
                )}
              </>
            )}

          </section>
        </div>

        {/* ================= RIGHT ================= */}

        <div className="spin-right">

          {/* Daily banner */}
          <div className="spin-banner">

            <div className="banner-icon">
              🎁
            </div>

            <div className="banner-content">
              <strong>
                Your daily luck window is open!
              </strong>

              <p>
                Spin now and grab exciting rewards.
              </p>
            </div>

            <div className="banner-gifts">
              <span>🎁</span>
              <span>🪙</span>
              <span>🏷️</span>
            </div>

          </div>

          {/* Rewards */}
          <div className="rewards-panel">

            <h3>
              <span className="reward-title-icon">
                🎁
              </span>

              Possible Rewards
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
                <span>🔄</span>
                <span>Try Again Tomorrow</span>
              </div>

              <div className="locked-item locked">
                <span>🔒</span>
                <span>Cart Locked</span>
              </div>

            </div>

          </div>
        </div>
      </div>

      {/* ================= TRUST BAR ================= */}

      <div className="spin-trust">

        <div className="trust-item">
          <span className="trust-icon">🛡️</span>

          <div>
            <strong>100% Safe &amp; Secure</strong>
            <p>Your data is protected</p>
          </div>
        </div>

        <div className="trust-item">
          <span className="trust-icon">⚡</span>

          <div>
            <strong>Instant Rewards</strong>
            <p>Rewards are credited instantly</p>
          </div>
        </div>

        <div className="trust-item">
          <span className="trust-icon">🔗</span>

          <div>
            <strong>Easy to Share</strong>
            <p>Share with friends &amp; family</p>
          </div>
        </div>

        <div className="trust-item">
          <span className="trust-icon">🏷️</span>

          <div>
            <strong>Best Deals Everyday</strong>
            <p>Use rewards on any order</p>
          </div>
        </div>

      </div>

    </main>
  );
}