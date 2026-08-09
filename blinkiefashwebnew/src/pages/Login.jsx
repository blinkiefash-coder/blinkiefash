import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authStart, authVerify } from '../api';
import { useAuth } from '../context/AuthContext';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [debugOtp, setDebugOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleStart = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authStart(phone, 'customer');
      if (!res.success) {
        setError(res.message || 'Could not find that number');
        return;
      }
      setDebugOtp(res.debugOtp || '');
      setStep('otp');
    } catch (err) {
      setError(err.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await authVerify({ phone, otp, expectedRole: 'customer' });
      if (!res.success) {
        setError(res.message || 'Invalid OTP');
        return;
      }
      login(res.user, res.token);
      navigate('/account');
    } catch (err) {
      setError(err.message || 'Something went wrong');
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
          {debugOtp && <p className="auth-hint">Dev OTP: {debugOtp}</p>}
          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify & continue'}
          </button>
        </form>
      )}

      <p className="auth-switch">
        New here? <Link to="/signup">Create an account</Link>
      </p>
    </div>
  );
}
