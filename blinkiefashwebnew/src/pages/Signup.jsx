import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api';

import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import { MdArrowForward, MdLock, MdMail, MdPerson, MdRedeem, MdShield } from 'react-icons/md';
import logo from '../assets/logo1.png';

import './Auth.css';

// Small inline icon set — no extra dependency required.
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

export default function Signup() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    name: '',
    email: '',
    referralCode: '',
    password: '',
    confirmPassword: '',
    gender: '',
  });

  // Full international phone number (E.164), e.g. +919876543210
  const [phone, setPhone] = useState('');

  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!phone || !isValidPhoneNumber(phone)) {
      setError('Please enter a valid phone number');
      return;
    }
    if (!form.gender) {
      setError('Please select your gender');
      return;
    }
    if (form.password.length < 6 || form.password.length > 16) {
      setError('Password must be 6-16 characters');
      return;
    }
    if (form.password !== form.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (!agreedToTerms) {
      setError('Please agree to the Terms and Conditions');
      return;
    }

    setLoading(true);
    try {
      const { ...payload } = form;
      const res = await registerUser({
        ...payload,
        phone, // full E.164 number
        role: 'customer',
      });

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
    <div className="auth-screen">
      <header className="auth-topbar">
        <Link to="/" className="auth-logo">
          <img src={logo} alt="Blinkiefash" className="auth-logo-mark" />
        </Link>
        <div className="auth-secure"><MdLock /> Secure Auth</div>
      </header>
      <main className="auth-main">
        <section className="auth-card auth-signup-card">
          <div className="auth-card-heading">
            <div><span className="auth-kicker">Create your account</span><h1>Join BlinkieFash</h1><p>Save your bag, unlock member drops, and get ₹300 off your first verified order.</p></div>
            <span className="auth-ssl"><MdShield /> 256-Bit SSL</span>
          </div>

      <form className="auth-form auth-modern-form" onSubmit={handleSubmit}>
        {/* Phone input with country code selector */}
        <div className="auth-input-wrap">
          <PhoneInput
            international
            defaultCountry="IN"
            value={phone}
            onChange={setPhone}
            placeholder="Enter phone number"
          />
        </div>

        <div className="auth-input-wrap auth-icon-field">
          <MdPerson className="auth-input-icon" />
          <input
            id="name"
            name="name"
            placeholder="Full Name"
            value={form.name}
            onChange={handleChange}
            required
          />
        </div>

        <div className="auth-input-wrap auth-icon-field">
          <MdPerson className="auth-input-icon" />
          <select
            id="gender"
            name="gender"
            value={form.gender}
            onChange={handleChange}
            required
            style={{ cursor: 'pointer' }}
          >
            <option value="">Select Gender</option>
            <option value="women">Women</option>
            <option value="men">Men</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div className="auth-input-wrap auth-icon-field">
          <MdMail className="auth-input-icon" />
          <input
            id="email"
            name="email"
            type="email"
            placeholder="Email Address (Optional)"
            value={form.email}
            onChange={handleChange}
          />
        </div>

        <div className="auth-input-wrap auth-icon-field">
          <MdRedeem className="auth-input-icon" />
          <input
            id="referralCode"
            name="referralCode"
            placeholder="Referral Code (Optional) — Get ₹50 off"
            value={form.referralCode}
            onChange={handleChange}
          />
        </div>

        <div className="auth-input-wrap auth-icon-field">
          <MdLock className="auth-input-icon" />
          <input
            id="password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            placeholder="Create Password"
            value={form.password}
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

        <div className="auth-input-wrap auth-icon-field">
          <MdLock className="auth-input-icon" />
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

        <label className="auth-checkbox-label" htmlFor="agreeToTerms">
          <input
            id="agreeToTerms"
            name="agreeToTerms"
            type="checkbox"
            checked={agreedToTerms}
            onChange={(e) => setAgreedToTerms(e.target.checked)}
          />
          <span>
            I agree to the <Link to="/terms">Terms &amp; Conditions</Link> and{' '}
            <Link to="/privacy">Privacy Policy</Link>
          </span>
        </label>

        {error && <p className="auth-error">{error}</p>}
        {message && <p className="auth-hint">{message}</p>}

        <button
          type="submit"
          className="auth-primary auth-submit-btn"
          disabled={loading || !agreedToTerms}
        >
          {loading ? (
            'Creating account...'
          ) : (
            <>
              Create Account <IconArrow />
            </>
          )}
        </button>
      </form>
          <div className="auth-social"><span>Already have an account?</span><div><Link className="auth-secondary-link" to="/login">Log in to your account <MdArrowForward /></Link></div></div>
          <div className="auth-perk"><MdRedeem /><span><strong>New member perk: Extra ₹300 OFF</strong><small>Auto-applied at checkout for verified accounts.</small></span></div>
          <p className="auth-legal">By continuing, you agree to BlinkieFash's <Link to="/terms">Terms of Service</Link> &amp; <Link to="/privacy">Privacy Policy</Link>.</p>
        </section>
      </main>
      <footer className="auth-footer"><span>© 2025 BlinkieFash. Secure Verified Portal.</span><span><Link to="/privacy">Privacy Policy</Link> <Link to="/terms">Terms</Link> <Link to="/help-support">Help</Link></span></footer>
    </div>
  );
}