import { useState } from 'react';
import '../styles/PasswordReset.css';

export default function PasswordReset() {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    // Validation
    if (!phone || !password || !confirmPassword) {
      setError('All fields are required');
      return;
    }

    if (phone.replace(/\D/g, '').length !== 10) {
      setError('Phone number must be 10 digits');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('https://blinkiefash.onrender.com/login/set-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phone: phone,
          password: password,
        }),
      });

      const data = await response.json();

      if (data.success) {
        setMessage('Password set successfully! You can now log in with your new password.');
        setPhone('');
        setPassword('');
        setConfirmPassword('');
      } else {
        setError(data.message || 'Failed to set password');
      }
    } catch (err) {
      setError('Error connecting to server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="password-reset-container">
      <div className="password-reset-card">
        <h1>Set/Reset Password</h1>
        <p className="subtitle">For Riders</p>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="phone">Phone Number</label>
            <input
              type="tel"
              id="phone"
              placeholder="Enter 10-digit phone number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              disabled={loading}
              maxLength="10"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">New Password</label>
            <input
              type="password"
              id="password"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              type="password"
              id="confirmPassword"
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={loading}
            />
          </div>

          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Setting Password...' : 'Set Password'}
          </button>
        </form>

        <div className="info-section">
          <h3>Need Help?</h3>
          <p>
            • Make sure you've registered your phone number first
          </p>
          <p>
            • Password must be at least 6 characters long
          </p>
          <p>
            • Use this page to set or reset your password
          </p>
        </div>
      </div>
    </div>
  );
}
