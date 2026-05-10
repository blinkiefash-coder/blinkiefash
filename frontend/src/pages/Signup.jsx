import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_BASE_URL } from "../apiBase";
import "./signup.css";

function normalizeToIndianPhone(value) {
  const digits = String(value || "").replace(/\D/g, "");
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith("91")) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith("091")) return `+91${digits.slice(3)}`;
  return "";
}

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const initialPhone = useMemo(() => {
    const queryPhone = searchParams.get("phone") || "";
    const normalized = normalizeToIndianPhone(queryPhone);
    return normalized || "";
  }, [searchParams]);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState(initialPhone);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    const formattedPhone = normalizeToIndianPhone(phone);
    if (!name.trim()) {
      setError("Please enter your full name");
      return;
    }

    if (!formattedPhone) {
      setError("Please enter a valid mobile number");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${API_BASE_URL}/login/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim() || null,
          phone: formattedPhone,
        }),
      });

      const data = await response.json();
      if (!data.success) {
        setError(data.message || "Unable to create account");
        return;
      }

      setSuccess("Account created successfully. Redirecting to login...");
      setTimeout(() => {
        navigate(`/login?phone=${encodeURIComponent(formattedPhone)}`);
      }, 1000);
    } catch (err) {
      console.error("Signup error:", err);
      setError("Unable to create account right now. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="signup-page">
      <div className="signup-card">
        <h1>Create Customer Account</h1>
        <p>Fill your details and continue with OTP login.</p>

        {error ? <div className="signup-error">{error}</div> : null}
        {success ? <div className="signup-success">{success}</div> : null}

        <form onSubmit={handleSubmit}>
          <label>
            Full Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter your name"
              disabled={loading}
            />
          </label>

          <label>
            Mobile Number
            <input
              type="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="Enter mobile number"
              disabled={loading}
            />
          </label>

          <label>
            Email (optional)
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email"
              disabled={loading}
            />
          </label>

          <button type="submit" disabled={loading}>
            {loading ? "Creating Account..." : "Create Account"}
          </button>
        </form>

        <button className="signup-back" onClick={() => navigate("/login")} type="button">
          Back to Login
        </button>
      </div>
    </div>
  );
}
