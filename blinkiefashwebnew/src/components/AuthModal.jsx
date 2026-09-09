import { useEffect, useState } from 'react';
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth';
import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import {
  MdClose,
  MdLock,
  MdSmartphone,
  MdKeyboardArrowDown,
  MdArrowForward,
  MdAutoAwesome,
  MdCardGiftcard,
  MdVisibility,
  MdVisibilityOff,
} from 'react-icons/md';

import { useAuth } from '../context/AuthContext';
import { useAuthModal } from '../context/AuthModalContext';
import { authStart, authVerify, registerUser } from '../api';
import { auth } from '../firebase.js';
import './AuthModal.css';

const initialSignupForm = {
  name: '',
  email: '',
  referralCode: '',
  password: '',
  confirmPassword: '',
  gender: '',
};

export default function AuthModal() {
  const { login } = useAuth();
  const { isAuthModalOpen, authModalView, setAuthModalView, closeAuthModal, handleAuthSuccess } =
    useAuthModal();

  // ---- login state ----
  const [loginStep, setLoginStep] = useState('phone');
  const [loginPhone, setLoginPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState(null);
  const [serverOtpMode, setServerOtpMode] = useState(false);
  const [serverOtp, setServerOtp] = useState('');

  // ---- signup state ----
  const [signupForm, setSignupForm] = useState(initialSignupForm);
  const [signupPhone, setSignupPhone] = useState('');
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [signupError, setSignupError] = useState('');
  const [signupMessage, setSignupMessage] = useState('');
  const [signupLoading, setSignupLoading] = useState(false);

  const digitCount = loginPhone.replace(/\D/g, '').length;

  const resetAll = () => {
    setLoginStep('phone');
    setLoginPhone('');
    setOtp('');
    setLoginError('');
    setLoginLoading(false);
    setConfirmationResult(null);
    setServerOtpMode(false);
    setServerOtp('');
    setSignupForm(initialSignupForm);
    setSignupPhone('');
    setAgreedToTerms(false);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setSignupError('');
    setSignupMessage('');
    setSignupLoading(false);
    if (typeof window !== 'undefined' && window.recaptchaVerifier) {
      try {
        window.recaptchaVerifier.clear();
      } catch {
        // ignore cleanup errors
      }
      delete window.recaptchaVerifier;
    }
  };

  // Lock body scroll + close on Escape while the modal is open.
  useEffect(() => {
    if (!isAuthModalOpen) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') closeAuthModal();
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isAuthModalOpen, closeAuthModal]);

  if (!isAuthModalOpen) {
    return <div id="recaptcha-container" />;
  }

  // Every path that closes the modal resets its fields first, so it always
  // opens fresh next time rather than showing whatever step was left over.
  const closeModal = () => {
    resetAll();
    closeAuthModal();
  };

  const finishWithSuccess = () => {
    resetAll();
    handleAuthSuccess();
  };

  const ensureRecaptcha = () => {
    if (typeof window === 'undefined' || !auth) {
      throw new Error('Firebase auth is not initialized');
    }
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
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

  const handleBackdropClick = () => {
    closeModal();
  };

  const switchView = (nextView) => {
    setLoginError('');
    setSignupError('');
    setSignupMessage('');
    setAuthModalView(nextView);
  };

  const handleStart = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      const formattedPhone = formatPhone(loginPhone);
      const accountCheck = await authStart(formattedPhone, 'customer');
      if (!accountCheck.success) {
        setLoginError(accountCheck.message || 'Mobile number not found');
        return;
      }

      if (accountCheck.fallbackOtpMode && accountCheck.debugOtp) {
        setServerOtpMode(true);
        setServerOtp(String(accountCheck.debugOtp));
        setConfirmationResult(null);
        setLoginStep('otp');
        return;
      }

      setServerOtpMode(false);
      setServerOtp('');
      const appVerifier = ensureRecaptcha();
      const confirmation = await signInWithPhoneNumber(auth, formattedPhone, appVerifier);
      setConfirmationResult(confirmation);
      setLoginStep('otp');
    } catch (err) {
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear();
        delete window.recaptchaVerifier;
      }
      setLoginError(err.message || 'Could not send OTP. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setLoginError('');
    setLoginLoading(true);
    try {
      if (serverOtpMode) {
        const res = await authVerify({
          phone: formatPhone(loginPhone),
          otp,
          expectedRole: 'customer',
        });
        if (!res.success) {
          setLoginError(res.message || 'Invalid OTP');
          return;
        }
        const storedGender = localStorage.getItem('bfw_gender');
        login({ ...res.user, gender: res.user?.gender || storedGender || 'other' }, res.token);
        finishWithSuccess();
        return;
      }

      if (!confirmationResult) {
        setLoginError('OTP flow not initialized. Please request a new OTP.');
        setLoginStep('phone');
        return;
      }

      const result = await confirmationResult.confirm(otp);
      const fbUser = result.user;
      const idToken = await fbUser.getIdToken();

      const res = await authVerify({ idToken, expectedRole: 'customer' });
      if (!res.success) {
        setLoginError(res.message || 'Invalid OTP');
        return;
      }

      const storedGender = localStorage.getItem('bfw_gender');
      const userWithGender = {
        ...res.user,
        gender: res.user?.gender || storedGender || 'other',
      };
      login(userWithGender, res.token);
      finishWithSuccess();
    } catch (err) {
      setLoginError(err.message || 'OTP verification failed. Please try again.');
    } finally {
      setLoginLoading(false);
    }
  };

  const handleSignupChange = (e) =>
    setSignupForm({ ...signupForm, [e.target.name]: e.target.value });

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    setSignupError('');
    setSignupMessage('');

    if (!signupPhone || !isValidPhoneNumber(signupPhone)) {
      setSignupError('Please enter a valid phone number');
      return;
    }
    if (!signupForm.gender) {
      setSignupError('Please select your gender');
      return;
    }
    if (signupForm.password.length < 6 || signupForm.password.length > 16) {
      setSignupError('Password must be 6-16 characters');
      return;
    }
    if (signupForm.password !== signupForm.confirmPassword) {
      setSignupError('Passwords do not match');
      return;
    }
    if (!agreedToTerms) {
      setSignupError('Please agree to the Terms and Conditions');
      return;
    }

    setSignupLoading(true);
    try {
      const res = await registerUser({
        ...signupForm,
        phone: signupPhone,
        role: 'customer',
      });

      if (!res.success) {
        setSignupError(res.message || 'Could not create your account');
        return;
      }

      setSignupMessage('Account created! Log in with your new number.');
      setTimeout(() => {
        setLoginPhone(signupPhone.replace(/^\+91/, ''));
        switchView('login');
      }, 1200);
    } catch (err) {
      setSignupError(err.message || 'Something went wrong');
    } finally {
      setSignupLoading(false);
    }
  };

  return (
    <div className="am-backdrop" onMouseDown={handleBackdropClick}>
      <div
        className="am-modal"
        role="dialog"
        aria-modal="true"
        aria-label={authModalView === 'login' ? 'Log in' : 'Create account'}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button type="button" className="am-close" onClick={closeModal} aria-label="Close">
          <MdClose />
        </button>

        <section className="am-banner">
          <span className="am-kicker">
            <MdAutoAwesome />
            {authModalView === 'signup'
              ? 'Made for how you shop'
              : loginStep === 'otp'
              ? 'Almost there'
              : 'Fast-track entry'}
          </span>
          <h2>
            {authModalView === 'signup' ? (
              <>Create your <span className="am-accent">BLINKIEFASH</span> account</>
            ) : loginStep === 'otp' ? (
              <>Enter your <span className="am-accent">code</span></>
            ) : (
              <>Welcome to <span className="am-accent">BLINKIEFASH</span></>
            )}
          </h2>
          <p>
            {authModalView === 'signup'
              ? 'Save your bag, track orders, and get first access to new drops.'
              : loginStep === 'otp'
              ? `We've sent a 6-digit code to ${formatPhone(loginPhone)}.`
              : "Log in or sign up in seconds — no password to remember."}
          </p>
          <div className="am-perks-row">
            <span>Trendy Fashion</span>
            <span>Faster Delivery</span>
            <span>Happier You</span>
          </div>
        </section>

        {authModalView === 'login' && (
          <>
            <div className="am-method">
              <MdSmartphone />
              Mobile OTP
              <span className="am-badge">Fast</span>
            </div>

            {loginStep === 'phone' && (
              <form className="am-form" onSubmit={handleStart}>
                <label className="am-label" htmlFor="am-phone">Mobile number</label>
                <div className="am-phone-row">
                  <span className="am-country">
                    IN +91 <MdKeyboardArrowDown />
                  </span>
                  <input
                    id="am-phone"
                    type="tel"
                    inputMode="numeric"
                    placeholder="Enter 10-digit mobile number"
                    value={loginPhone}
                    onChange={(e) => setLoginPhone(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="am-helper-row">
                  <span>OTP will be delivered via SMS</span>
                  <b>{digitCount}/10</b>
                </div>

                {loginError && <p className="am-error">{loginError}</p>}

                <button type="submit" className="am-submit" disabled={loginLoading}>
                  {loginLoading ? 'Sending code…' : 'Get OTP & Continue'} <MdArrowForward />
                </button>

                <div className="am-perk">
                  <span className="am-perk-icon">
                    <MdCardGiftcard color="#0a6b34" />
                  </span>
                  <p className="am-perk-text">
                    New to BlinkieFash? <b>Extra ₹300 OFF</b>
                    <span>Auto-applied at checkout for verified accounts.</span>
                  </p>
                </div>
              </form>
            )}

            {loginStep === 'otp' && (
              <form className="am-form" onSubmit={handleVerify}>
                <div className="am-otp-sent">
                  <MdSmartphone />
                  <span>Code sent to <strong>{formatPhone(loginPhone)}</strong></span>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginStep('phone');
                      setOtp('');
                      setLoginError('');
                    }}
                  >
                    Change
                  </button>
                </div>

                <label className="am-label" htmlFor="am-otp">6-digit code</label>
                <input
                  className="am-otp-input"
                  id="am-otp"
                  type="text"
                  inputMode="numeric"
                  maxLength="6"
                  placeholder="------"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                  required
                  autoFocus
                />

                {serverOtp && <p className="am-hint">Development code: {serverOtp}</p>}
                {loginError && <p className="am-error">{loginError}</p>}

                <button type="submit" className="am-submit" disabled={loginLoading}>
                  {loginLoading ? 'Verifying…' : 'Log in'} <MdLock />
                </button>
              </form>
            )}
          </>
        )}

        {authModalView === 'signup' && (
          <form className="am-form" onSubmit={handleSignupSubmit}>
            <div className="am-field">
              <label className="am-label">Phone number</label>
              <PhoneInput
                international
                defaultCountry="IN"
                value={signupPhone}
                onChange={setSignupPhone}
                placeholder="Enter phone number"
              />
            </div>

            <div className="am-field">
              <label className="am-label" htmlFor="am-name">Full name</label>
              <input
                id="am-name"
                name="name"
                className="am-input-plain"
                placeholder="Your name"
                value={signupForm.name}
                onChange={handleSignupChange}
                required
              />
            </div>

            <div className="am-field">
              <label className="am-label" htmlFor="am-gender">Gender</label>
              <select
                id="am-gender"
                name="gender"
                className="am-input-plain"
                value={signupForm.gender}
                onChange={handleSignupChange}
                required
              >
                <option value="">Select</option>
                <option value="women">Women</option>
                <option value="men">Men</option>
                <option value="other">Other</option>
              </select>
            </div>

            <div className="am-field">
              <label className="am-label" htmlFor="am-email">Email (optional)</label>
              <input
                id="am-email"
                name="email"
                type="email"
                className="am-input-plain"
                placeholder="you@example.com"
                value={signupForm.email}
                onChange={handleSignupChange}
              />
            </div>

            <div className="am-field">
              <label className="am-label" htmlFor="am-referral">Referral code (optional)</label>
              <input
                id="am-referral"
                name="referralCode"
                className="am-input-plain"
                placeholder="Get ₹50 off"
                value={signupForm.referralCode}
                onChange={handleSignupChange}
              />
            </div>

            <div className="am-field">
              <label className="am-label" htmlFor="am-password">Password</label>
              <div className="am-input-icon-row">
                <input
                  id="am-password"
                  name="password"
                  className="am-input-plain"
                  type={showPassword ? 'text' : 'password'}
                  value={signupForm.password}
                  onChange={handleSignupChange}
                  minLength={6}
                  maxLength={16}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>

            <div className="am-field">
              <label className="am-label" htmlFor="am-confirm-password">Confirm password</label>
              <div className="am-input-icon-row">
                <input
                  id="am-confirm-password"
                  name="confirmPassword"
                  className="am-input-plain"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={signupForm.confirmPassword}
                  onChange={handleSignupChange}
                  minLength={6}
                  maxLength={16}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPassword ? <MdVisibilityOff /> : <MdVisibility />}
                </button>
              </div>
            </div>
            <p className="am-hint">6–16 characters, mix letters, numbers &amp; symbols.</p>

            <label className="am-checkbox" htmlFor="am-agree">
              <input
                id="am-agree"
                type="checkbox"
                checked={agreedToTerms}
                onChange={(e) => setAgreedToTerms(e.target.checked)}
              />
              <span>I agree to the Terms &amp; Conditions and Privacy Policy</span>
            </label>

            {signupError && <p className="am-error">{signupError}</p>}
            {signupMessage && <p className="am-hint">{signupMessage}</p>}

            <button type="submit" className="am-submit" disabled={signupLoading || !agreedToTerms}>
              {signupLoading ? 'Creating account…' : 'Create account'} <MdArrowForward />
            </button>
          </form>
        )}

        <p className="am-legal">
          By continuing you agree to BlinkieFash&apos;s Terms of Service &amp; Privacy Policy.
        </p>

        /* hii */

        <p className="am-switch">
          {authModalView === 'login' ? (
            <>New here? <button type="button" onClick={() => switchView('signup')}>Create an account</button></>
          ) : (
            <>Already have an account? <button type="button" onClick={() => switchView('login')}>Log in</button></>
          )}
        </p>
      </div>

      <div id="recaptcha-container" />
    </div>
  );
}