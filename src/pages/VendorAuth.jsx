import "./vendor.css";
import { useState } from "react";
import Navbar from "../components/Navbar";
import { Link, useNavigate } from "react-router-dom";
import { API_API_BASE_URL } from "../apiBase";

export default function VendorAuth() {

  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!email) {
      setError("Please enter email");
      return;
    }

    try {
      const res = await fetch(
        `${API_API_BASE_URL}/vendor/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ email })
        }
      );

      const data = await res.json();

      if (data.success) {

        // ✅ Store vendor_id
        localStorage.setItem("vendor_id", data.vendor_id);

        navigate("/vendor/add-product");

      } else {
        setError(data.message);
      }

    } catch (err) {
      setError("Server error");
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

            {error && <p className="vendor-error">{error}</p>}

            <button type="submit">
              Verify & Continue
            </button>

            <p className="vendor-register-link">
              New seller? <Link to="/vendor/register">Create your seller account</Link>
            </p>

          </form>

        </div>
      </div>
    </>
  );
}