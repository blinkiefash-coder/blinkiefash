import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Login from "./pages/Login";
import Shop from "./pages/Shop";
import Women from "./pages/Women";
import Wishlist from "./pages/Wishlist";
import Cart from "./pages/Cart";
import VendorAuth from "./pages/VendorAuth";
import AddProduct from "./pages/AddProduct";
import ProductDetail from "./pages/ProductDetail";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/home" element={<Home />} />
        <Route path="/shop" element={<Shop />} />
        <Route path="/women" element={<Women />} />
        <Route path="/wishlist" element={<Wishlist />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/vendor" element={<VendorAuth />} />
        <Route path="/vendor/add-product" element={<AddProduct />} />
        <Route path="/product/:id" element={<ProductDetail />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
