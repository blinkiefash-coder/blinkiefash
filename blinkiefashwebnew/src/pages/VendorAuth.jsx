import "./vendor.css";
import { useId, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { MdVisibility, MdVisibilityOff } from "react-icons/md";
import { API_API_BASE_URL } from "../apiBase";
import { clearVendorPasswordAuth, markVendorPasswordAuth } from "../utils/vendorSession";

const ADMIN_EMAIL = "superadminsatyam@blinkiefash.in";

// This component renders both the login view and the forgot-password view,
// so it's registered on two routes: /vendor and /vendor/forgot-password.
// The current path decides which view shows on first load / direct link /
// browser back-forward; the "Forgot password?" / "Back to login" links then
// just navigate between those two paths as normal, and this effect keeps
// the view in sync without a page reload.
function viewFromPath(pathname) {
  return pathname.startsWith("/vendor/forgot-password") ? "forgot" : "login";
}

export default function VendorAuth() {
  const location = useLocation();
  const navigate = useNavigate();
  const view = viewFromPath(location.pathname);

  return (
    <div className="vendor-page">
      <section className="vendor-hero-panel">
        <div className="vendor-hero-copy">
          <p className="vendor-eyebrow">Blinkiefash vendor access</p>
          {view === "login" ? (
            <>
              <h1>One dashboard for orders, stock, and store control.</h1>
              <p>
                Sign in to manage products, confirm orders, update inventory, and keep your store live in real time.
              </p>
              <div className="vendor-hero-stats">
                <div>
                  <strong>Live</strong>
                  <span>Order sync</span>
                </div>
                <div>
                  <strong>Fast</strong>
                  <span>Stock updates</span>
                </div>
                <div>
                  <strong>Ready</strong>
                  <span>Vendor tools</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <h1>Reset your vendor password.</h1>
              <p>Enter the email linked to your vendor account and we'll send you a link to reset your password.</p>
            </>
          )}
        </div>

        {view === "login" ? (
          <LoginCard navigate={navigate} />
        ) : (
          <ForgotPasswordCard navigate={navigate} />
        )}
      </section>
    </div>
  );
}

function LoginCard({ navigate }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const passwordFieldId = useId();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    const isAdminEmail = String(email).trim().toLowerCase() === ADMIN_EMAIL.toLowerCase();

    try {
      if (isAdminEmail) {
        const res = await fetch(`${API_API_BASE_URL}/admin/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim().toLowerCase(), password }),
        });
        const data = await res.json();
        if (!data.success) {
          setError(data.message || "Invalid admin credentials");
          return;
        }
        localStorage.setItem("is_admin", "true");
        localStorage.setItem("admin_email", ADMIN_EMAIL);
        if (data.user_id) localStorage.setItem("user_id", data.user_id);
        localStorage.setItem("store_name", "Admin — All Vendors");
        localStorage.setItem("vendor_name", data.admin_name || "Admin");
        localStorage.removeItem("vendor_id");
        clearVendorPasswordAuth();
        navigate("/vendor/orders");
        return;
      }

      const res = await fetch(`${API_API_BASE_URL}/vendor/login-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        setError(`Server error: ${res.status} ${res.statusText}`);
        return;
      }

      const data = await res.json();

      if (data.success) {
        localStorage.removeItem("is_admin");
        localStorage.setItem("vendor_id", data.vendor_id);
        if (data.user_id) localStorage.setItem("user_id", data.user_id);
        if (data.store_name) localStorage.setItem("store_name", data.store_name);
        if (data.owner_name) localStorage.setItem("vendor_name", data.owner_name);
        markVendorPasswordAuth();
        navigate("/vendor/orders");
      } else {
        setError(data.message || "Verification failed");
      }
    } catch (err) {
      console.error("Vendor auth error:", err);
      setError(err.message || "Server error - please check your connection");
    }
  };

  return (
    <div className="vendor-card">
      <h2>Super Admin Login</h2>
      <p className="vendor-subtext">
        Access all vendor orders, stock monitoring, and admin tools from one dashboard.
      </p>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          placeholder="Enter your email"
          value={email}
          autoComplete="username"
          onChange={(e) => {
            setEmail(e.target.value);
            setError("");
          }}
        />

        <div className="vendor-password-field">
          <label htmlFor={passwordFieldId} className="vendor-sr-only">
            Password
          </label>
          <input
            id={passwordFieldId}
            type={showPassword ? "text" : "password"}
            placeholder="Enter your password"
            value={password}
            autoComplete="current-password"
            aria-describedby={`${passwordFieldId}-visibility-status`}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
          />
          <button
            type="button"
            className="vendor-password-toggle"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-pressed={showPassword}
            aria-label={showPassword ? "Hide password" : "Show password"}
          >
            {showPassword ? <MdVisibilityOff aria-hidden="true" /> : <MdVisibility aria-hidden="true" />}
          </button>
          {/* Visually hidden live region: announces the visibility change to screen readers
              without relying on them to notice the input's type attribute changed. */}
          <span
            id={`${passwordFieldId}-visibility-status`}
            className="vendor-sr-only"
            role="status"
            aria-live="polite"
          >
            {showPassword ? "Password is visible" : "Password is hidden"}
          </span>
        </div>

        <div className="vendor-forgot-row">
          <Link to="/vendor/forgot-password" className="vendor-forgot-link">
            Forgot password?
          </Link>
        </div>

        {error && <p className="vendor-error">{error}</p>}

        <button type="submit">Login & Continue</button>

        <p className="vendor-register-link">
          New vendor? <Link to="/vendor/register">Create your vendor account</Link>
        </p>
      </form>
    </div>
  );
}

// NOTE: this calls POST /vendor/forgot-password on the backend, which does
// not exist yet in this codebase (checked: no matching route in
// backend/routes/vendor.js). This stays frontend-only per request — the
// corresponding backend endpoint (accept an email, verify the vendor
// exists, send a reset link/OTP) still needs to be added separately before
// this will actually send anything. Until then the fetch below will 404,
// which the catch/error branch surfaces as a generic error message.
function ForgotPasswordCard() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("idle"); // idle | submitting | sent | error
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email) {
      setError("Please enter your registered email");
      return;
    }
    setError("");
    setStatus("submitting");

    try {
      const res = await fetch(`${API_API_BASE_URL}/vendor/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });
      const data = await res.json().catch(() => ({}));

      if (!res.ok || !data.success) {
        setStatus("error");
        setError(data.message || "Something went wrong. Please try again.");
        return;
      }

      setStatus("sent");
    } catch (err) {
      console.error("Vendor forgot-password error:", err);
      setStatus("error");
      setError("Could not reach the server. Please check your connection and try again.");
    }
  };

  return (
    <div className="vendor-card">
      <h2>Forgot password</h2>

      {status === "sent" ? (
        <div className="vendor-success" role="status" aria-live="polite">
          <p>
            If an account exists for <strong>{email}</strong>, a password reset link is on its way. Check your
            inbox (and spam folder).
          </p>
          <p className="vendor-register-link">
            <Link to="/vendor">Back to login</Link>
          </p>
        </div>
      ) : (
        <>
          <p className="vendor-subtext">We'll email you a link to get back into your account.</p>

          <form onSubmit={handleSubmit} noValidate>
            <label htmlFor="vendor-forgot-email" className="vendor-sr-only">
              Registered email
            </label>
            <input
              id="vendor-forgot-email"
              type="email"
              placeholder="Enter your registered email"
              value={email}
              autoComplete="username"
              aria-invalid={status === "error" && !!error}
              aria-describedby={error ? "vendor-forgot-error" : undefined}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
                if (status === "error") setStatus("idle");
              }}
            />

            {error && (
              <p className="vendor-error" id="vendor-forgot-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" disabled={status === "submitting"}>
              {status === "submitting" ? "Sending..." : "Send reset link"}
            </button>

            <p className="vendor-register-link">
              Remembered your password? <Link to="/vendor">Back to login</Link>
            </p>
          </form>
        </>
      )}
    </div>
  );
}