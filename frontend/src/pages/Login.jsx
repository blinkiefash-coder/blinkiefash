import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { API_BASE_URL } from '../apiBase'
import leftPanelImage from '../assets/hero2.png'
import './Login.css'

function Login() {
  const [activeTab, setActiveTab] = useState('customer')
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [showRegister, setShowRegister] = useState(false)
  const [registerForm, setRegisterForm] = useState({
    name: '',
    email: '',
    role: 'customer',
  })
  const navigate = useNavigate()

  const normalizeToIndianPhone = (value) => {
    const digits = value.replace(/\D/g, '')
    if (digits.length === 10) return `+91${digits}`
    if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`
    if (digits.length === 13 && digits.startsWith('091')) return `+91${digits.slice(3)}`
    return ''
  }

  useEffect(() => {
    const existingToken = localStorage.getItem('token')
    const existingRole = localStorage.getItem('userRole')

    if (existingToken && existingRole) {
      navigate(existingRole === 'vendor' ? '/vendor' : '/home', { replace: true })
    }
  }, [navigate])

  useEffect(() => {
    setRegisterForm((prev) => ({
      ...prev,
      role: activeTab === 'vendor' ? 'vendor' : 'customer',
    }))
    setShowRegister(false)
  }, [activeTab])

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
        if ((roleData.message || '').toLowerCase().includes('not found')) {
          setShowRegister(true)
          setRegisterForm((prev) => ({
            ...prev,
            role: expectedRole,
          }))
        }
        return
      }

      setShowRegister(false)

      setOtpSent(true)
      setSuccess(`OTP sent to ${formattedPhone}`)
      if (roleData.debugOtp) {
        setSuccess(`OTP sent to ${formattedPhone}. Dev OTP: ${roleData.debugOtp}`)
      }
    } catch (err) {
      console.error('OTP Send Error:', err)
      setError('Unable to send OTP. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    const formattedPhone = normalizeToIndianPhone(phone)
    if (!formattedPhone) {
      setError('Enter a valid 10 digit mobile number for registration')
      return
    }

    if (!registerForm.name.trim()) {
      setError('Please enter your name')
      return
    }

    setLoading(true)
    try {
      const response = await fetch(`${API_BASE_URL}/login/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: registerForm.name.trim(),
          email: registerForm.email.trim() || null,
          role: registerForm.role,
          phone: formattedPhone,
        }),
      })

      const data = await response.json()
      if (!data.success) {
        setError(data.message || 'Registration failed')
        return
      }

      if (data.vendorPending) {
        setSuccess('Vendor request submitted. We will activate your account soon.')
      } else {
        setSuccess('Registration successful. Please click Send OTP to continue.')
      }

      setShowRegister(false)
    } catch (err) {
      console.error('Register Error:', err)
      setError('Unable to register right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (!/^\d{6}$/.test(otp)) {
      setError('Enter valid 6 digit OTP')
      return
    }

    const expectedRole = activeTab === 'vendor' ? 'vendor' : 'customer'

    setLoading(true)
    try {
      const formattedPhone = normalizeToIndianPhone(phone)

      const verifyRes = await fetch(`${API_BASE_URL}/login/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: formattedPhone, otp, expectedRole })
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
                      setSuccess('')
                    }}
                    disabled={loading}
                  >
                    Change Number
                  </button>
                </>
              )}
            </form>

            {!otpSent && (
              <div className="otp-hint">
                We'll send a 6-digit verification code to your phone instantly.
              </div>
            )}

            {showRegister && !otpSent && (
              <form className="register-box" onSubmit={handleRegister}>
                <h4>Create New Account</h4>

                <div className="register-grid">
                  <input
                    type="text"
                    placeholder="Full name"
                    value={registerForm.name}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, name: e.target.value }))
                    }
                    disabled={loading}
                  />
                  <input
                    type="email"
                    placeholder="Email (optional)"
                    value={registerForm.email}
                    onChange={(e) =>
                      setRegisterForm((prev) => ({ ...prev, email: e.target.value }))
                    }
                    disabled={loading}
                  />
                </div>

                <div className="register-role-row">
                  <label>
                    <input
                      type="radio"
                      name="register-role"
                      value="customer"
                      checked={registerForm.role === 'customer'}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, role: e.target.value }))
                      }
                      disabled={loading}
                    />
                    Customer
                  </label>
                  <label>
                    <input
                      type="radio"
                      name="register-role"
                      value="vendor"
                      checked={registerForm.role === 'vendor'}
                      onChange={(e) =>
                        setRegisterForm((prev) => ({ ...prev, role: e.target.value }))
                      }
                      disabled={loading}
                    />
                    Vendor (Admin approval required)
                  </label>
                </div>

                <button type="submit" className="register-btn" disabled={loading}>
                  {loading ? 'Creating...' : 'Create Account'}
                </button>
              </form>
            )}

            <div className="divider"><span>secure login</span></div>

            <div className="signup-box">
              <div>
                <strong>New here?</strong>
                <p>If this number is new, fill details above to create your account.</p>
              </div>
              <a href="/home" className="signup-btn">Go Home</a>
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