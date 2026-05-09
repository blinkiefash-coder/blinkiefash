import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { RecaptchaVerifier, signInWithPhoneNumber } from 'firebase/auth'
import { auth } from '../firebase'
import { API_BASE_URL } from '../apiBase'
import leftPanelImage from '../assets/hero2.png'
import './Login.css'

function Login() {
  const [activeTab, setActiveTab] = useState('customer')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [confirmationResult, setConfirmationResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()

  const normalizeToIndianPhone = (value) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length === 10) return `+91${digits}`
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
    if (digits.length === 13 && digits.startsWith('091')) return `+91${digits.slice(3)}`
    return ''
  }

  const setupRecaptcha = () => {
    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      })
    }
    return window.recaptchaVerifier
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const formattedPhone = normalizeToIndianPhone(phone)
    if (!formattedPhone) {
      setError('Enter a valid 10 digit mobile number')
      return
    }

    const expectedRole = activeTab === 'vendor' ? 'vendor' : 'customer'

    setLoading(true)

    try {
      const roleRes = await fetch(`${API_BASE_URL}/login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, expectedRole })
      })

      const roleData = await roleRes.json()
      if (!roleData.success) {
        setError(roleData.message || 'This number is not allowed for selected login')
        return
      }

      const appVerifier = setupRecaptcha()
      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier)
      setConfirmationResult(result)
      setOtpSent(true)
      setSuccess(`OTP sent to ${formattedPhone}`)
    } catch (err) {
      console.error('OTP Send Error:', err)
      // Extract Firebase error code for better debugging
      const errorCode = err?.code || 'unknown'
      const errorMsg = err?.message || 'Failed to send OTP'
      if (errorCode === 'auth/billing-not-enabled') {
        setError('Authentication service is being set up. Please try again in a moment.')
      } else if (errorCode === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please check and try again.')
      } else {
        setError('Unable to send OTP. Please check your connection and try again.')
      }
      if (window.recaptchaVerifier) {
        window.recaptchaVerifier.clear()
        window.recaptchaVerifier = null
      }
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!confirmationResult) {
      setError('Please request OTP first')
      return
    }

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter valid 6 digit OTP')
      return
    }

    const expectedRole = activeTab === 'vendor' ? 'vendor' : 'customer'

    setLoading(true)
    try {
      const credential = await confirmationResult.confirm(otp)
      const firebaseIdToken = await credential.user.getIdToken()

      const verifyRes = await fetch(`${API_BASE_URL}/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken: firebaseIdToken, expectedRole })
      })

      const data = await verifyRes.json()

      if (data.success) {
        setSuccess('Login successful! Redirecting...')
        localStorage.setItem('token', data.token || '')
        localStorage.setItem('userUuid', data.user.id)
        localStorage.setItem('userRole', data.user.role)
        localStorage.setItem('userPhone', data.user.phone)
        setTimeout(() => {
          if (data.user.role === 'vendor') navigate('/vendor')
          else navigate('/home')
        }, 1200)
      } else {
        setError(data.message || 'OTP verification failed')
      }
    } catch (err) {
      setError('Invalid OTP or verification failed')
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-page">

      {/* ── TOP BAR ── */}
      <div className="login-topbar">
        <span className="login-topbar-lang">🌐 English ▾</span>
      </div>

      <div className="login-split">

        {/* ══════════ LEFT PANEL ══════════ */}
        <div className="login-left">
          <img
            src={leftPanelImage}
            alt="BlinkieFash fashion delivery"
            className="login-left-static-image"
          />
        </div>

        {/* ══════════ RIGHT PANEL ══════════ */}
        <div className="login-right">
          <div className="lr-card">
            <h2 className="lr-title">Welcome <span className="brand-green">Back!</span></h2>
            <p className="lr-subtitle">Login to continue to <strong>BlinkieFash</strong></p>

            {/* TABS */}
            <div className="lr-tabs">
              <button
                className={`lr-tab ${activeTab === 'customer' ? 'active' : ''}`}
                onClick={() => setActiveTab('customer')}
                type="button"
              >
                👤 Customer Login
              </button>
              <button
                className={`lr-tab ${activeTab === 'vendor' ? 'active' : ''}`}
                onClick={() => setActiveTab('vendor')}
                type="button"
              >
                🏪 Vendor Login
              </button>
            </div>

            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <form onSubmit={otpSent ? handleVerifyOtp : handleSendOtp}>
              <div className="form-group">
                <label>Mobile Number</label>
                <div className="input-icon-wrap">
                  <span className="input-icon">📱</span>
                  <input
                    type="tel"
                    placeholder="Enter 10 digit mobile number"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={loading || otpSent}
                    maxLength={10}
                  />
                </div>
              </div>

              {otpSent && (
                <div className="form-group">
                  <label>OTP</label>
                  <div className="input-icon-wrap">
                    <span className="input-icon">🔐</span>
                    <input
                      type="text"
                      placeholder="Enter 6 digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      disabled={loading}
                      maxLength={6}
                    />
                  </div>
                </div>
              )}

              {!otpSent && (
                <button type="submit" className="login-button" disabled={loading}>
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </button>
              )}

              {otpSent && (
                <>
                  <button type="submit" className="login-button" disabled={loading}>
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </button>
                  <button
                    type="button"
                    className="continue-btn"
                    onClick={() => {
                      setOtpSent(false)
                      setOtp('')
                      setConfirmationResult(null)
                      setSuccess('')
                    }}
                    disabled={loading}
                  >
                    Change Number
                  </button>
                </>
              )}
            </form>

            <div id="recaptcha-container" />

            {!otpSent && (
              <div className="otp-hint">
                We'll send a 6-digit verification code to your phone. Secure and fast!
              </div>
            )}

            <div className="divider"><span>secure login</span></div>

            <div className="signup-box">
              <div>
                <strong>New here?</strong>
                <p>Contact support to register your phone number with BlinkieFash</p>
              </div>
              <a href="/" className="signup-btn">Go Home</a>
            </div>

            <div className="trust-badges">
              <div className="trust-badge">🛡️ <span>Secure OTP<br />Verified</span></div>
              <div className="trust-badge">✓ <span>Account<br />Verified</span></div>
              <div className="trust-badge">⚡ <span>60-Minute<br />Delivery</span></div>
            </div>

          </div>

          <div className="lr-footer">
            <p>Use the phone number registered with BlinkieFash for fastest checkout.</p>
            <p>© 2026 BlinkieFash. All rights reserved.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login