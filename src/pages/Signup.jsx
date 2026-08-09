import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api';
import './Auth.css';

export default function Signup() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', phone: '', email: '', referralCode: '' });
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setLoading(true);
    try {
      const res = await registerUser({ ...form, role: 'customer' });
      if (!res.success) {
        setError(res.message || 'Could not create your account');
        return;
      }
      setMessage('Account created! You can now log in.');
      setTimeout(() => navigate('/login'), 1200);
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <h1>Create account</h1>
      <p className="auth-subtitle">Join Blinkiefash for 60-minute fashion delivery.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <label htmlFor="name">Full name</label>
        <input id="name" name="name" value={form.name} onChange={handleChange} required />

        <label htmlFor="phone">Mobile number</label>
        <input id="phone" name="phone" type="tel" value={form.phone} onChange={handleChange} required />

        <label htmlFor="email">Email (optional)</label>
        <input id="email" name="email" type="email" value={form.email} onChange={handleChange} />

        <label htmlFor="referralCode">Referral code (optional)</label>
        <input id="referralCode" name="referralCode" value={form.referralCode} onChange={handleChange} />

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-hint">{message}</p>}

        <button type="submit" className="primary-btn" disabled={loading}>
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      <p className="auth-switch">
        Already have an account? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
