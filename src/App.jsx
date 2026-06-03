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
          {/* About Us / Home Page */}
          <Route path="/" element={<AboutUs />} />
          <Route path="/home" element={<AboutUs />} />
          
          {/* Authentication Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/signup" element={<Signup />} />

          {/* ACTIVE: Vendor Routes */}
          <Route path="/vendor" element={<VendorAuth />} />
          <Route path="/vendor/register" element={<SellerRegistration />} />
          <Route path="/vendor/add-product" element={<AddProduct />} />
          <Route path="/vendor/:identifier" element={<VendorStore />} />

          {/* ACTIVE: Admin Routes */}
          <Route path="/darkstore" element={<DarkStore />} />
          <Route path="/admin-access" element={<Navigate to="/" replace />} />

          {/* ACTIVE: Help & Support Pages */}
          <Route path="/customer-service" element={<CustomerService />} />
          <Route path="/company" element={<Company />} />
          <Route path="/policies" element={<Policies />} />

          {/* BLOCKED: Customer Shopping Routes → NotAccessible */}
          <Route path="/shop" element={<NotAccessible />} />
          <Route path="/women" element={<NotAccessible />} />
          <Route path="/catalog" element={<NotAccessible />} />
          <Route path="/explore-shops" element={<NotAccessible />} />
          <Route path="/wishlist" element={<NotAccessible />} />
          <Route path="/cart" element={<NotAccessible />} />
          <Route path="/checkout" element={<NotAccessible />} />
          <Route path="/orders" element={<NotAccessible />} />
          <Route path="/refer-earn" element={<NotAccessible />} />
          <Route path="/donate-clothes" element={<NotAccessible />} />
          <Route path="/product/:id" element={<NotAccessible />} />
          <Route path="/inside-catalog" element={<NotAccessible />} />

          {/* Catch-all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
