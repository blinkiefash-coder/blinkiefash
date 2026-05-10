import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
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
  const [serverOtpMode, setServerOtpMode] = useState(false)
  const [useVisibleCaptcha, setUseVisibleCaptcha] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()

  const resetRecaptcha = () => {
    if (window.recaptchaVerifier) {
      window.recaptchaVerifier.clear()
      window.recaptchaVerifier = null
    }
  }

  const normalizeToIndianPhone = (value) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length === 10) return `+91${digits}`
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
    if (digits.length === 13 && digits.startsWith('091')) return `+91${digits.slice(3)}`
    return ''
  }

  const toInputPhone = (value) => {
    const digits = String(value || '').replace(/\D/g, '')
    if (digits.length === 10) return digits
    if (digits.length >= 12 && digits.startsWith('91')) return digits.slice(2, 12)
    if (digits.length > 10) return digits.slice(-10)
    return digits
  }

  const setupRecaptcha = () => {
    if (!auth) {
      setError('Login service is temporarily unavailable. Please try again shortly.')
      return null
    }

    if (!window.recaptchaVerifier) {
      window.recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: useVisibleCaptcha ? 'normal' : 'invisible',
      })

      if (typeof window.recaptchaVerifier.render === 'function') {
        window.recaptchaVerifier.render().catch(() => {})
      }
    }
    return window.recaptchaVerifier
  }

  useEffect(() => {
    const queryPhone = searchParams.get('phone')
    if (queryPhone) {
      setPhone(toInputPhone(queryPhone))
    }
  }, [searchParams])

  const resetOtpState = () => {
    setOtpSent(false)
    setOtp('')
    setConfirmationResult(null)
    setUseVisibleCaptcha(false)
    resetRecaptcha()
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
    let roleData = null

    try {
      const roleRes = await fetch(`${API_BASE_URL}/login/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, expectedRole })
      })

      roleData = await roleRes.json()
      if (!roleData.success) {
        const message = roleData.message || 'This number is not allowed for selected login'
        const isNotFound = message.toLowerCase().includes('not found')

        if (isNotFound && expectedRole === 'customer') {
          navigate(`/signup?phone=${encodeURIComponent(formattedPhone)}`)
          return
        }

        setError(roleData.message || 'This number is not allowed for selected login')
        return
      }

      // In local development, prefer backup OTP path to avoid Firebase captcha/app-credential issues.
      if (import.meta.env.DEV && roleData?.fallbackOtpMode && roleData?.debugOtp) {
        setServerOtpMode(true)
        setOtpSent(true)
        setUseVisibleCaptcha(false)
        setConfirmationResult(null)
        setSuccess(`Use temporary PIN: ${roleData.debugOtp}`)
        return
      }

      resetRecaptcha()
      setServerOtpMode(false)
      const appVerifier = setupRecaptcha()
      if (!appVerifier) return

      // Ensure captcha token is freshly generated before sending OTP
      await appVerifier.verify()

      const result = await signInWithPhoneNumber(auth, formattedPhone, appVerifier)
      setConfirmationResult(result)
      setOtpSent(true)
      setUseVisibleCaptcha(false)
      setSuccess(`OTP sent to ${formattedPhone}`)
    } catch (err) {
      console.error('OTP Send Error:', err)
      const errorCode = err?.code || ''
      if (errorCode === 'auth/billing-not-enabled') {
        setError('Authentication service is being set up. Please try again in a moment.')
      } else if (errorCode === 'auth/invalid-phone-number') {
        setError('Invalid phone number. Please check and try again.')
      } else if (errorCode === 'auth/invalid-app-credential') {
        if (roleData?.fallbackOtpMode) {
          setServerOtpMode(true)
          setOtpSent(true)
          setUseVisibleCaptcha(false)
          setConfirmationResult(null)
          const fallbackMessage = roleData?.debugOtp
            ? `Firebase verification failed. Use backup OTP: ${roleData.debugOtp}`
            : 'Firebase verification failed. Using backup OTP mode.'
          setSuccess(fallbackMessage)
          setError('')
        } else {
          setUseVisibleCaptcha(true)
          setError('Verification failed. Please complete captcha below and retry Send OTP.')
          resetRecaptcha()
          setupRecaptcha()
        }
      } else {
        setError('Unable to send OTP. Please check your connection and try again.')
        resetRecaptcha()
      }
    } finally {
      setLoading(false)
    }
  }

  const handleRetryWithCaptcha = () => {
    setError('')
    setSuccess('')
    setOtp('')
    setOtpSent(false)
    setConfirmationResult(null)
    setServerOtpMode(false)
    setUseVisibleCaptcha(true)
    resetRecaptcha()
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!serverOtpMode && !confirmationResult) {
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
      let verifyBody

      if (serverOtpMode) {
        const formattedPhone = normalizeToIndianPhone(phone)
        verifyBody = { phone: formattedPhone, otp, expectedRole }
      } else {
        const credential = await confirmationResult.confirm(otp)
        const firebaseIdToken = await credential.user.getIdToken()
        verifyBody = { idToken: firebaseIdToken, expectedRole }
      }

      const verifyRes = await fetch(`${API_BASE_URL}/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(verifyBody)
      })

      const data = await verifyRes.json()

      if (data.success) {
        setSuccess('Login successful! Redirecting...')
        localStorage.setItem('token', data.token || '')
        localStorage.setItem('userUuid', data.user.id)
        localStorage.setItem('userRole', data.user.role)
        localStorage.setItem('userPhone', data.user.phone)
        localStorage.setItem('userName', data.user.name)
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
                onClick={() => {
                  setActiveTab('customer')
                  setError('')
                  setSuccess('')
                  resetOtpState()
                }}
                type="button"
              >
                👤 Customer Login
              </button>
              <button
                className={`lr-tab ${activeTab === 'vendor' ? 'active' : ''}`}
                onClick={() => {
                  setActiveTab('vendor')
                  setError('')
                  setSuccess('')
                  resetOtpState()
                }}
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
                    onChange={(e) => {
                      setPhone(e.target.value)
                      if (!otpSent) {
                        setError('')
                        setSuccess('')
                      }
                    }}
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
                      resetOtpState()
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

            {useVisibleCaptcha && !otpSent && !serverOtpMode && (
              <div className="captcha-note-wrap">
                <div className="captcha-note">Complete the captcha challenge, then click Send OTP again.</div>
                <button
                  type="button"
                  className="captcha-retry-btn"
                  onClick={handleRetryWithCaptcha}
                  disabled={loading}
                >
                  Retry with Captcha
                </button>
              </div>
            )}

            {!otpSent && (
              <div className="otp-hint">
                We'll send a 6-digit verification code to your phone instantly.
              </div>
            )}

            <div className="divider"><span>secure login</span></div>

            <div className="signup-box">
              <div>
                <strong>New here?</strong>
                <p>Enter your mobile and click Send OTP. If not found, we will take you to signup.</p>
              </div>
              <a href={`/signup?phone=${encodeURIComponent(normalizeToIndianPhone(phone) || '')}`} className="signup-btn">Create Account</a>
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