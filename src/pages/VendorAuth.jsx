import "./vendor.css";
import { useState } from "react";
import Navbar from "../components/Navbar";
import { Link, useNavigate } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";

export default function VendorAuth() {

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email || !password) {
      setError("Please enter email and password");
      return;
    }

    try {
      const res = await fetch(
        `${API_API_BASE_URL}/vendor/login-password`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email, password })
        }
      );

      if (!res.ok) {
        setError(`Server error: ${res.status} ${res.statusText}`);
        return;
      }

      const data = await res.json();

      if (data.success) {

        // ✅ Store vendor_id
        localStorage.setItem("vendor_id", data.vendor_id);
        if (data.user_id) {
          localStorage.setItem("user_id", data.user_id);
        }
        if (data.store_name) {
          localStorage.setItem("store_name", data.store_name);
        }
        if (data.owner_name) {
          localStorage.setItem("vendor_name", data.owner_name);
        }

        navigate("/vendor/add-product");

      } else {
        setError(data.message || "Verification failed");
      }

    } catch (err) {
      console.error("Vendor auth error:", err);
      setError(err.message || "Server error - please check your connection");
    }
  };

  return (
    <>
      <Navbar />

      <div className="vendor-page">
        <div className="vendor-card">

          <h2>Vendor Login</h2>

          <form onSubmit={handleSubmit}>

            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value);
                setError("");
              }}
            />

            <input
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError("");
              }}
            />

            {error && <p className="vendor-error">{error}</p>}

            <button type="submit">
              Login & Continue
            </button>

            <p className="vendor-register-link">
              New vendor? <Link to="/vendor/register">Create your vendor account</Link>
            </p>

          </form>

        </div>
      </div>
    </>
  );
}