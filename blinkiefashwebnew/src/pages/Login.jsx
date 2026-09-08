import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authStart, authVerify } from '../api';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase.js';
import { MdArrowForward, MdLock, MdPhoneAndroid, MdShield } from 'react-icons/md';
import logo from '../assets/logo.png';
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
  const [serverOtpMode, setServerOtpMode] = useState(false);
  const [serverOtp, setServerOtp] = useState('');

  const ensureRecaptcha = () => {
    if (typeof window === 'undefined') {
      throw new Error('Firebase auth is not initialized');
    }

    if (!auth) {
      throw new Error('Firebase auth is not initialized');
    }

    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(
        auth,
        'recaptcha-container',
        { size: 'invisible' }
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
      const accountCheck = await authStart(formattedPhone, 'customer');
      if (!accountCheck.success) {
        setError(accountCheck.message || 'Mobile number not found');
        return;
      }

      if (accountCheck.fallbackOtpMode && accountCheck.debugOtp) {
        setServerOtpMode(true);
        setServerOtp(String(accountCheck.debugOtp));
        setConfirmationResult(null);
        setStep('otp');
        return;
      }

      setServerOtpMode(false);
      setServerOtp('');
      const appVerifier = ensureRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setStep('otp');
    } catch (err) {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
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
      if (serverOtpMode) {
        const res = await authVerify({
          phone: formatPhone(phone),
          otp,
          expectedRole: 'customer',
        });
        if (!res.success) {
          setError(res.message || 'Invalid OTP');
          return;
        }

        const storedGender = localStorage.getItem('bfw_gender');
        login({
          ...res.user,
          gender: res.user?.gender || storedGender || 'other',
        }, res.token);
        navigate('/');
        return;
      }

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

      // Preserve gender if it exists in localStorage, or get from response
      const storedGender = localStorage.getItem('bfw_gender');
      const userWithGender = {
        ...res.user,
        gender: res.user?.gender || storedGender || 'other'
      };

      login(userWithGender, res.token);
      navigate('/');
    } catch (err) {
      setError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-screen">
      <header className="auth-topbar">
        <Link to="/" className="auth-logo">
          <img src={logo} alt="Blinkiefash" className="auth-logo-mark" />
          <span className="auth-logo-wordmark"><b>BLINKIE</b><span>FASH</span></span>
        </Link>
        <div className="auth-secure"><MdLock /> Secure Auth</div>
      </header>

      <main className="auth-main">
        <section className="auth-card auth-login-card">
          <div className="auth-card-heading">
            <div>
              <span className="auth-kicker">Fast-track entry</span>
              <h1>Welcome to BlinkieFash</h1>
              <p>Log in or sign up in seconds to access your saved bag, instant checkouts, and member drops.</p>
            </div>
            <span className="auth-ssl"><MdShield /> 256-Bit SSL</span>
          </div>

          <div className="auth-tabs auth-tabs-single" aria-label="Login method">
            <span className="is-active"><MdPhoneAndroid /> Mobile OTP <b>Fast</b></span>
          </div>

          {step === 'phone' && (
            <form className="auth-form auth-modern-form" onSubmit={handleStart}>
              <label htmlFor="phone">Mobile number</label>
              <div className="auth-phone-field"><span>IN&nbsp; +91</span><input id="phone" type="tel" placeholder="Enter 10-digit mobile number" value={phone} onChange={(e) => setPhone(e.target.value)} required /></div>
              <div className="auth-field-meta"><small>OTP will be delivered via SMS</small><b>{phone.replace(/\D/g, '').slice(-10).length} / 10</b></div>
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-primary" disabled={loading}>{loading ? 'Please wait...' : 'Get OTP & Continue'} <MdArrowForward /></button>
            </form>
          )}

          {step === 'otp' && (
            <form className="auth-form auth-modern-form" onSubmit={handleVerify}>
              <div className="auth-otp-sent"><MdPhoneAndroid /><span>OTP sent to <strong>{formatPhone(phone)}</strong></span><button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>Edit</button></div>
              <label htmlFor="otp">Enter 6-digit code</label>
              {serverOtp && <p className="auth-hint">Development OTP: {serverOtp}</p>}
              <input className="auth-otp-input" id="otp" type="text" inputMode="numeric" maxLength="6" placeholder="••••••" value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))} required />
              {error && <p className="auth-error">{error}</p>}
              <button type="submit" className="auth-primary" disabled={loading}>{loading ? 'Verifying...' : 'Verify & Enter Portal'} <MdLock /></button>
            </form>
          )}

          <div className="auth-perk"><strong>New to Blinkie? Extra ₹300 OFF</strong><small>Auto-applied at checkout for verified accounts.</small></div>
          <p className="auth-legal">By continuing, you agree to BlinkieFash's <Link to="/terms">Terms of Service</Link> &amp; <Link to="/privacy">Privacy Policy</Link>.</p>
          <p className="auth-switch">New here? <Link to="/signup">Create an account</Link></p>
        </section>
      </main>
      <footer className="auth-footer"><span>© 2025 BlinkieFash. Secure Verified Portal.</span><span><Link to="/privacy">Privacy Policy</Link> <Link to="/terms">Terms</Link> <Link to="/help-support">Help</Link></span></footer>
      <div id="recaptcha-container" />
    </div>
  );
}