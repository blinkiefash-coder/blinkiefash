import Navbar from "../components/Navbar";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./product.css";

export default function ProductDetail() {

  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [activeImage, setActiveImage] = useState("");

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");

  /* ✅ FETCH DATA */
  useEffect(() => {
    fetch(`https://blinkiefash.onrender.com/api/products/${id}`)
      .then(res => res.json())
      .then(data => {
        setProduct(data.product);
        setImages(data.images || []);
        setActiveImage(data.images?.[0] || "");
      })
      .catch(err => console.error(err));
  }, [id]);

  if (!product) return <p>Loading...</p>;

  const original = Number(product.price);
  const discount = Number(product.discount_price);

  const hasDiscount = discount && discount < original;

  const off = hasDiscount
    ? Math.round(((original - discount) / original) * 100)
    : 0;

  return (
    <>
      <Navbar />

      <div className="pdp-container">

        {/* ✅ LEFT SIDE */}
        <div className="pdp-images">

          {/* ✅ THUMBNAILS */}
          <div className="pdp-thumbs">
            {images.map((img, i) => (
              <img
                key={i}
                src={img}
                alt="thumbnail"
                onClick={() => setActiveImage(img)}
                className={img === activeImage ? "active" : ""}
              />
            ))}
          </div>

          {/* ✅ MAIN IMAGE */}
          <div className="pdp-main">
            {activeImage ? (
              <img src={activeImage} alt="main product" />
            ) : (
              <div className="no-image">No Image</div>
            )}
          </div>
        </div>

        {/* ✅ RIGHT SIDE */}
        <div className="pdp-details">

          <h2>{product.name}</h2>
          <p className="brand">{product.brand}</p>

          <p className="rating">⭐ 4.6 • 642 reviews</p>

          {/* ✅ PRICE */}
          <div className="price-section">
            {hasDiscount ? (
              <>
                <span className="price-final">₹{discount}</span>
                <span className="price-original">₹{original}</span>
                <span className="price-off">{off}% OFF</span>
              </>
            ) : (
              <span className="price-final">₹{original}</span>
            )}
          </div>

          {/* ✅ SIZE */}
          <div className="pdp-section">
            <h4>Size</h4>
            <div className="size-grid">
              {["XS", "S", "M", "L", "XL"].map(size => (
                <button
                  key={size}
                  className={selectedSize === size ? "active" : ""}
                  onClick={() => setSelectedSize(size)}
                >
                  {size}
                </button>
              ))}
            </div>
          </div>

          {/* ✅ COLOR */}
          <div className="pdp-section">
            <h4>Color</h4>
            <div className="color-grid">
              {["Cream", "Blue", "Gold"].map(c => (
                <button
                  key={c}
                  className={selectedColor === c ? "active" : ""}
                  onClick={() => setSelectedColor(c)}
                >
                  {c}
                </button>
              ))}
            </div>
          </div>

          {/* ✅ DELIVERY */}
          <div className="pdp-info">
            <p>✅ 60-min delivery</p>
            <p>📦 In stock</p>
          </div>

          {/* ✅ ACTIONS */}
          <div className="pdp-actions">
            <button className="buy">Buy Now</button>
            <button className="cart">Add to Bag</button>
          </div>

          <button className="try">Try & Buy</button>

        </div>
      </div>
    </>
  );
}
