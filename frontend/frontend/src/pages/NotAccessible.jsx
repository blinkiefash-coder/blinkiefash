import "./staticInfoPages.css";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function NotAccessible() {
  const navigate = useNavigate();

  return (
    <div className="not-accessible-page">
      <Navbar />
      
      <div className="not-accessible-container">
        <section className="not-accessible-content">
          <div className="error-icon">🔒</div>
          <h1>Feature Not Available</h1>
          <p>Customer shopping features are not available through the web platform.</p>
          <p className="subtitle">BlinkieFash web portal is designed for vendor and admin operations.</p>
          
          <div className="available-features">
            <h2>Available Features</h2>
            <div className="feature-list">
              <button 
                className="feature-btn"
                onClick={() => navigate("/vendor")}
              >
                📦 Vendor Portal
              </button>
              <button 
                className="feature-btn"
                onClick={() => navigate("/darkstore")}
              >
                🏪 Dark Store Management
              </button>
              <button 
                className="feature-btn"
                onClick={() => navigate("/vendor/add-product")}
              >
                ➕ Add Products
              </button>
            </div>
          </div>

          <div className="note-section">
            <p><strong>Note:</strong> For customer shopping experience, please use the mobile app (BlinkieFash Customer).</p>
          </div>

          <button 
            className="back-btn"
            onClick={() => navigate("/")}
          >
            ← Back to Home
          </button>
        </section>
      </div>

      <Footer />
    </div>
  );
}

export default NotAccessible;
