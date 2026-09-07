import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import BottomNav from './components/BottomNav';
import Loader from './components/Loader';
import Home from './pages/Home';
import Shop from './pages/Shop';
import Men from './pages/Men';
import Kids from './pages/Kids';
import Women from './pages/Women';
import Electronics from './pages/Electronics';
import Footwear from './pages/Footwear';
import Backpack from './pages/Backpack';
import Beauty from './pages/Beauty';
import HomeLiving from './pages/HomeLiving';
import ProductDetail from './pages/ProductDetail';
import Cart from './pages/Cart';
import Wishlist from './pages/Wishlist';
import Checkout from './pages/Checkout';
import Orders from './pages/Orders';
import Account from './pages/Account';
import Offers from './pages/Offers';
import ReferEarn from './pages/ReferEarn';
import OldClothes from './pages/OldClothes';
import SpinWheel from './pages/SpinWheel';
import FashionQuest from './pages/FashionQuest';
import Login from './pages/Login';
import Signup from './pages/Signup';
import SetPassword from './pages/SetPassword';
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
import OrderTracking from './pages/OrderTracking';
import Parcel from './pages/Parcel';
import HelpSupport from './pages/helpsupport'; 
import SavedAddresses from './pages/SavedAddresses';
import CreateVendor from './pages/CreateVendor';
import ManageCategories from './pages/ManageCategories';
import { useAuth } from './context/AuthContext';
import { applyThemeVariables, removeThemeVariables } from './utils/themeUtils';

