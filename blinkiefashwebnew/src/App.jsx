import { Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { lazy, useEffect, useState } from 'react';
import BottomNav from './components/BottomNav';
import Loader from './components/Loader';
import AuthModal from './components/AuthModal';
import { useAuthModal } from './context/AuthModalContext';
import Home from './pages/Home';
const Shop = lazy(() => import('./pages/Shop'));
const Men = lazy(() => import('./pages/Men'));
const Kids = lazy(() => import('./pages/Kids'));
const Women = lazy(() => import('./pages/Women'));
const Electronics = lazy(() => import('./pages/Electronics'));
const Footwear = lazy(() => import('./pages/Footwear'));
const Backpack = lazy(() => import('./pages/Backpack'));
const Beauty = lazy(() => import('./pages/Beauty'));
const HomeLiving = lazy(() => import('./pages/HomeLiving'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const BrandPage = lazy(() => import('./pages/brand'));
const Cart = lazy(() => import('./pages/Cart'));
const Wishlist = lazy(() => import('./pages/Wishlist'));
const Checkout = lazy(() => import('./pages/Checkout'));
const Orders = lazy(() => import('./pages/Orders'));
const Account = lazy(() => import('./pages/Account'));
const Offers = lazy(() => import('./pages/Offers'));
const ReferEarn = lazy(() => import('./pages/ReferEarn'));
const OldClothes = lazy(() => import('./pages/OldClothes'));
const SpinWheel = lazy(() => import('./pages/SpinWheel'));
const FashionQuest = lazy(() => import('./pages/FashionQuest'));
const SetPassword = lazy(() => import('./pages/SetPassword'));
const ComingSoon = lazy(() => import('./pages/ComingSoon'));
const VendorAuth = lazy(() => import('./pages/VendorAuth'));
const SellerRegistration = lazy(() => import('./pages/SellerRegistration'));
const VendorStore = lazy(() => import('./pages/VendorStore'));
const VendorOrders = lazy(() => import('./pages/VendorOrders'));
const StockMonitoring = lazy(() => import('./pages/StockMonitoring'));
const AddProduct = lazy(() => import('./pages/AddProduct'));
const EditProduct = lazy(() => import('./pages/EditProduct'));
const ProductAnalytics = lazy(() => import('./pages/ProductAnalytics'));
const VendorProfile = lazy(() => import('./pages/VendorProfile'));
const VendorCatalogue = lazy(() => import('./pages/VendorCatalogue'));
const CustomerService = lazy(() => import('./pages/CustomerService'));
const Company = lazy(() => import('./pages/Company'));
const Faqs = lazy(() => import('./pages/Faqs'));
const Policies = lazy(() => import('./pages/Policies'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const Stores = lazy(() => import('./pages/Stores'));
const Careers = lazy(() => import('./pages/Careers'));
const ContactUs = lazy(() => import('./pages/ContactUs'));
const Complain = lazy(() => import('./pages/Complain'));
import { hasVendorPasswordAuth } from './utils/vendorSession';
import { isAdmin } from './utils/adminSession';
const OrderTracking = lazy(() => import('./pages/OrderTracking'));
const Parcel = lazy(() => import('./pages/Parcel'));
const HelpSupport = lazy(() => import('./pages/helpsupport'));
const SavedAddresses = lazy(() => import('./pages/SavedAddresses'));
const CreateVendor = lazy(() => import('./pages/CreateVendor'));
const ManageCategories = lazy(() => import('./pages/ManageCategories'));
const HeroCardsManager = lazy(() => import('./pages/HeroCardsManager'));
import { useAuth } from './context/AuthContext';
const DealsOfTheDay = lazy(() => import('./pages/dealsoftheday'));
const FestivePage = lazy(() => import('./pages/FestivePage'));
const OrderDetails = lazy(() => import('./pages/Orderdetail'));

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

// Anyone who lands on /login or /signup directly (bookmark, shared link,
// typed URL) gets sent back to where they meant to go, with the auth
// popup opened on top of it — so there's only ever one login/signup UI,
// and it's always the popup.
function AuthModalRoute({ view }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { openAuthModal } = useAuthModal();

  useEffect(() => {
    const destination = location.state?.from || '/';
    openAuthModal(view);
    navigate(destination, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function App() {
  const { pathname } = useLocation();
  const { isLoggedIn, userGender } = useAuth();
  const [routeLoading, setRouteLoading] = useState(false);
  const [lastPathname, setLastPathname] = useState(pathname);

  // Show the loader the instant the route changes. This is done as a
  // render-time state adjustment (React's documented pattern for "reset
  // state when a prop changes") rather than inside an effect, since setting
  // it here means it's applied before the browser paints the new route —
  // an effect would only run after that paint.
  if (pathname !== lastPathname) {
    setLastPathname(pathname);
    setRouteLoading(true);
  }

  // Hiding the loader after a short delay is a genuine side effect (a
  // timer), so it stays in an effect — the setState call lives inside the
  // setTimeout callback, not in the effect body itself.
  useEffect(() => {
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
  const isDeals = pathname === '/deals-of-the-day';
  const isFestive = pathname.startsWith('/festive');
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
    pathname.startsWith('/product/') ||
    pathname.startsWith('/brands/');
  const isCheckoutPage = pathname === '/checkout';
  const isOrdersPage = pathname === '/orders';
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
      className={`app-shell${isHome ? ' is-home' : ''}${isVendorArea ? ' is-vendor' : ''}${isInfoPage ? ' is-info' : ''}${isCatalogPage ? ' is-catalog' : ''}${isCheckoutPage ? ' is-checkout' : ''}${isOrdersPage ? ' is-orders' : ''}${isOrderTrackingPage ? ' is-order-tracking' : ''}${isAccountPage ? ' is-account' : ''}${isParcelPage ? ' is-parcel' : ''}${isOffersPage ? ' is-offers' : ''}${isHelpSupportPage ? ' is-help-support' : ''}${isDeals ? ' is-deals' : ''}${isFestive ? ' is-festive' : ''}`}
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
        <Route path="/brands/:brandName" element={<BrandPage />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/orders" element={<Orders />} />
        <Route path="/complain" element={<Complain />} />
        <Route path="/account" element={<Account />} />
        <Route path="/parcel" element={<Parcel />} />
        <Route path="/offers" element={<Offers />} />
        <Route path="/refer-earn" element={<ReferEarn />} />
        <Route path="/old-clothes" element={<OldClothes />} />
        <Route path="/spin-wheel" element={<SpinWheel />} />
        <Route path="/play-and-win" element={<FashionQuest />} />
        <Route path="/login" element={<AuthModalRoute view="login" />} />
        <Route path="/signup" element={<AuthModalRoute view="signup" />} />
        <Route path="/set-password" element={<SetPassword />} />
        <Route path="/orders/:orderId" element={<OrderDetails />} />
        <Route path="/orders/:orderId/track" element={<OrderTracking />} />
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
          path="/vendor/catalogue"
          element={
            <RequireVendorOrAdmin>
              <VendorCatalogue />
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
        <Route
          path="/vendor/hero-cards"
          element={
            <RequireAdmin>
              <HeroCardsManager />
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
        <Route path="/deals-of-the-day" element={<DealsOfTheDay />} />
        <Route path="/festive/:gender" element={<FestivePage />} />
  {/* NEW: Blinkiefash India / Local mode pages */}
        {/* <Route path="/blinkiefash-india" element={<BlinkiefashIndia />} /> */}
        {/* <Route path="/blinkiefash-local" element={<BlinkiefashLocal />} /> */}
      </Routes>
      {!isHome &&
        !isVendorArea &&
        !isInfoPage &&
        !isCatalogPage &&
        !isCheckoutPage &&
        !isOrdersPage &&
        !isOrderTrackingPage &&
        !isAccountPage &&
        !isOffersPage &&
        !isHelpSupportPage &&
        !isDeals &&
        !isFestive && <BottomNav />}

      <AuthModal />
    </div>
  );
}