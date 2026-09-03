import logo from '../assets/logo.png';
import './Loader.css';

export default function Loader({
  label = '',
  subtitle = '',
  overlay = false,
  showLogo = false,
}) {
  const hasText = Boolean(label || subtitle);
  const showBrandLogo = showLogo || overlay;

  return (
    <div className={overlay ? 'loader-overlay' : 'loader-inline'}>
      <div className={`loader-spinner-wrap${showBrandLogo ? ' has-logo' : ''}`}>
        <div className="loader-spinner" />
        {showBrandLogo && (
          <img
            src={logo}
            alt="Blinkiefash"
            className="loader-logo"
          />
        )}
      </div>
      {hasText && label ? <p className="loader-label">{label}</p> : null}
      {hasText && subtitle ? <p className="loader-subtitle">{subtitle}</p> : null}
    </div>
  );
}