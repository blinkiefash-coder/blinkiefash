import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PhoneInput from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { setPassword } from '../api';
import './Auth.css';

// Small inline icon set — no extra dependency required.
const IconPhone = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);
const IconLock = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);
const IconEye = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8Z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);
const IconEyeOff = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a19.7 19.7 0 0 1 4.22-5.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a19.7 19.7 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" />
    <path d="M1 1l22 22" />
  </svg>
);
const IconArrow = () => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M5 12h14M13 6l6 6-6 6" />
  </svg>
);

export default function SetPassword() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    phone: '',
    newPassword: '',
    confirmPassword: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });
  const handlePhoneChange = (value) => setForm({ ...form, phone: value || '' });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!form.phone) {
      setError('Please enter your phone number');
      return;
    }

    if (form.newPassword.length < 6 || form.newPassword.length > 16) {
      setError('Password must be 6-16 characters');
      return;
    }

    if (form.newPassword !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const res = await setPassword({
        phone: form.phone,
        password: form.newPassword,
      });

      if (!res.success) {
        setError(res.message || 'Could not set password. Please try again.');
        return;
      }

      setMessage('Password set successfully! You can now log in with your phone and password.');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to set password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <h1>
        Set Your <span className="brand-accent">Password</span>
      </h1>
      <p className="auth-subtitle">Create a password for your account to login with your phone.</p>

      <form className="auth-form" onSubmit={handleSubmit}>
        <div className="auth-input-wrap">
          <span className="auth-input-icon"><IconPhone /></span>
          <PhoneInput
            value={form.phone}
            onChange={handlePhoneChange}
            defaultCountry="IN"
            placeholder="Enter your phone number"
            className="auth-phone-input"
          />
        </div>

        <div className="auth-input-wrap">
          <span className="auth-input-icon"><IconLock /></span>
          <input
            id="newPassword"
            name="newPassword"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create New Password"
            value={form.newPassword}
            onChange={handleChange}
            minLength={6}
            maxLength={16}
            required
          />
          <button
            type="button"
            className="auth-input-toggle"
            onClick={() => setShowPassword((v) => !v)}
            aria-label={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>
        <p className="auth-field-hint">
          Use 6–16 characters with a mix of letters, numbers &amp; symbols.
        </p>

        <div className="auth-input-wrap">
          <span className="auth-input-icon"><IconLock /></span>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type={showConfirmPassword ? 'text' : 'password'}
            placeholder="Confirm Password"
            value={form.confirmPassword}
            onChange={handleChange}
            minLength={6}
            maxLength={16}
            required
          />
          <button
            type="button"
            className="auth-input-toggle"
            onClick={() => setShowConfirmPassword((v) => !v)}
            aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
          >
            {showConfirmPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-hint">{message}</p>}

        <button
          type="submit"
          className="primary-btn auth-submit-btn"
          disabled={loading}
        >
          {loading ? (
            'Setting password...'
          ) : (
            <>
              Set Password <IconArrow />
            </>
          )}
        </button>
      </form>

      <p className="auth-switch">
        Already have a password? <Link to="/login">Log in</Link>
      </p>
    </div>
  );
}
