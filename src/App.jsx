import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import VendorAuth from "./pages/VendorAuth";
import VendorOrders from "./pages/VendorOrders";
import AdminInsights from "./pages/AdminInsights";
import AddProduct from "./pages/AddProduct";
import VendorStore from "./pages/VendorStore";
import CustomerService from "./pages/CustomerService";
import Company from "./pages/Company";
import Faqs from "./pages/Faqs";
import Policies from "./pages/Policies";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import VendorRegistration from "./pages/SellerRegistration";
import DarkStore from "./pages/DarkStore";
import StockMonitoring from "./pages/StockMonitoring";
import ProductAnalytics from "./pages/ProductAnalytics";
import AboutUs from "./pages/AboutUs";
import Stores from "./pages/Stores";
import Careers from "./pages/Careers";
import ContactUs from "./pages/ContactUs";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing Page */}
        <Route path="/" element={<Company />} />
        <Route path="/company" element={<Company />} />
        
        {/* Vendor Pages */}
        <Route path="/vendor" element={<VendorAuth />} />
        <Route path="/vendor/register" element={<VendorRegistration />} />
        <Route path="/vendor/add-product" element={<AddProduct />} />
        <Route path="/vendor/stock-monitoring" element={<StockMonitoring />} />
        <Route path="/vendor/product-analytics" element={<ProductAnalytics />} />
        <Route path="/vendor/orders" element={<VendorOrders />} />
        <Route path="/vendor/insights" element={<AdminInsights />} />
        <Route path="/vendor/:identifier" element={<VendorStore />} />

        {/* Admin Dark Store */}
        <Route path="/darkstore" element={<DarkStore />} />

        {/* Help & Support Pages */}
        <Route path="/customer-service" element={<CustomerService />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/faqs" element={<Faqs />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />

        {/* Redirect all other routes to landing page */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
