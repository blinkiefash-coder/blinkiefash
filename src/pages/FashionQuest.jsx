import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGamificationState, completeQuestLevel } from '../api';
import './OfferFeature.css';
import './FashionQuest.css';

const EMOJIS = ['👗', '👘', '👙', '👚', '👛', '👜', '👟', '👠', '👒', '🧢'];
const DAILY_LIMIT = 10;
const MAX_LEVEL = 1000;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function buildBoard(pairCount = 5) {
  const picks = shuffle(EMOJIS).slice(0, pairCount);
  return shuffle(
    [...picks, ...picks].map((emoji, i) => ({
      id: i,
      emoji,
      flipped: false,
      matched: false,
    }))
  );
}

export default function FashionQuest() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(14);
  const [todayCount, setTodayCount] = useState(0);
  const [halfPct, setHalfPct] = useState(0);
  const [questRewardPct, setQuestRewardPct] = useState(0);
  const [cards, setCards] = useState(() => buildBoard(5));
  const [flipped, setFlipped] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);
  const [lives] = useState(2);
  const [score, setScore] = useState(0);

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
        setLevel(data.questLevel || 14);
        setTodayCount(data.questTodayCount || 0);
        setHalfPct(data.questHalfPct || 0);
        setQuestRewardPct(data.questRewardPct || 0);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [isLoggedIn, user?.id]);

  const startLevel = () => {
    if (todayCount >= DAILY_LIMIT) {
      setMessage('Daily limit reached (10 levels). Come back tomorrow!');
      return;
    }
    if (level >= MAX_LEVEL) {
      setMessage('You completed all 1000 levels!');
      return;
    }
    setCards(buildBoard(5));
    setFlipped([]);
    setBusy(false);
    setPlaying(true);
    setMessage(null);
    setError(null);
  };

  const onCardClick = async (index) => {
    if (!playing || busy) return;
    const card = cards[index];
    if (card.flipped || card.matched) return;
    if (flipped.length >= 2) return;

    const nextCards = cards.map((c, i) =>
      i === index ? { ...c, flipped: true } : c
    );
    const nextFlipped = [...flipped, index];
    setCards(nextCards);
    setFlipped(nextFlipped);

    if (nextFlipped.length < 2) return;

    setBusy(true);
    const [a, b] = nextFlipped;

    if (nextCards[a].emoji === nextCards[b].emoji) {
      const matched = nextCards.map((c, i) =>
        i === a || i === b ? { ...c, matched: true } : c
      );
      setCards(matched);
      setFlipped([]);
      setBusy(false);
      setScore((s) => s + 10);

      const allMatched = matched.every((c) => c.matched);
      if (allMatched && user?.id) {
        try {
          const res = await completeQuestLevel(user.id);
          if (res.success) {
            setLevel(res.questLevel ?? level + 1);
            setTodayCount(res.questTodayCount ?? todayCount + 1);
            if (res.questHalfPct != null) setHalfPct(res.questHalfPct);
            setMessage(
              `Level cleared! Progress: ${res.questLevel ?? level + 1} / ${MAX_LEVEL}`
            );
            setPlaying(false);
          } else {
            setError(res.message || 'Could not save progress');
            setPlaying(false);
          }
        } catch (err) {
          setError(err.message || 'Could not save progress');
          setPlaying(false);
        }
      }
    } else {
      setTimeout(() => {
        setCards((prev) =>
          prev.map((c, i) =>
            i === a || i === b ? { ...c, flipped: false } : c
          )
        );
        setFlipped([]);
        setBusy(false);
      }, 700);
    }
  };

  if (!isLoggedIn) {
    return (
      <main className="page offer-feature-page fashion-quest-page">
        <button type="button" className="offer-back" onClick={() => navigate('/offers')}>
          ← Back to Offers
        </button>
        <div className="offer-feature-card">
          <h1>Fashion Quest</h1>
          <p>Log in to play memory match and earn daily discounts.</p>
          <button type="button" className="primary-btn" onClick={() => navigate('/login')}>
            Log in
          </button>
        </div>
      </main>
    );
  }

  const progressPct = Math.min(100, (level / MAX_LEVEL) * 100).toFixed(1);

  return (
    <main className="page offer-feature-page fashion-quest-page">
      <div className="fq-breadcrumb">Home &nbsp;›&nbsp; Fashion Quest</div>

      <div className="fq-top">
        <div className="fq-title-block">
          <h1>
            Fashion <span className="accent">Quest</span>
            <span className="game-icon">🎮</span>
          </h1>
          <p>Play daily, complete levels &amp; win exciting rewards!</p>
        </div>

        <div className="fq-stats-bar">
          <div className="fq-stat">
            <span className="stat-icon">🏆</span>
            <div>
              <strong>{progressPct}%</strong>
              <span>Total Progress</span>
              <small>Keep playing to win big rewards!</small>
            </div>
          </div>
          <div className="fq-stat">
            <span className="stat-icon">🛡️</span>
            <div>
              <strong>Level {level}</strong>
              <span>Your Level</span>
              <small>L{level} / {MAX_LEVEL}</small>
            </div>
          </div>
          <div className="fq-stat">
            <span className="stat-icon">📅</span>
            <div>
              <strong>{todayCount} / {DAILY_LIMIT}</strong>
              <span>Today's Quest</span>
              <small>+{(halfPct * 0.5).toFixed(1)}%</small>
            </div>
          </div>
          <div className="fq-stat">
            <span className="stat-icon">💚</span>
            <div>
              <strong>Lives</strong>
              <div className="lives">
                {[0, 1, 2].map((i) => (
                  <span key={i}>{i < lives ? '❤️' : '🖤'}</span>
                ))}
              </div>
            </div>
          </div>
          <div className="fq-stat">
            <span className="stat-icon">⭐</span>
            <div>
              <strong>{score}</strong>
              <span>Score</span>
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <p className="state-msg">Loading…</p>
      ) : (
        <>
          <div className="fq-main">
            {/* LEFT – cards */}
            <div className="fq-left">
              <div className="fq-level-badge">
                Level {level} • Match 3 pairs
              </div>
              <p className="fq-instruction">
                Flip the cards and find matching pairs!
              </p>

              <div className={`fq-card-grid ${playing ? 'playing' : ''}`}>
                {cards.map((card, i) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`fq-memory-card ${
                      card.flipped || card.matched ? 'open' : ''
                    } ${card.matched ? 'matched' : ''}`}
                    onClick={() => onCardClick(i)}
                    disabled={!playing || card.matched || busy}
                  >
                    <div className="card-inner">
                      <div className="card-back">
                        <div className="card-back-inner"></div>
                        <div className="card-back-inner-bottom"></div>
                        <div className="corner-br"></div>
                        <div className="center-frame"></div>
                      </div>
                      <div className="card-front">{card.emoji}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT – rewards only */}
            <div className="fq-right">
              <div className="fq-rewards-panel">
                <h3>
                  <span>🎁</span> Possible Rewards
                </h3>

                <div className="fq-rewards-grid">
                  <div className="fq-reward yellow">1% DISCOUNT</div>
                  <div className="fq-reward blue">2% DISCOUNT</div>
                  <div className="fq-reward green">5% DISCOUNT</div>
                  <div className="fq-reward purple">10% DISCOUNT</div>
                  <div className="fq-reward pink">FREE T-SHIRT</div>
                  <div className="fq-reward orange">FREE SMARTWATCH</div>
                </div>

                <div className="fq-locked-row">
                  <div className="fq-locked">
                    <span>🔄</span> TRY AGAIN TOMORROW
                  </div>
                  <div className="fq-locked">
                    <span>🔒</span> CAR LOCKED
                    <small>Reach higher levels to unlock</small>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* BOTTOM BAR: 3 info cards + PLAY button (matches target) */}
          <div className="fq-bottom-bar">
            <div className="fq-info-row">
              <div className="fq-info-card">
                <span>⚡</span>
                <div>
                  <strong>Daily Quest</strong>
                  <p>Play 10 levels daily to earn bonus rewards!</p>
                </div>
              </div>
              <div className="fq-info-card">
                <span>📅</span>
                <div>
                  <strong>Come Back Daily</strong>
                  <p>New quests &amp; bigger rewards every day!</p>
                </div>
              </div>
              <div className="fq-info-card">
                <span>🎁</span>
                <div>
                  <strong>Win Exciting Rewards</strong>
                  <p>Discounts, freebies &amp; special surprises!</p>
                </div>
              </div>
            </div>

            <button
              className="fq-play-btn"
              onClick={startLevel}
              disabled={playing || todayCount >= DAILY_LIMIT || level >= MAX_LEVEL}
            >
              <span>🎲</span>
              {playing
                ? 'PLAYING…'
                : todayCount >= DAILY_LIMIT
                ? 'COME BACK TOMORROW'
                : 'PLAY NOW'}
            </button>
          </div>

          {message && <p className="fq-message success">{message}</p>}
          {error && <p className="fq-message error">{error}</p>}
          {questRewardPct > 0 && (
            <p className="fq-reward-note">
              Banked quest reward: {questRewardPct}% off
            </p>
          )}
        </>
      )}

      <div className="fq-how">
        <h3>How It Works</h3>
        <div className="fq-steps">
          <div className="fq-step">
            <div className="step-num">1</div>
            <div>
              <strong>Flip Cards</strong>
              <p>Tap on any card to flip it</p>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="fq-step">
            <div className="step-num">2</div>
            <div>
              <strong>Find Pairs</strong>
              <p>Match 3 pairs to complete the level</p>
            </div>
          </div>
          <div className="step-arrow">→</div>
          <div className="fq-step">
            <div className="step-num">3</div>
            <div>
              <strong>Win Rewards</strong>
              <p>Complete levels &amp; win exciting rewards</p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}