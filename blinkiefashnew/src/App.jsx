import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Home from './pages/Home.jsx';
import Company from './pages/Company.jsx';
import Policies from './pages/Policies.jsx';
import CustomerService from './pages/CustomerService.jsx';
import VendorAuth from './pages/VendorAuth.jsx';
import SellerRegistration from './pages/SellerRegistration.jsx';
import VendorStore from './pages/VendorStore.jsx';
import AddProduct from './pages/AddProduct.jsx';
import StockMonitoring from './pages/StockMonitoring.jsx';
import ProductAnalytics from './pages/ProductAnalytics.jsx';
import DarkStore from './pages/DarkStore.jsx';
import ProductDetail from './pages/ProductDetail.jsx';
import Explore from './pages/Explore.jsx';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Landing */}
        <Route path="/" element={<Home />} />
        <Route path="/about" element={<Company />} />

        {/* Shop */}
        <Route path="/explore" element={<Explore />} />
        <Route path="/product/:id" element={<ProductDetail />} />

        {/* Info pages */}
        <Route path="/policies" element={<Policies />} />
        <Route path="/customer-service" element={<CustomerService />} />

        {/* Vendor */}
        <Route path="/vendor" element={<VendorAuth />} />
        <Route path="/vendor/register" element={<SellerRegistration />} />
        <Route path="/vendor/add-product" element={<AddProduct />} />
        <Route path="/vendor/stock-monitoring" element={<StockMonitoring />} />
        <Route path="/vendor/product-analytics" element={<ProductAnalytics />} />
        <Route path="/vendor/:identifier" element={<VendorStore />} />

        {/* Admin */}
        <Route path="/darkstore" element={<DarkStore />} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
