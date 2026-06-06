import "./staticInfoPages.css";
import { useNavigate } from "react-router-dom";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";

function AboutUs() {
  const navigate = useNavigate();

  return (
    <div className="about-us-page">
      <Navbar />
      
      <div className="about-us-container">
        {/* Hero Section */}
        <section className="about-hero">
          <div className="about-hero-content">
            <h1>Welcome to BlinkieFash</h1>
            <p className="about-subtitle">Revolutionizing Fashion Technology & E-Commerce Solutions</p>
          </div>
        </section>

        {/* Main Content */}
        <section className="about-content">
          <div className="about-section">
            <h2>About BlinkieFash</h2>
            <p>
              BlinkieFash is a modern fashion technology platform designed to streamline inventory management, 
              vendor operations, and delivery logistics. We provide comprehensive tools for vendors, dark stores, 
              and logistics partners to manage their operations efficiently.
            </p>
          </div>

          <div className="about-section">
            <h2>Our Services</h2>
            <div className="services-grid">
              <div className="service-card">
                <h3>🛍️ Vendor Management</h3>
                <p>Comprehensive tools for sellers to manage their inventory, products, and store operations.</p>
              </div>
              <div className="service-card">
                <h3>📦 Dark Store Operations</h3>
                <p>Centralized warehouse management system for efficient inventory tracking and fulfillment.</p>
              </div>
              <div className="service-card">
                <h3>🚚 Delivery & Logistics</h3>
                <p>Complete rider management platform for delivery operations and order fulfillment.</p>
              </div>
              <div className="service-card">
                <h3>👔 Product Management</h3>
                <p>Add, manage, and showcase your fashion products with detailed specifications.</p>
              </div>
            </div>
          </div>

          <div className="about-section">
            <h2>Admin Features</h2>
            <p>
              Our platform includes robust administrative capabilities for managing vendors, dark stores, 
              product catalogs, and logistics operations.
            </p>
          </div>

          <div className="about-section cta-section">
            <h2>Access Admin & Vendor Features</h2>
            <div className="cta-buttons">
              <button 
                className="cta-btn vendor-btn"
                onClick={() => navigate("/vendor")}
              >
                Vendor Portal
              </button>
              <button 
                className="cta-btn admin-btn"
                onClick={() => navigate("/admin-access")}
              >
                Admin Access
              </button>
              <button 
                className="cta-btn darkstore-btn"
                onClick={() => navigate("/darkstore")}
              >
                Dark Store
              </button>
            </div>
          </div>

          <div className="about-section info-grid">
            <div className="info-card">
              <h3>For Vendors</h3>
              <ul>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/vendor/register"); }}>Register as Seller</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/vendor/add-product"); }}>Add Products</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/vendor"); }}>Vendor Dashboard</a></li>
              </ul>
            </div>
            <div className="info-card">
              <h3>For Admin</h3>
              <ul>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/admin-access"); }}>Admin Portal</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/darkstore"); }}>Dark Store Management</a></li>
              </ul>
            </div>
            <div className="info-card">
              <h3>Help & Support</h3>
              <ul>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/customer-service"); }}>Customer Service</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/policies"); }}>Policies</a></li>
                <li><a href="#" onClick={(e) => { e.preventDefault(); navigate("/company"); }}>Company Info</a></li>
              </ul>
            </div>
          </div>
        </section>
      </div>

      <Footer />
    </div>
  );
}

export default AboutUs;
