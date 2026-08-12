import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authLoginVendorWithEmailPassword, authLoginWithEmailPassword, authVerify } from '../api';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase.js';
import { clearVendorPasswordAuth, markVendorPasswordAuth } from '../utils/vendorSession';
import './Auth.css';

export default function Login() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [method, setMethod] = useState('email');
  const [step, setStep] = useState('phone');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);

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

  const handleEmailPasswordLogin = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      let customerError = '';

      try {
        const customerRes = await authLoginWithEmailPassword({
          email,
          password,
          expectedRole: 'customer',
        });

        if (customerRes.success) {
          clearVendorPasswordAuth();
          localStorage.removeItem('vendor_id');
          localStorage.removeItem('vendor_store_id');
          localStorage.removeItem('store_name');
          localStorage.removeItem('vendor_name');
          login(customerRes.user, customerRes.token);
          navigate('/account');
          return;
        }

        customerError = customerRes.message || 'Invalid email or password';
      } catch (customerErr) {
        customerError = customerErr.message || 'Invalid email or password';
      }

      const vendorRes = await authLoginVendorWithEmailPassword({ email, password });
      if (!vendorRes.success) {
        setError(vendorRes.message || customerError || 'Invalid email or password');
        return;
      }

      if (vendorRes.vendor_id) localStorage.setItem('vendor_id', String(vendorRes.vendor_id));
      if (vendorRes.user_id) localStorage.setItem('user_id', String(vendorRes.user_id));
      if (vendorRes.dark_store_id) localStorage.setItem('vendor_store_id', String(vendorRes.dark_store_id));
      if (vendorRes.store_name) localStorage.setItem('store_name', String(vendorRes.store_name));
      if (vendorRes.owner_name) localStorage.setItem('vendor_name', String(vendorRes.owner_name));
      markVendorPasswordAuth();

      const vendorUserId = vendorRes.user_id || vendorRes.vendor_id;
      login(
        {
          id: vendorUserId,
          name: vendorRes.owner_name || vendorRes.store_name || 'Vendor',
          phone: '',
          email: String(email || '').trim().toLowerCase(),
          role: 'vendor',
        },
        `vendor_session_${vendorUserId || Date.now()}_${Date.now()}`
      );

      navigate('/account');
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
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
      <p className="auth-subtitle">Log in with email and password or use mobile OTP.</p>

      <div className="auth-method-switch" role="tablist" aria-label="Login method">
        <button
          type="button"
          className={`auth-method-btn ${method === 'email' ? 'active' : ''}`}
          onClick={() => {
            setMethod('email');
            setError('');
          }}
        >
          Email + Password
        </button>
        <button
          type="button"
          className={`auth-method-btn ${method === 'otp' ? 'active' : ''}`}
          onClick={() => {
            setMethod('otp');
            setError('');
            setStep('phone');
            setOtp('');
          }}
        >
          Phone OTP
        </button>
      </div>

      {method === 'email' && (
        <form className="auth-form" onSubmit={handleEmailPasswordLogin}>
          <label htmlFor="email">Email</label>
          <input
            id="email"
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="password">Password</label>
          <input
            id="password"
            type="password"
            placeholder="Enter your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />

          {error && <p className="auth-error">{error}</p>}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Please wait...' : 'Log in'}
          </button>
        </form>
      )}

      {method === 'otp' && step === 'phone' && (
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

      {method === 'otp' && step === 'otp' && (
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
