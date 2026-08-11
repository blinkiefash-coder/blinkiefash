export default function Loader({ label = 'Loading...', overlay = false }) {
  return (
    <div className={overlay ? 'loader-overlay' : 'loader-inline'}>
      <div className="loader-spinner" />
      <p className="loader-label">{label}</p>
    </div>
  );
}
