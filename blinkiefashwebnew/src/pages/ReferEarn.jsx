import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getReferralInfo, applyReferralCode } from '../api';
import './ReferEarn.css';

export default function ReferEarn() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(() => Boolean(isLoggedIn && user?.id));
  const [code, setCode] = useState('');
  const [totalReferrals, setTotalReferrals] = useState(0);
  const [availableReward, setAvailableReward] = useState(0);
  const [perReferralReward, setPerReferralReward] = useState(50);
  const [redeemCode, setRedeemCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isLoggedIn || !user?.id) {
      return;
    }
    let cancelled = false;

    (async () => {
      try {
        const data = await getReferralInfo(user.id);
        if (cancelled) return;
        setCode(data.code || '');
        setTotalReferrals(data.totalReferrals || 0);
        setAvailableReward(data.availableReward || 0);
        setPerReferralReward(data.perReferralReward || 50);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load referral info');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id]);

  const copyCode = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setMessage('Referral code copied!');
      setTimeout(() => {
        setCopied(false);
        setMessage(null);
      }, 2000);
    } catch {
      setError('Could not copy code');
    }
  };

  const shareCode = async () => {
    if (!code) return;
    const text = `Join BlinkieFash with my code ${code} and we both get up to ₹${perReferralReward} off!`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'BlinkieFash Refer & Earn', text });
      } catch {
        /* cancelled */
      }
    } else {
      copyCode();
    }
  };

  const onRedeem = async (e) => {
    e.preventDefault();
    if (!redeemCode.trim() || !user?.id) return;
    setRedeeming(true);
    setError(null);
    setMessage(null);
    try {
      const res = await applyReferralCode(user.id, redeemCode.trim());
      if (res.success) {
        setMessage(res.message || 'Code applied successfully! You both get rewards.');
        setRedeemCode('');
        const data = await getReferralInfo(user.id);
        setAvailableReward(data.availableReward || 0);
        setTotalReferrals(data.totalReferrals || 0);
      } else {
        setError(res.message || 'Could not apply code');
      }
    } catch (err) {
      setError(err.message || 'Could not apply code');
    } finally {
      setRedeeming(false);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="re-page">
        <nav className="re-breadcrumb">
          <button type="button" onClick={() => navigate('/')}>
            Home
          </button>
          <span>›</span>
          <button type="button" onClick={() => navigate('/account')}>
            My Account
          </button>
          <span>›</span>
          <span className="re-crumb-active">Refer &amp; Earn</span>
        </nav>
        <div className="re-login-card">
          <h1>Refer &amp; Earn</h1>
          <p>Log in to get your referral code and earn rewards.</p>
          <button type="button" className="re-btn-primary" onClick={() => navigate('/login')}>
            Log in
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="re-page">
      <nav className="re-breadcrumb" aria-label="Breadcrumb">
        <button type="button" onClick={() => navigate('/')}>
          Home
        </button>
        <span>›</span>
        <button type="button" onClick={() => navigate('/account')}>
          My Account
        </button>
        <span>›</span>
        <span className="re-crumb-active">Refer &amp; Earn</span>
      </nav>

      <header className="re-header">
        <div>
          <h1>
            Refer &amp; Earn{' '}
            <span className="re-sparkle" aria-hidden="true">
              ✦
            </span>
          </h1>
          <p>Invite your friends and earn exciting rewards together.</p>
        </div>
        <div className="re-header-art" aria-hidden="true">
          <span className="re-art-gift">🎁</span>
          <span className="re-art-coin">₹{perReferralReward}</span>
        </div>
      </header>

      {loading ? (
        <p className="re-loading">Loading your referral details…</p>
      ) : (
        <>
          <div className="re-top-row">
            <section className="re-promo-card">
              <div className="re-promo-icon" aria-hidden="true">
                🎁
              </div>
              <div>
                <h2>
                  Give ₹{perReferralReward}, Get upto ₹{perReferralReward}
                </h2>
                <p>
                  Share your code with friends. When they sign up using it, BOTH of you instantly get
                  upto ₹{perReferralReward} off your next order.
                </p>
              </div>
            </section>

            <section className="re-code-card">
              <h3>Your Referral Code</h3>
              <div className="re-code-box">
                <span className="re-code-text">{code || '—'}</span>
                <button
                  type="button"
                  className="re-copy-btn"
                  onClick={copyCode}
                  disabled={!code}
                  title="Copy code"
                  aria-label="Copy referral code"
                >
                  {copied ? '✓' : '⧉'}
                </button>
              </div>
              <button
                type="button"
                className="re-share-btn"
                onClick={shareCode}
                disabled={!code}
              >
                <span aria-hidden="true">↗</span> Share Invite
              </button>
            </section>
          </div>

          <div className="re-mid-row">
            <section className="re-redeem-card">
              <div className="re-redeem-head">
                <span className="re-redeem-icon" aria-hidden="true">
                  🎁
                </span>
                <div>
                  <h3>Have a Referral Code?</h3>
                  <p>
                    Redeem a friend&apos;s code and both of you get upto ₹{perReferralReward}{' '}
                    instantly!
                  </p>
                </div>
              </div>
              <form className="re-redeem-form" onSubmit={onRedeem}>
                <input
                  type="text"
                  placeholder="Enter referral code"
                  value={redeemCode}
                  onChange={(e) => setRedeemCode(e.target.value.toUpperCase())}
                  maxLength={20}
                  autoCapitalize="characters"
                />
                <button
                  type="submit"
                  className="re-btn-blue"
                  disabled={redeeming || !redeemCode.trim()}
                >
                  {redeeming ? 'Redeeming…' : 'Redeem Code'}
                </button>
              </form>
            </section>

            <section className="re-how-card">
              <h3>How It Works</h3>
              <ol className="re-steps">
                <li>
                  <span className="re-step-num">1</span>
                  <div>
                    <strong>Share your code</strong>
                    <p>Send it to friends &amp; family.</p>
                  </div>
                </li>
                <li>
                  <span className="re-step-num">2</span>
                  <div>
                    <strong>They sign up using your code</strong>
                    <p>They enter it during registration.</p>
                  </div>
                </li>
                <li>
                  <span className="re-step-num">3</span>
                  <div>
                    <strong>Both get upto ₹{perReferralReward} off</strong>
                    <p>Reward is auto-applied at checkout. Use it on any order.</p>
                  </div>
                </li>
              </ol>
            </section>
          </div>

          <div className="re-stats-row">
            <div className="re-stat-card">
              <span className="re-stat-icon re-stat-green" aria-hidden="true">
                👥
              </span>
              <div>
                <strong>{totalReferrals}</strong>
                <span>Successful Referrals</span>
              </div>
            </div>
            <div className="re-stat-card">
              <span className="re-stat-icon re-stat-teal" aria-hidden="true">
                💳
              </span>
              <div>
                <strong>₹{availableReward}</strong>
                <span>Available Reward</span>
              </div>
            </div>
            <div className="re-banner-card">
              <div className="re-banner-text">
                <span className="re-star" aria-hidden="true">
                  ⭐
                </span>
                <div>
                  <strong>More friends, more rewards!</strong>
                  <p>Keep referring and earn unlimited rewards.</p>
                </div>
              </div>
              <button type="button" className="re-view-btn">
                View My Referrals ›
              </button>
            </div>
          </div>

          {(message || error) && (
            <p className={message ? 're-success' : 're-error'} role="status">
              {message || error}
            </p>
          )}

          <footer className="re-trust">
            <div>
              <span aria-hidden="true">🛡️</span>
              <div>
                <strong>100% Safe &amp; Secure</strong>
                <small>Your data is protected</small>
              </div>
            </div>
            <div>
              <span aria-hidden="true">⚡</span>
              <div>
                <strong>Instant Rewards</strong>
                <small>Rewards are credited instantly</small>
              </div>
            </div>
            <div>
              <span aria-hidden="true">✈️</span>
              <div>
                <strong>Easy to Share</strong>
                <small>Share via WhatsApp, SMS &amp; more</small>
              </div>
            </div>
            <div>
              <span aria-hidden="true">🏷️</span>
              <div>
                <strong>Best Deals Everyday</strong>
                <small>Use rewards on any order</small>
              </div>
            </div>
          </footer>
        </>
      )}
    </main>
  );
}