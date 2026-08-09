import { useNavigate } from 'react-router-dom';

export default function ComingSoon({ title, emoji, description }) {
  const navigate = useNavigate();
  return (
    <div className="page" style={{ textAlign: 'center', paddingTop: 48 }}>
      <div style={{ fontSize: 44 }}>{emoji}</div>
      <h1 style={{ fontSize: 18, marginTop: 12 }}>{title}</h1>
      <p className="state-msg">{description}</p>
      <button type="button" className="primary-btn" onClick={() => navigate('/')}>
        Back to home
      </button>
    </div>
  );
}
