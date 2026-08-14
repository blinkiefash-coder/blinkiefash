import { useNavigate } from 'react-router-dom';
import './Offers.css';

const OFFERS = [
  {
    icon: '🎁',
    title: 'Refer & Earn',
    badge: 'Reward',
    description: 'Earn ₹50 for every friend you invite',
    action: 'Explore Now',
    className: 'offer-orange',
    path: '/refer-earn',
  },
  {
    icon: '♻️',
    title: 'Donate Old Clothes',
    badge: 'Special',
    description: 'Give back old clothes & earn up to 5% off',
    action: 'Get 5% OFF',
    className: 'offer-green',
    path: '/account',
  },
  {
    icon: '🎡',
    title: 'Spin & Win',
    badge: 'Fun Zone',
    description: 'Spin the wheel daily — win discounts & big prizes!',
    action: 'Spin Now',
    className: 'offer-pink',
    path: '/spin-wheel',
  },
  {
    icon: '🎮',
    title: 'Fashion Quest',
    badge: 'Challenge',
    description: '1000 levels • 10/day • Complete levels = +5% off daily',
    action: 'Play Now',
    className: 'offer-purple',
    path: '/play-and-win',
  },
  {
    icon: '💰',
    title: 'Order Discounts',
    badge: 'Auto Applied',
    description: '₹100 off ₹1000+ • ₹250 off ₹2000+ • Buy 2 save 10%',
    action: 'Shop & Save',
    className: 'offer-gold',
    path: '/shop',
  },
];

export default function Offers() {
  const navigate = useNavigate();

  return (
    <main className="page offers-page">
      <header className="offers-header">
        <div>
          <h1>My Offers &amp; <span>Rewards</span></h1>
          <p>Explore exciting offers, earn rewards and save more on every order.</p>
        </div>
        <div className="offers-header-art" aria-hidden="true">🎁🏷️</div>
      </header>

      <section className="offers-list" aria-label="Available offers">
        {OFFERS.map((offer) => (
          <article className={`offer-row ${offer.className}`} key={offer.title}>
            <div className="offer-icon" aria-hidden="true">{offer.icon}</div>
            <div className="offer-copy">
              <div className="offer-title-line">
                <h2>{offer.title}</h2>
                <span className="offer-badge">{offer.badge}</span>
              </div>
              <p>{offer.description}</p>
            </div>
            <button type="button" className="offer-action" onClick={() => navigate(offer.path)}>
              {offer.action}
            </button>
            <span className="offer-arrow" aria-hidden="true">›</span>
          </article>
        ))}
      </section>

      <section className="offers-trust" aria-label="Offer benefits">
        <div><strong>♢ 100% Safe &amp; Secure</strong><span>Your data is protected</span></div>
        <div><strong>◇ Best Deals Everyday</strong><span>New offers updated daily</span></div>
        <div><strong>♧ Need Help?</strong><span>Visit Help &amp; Support</span></div>
      </section>
    </main>
  );
}