import Navbar from "../components/Navbar";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  MdArrowBack,
  MdBolt,
  MdChevronLeft,
  MdChevronRight,
  MdFavoriteBorder,
  MdLocalShipping,
  MdLock,
  MdOutlineShoppingCart,
  MdStar,
  MdVerified,
} from "react-icons/md";
import { API_API_BASE_URL } from "../apiBase";
import "./product.css";

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const userId = localStorage.getItem("userUuid");
  const city = localStorage.getItem("selectedCity") || "Cuttack";

  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeImage, setActiveImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState("");
  const [wishlisted, setWishlisted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    fetch(`${API_API_BASE_URL}/products/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load product");
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;

        const rows = Array.isArray(data?.variants) ? data.variants : [];
        const firstAvailable =
          rows.find((v) => Number(v.available_stock || 0) > 0 || v.available_stock === undefined) ||
          rows[0] ||
          null;

        setProduct(data?.product || null);
        setImages(Array.isArray(data?.images) ? data.images : []);
        setVariants(rows);
        setSelectedVariant(firstAvailable);
        setSelectedColor(firstAvailable?.color || "");
        setActiveImage(0);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || "Could not load this product");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id]);

  useEffect(() => {
    let cancelled = false;

    const loadRelated = async () => {
      if (!product) return;

      try {
        const params = new URLSearchParams();
        if (product.category_id) params.set("category_id", String(product.category_id));
        params.set("limit", "8");

        const response = await fetch(`${API_API_BASE_URL}/products?${params.toString()}`);
        if (!response.ok) return;

        const data = await response.json();
        const rows = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : [];

        if (!cancelled) {
          setRelatedProducts(
            rows.filter((item) => String(item?.id) !== String(product.id)).slice(0, 4)
          );
        }
      } catch {
        if (!cancelled) setRelatedProducts([]);
      }
    };

    loadRelated();
    return () => {
      cancelled = true;
    };
  }, [product]);

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="pdp-modern-loading">Loading product...</div>
      </>
    );
  }

  if (error || !product) {
    return (
      <>
        <Navbar />
        <div className="pdp-modern-loading">{error || "Unable to load product"}</div>
      </>
    );
  }

  const gallery = images.length > 0 ? images : [{ url: null }];
  const currentImage = gallery[activeImage]?.url || "";
  const price = Number(selectedVariant?.discount_price ?? product.price ?? 0);
  const mrp = Number(selectedVariant?.price ?? price);
  const discountPct = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const rating = Number(product.rating || 4.8);
  const reviewCount = Number(product.review_count || 120);
  const canPurchase = Boolean(selectedVariant);

  const colorSeen = new Set();
  const colorOptions = variants
    .map((v) => (v.color || "").trim())
    .filter((color) => {
      const key = color.toLowerCase();
      if (!key || colorSeen.has(key)) return false;
      colorSeen.add(key);
      return true;
    });

  const sizeOptions = selectedColor
    ? variants.filter((v) => (v.color || "").toLowerCase() === selectedColor.toLowerCase())
    : variants;

  const uniqueSizes = [...new Set(sizeOptions.map((v) => v.size || "Default"))];

  const breadcrumb = [
    "Home",
    product.category_name || product.category || "Category",
    product.brand || "Brand",
    product.name,
  ];

  const onPickColor = (color) => {
    setSelectedColor(color);
    const match = variants.find((v) => (v.color || "").toLowerCase() === color.toLowerCase());
    if (match) setSelectedVariant(match);
  };

  const onPickSize = (size) => {
    const match = sizeOptions.find((v) => (v.size || "Default") === size);
    if (match) setSelectedVariant(match);
  };

  const handleAddToCart = () => {
    if (!userId) {
      alert("Please login to add items to cart");
      return;
    }
    if (!selectedVariant?.id) {
      alert("Please choose an available variant");
      return;
    }

    fetch(`${API_API_BASE_URL}/cart/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, variantId: selectedVariant.id, quantity: 1 }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Unable to add");
        window.dispatchEvent(new Event("cart:updated"));
        alert("Added to cart");
      })
      .catch(() => alert("Unable to add to cart right now"));
  };

  const handleAddToWishlist = () => {
    if (!userId) {
      alert("Please login to add items to wishlist");
      return;
    }
    if (!selectedVariant?.id) {
      alert("Please choose an available variant");
      return;
    }

    fetch(`${API_API_BASE_URL}/wishlist/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, variantId: selectedVariant.id }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) throw new Error(data.message || "Unable to add");
        window.dispatchEvent(new Event("wishlist:updated"));
        setWishlisted(true);
        alert("Added to wishlist");
      })
      .catch(() => alert("Unable to add to wishlist right now"));
  };

  return (
    <>
      <Navbar />

      <div className="pdp-modern-page">
        <div className="pdp-modern-wrap">
          <div className="pdp-modern-breadcrumbs">
            <button type="button" className="pdp-modern-back" onClick={() => navigate(-1)}>
              <MdArrowBack /> Back
            </button>
            {breadcrumb.map((item, idx) => (
              <span key={`${item}-${idx}`}>{idx > 0 ? " > " : ""}{item}</span>
            ))}
          </div>

          <section className="pdp-modern-main">
            <div className="pdp-modern-gallery">
              <div className="pdp-modern-thumbs">
                {gallery.map((img, idx) => (
                  <button
                    key={img.url || idx}
                    type="button"
                    className={`pdp-modern-thumb ${idx === activeImage ? "active" : ""}`}
                    onClick={() => setActiveImage(idx)}
                  >
                    {img.url ? <img src={img.url} alt="" /> : <div className="pdp-modern-empty" />}
                  </button>
                ))}
              </div>

              <div className="pdp-modern-imagebox">
                {currentImage ? <img src={currentImage} alt={product.name} /> : <div className="pdp-modern-empty">No image</div>}
                {gallery.length > 1 ? (
                  <>
                    <button
                      type="button"
                      className="pdp-modern-arrow left"
                      onClick={() => setActiveImage((prev) => (prev === 0 ? gallery.length - 1 : prev - 1))}
                      aria-label="Previous image"
                    >
                      <MdChevronLeft />
                    </button>
                    <button
                      type="button"
                      className="pdp-modern-arrow right"
                      onClick={() => setActiveImage((prev) => (prev === gallery.length - 1 ? 0 : prev + 1))}
                      aria-label="Next image"
                    >
                      <MdChevronRight />
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="pdp-modern-info">
              <div className="pdp-modern-chip-row">
                <span><MdBolt /> 60 MIN DELIVERY</span>
                {product.is_try_and_buy ? <span><MdVerified /> Try & Buy</span> : null}
              </div>
              <p className="pdp-modern-brand">{product.brand || "BLINKIEFASH"}</p>
              <h1>{product.name}</h1>
              <div className="pdp-modern-rating">
                <div>{Array.from({ length: 5 }).map((_, i) => <MdStar key={i} />)}</div>
                <span>{rating.toFixed(1)} ({reviewCount} Reviews)</span>
              </div>
              <div className="pdp-modern-price">
                <strong>₹{price.toLocaleString("en-IN")}</strong>
                {mrp > price ? <span>₹{mrp.toLocaleString("en-IN")}</span> : null}
                {discountPct > 0 ? <em>{discountPct}% OFF</em> : null}
              </div>
              <p className="pdp-modern-tax">Inclusive of all taxes</p>

              {colorOptions.length > 0 ? (
                <div className="pdp-modern-option">
                  <p>Color: {selectedColor || colorOptions[0]}</p>
                  <div>
                    {colorOptions.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={selectedColor.toLowerCase() === color.toLowerCase() ? "active" : ""}
                        onClick={() => onPickColor(color)}
                      >
                        {color}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="pdp-modern-option">
                <p>Select size</p>
                <div>
                  {uniqueSizes.map((size) => (
                    <button
                      key={size}
                      type="button"
                      className={(selectedVariant?.size || "Default") === size ? "active" : ""}
                      onClick={() => onPickSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pdp-modern-facts">
                <p><strong>Category:</strong> {product.category_name || product.category || "Fashion"}</p>
                <p><strong>Brand:</strong> {product.brand || "Blinkiefash"}</p>
                <p><strong>Stock:</strong> {selectedVariant?.available_stock ?? "Available"}</p>
              </div>
            </div>

            <aside className="pdp-modern-buybox">
              <h3>Deliver to</h3>
              <p>{city}</p>
              <div>
                <p><MdBolt /> 60-Minute Express Delivery</p>
                <p><MdLocalShipping /> Cash on Delivery available</p>
                <p><MdVerified /> Easy Returns</p>
              </div>
              <button type="button" disabled={!canPurchase} onClick={() => { handleAddToCart(); navigate("/checkout"); }}>
                <MdBolt /> Buy Now
              </button>
              <button type="button" className="outline" disabled={!canPurchase} onClick={handleAddToCart}>
                <MdOutlineShoppingCart /> Add to Cart
              </button>
              <button type="button" className="wish" onClick={handleAddToWishlist}>
                <MdFavoriteBorder /> {wishlisted ? "Wishlisted" : "Add to Wishlist"}
              </button>
              <small><MdLock /> Secure Payment</small>
            </aside>
          </section>

          <section className={`pdp-modern-bottom ${relatedProducts.length > 0 ? "" : "no-related"}`}>
            <div className="pdp-modern-description-card">
              <div className="pdp-modern-tabs">
                <button type="button" className="active">Product Description</button>
                <button type="button">Product Details</button>
                <button type="button">Ratings & Reviews ({reviewCount})</button>
              </div>
              <div className="pdp-modern-description-body">
                <p>{product.description || "No description available for this product yet."}</p>
                <ul>
                  <li><MdVerified /> 100% Original product</li>
                  <li><MdLocalShipping /> Easy returns within 5 days</li>
                  <li><MdLock /> Secure payment and protected checkout</li>
                </ul>
              </div>
            </div>

            {relatedProducts.length > 0 ? (
              <aside className="pdp-modern-related-card">
                <div className="pdp-modern-related-head">
                  <h3>You May Also Like</h3>
                  <button type="button" onClick={() => navigate("/shop")}>View All</button>
                </div>
                <div className="pdp-modern-related-list">
                  {relatedProducts.map((item) => {
                    const itemPrice = Number(item.discount_price || item.price || 0);
                    return (
                      <article key={item.id} onClick={() => navigate(`/product/${item.id}`)}>
                        <div>{item.image ? <img src={item.image} alt={item.name} /> : <div className="pdp-modern-empty" />}</div>
                        <h4>{item.name}</h4>
                        <p>₹{itemPrice.toLocaleString("en-IN")}</p>
                      </article>
                    );
                  })}
                </div>
              </aside>
            ) : null}
          </section>
        </div>

        <div className="pdp-modern-mobile-bar">
          <div>
            <strong>₹{price.toLocaleString("en-IN")}</strong>
            {mrp > price ? <span>₹{mrp.toLocaleString("en-IN")}</span> : null}
          </div>
          <button type="button" className="cart" disabled={!canPurchase} onClick={handleAddToCart}><MdOutlineShoppingCart /> Cart</button>
          <button
            type="button"
            className="buy"
            disabled={!canPurchase}
            onClick={() => {
              handleAddToCart();
              navigate("/checkout");
            }}
          >
            <MdBolt /> Buy
          </button>
        </div>
      </div>
    </>
  );
}
