import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { registerUser } from '../api';

import PhoneInput, { isValidPhoneNumber } from 'react-phone-number-input';
import 'react-phone-number-input/style.css';
import {
  MdLock,
  MdAutoAwesome,
  MdArrowForward,
  MdVisibility,
  MdVisibilityOff,
  MdCardGiftcard,
} from 'react-icons/md';
import logo from '../assets/logo1.png';
import './Auth.css';

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
                Made for how you shop
              </span>
              <h1>
                Create your <span className="ft-accent">BLINKIEFASH</span> account
              </h1>
              <p>Save your bag, track orders, and get first access to new drops. Takes about a minute.</p>
            </div>

            <div className="ft-banner-right">
              <div className="ft-sparkles">
                <MdAutoAwesome />
                <MdAutoAwesome />
              </div>
              <div className="ft-banner-divider" />
              <ul className="ft-banner-list">
                <li>Extra ₹300 off first order</li>
                <li>One-tap reorders</li>
                <li>Member-only drops</li>
              </ul>
            </div>
          </section>

          <form className="ft-form" onSubmit={handleSubmit}>
            <div className="ft-field">
              <label className="ft-label">Phone number</label>
              <PhoneInput
                international
                defaultCountry="IN"
                value={phone}
                onChange={setPhone}
                placeholder="Enter phone number"
              />
            </div>

            <div className="ft-grid-2">
              <div className="ft-field">
                <label className="ft-label" htmlFor="name">Full name</label>
                <input
                  id="name"
                  name="name"
                  className="ft-input-plain"
                  placeholder="Your name"
                  value={form.name}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="ft-field">
                <label className="ft-label" htmlFor="gender">Gender</label>
                <select
                  id="gender"
                  name="gender"
                  className="ft-input-plain"
                  value={form.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="">Select</option>
                  <option value="women">Women</option>
                  <option value="men">Men</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div className="ft-grid-2">
              <div className="ft-field">
                <label className="ft-label" htmlFor="email">Email (optional)</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="ft-input-plain"
                  placeholder="you@example.com"
                  value={form.email}
                  onChange={handleChange}
                />
              </div>

              <div className="ft-field">
                <label className="ft-label" htmlFor="referralCode">Referral code (optional)</label>
                <input
                  id="referralCode"
                  name="referralCode"
                  className="ft-input-plain"
                  placeholder="Get ₹50 off"
                  value={form.referralCode}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="ft-grid-2">
              <div className="ft-field">
                <label className="ft-label" htmlFor="password">Password</label>
                <div className="ft-input-icon-row">
                  <input
                    id="password"
                    name="password"
                    className="ft-input-plain"
                    type={showPassword ? 'text' : 'password'}
                    value={form.password}
                    onChange={handleChange}
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

              <div className="ft-field">
                <label className="ft-label" htmlFor="confirmPassword">Confirm password</label>
                <div className="ft-input-icon-row">
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    className="ft-input-plain"
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={form.confirmPassword}
                    onChange={handleChange}
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
            </div>
            <p className="ft-hint">6–16 characters, mix letters, numbers &amp; symbols.</p>

            <label className="ft-checkbox" htmlFor="agreeToTerms">
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

            {error && <p className="ft-error">{error}</p>}
            {message && <p className="ft-hint">{message}</p>}

            <button
              type="submit"
              className="ft-submit"
              disabled={loading || !agreedToTerms}
            >
              {loading ? 'Creating account…' : 'Create account'} <MdArrowForward />
            </button>

            <div className="ft-perk">
              <span className="ft-perk-icon">
                <MdCardGiftcard color="#0a6b34" />
              </span>
              <p className="ft-perk-text">
                Referral applied? <b>Extra ₹50 OFF</b>
                <span>Credited to your account once verified.</span>
              </p>
            </div>
          </form>

          <p className="ft-legal">
            By creating an account, you agree to BlinkieFash's{' '}
            <Link to="/terms">Terms of Service</Link> &amp; <Link to="/privacy">Privacy Policy</Link>.
          </p>

          <p className="ft-switch">
            Already have an account? <Link to="/login">Log in</Link>
          </p>
        </div>
      </main>
    </div>
  );
}