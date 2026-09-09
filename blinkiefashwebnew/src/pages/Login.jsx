import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { authStart, authVerify } from '../api';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import { auth } from '../firebase.js';
import {
  MdLock,
  MdSmartphone,
  MdKeyboardArrowDown,
  MdArrowForward,
  MdAutoAwesome,
  MdCardGiftcard,
} from 'react-icons/md';
import logo from '../assets/logo1.png';
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

  const digitCount = phone.replace(/\D/g, '').length;

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
    <div className="ft-page">
      <div className="ft-topbar">
        <Link to="/" className="ft-logo">
          <img src={logo} alt="Blinkiefash" />
        </Link>
        <span className="ft-secure-badge">
          <MdLock /> Secure Auth
        </span>
      </div>

      <main className="ft-main">
        <div className="ft-card">
          <section className="ft-banner">
            <div>
              <span className="ft-banner-kicker">
                <MdAutoAwesome />
                {step === 'phone' ? 'Fast-track entry' : 'Almost there'}
              </span>
              <h1>
                {step === 'phone' ? (
                  <>Welcome to <span className="ft-accent">BLINKIEFASH</span></>
                ) : (
                  <>Enter your <span className="ft-accent">code</span></>
                )}
              </h1>
              <p>
                {step === 'phone'
                  ? 'Log in or sign up in seconds to access your saved bag, instant checkouts, and member drops.'
                  : `We've sent a 6-digit code to ${formatPhone(phone)}. Enter it below to continue.`}
              </p>
            </div>

            <div className="ft-banner-right">
              <div className="ft-sparkles">
                <MdAutoAwesome />
                <MdAutoAwesome />
              </div>
              <div className="ft-banner-divider" />
              <ul className="ft-banner-list">
                <li>Trendy Fashion</li>
                <li>Faster Delivery</li>
                <li>Happier You</li>
              </ul>
            </div>
          </section>

          <div className="ft-method">
            <div className="ft-method-tab">
              <MdSmartphone />
              Mobile OTP
              <span className="ft-method-badge">Fast</span>
            </div>
          </div>

          {step === 'phone' && (
            <form className="ft-form" onSubmit={handleStart}>
              <label className="ft-label" htmlFor="phone">Mobile number</label>
              <div className="ft-phone-row">
                <span className="ft-country">
                  IN +91 <MdKeyboardArrowDown />
                </span>
                <input
                  id="phone"
                  type="tel"
                  inputMode="numeric"
                  placeholder="Enter 10-digit mobile number"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>

              <div className="ft-helper-row">
                <span>OTP will be delivered via SMS</span>
                <b>{digitCount}/10</b>
              </div>

              {error && <p className="ft-error">{error}</p>}

              <button type="submit" className="ft-submit" disabled={loading}>
                {loading ? 'Sending code…' : 'Get OTP & Continue'} <MdArrowForward />
              </button>

              <div className="ft-perk">
                <span className="ft-perk-icon">
                  <MdCardGiftcard color="#0a6b34" />
                </span>
                <p className="ft-perk-text">
                  New to BlinkieFash? <b>Extra ₹300 OFF</b>
                  <span>Auto-applied at checkout for verified accounts.</span>
                </p>
              </div>
            </form>
          )}

          {step === 'otp' && (
            <form className="ft-form" onSubmit={handleVerify}>
              <div className="ft-otp-sent">
                <MdSmartphone />
                <span>Code sent to <strong>{formatPhone(phone)}</strong></span>
                <button type="button" onClick={() => { setStep('phone'); setOtp(''); setError(''); }}>
                  Change
                </button>
              </div>

              <label className="ft-label" htmlFor="otp">6-digit code</label>
              <input
                className="ft-otp-input"
                id="otp"
                type="text"
                inputMode="numeric"
                maxLength="6"
                placeholder="------"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                required
              />

              {serverOtp && <p className="ft-hint">Development code: {serverOtp}</p>}
              {error && <p className="ft-error">{error}</p>}

              <button type="submit" className="ft-submit" disabled={loading}>
                {loading ? 'Verifying…' : 'Log in'} <MdLock />
              </button>
            </form>
          )}

          <p className="ft-legal">
            By continuing, you agree to BlinkieFash's{' '}
            <Link to="/terms">Terms of Service</Link> &amp; <Link to="/privacy">Privacy Policy</Link>.
          </p>

          <p className="ft-switch">
            New here? <Link to="/signup">Create an account</Link>
          </p>
        </div>
      </main>

      <div id="recaptcha-container" />
    </div>
  );
}