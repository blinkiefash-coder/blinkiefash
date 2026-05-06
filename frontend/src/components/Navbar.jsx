import "./Navbar.css";
import logo from "../assets/logo.png";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Navbar() {
  const [activeTab, setActiveTab] = useState("ALL");
  const [selectedCity, setSelectedCity] = useState("Bhubaneswar");
  const [addressOpen, setAddressOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);

  const navigate = useNavigate();

  const tabs = ["ALL", "WOMEN", "MEN", "KIDS", "BEAUTY", "HOMELIVING"];

  return (
    <header className="navbar">
      <div className="nav-left">
        <img src={logo} alt="Blinkiefash" className="logo-img" />

        <span className="brand">
          <span className="brand-black">BLINKIE</span>
          <span className="brand-green">FASH</span>
        </span>

        <div
          className="address-box"
          onClick={() => setAddressOpen(!addressOpen)}
        >
          <span className="address-top">DELIVER IN 60 MIN</span>
          <span className="address-bottom">
            {selectedCity} ▾
          </span>

          {addressOpen && (
            <div className="address-dropdown">
              <div onClick={() => setSelectedCity("Bhubaneswar")}>
                Bhubaneswar
              </div>
              <div onClick={() => setSelectedCity("Cuttack")}>
                Cuttack
              </div>
              <div className="divider" />
              <div className="add-address">+ Add address</div>
            </div>
          )}
        </div>

        <nav className="nav-links">
          {tabs.map((tab) => (
            <span
              key={tab}
              className={`nav-item ${
                activeTab === tab ? "active" : ""
              }`}
              onClick={() => {
                setActiveTab(tab);
                navigate("/shop");
              }}
            >
              {tab}
            </span>
          ))}
        </nav>
      </div>

      <div className="nav-right">
        <input
          className="search-box"
          placeholder="Search for apparels, brands & trends"
        />

        <div className="cart-icon">
          <svg viewBox="0 0 24 24">
            <path d="M6 6h15l-1.5 9h-12z" />
            <circle cx="9" cy="21" r="1" />
            <circle cx="18" cy="21" r="1" />
          </svg>
        </div>

        <div
          className="profile-box"
          onClick={() => setProfileOpen(!profileOpen)}
        >
          <div className="avatar">S</div>
          <div className="profile-text">
            <span>Hello</span>
            <strong>Sejal</strong>
          </div>

          {profileOpen && (
            <div className="profile-dropdown">
              <div>My Profile</div>
              <div>Orders</div>
              <div className="divider" />
              <div className="logout">Logout</div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}