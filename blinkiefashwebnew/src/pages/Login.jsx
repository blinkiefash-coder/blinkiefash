import { useRef, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authStart, authVerify } from '../api';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase.js';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const recaptchaInitialized = useRef(false);

  const ensureRecaptcha = () => {
    if (typeof window === 'undefined') {
      throw new Error('Firebase auth is not initialized');
    }

    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }

    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        'recaptcha-container',
        { size: 'invisible' },
        auth
      );
    }

    return window.recaptchaVerifier;
  };

  const formatPhone = (rawPhone) => {
    const trimmed = rawPhone.replace(/\D/g, '');
    if (trimmed.startsWith('91') && trimmed.length === 12) return `+${trimmed}`;
    if (trimmed.length === 10) return `+91${trimmed}`;
    if (trimmed.startsWith('+') && trimmed.length >= 10) return trimmed;
    return `+${trimmed}`;
  };

  const handleStart = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const formattedPhone = formatPhone(phone);
      const appVerifier = ensureRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Could not send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      if (!confirmationResult) {
        setError('OTP flow not initialized. Please request a new OTP.');
        setStep('phone');
        return;
      }

      const result = await confirmationResult.confirm(otp);
      const fbUser = result.user;
      const idToken = await fbUser.getIdToken();

      const res = await authVerify({ idToken, expectedRole: 'customer' });
      if (!res.success) {
        setError(res.message || 'Invalid OTP');
        return;
      }

      login(res.user, res.token);
      navigate('/account');
    } catch (err) {
      setError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page auth-page">
      <h1>Log in</h1>
      <p className="auth-subtitle">Use your registered mobile number to continue.</p>

      {step === 'phone' && (
        <form className="auth-form" onSubmit={handleStart}>
          <label htmlFor="phone">Mobile number</label>
          <input
            id="phone"
            type="tel"
            placeholder="10-digit mobile number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Please wait...' : 'Send OTP'}
          </button>
        </form>
      )}

      {step === 'otp' && (
        <form className="auth-form" onSubmit={handleVerify}>
          <label htmlFor="otp">Enter OTP</label>
          <input
            id="otp"
            type="text"
            placeholder="6-digit OTP"
            value={otp}
            onChange={(e) => setOtp(e.target.value)}
            required
          />
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify & continue'}
          </button>
          <button
            type="button"
            className="secondary-btn"
            onClick={() => {
              setStep('phone');
              setOtp('');
              setError('');
            }}
          >
            Change number
          </button>
        </form>
      )}

      <div id="recaptcha-container" />

      <p className="auth-switch">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
