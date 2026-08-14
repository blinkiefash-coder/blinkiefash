import { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getGamificationState, completeQuestLevel } from '../api';
import './OfferFeature.css';

const EMOJIS = ['👗', '👘', '👙', '👚', '👛', '👜', '👟', '👠', '👒', '🧢', '🧣', '🧥'];
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

function buildBoard(pairCount = 6) {
  const picks = shuffle(EMOJIS).slice(0, pairCount);
  return shuffle([...picks, ...picks].map((emoji, i) => ({ id: i, emoji, flipped: false, matched: false })));
}

export default function FashionQuest() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [level, setLevel] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [halfPct, setHalfPct] = useState(0);
  const [questRewardPct, setQuestRewardPct] = useState(0);
  const [cards, setCards] = useState(() => buildBoard());
  const [flipped, setFlipped] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [error, setError] = useState(null);
  const [playing, setPlaying] = useState(false);

  const load = async () => {
    if (!user?.id) return;
    setLoading(true);
    try {
      const data = await getGamificationState(user.id);
      setLevel(data.questLevel || 0);
      setTodayCount(data.questTodayCount || 0);
      setHalfPct(data.questHalfPct || 0);
      setQuestRewardPct(data.questRewardPct || 0);
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

  const startLevel = () => {
    if (todayCount >= DAILY_LIMIT) {
      setMessage('Daily limit reached (10 levels). Come back tomorrow!');
      return;
    }
    if (level >= MAX_LEVEL) {
      setMessage('You completed all 1000 levels!');
      return;
    }
    setCards(buildBoard(6));
    setFlipped([]);
    setBusy(false);
    setPlaying(true);
    setMessage(null);
    setError(null);
  };

  const onCardClick = useCallback(
    async (index) => {
      if (!playing || busy) return;
      const card = cards[index];
      if (card.flipped || card.matched) return;
      if (flipped.length >= 2) return;

      const nextCards = cards.map((c, i) => (i === index ? { ...c, flipped: true } : c));
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
        const allMatched = matched.every((c) => c.matched);
        if (allMatched && user?.id) {
          try {
            const res = await completeQuestLevel(user.id);
            if (res.success) {
              setLevel(res.questLevel ?? level + 1);
              setTodayCount(res.questTodayCount ?? todayCount + 1);
              if (res.questHalfPct != null) setHalfPct(res.questHalfPct);
              setMessage(`Level cleared! Progress: ${(res.questLevel ?? level + 1)} / ${MAX_LEVEL}`);
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
            prev.map((c, i) => (i === a || i === b ? { ...c, flipped: false } : c))
          );
          setFlipped([]);
          setBusy(false);
        }, 700);
      }
    },
    [playing, busy, cards, flipped, user?.id, level, todayCount]
  );

  if (!isLoggedIn) {
    return (
      <main className="page offer-feature-page">
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

  return (
    <main className="page offer-feature-page">
      <button type="button" className="offer-back" onClick={() => navigate('/offers')}>
        ← Back to Offers
      </button>

      <header className="offer-feature-header quest-header">
        <span className="offer-feature-emoji">🎮</span>
        <div>
          <h1>Fashion Quest</h1>
          <p>Match pairs · 10 levels/day · up to +5% off</p>
        </div>
      </header>

      {loading ? (
        <p className="state-msg">Loading…</p>
      ) : (
        <>
          <section className="offer-feature-card">
            <div className="refer-stats">
              <div>
                <strong>{level}</strong>
                <span>Levels done</span>
              </div>
              <div>
                <strong>
                  {todayCount}/{DAILY_LIMIT}
                </strong>
                <span>Today</span>
              </div>
              <div>
                <strong>{(halfPct * 0.5).toFixed(1)}%</strong>
                <span>Quest discount</span>
              </div>
            </div>
            {!playing && (
              <button
                type="button"
                className="primary-btn"
                style={{ marginTop: 16 }}
                onClick={startLevel}
                disabled={todayCount >= DAILY_LIMIT || level >= MAX_LEVEL}
              >
                {todayCount >= DAILY_LIMIT ? 'Come back tomorrow' : 'Play next level'}
              </button>
            )}
          </section>

          {playing && (
            <section className="offer-feature-card">
              <div className="quest-grid">
                {cards.map((card, i) => (
                  <button
                    key={card.id}
                    type="button"
                    className={`quest-card${card.flipped || card.matched ? ' open' : ''}${
                      card.matched ? ' matched' : ''
                    }`}
                    onClick={() => onCardClick(i)}
                    disabled={card.matched || busy}
                  >
                    {card.flipped || card.matched ? card.emoji : '?'}
                  </button>
                ))}
              </div>
            </section>
          )}

          {message && <p className="offer-success">{message}</p>}
          {error && <p className="offer-error">{error}</p>}
          {questRewardPct > 0 && (
            <p className="muted-note">Banked quest reward: {questRewardPct}% off</p>
          )}
        </>
      )}
    </main>
  );
}
