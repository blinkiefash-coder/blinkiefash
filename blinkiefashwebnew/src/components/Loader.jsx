export default function Loader({ label = 'Loading...', subtitle = '', overlay = false }) {
  return (
    <div className={overlay ? 'loader-overlay' : 'loader-inline'}>
      <div className="loader-spinner" />
      <p className="loader-label">{label}</p>
      {subtitle ? <p className="loader-subtitle">{subtitle}</p> : null}
    </div>
  );
}