// NEW: Blinkiefash India / Local mode pages
// import BlinkiefashIndia from './pages/BlinkifashIndia';
// import BlinkiefashLocal from './pages/BlinkiefashLocal';

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
  const { isLoggedIn, userGender } = useAuth();
  const [routeLoading, setRouteLoading] = useState(false);

  useEffect(() => {
    setRouteLoading(true);
    const timeoutId = window.setTimeout(() => {
      setRouteLoading(false);
    }, 260);

    return () => window.clearTimeout(timeoutId);
  }, [pathname]);

  // Initialize theme based on user's gender
  useEffect(() => {
    if (isLoggedIn && userGender) {
      applyThemeVariables(userGender);
    } else {
      removeThemeVariables();
    }
  }, [isLoggedIn, userGender]);

  const isHome = pathname === '/';
  const isVendorArea = pathname.startsWith('/vendor');
  const isCatalogPage =
    pathname === '/shop' ||
    pathname === '/catalog' ||
    pathname === '/men' ||
    pathname === '/kids' ||
    pathname === '/women' ||
    pathname === '/electronics' ||
    pathname === '/footwear' ||
    pathname === '/backpack' ||
    pathname === '/beauty' ||
    pathname === '/home-living' ||
    pathname.startsWith('/product/');
  const isCheckoutPage = pathname === '/checkout';
  const isOrderTrackingPage = pathname.startsWith('/orders/');
  const isAccountPage = pathname === '/account' || pathname.startsWith('/account/');
  const isParcelPage = pathname === '/parcel' || pathname.startsWith('/parcel/');
  const isOffersPage =
    pathname === '/offers' ||
    pathname === '/refer-earn' ||
    pathname === '/old-clothes' ||
    pathname === '/spin-wheel' ||
    pathname === '/play-and-win';

  const isHelpSupportPage = pathname === '/help-support';
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
    '/blinkiefash-india',
    '/blinkiefash-local',
  ].some((route) => pathname === route || pathname.startsWith(`${route}/`));

  return (
    <div
      className={`app-shell${isHome ? ' is-home' : ''}${isVendorArea ? ' is-vendor' : ''}${isInfoPage ? ' is-info' : ''}${isCatalogPage ? ' is-catalog' : ''}${isCheckoutPage ? ' is-checkout' : ''}${isOrderTrackingPage ? ' is-order-tracking' : ''}${isAccountPage ? ' is-account' : ''}${isParcelPage ? ' is-parcel' : ''}${isOffersPage ? ' is-offers' : ''}${isHelpSupportPage ? ' is-help-support' : ''}`}
    >
      {routeLoading ? (
        <Loader overlay label="Loading page..." subtitle="Please wait" showLogo />
      ) : null}

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/catalog" element={<Shop />} />
        <Route path="/men" element={<Men />} />
        <Route path="/kids" element={<Kids />} />
        <Route path="/women" element={<Women />} />
        <Route path="/electronics" element={<Electronics />} />
        <Route path="/footwear" element={<Footwear />} />
        <Route path="/backpack" element={<Backpack />} />
        <Route path="/beauty" element={<Beauty />} />
        <Route path="/home-living" element={<HomeLiving />} />
        <Route path="/product/:id" element={<ProductDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/orders/:orderId" element={<OrderTracking />} />
        <Route path="/account" element={<Account />} />
        <Route path="/parcel" element={<Parcel />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/refer-earn" element={<ReferEarn />} />
        <Route path="/old-clothes" element={<OldClothes />} />
        <Route path="/spin-wheel" element={<SpinWheel />} />
        <Route path="/play-and-win" element={<FashionQuest />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route
          path="/notifications"
          element={
            <ComingSoon
              title="Notifications"
              emoji="🔔"
              description="No new notifications yet."
            />
          }
        />
        <Route path="/vendor" element={<VendorAuth />} />
        <Route path="/vendor/forgot-password" element={<VendorAuth />} />
        <Route path="/vendor/register" element={<SellerRegistration />} />
        <Route
          path="/vendor/add-product"
          element={
            <RequireVendorOrAdmin>
              <AddProduct />
            </RequireVendorOrAdmin>
          }
        />
        <Route
          path="/vendor/stock-monitoring"
          element={
            <RequireVendorOrAdmin>
              <StockMonitoring />
            </RequireVendorOrAdmin>
          }
        />
        <Route
          path="/vendor/product-analytics"
          element={
            <RequireVendorOrAdmin>
              <ProductAnalytics />
            </RequireVendorOrAdmin>
          }
        />
        <Route
          path="/vendor/orders"
          element={
            <RequireVendorOrAdmin>
              <VendorOrders />
            </RequireVendorOrAdmin>
          }
        />
        <Route
          path="/vendor/edit-product"
          element={
            <RequireVendorOrAdmin>
              <EditProduct />
            </RequireVendorOrAdmin>
          }
        />
        <Route
          path="/vendor/insights"
          element={
            <RequireAdmin>
              <VendorProfile />
            </RequireAdmin>
          }
        />
        <Route
          path="/vendor/profile"
          element={
            <RequireVendorOrAdmin>
              <VendorProfile />
            </RequireVendorOrAdmin>
          }
        />
        <Route
          path="/vendor/create-vendor"
          element={
            <RequireAdmin>
              <CreateVendor />
            </RequireAdmin>
          }
        />
        <Route
          path="/vendor/manage-categories"
          element={
            <RequireAdmin>
              <ManageCategories />
            </RequireAdmin>
          }
        />
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
        <Route path="/terms" element={<Policies />} />
        <Route path="/help-support" element={<HelpSupport />} />
        <Route path="/account/addresses" element={<SavedAddresses />} />

        {/* NEW: Blinkiefash India / Local mode pages */}
        {/* <Route path="/blinkiefash-india" element={<BlinkiefashIndia />} /> */}
        {/* <Route path="/blinkiefash-local" element={<BlinkiefashLocal />} /> */}
      </Routes>
      {!isHome &&
        !isVendorArea &&
        !isInfoPage &&
        !isCatalogPage &&
        !isCheckoutPage &&
        !isOrderTrackingPage &&
        !isAccountPage &&
        !isOffersPage &&
        !isHelpSupportPage && <BottomNav />}
    </div>
  );
}