import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Shop from "./pages/Shop";
import Women from "./pages/Women";
import VendorAuth from "./pages/VendorAuth";
import AddProduct from "./pages/AddProduct";
function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/shop" element={<Shop />} />

        <Route path="/women" element={<Women />}/>
        <Route path="/vendor" element={<VendorAuth />} />
        <Route path="/vendor/add-product" element={<AddProduct />} />

      </Routes>
    </BrowserRouter>
  );
}

export default App;
