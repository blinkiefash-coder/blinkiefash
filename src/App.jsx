import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import VendorAuth from "./pages/VendorAuth";
import AddProduct from "./pages/AddProduct";
import VendorStore from "./pages/VendorStore";
import CustomerService from "./pages/CustomerService";
import Company from "./pages/Company";
import Policies from "./pages/Policies";
import SellerRegistration from "./pages/SellerRegistration";
import DarkStore from "./pages/DarkStore";
import StockMonitoring from "./pages/StockMonitoring";
import ProductAnalytics from "./pages/ProductAnalytics";
import VendorSalesReport from "./pages/VendorSalesReport";
import PinAccessGate from "./components/PinAccessGate";

const ACCESS_PIN = "00198234";

function PinProtectedRoute({ sectionLabel, children }) {
  const [isUnlocked, setIsUnlocked] = useState(false);

  const handleUnlock = () => {
    setIsUnlocked(true);
  };

  if (!isUnlocked) {
    return (
      <PinAccessGate
        requiredPin={ACCESS_PIN}
        sectionLabel={sectionLabel}
        onSuccess={handleUnlock}
      />
    );
  }

  return children;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Company />} />
        <Route path="/company" element={<Company />} />
        
        {/* Vendor Pages */}
        <Route path="/vendor" element={<PinProtectedRoute sectionLabel="Vendor Dashboard"><VendorAuth /></PinProtectedRoute>} />
        <Route path="/vendor/register" element={<PinProtectedRoute sectionLabel="Vendor Dashboard"><SellerRegistration /></PinProtectedRoute>} />
        <Route path="/vendor/add-product" element={<PinProtectedRoute sectionLabel="Vendor Dashboard"><AddProduct /></PinProtectedRoute>} />
        <Route path="/vendor/stock-monitoring" element={<PinProtectedRoute sectionLabel="Vendor Dashboard"><StockMonitoring /></PinProtectedRoute>} />
        <Route path="/vendor/product-analytics" element={<PinProtectedRoute sectionLabel="Vendor Dashboard"><ProductAnalytics /></PinProtectedRoute>} />
        <Route path="/vendor/sales-report" element={<PinProtectedRoute sectionLabel="Vendor Dashboard"><VendorSalesReport /></PinProtectedRoute>} />
        <Route path="/vendor/:identifier" element={<VendorStore />} />

        {/* Admin Dark Store */}
        <Route path="/darkstore" element={<PinProtectedRoute sectionLabel="Dark Store"><DarkStore /></PinProtectedRoute>} />

        {/* Help & Support Pages */}
        <Route path="/customer-service" element={<CustomerService />} />
        <Route path="/policies" element={<Policies />} />

        {/* Redirect all other routes to landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
