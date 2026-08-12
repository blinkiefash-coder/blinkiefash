import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Home from './pages/Home';
import Shop from './pages/Shop';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Account from './pages/Account';
import Login from './pages/Login';
import Signup from './pages/Signup';
import ComingSoon from './pages/ComingSoon';
import VendorAuth from './pages/VendorAuth';
import SellerRegistration from './pages/SellerRegistration';
import VendorStore from './pages/VendorStore';
import VendorOrders from './pages/VendorOrders';
import StockMonitoring from './pages/StockMonitoring';
import AddProduct from './pages/AddProduct';
import EditProduct from './pages/EditProduct';
import ProductAnalytics from './pages/ProductAnalytics';
import VendorProfile from './pages/VendorProfile';
import CustomerService from './pages/CustomerService';
import Company from './pages/Company';
import Faqs from './pages/Faqs';
import Policies from './pages/Policies';
import PrivacyPolicy from './pages/PrivacyPolicy';
import AboutUs from './pages/AboutUs';
import Stores from './pages/Stores';
import Careers from './pages/Careers';
import ContactUs from './pages/ContactUs';
import { hasVendorPasswordAuth } from './utils/vendorSession';
import { isAdmin } from './utils/adminSession';
import IndependenceThemeBanner from './components/IndependenceThemeBanner';

function RequireVendorOrAdmin({ children }) {
  if (isAdmin() || hasVendorPasswordAuth()) {
    return children;
  }
  return <Navigate to="/vendor" replace />;
}

function RequireAdmin({ children }) {
  if (isAdmin()) {
    return children;
  }
  return <Navigate to="/vendor" replace />;
}

export default function App() {
  const { pathname } = useLocation();
  const isHome = pathname === '/';
  const isVendorArea = pathname.startsWith('/vendor');
  const isCatalogPage =
    pathname === '/shop' ||
    pathname === '/catalog' ||
    pathname === '/women' ||
    pathname.startsWith('/product/');
  const isInfoPage = [
    '/company',
    '/customer-service',
    '/contact-us',
    '/about',
    '/stores',
    '/careers',
    '/faqs',
    '/policies',
    '/privacy-policy',
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <div className={`app-shell${isHome ? ' is-home' : ''}${isVendorArea ? ' is-vendor' : ''}${isInfoPage ? ' is-info' : ''}${isCatalogPage ? ' is-catalog' : ''}`}>
      {!isVendorArea && <IndependenceThemeBanner />}
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/catalog" element={<Shop />} />
        <Route path="/women" element={<Shop />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/account" element={<Account />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/notifications"
          element={<ComingSoon title="Notifications" emoji="🔔" description="No new notifications yet." />}
        />
        <Route
          path="/spin-wheel"
          element={<ComingSoon title="Spin & Win" emoji="🎡" description="The spin wheel is coming soon." />}
        />
        <Route
          path="/play-and-win"
          element={<ComingSoon title="Play & Win" emoji="🎮" description="Fashion quest is coming soon." />}
        />
        <Route
          path="/refer-earn"
          element={<ComingSoon title="Refer & Earn" emoji="🎁" description="Referral rewards are coming soon." />}
        />
        <Route path="/vendor" element={<VendorAuth />} />
        <Route path="/vendor/register" element={<SellerRegistration />} />
        <Route path="/vendor/add-product" element={<RequireVendorOrAdmin><AddProduct /></RequireVendorOrAdmin>} />
        <Route path="/vendor/stock-monitoring" element={<RequireVendorOrAdmin><StockMonitoring /></RequireVendorOrAdmin>} />
        <Route path="/vendor/product-analytics" element={<RequireVendorOrAdmin><ProductAnalytics /></RequireVendorOrAdmin>} />
        <Route path="/vendor/orders" element={<RequireVendorOrAdmin><VendorOrders /></RequireVendorOrAdmin>} />
        <Route path="/vendor/edit-product" element={<RequireVendorOrAdmin><EditProduct /></RequireVendorOrAdmin>} />
        <Route path="/vendor/insights" element={<RequireAdmin><VendorProfile /></RequireAdmin>} />
        <Route path="/vendor/profile" element={<RequireVendorOrAdmin><VendorProfile /></RequireVendorOrAdmin>} />
        <Route path="/vendor/:identifier" element={<VendorStore />} />
        <Route path="/company" element={<Company />} />
        <Route path="/customer-service" element={<CustomerService />} />
        <Route path="/contact-us" element={<ContactUs />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/stores" element={<Stores />} />
        <Route path="/careers" element={<Careers />} />
        <Route path="/faqs" element={<Faqs />} />
        <Route path="/policies" element={<Policies />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
      </Routes>
      {!isHome && !isVendorArea && !isInfoPage && !isCatalogPage && <BottomNav />}
    </div>
  );
}
