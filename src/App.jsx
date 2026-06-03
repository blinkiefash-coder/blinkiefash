import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Shop from "./pages/Shop";
import Women from "./pages/Women";
import Wishlist from "./pages/Wishlist";
import Cart from "./pages/Cart";
import VendorAuth from "./pages/VendorAuth";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";
import Signup from "./pages/Signup";
import ExploreShops from "./pages/ExploreShops";
import VendorStore from "./pages/VendorStore";
import InsideCatalog from "./pages/InsideCatalog";
import CustomerService from "./pages/CustomerService";
import Company from "./pages/Company";
import Policies from "./pages/Policies";
import AdminPinGate from "./pages/AdminPinGate";
import SellerRegistration from "./pages/SellerRegistration";
import DarkStore from "./pages/DarkStore";
import PasswordReset from "./pages/PasswordReset";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import ReferEarn from "./pages/ReferEarn";
import OldClothes from "./pages/OldClothes";
import AboutUs from "./pages/AboutUs";
import NotAccessible from "./pages/NotAccessible";

function App() {
  const [isPinVerified, setIsPinVerified] = useState(
    localStorage.getItem("adminPinVerified") === "true"
  );

  const handlePinSuccess = () => {
    localStorage.setItem("adminPinVerified", "true");
    setIsPinVerified(true);
  };

  return (
    <BrowserRouter>
      {!isPinVerified ? (
        <Routes>
          <Route path="/admin-access" element={<AdminPinGate onSuccess={handlePinSuccess} />} />
          <Route path="*" element={<Navigate to="/admin-access" replace />} />
        </Routes>
      ) : (
        <Routes>
          {/* ONLY ALLOWED: About Us Home Page */}
          <Route path="/" element={<AboutUs />} />
          
          {/* ONLY ALLOWED: Vendor Pages */}
          <Route path="/vendor" element={<VendorAuth />} />
          <Route path="/vendor/register" element={<SellerRegistration />} />
          <Route path="/vendor/add-product" element={<AddProduct />} />
          <Route path="/vendor/:identifier" element={<VendorStore />} />

          {/* ONLY ALLOWED: Admin Dark Store */}
          <Route path="/darkstore" element={<DarkStore />} />

          {/* ONLY ALLOWED: Help & Support Pages */}
          <Route path="/customer-service" element={<CustomerService />} />
          <Route path="/company" element={<Company />} />
          <Route path="/policies" element={<Policies />} />

          {/* BLOCKED: Everything else redirects to About Us */}
          <Route path="/home" element={<Navigate to="/" replace />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
          <Route path="/password-reset" element={<Navigate to="/" replace />} />
          <Route path="/shop" element={<Navigate to="/" replace />} />
          <Route path="/women" element={<Navigate to="/" replace />} />
          <Route path="/catalog" element={<Navigate to="/" replace />} />
          <Route path="/explore-shops" element={<Navigate to="/" replace />} />
          <Route path="/wishlist" element={<Navigate to="/" replace />} />
          <Route path="/cart" element={<Navigate to="/" replace />} />
          <Route path="/checkout" element={<Navigate to="/" replace />} />
          <Route path="/orders" element={<Navigate to="/" replace />} />
          <Route path="/refer-earn" element={<Navigate to="/" replace />} />
          <Route path="/donate-clothes" element={<Navigate to="/" replace />} />
          <Route path="/product/:id" element={<Navigate to="/" replace />} />
          <Route path="/inside-catalog" element={<Navigate to="/" replace />} />
          <Route path="/admin-access" element={<Navigate to="/" replace />} />

          {/* Catch-all: Any unknown route goes to home */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
