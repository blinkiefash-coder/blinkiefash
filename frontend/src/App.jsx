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
          <Route path="/" element={<Login />} />
          <Route path="/login" element={<Login />} />
          <Route path="/password-reset" element={<PasswordReset />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/home" element={<Home />} />
          <Route path="/shop" element={<Shop />} />
          <Route path="/explore-shops" element={<ExploreShops />} />
          <Route path="/vendor/:identifier" element={<VendorStore />} />
          <Route path="/women" element={<Women />} />
          <Route path="/wishlist" element={<Wishlist />} />
          <Route path="/cart" element={<Cart />} />
          <Route path="/vendor" element={<VendorAuth />} />
          <Route path="/vendor/register" element={<SellerRegistration />} />
          <Route path="/vendor/add-product" element={<AddProduct />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/catalog" element={<InsideCatalog />} />
          <Route path="/customer-service" element={<CustomerService />} />
          <Route path="/company" element={<Company />} />
          <Route path="/policies" element={<Policies />} />
          <Route path="/darkstore" element={<DarkStore />} />
          <Route path="/admin-access" element={<Navigate to="/home" replace />} />
          <Route path="*" element={<Navigate to="/home" replace />} />
        </Routes>
      )}
    </BrowserRouter>
  );
}

export default App;
