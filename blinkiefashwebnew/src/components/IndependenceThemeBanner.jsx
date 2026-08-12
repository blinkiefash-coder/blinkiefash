const HIDE_AFTER_IST_UTC_MS = Date.UTC(2026, 7, 16, 18, 30, 0);

export default function IndependenceThemeBanner() {
  if (Date.now() >= HIDE_AFTER_IST_UTC_MS) {
    return null;
  }

  return (
    <section className="id-theme-banner" aria-label="Independence Day theme banner">
      <p className="id-theme-kicker">15 August Special</p>
      <p className="id-theme-text">
        Happy Independence Day! Celebrate freedom with festive styles and quick delivery.
      </p>
    </section>
  );
}
