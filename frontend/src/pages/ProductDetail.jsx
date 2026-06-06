import Navbar from "../components/Navbar";
import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import "./product.css";
import { API_API_BASE_URL } from "../apiBase";

const REVIEW_SUMMARY = [
  { label: "5", count: 412 },
  { label: "4", count: 160 },
  { label: "3", count: 48 },
  { label: "2", count: 14 },
  { label: "1", count: 8 },
];

const SAMPLE_REVIEWS = [
  {
    name: "Priya S.",
    time: "5 days ago",
    text: "Beautiful set. The fabric is soft and the print looks even better in person.",
  },
  {
    name: "Ananya R.",
    time: "1 week ago",
    text: "Loved the fit and the quality. Got so many compliments after wearing it.",
  },
  {
    name: "Neha T.",
    time: "2 weeks ago",
    text: "Nice product, color and design are great. Lightweight and flowy.",
  },
];

const FEATURE_POINTS = [
  "100% original products",
  "60-min delivery in selected locations",
  "7-day easy returns",
  "Secure payments",
];

function getInitialSelection(values) {
  return values[0] || "";
}

function getVariantId(variant) {
  return variant?.id || variant?.variant_id || "";
}

function formatCurrency(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

export default function ProductDetail() {

  const { id } = useParams();

  const [product, setProduct] = useState(null);
  const [images, setImages] = useState([]);
  const [variants, setVariants] = useState([]);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [activeImage, setActiveImage] = useState("");

  const [selectedSize, setSelectedSize] = useState("");
  const [selectedColor, setSelectedColor] = useState("");
  const userId = localStorage.getItem("userUuid");

  /* ✅ FETCH DATA */
  useEffect(() => {
  fetch(`${API_API_BASE_URL}/products/${id}`)
    .then(res => {
      if (!res.ok) throw new Error("API failed");
      return res.json();
    })
    .then(data => {
      setProduct(data.product);
      setImages(data.images || []);
      setActiveImage(data.images?.[0] || "");
      setVariants(data.variants || []);

      const inStockVariants = (data.variants || []).filter((item) => Number(item.available_stock || 0) > 0 || item.available_stock === undefined);
      const sizes = [...new Set(inStockVariants.map((item) => item.size).filter(Boolean))];
      const colors = [...new Set(inStockVariants.map((item) => item.color).filter(Boolean))];

      setSelectedSize((current) => current || getInitialSelection(sizes));
      setSelectedColor((current) => current || getInitialSelection(colors));
    })
    .catch(err => {
      console.error("Fetch error:", err);
    });
}, [id]);

  useEffect(() => {
    fetch(`${API_API_BASE_URL}/products`)
      .then((res) => {
        if (!res.ok) {
          throw new Error("Products API failed");
        }
        return res.json();
      })
      .then((data) => {
        setRelatedProducts((data || []).filter((item) => String(item.id) !== String(id)).slice(0, 4));
      })
      .catch((err) => {
        console.error("Related products fetch error:", err);
      });
  }, [id]);


  if (!product) return <p>Loading...</p>;

  const sizeOptions = [...new Set(variants.map((item) => item.size).filter(Boolean))];
  const colorOptions = [...new Set(
    variants
      .filter((item) => !selectedSize || item.size === selectedSize)
      .map((item) => item.color)
      .filter(Boolean)
  )];

  const selectedVariant =
    variants.find(
      (item) =>
        (!selectedSize || item.size === selectedSize) &&
        (!selectedColor || item.color === selectedColor)
    ) || variants.find((item) => !selectedSize || item.size === selectedSize) || variants[0] || null;

  const selectedVariantId = getVariantId(selectedVariant);
  const selectedVariantStock = Number(selectedVariant?.available_stock || 0);
  const hasStock = selectedVariant ? (selectedVariant?.available_stock === undefined || selectedVariantStock > 0) : false;

  const original = Number(selectedVariant?.price || 0);
  const discount = Number(selectedVariant?.discount_price || 0);

  const hasDiscount = discount && discount < original;

  const off = hasDiscount
    ? Math.round(((original - discount) / original) * 100)
    : 0;

  const averageRating = 4.6;
  const totalReviews = 642;
  const ratingPercentages = REVIEW_SUMMARY.map((item) => ({
    ...item,
    percent: Math.round((item.count / totalReviews) * 100),
  }));

  const displayedPrice = hasDiscount ? discount : original;
  const material = product.material || "Soft blended fabric";
  const description =
    product.description ||
    `${product.name} crafted for everyday wear with a flattering silhouette and comfortable finish.`;

  const handleAddToCart = () => {
    if (!userId) {
      alert("Please login to add items to cart");
      return;
    }

    if (!selectedVariantId || !hasStock) {
      alert("Please choose an available variant");
      return;
    }

    fetch(`${API_API_BASE_URL}/cart/add`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId, variantId: selectedVariantId, quantity: 1 }),
    })
      .then((res) => res.json())
      .then((data) => {
        if (!data.success) {
          throw new Error(data.message || "Unable to add to cart");
        }
        window.dispatchEvent(new Event("cart:updated"));
        alert("Added to cart");
      })
      .catch(() => {
        alert("Unable to add to cart right now");
      });
  };

  const handleAddToWishlist = async () => {
    if (!userId) {
      alert("Please login to add items to wishlist");
      return;
    }

    if (!selectedVariantId || !hasStock) {
      alert("Please choose an available variant");
      return;
    }

    try {
      const response = await fetch(`${API_API_BASE_URL}/wishlist/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, variantId: selectedVariantId }),
      });
      const data = await response.json();

      if (!data.success) {
        throw new Error(data.message || "Unable to add to wishlist");
      }

      window.dispatchEvent(new Event("wishlist:updated"));
      alert("Added to wishlist");
    } catch {
      alert("Unable to add to wishlist right now");
    }
  };

  return (
    <>
      <Navbar />

      <div className="pdp-page">
        <div className="pdp-shell">
          <div className="pdp-breadcrumbs">
            <span>Home</span>
            <span>/</span>
            <span>{product.gender || "Shop"}</span>
            <span>/</span>
            <span>{product.brand || "Product"}</span>
            <span>/</span>
            <strong>{product.name}</strong>
          </div>

          <div className="pdp-container">
            <div className="pdp-images">
              <div className="pdp-thumbs">
                {images.map((img, i) => (
                  <button
                    key={img || i}
                    type="button"
                    className={`pdp-thumb ${img === activeImage ? "active" : ""}`}
                    onClick={() => setActiveImage(img)}
                  >
                    <img src={img} alt={`${product.name} view ${i + 1}`} />
                  </button>
                ))}
              </div>

              <div className="pdp-main">
                {activeImage ? (
                  <img src={activeImage} alt={product.name} />
                ) : (
                  <div className="no-image">No Image</div>
                )}
                <button type="button" className="pdp-zoom">+</button>
              </div>
            </div>

            <div className="pdp-details">
              <div className="pdp-header-block">
                <span className="pdp-label">{product.gender || "Women"}</span>
                <h1>{product.name}</h1>
                <p className="brand">{product.brand || "BlinkieFash"}</p>
                <div className="pdp-rating-row">
                  <span className="pdp-rating-badge">★ {averageRating}</span>
                  <span>{totalReviews} reviews</span>
                </div>
              </div>

              <div className="price-section">
                <span className="price-final">{formatCurrency(displayedPrice)}</span>
                {hasDiscount ? (
                  <>
                    <span className="price-original">{formatCurrency(original)}</span>
                    <span className="price-off">{off}% OFF</span>
                  </>
                ) : null}
              </div>

              <div className="pdp-option-block">
                <div className="pdp-option-head">
                  <h4>Size</h4>
                  <button type="button" className="pdp-text-link">Size Guide</button>
                </div>
                <div className="size-grid">
                  {sizeOptions.map((size) => (
                    <button
                      type="button"
                      key={size}
                      className={selectedSize === size ? "active" : ""}
                      onClick={() => setSelectedSize(size)}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pdp-option-block">
                <h4>Color</h4>
                <div className="color-grid">
                  {colorOptions.map((color) => (
                    <button
                      type="button"
                      key={color}
                      className={selectedColor === color ? "active" : ""}
                      onClick={() => setSelectedColor(color)}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pdp-meta-strip">
                <div>
                  <strong>60-min delivery</strong>
                  <span>Fast delivery available</span>
                </div>
                <div>
                  <strong>{hasStock ? "In stock" : "Out of stock"}</strong>
                  <span>{hasStock ? `Only ${selectedVariantStock || "few"} left` : "Selected variant unavailable"}</span>
                </div>
              </div>

              <div className="pdp-actions">
                <button type="button" className="buy">Buy Now</button>
                <button type="button" className="cart" onClick={handleAddToCart} disabled={!hasStock}>Add to Bag</button>
              </div>

              <button type="button" className="try" onClick={handleAddToWishlist} disabled={!hasStock}>Add to Wishlist</button>
              <button type="button" className="try">Try & Buy</button>

              <div className="pdp-try-box">
                <h4>How Try & Buy works</h4>
                <ol>
                  <li>Pay full amount now and hold it safely.</li>
                  <li>Try the product at home and keep what fits.</li>
                  <li>Refunds are processed quickly for returned items.</li>
                </ol>
              </div>

              <div className="pdp-accordion-list">
                <details open>
                  <summary>Product Description</summary>
                  <p>{description}</p>
                </details>
                <details>
                  <summary>Fabric & Care</summary>
                  <p>{material}. Dry clean or gentle hand wash recommended.</p>
                </details>
                <details>
                  <summary>Delivery & Returns</summary>
                  <p>Free shipping on qualifying orders. Easy returns within 7 days.</p>
                </details>
              </div>
            </div>
          </div>

          <div className="pdp-content-sections">
            <section className="pdp-card-section">
              <div className="pdp-section-title">Product Description</div>
              <p>{description}</p>
              <ul>
                <li>Selected color: {selectedColor || "Standard"}</li>
                <li>Selected size: {selectedSize || "One size"}</li>
                <li>Material: {material}</li>
                <li>Brand: {product.brand || "BlinkieFash"}</li>
              </ul>
            </section>

            <section className="pdp-card-section pdp-two-col">
              <div>
                <div className="pdp-section-title">Fabric & Care</div>
                <p className="pdp-subtitle">Material</p>
                <p>{material}</p>
                <p className="pdp-subtitle">Care</p>
                <p>Hand wash separately in cold water. Dry in shade. Iron on low heat.</p>
              </div>
              <div className="pdp-feature-list">
                <div>Soft & breathable</div>
                <div>Lightweight feel</div>
                <div>Comfort focused finish</div>
              </div>
            </section>

            <section className="pdp-card-section pdp-two-col">
              <div>
                <div className="pdp-section-title">Delivery & Returns</div>
                <ul>
                  <li>60-min delivery in selected cities</li>
                  <li>Standard delivery in 2-4 business days</li>
                  <li>Free shipping on larger orders</li>
                </ul>
              </div>
              <div>
                <p className="pdp-subtitle">Returns</p>
                <ul>
                  <li>7-day easy returns</li>
                  <li>Product must be unused with original tags</li>
                  <li>Refunds processed after quality check</li>
                </ul>
              </div>
            </section>

            <section className="pdp-reviews-section">
              <div className="pdp-reviews-head">
                <div>
                  <h2>Ratings & Reviews</h2>
                </div>
                <button type="button" className="pdp-outline-button">Write a Review</button>
              </div>

              <div className="pdp-reviews-summary">
                <div className="pdp-rating-card">
                  <div className="pdp-rating-score">{averageRating}</div>
                  <div className="pdp-stars">★★★★★</div>
                  <p>{totalReviews} reviews</p>
                </div>

                <div className="pdp-rating-breakdown">
                  {ratingPercentages.map((item) => (
                    <div key={item.label} className="pdp-rating-row-bar">
                      <span>{item.label} ★</span>
                      <div className="pdp-rating-track">
                        <div style={{ width: `${item.percent}%` }} />
                      </div>
                      <span>{item.count}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pdp-review-filters">
                {["All", "5★", "4★", "3★", "2★", "1★", "With Images"].map((label) => (
                  <button key={label} type="button">{label}</button>
                ))}
              </div>

              <div className="pdp-review-grid">
                {SAMPLE_REVIEWS.map((review) => (
                  <article key={review.name} className="pdp-review-card">
                    <div className="pdp-review-head">
                      <div>
                        <strong>{review.name}</strong>
                        <span>Verified Buyer</span>
                      </div>
                      <span>{review.time}</span>
                    </div>
                    <div className="pdp-stars small">★★★★★</div>
                    <p>{review.text}</p>
                    {activeImage ? <img src={activeImage} alt={product.name} /> : null}
                  </article>
                ))}
              </div>
            </section>

            <section className="pdp-related-section">
              <div className="pdp-section-title">You May Also Like</div>
              <div className="pdp-related-grid">
                {relatedProducts.map((item) => {
                  const itemOriginal = Number(item.price || 0);
                  const itemDiscount = Number(item.discount_price || 0);
                  const itemHasDiscount = itemDiscount && itemDiscount < itemOriginal;
                  const itemDisplay = itemHasDiscount ? itemDiscount : itemOriginal;

                  return (
                    <article key={item.id} className="pdp-related-card">
                      <div className="pdp-related-image">
                        {item.image ? <img src={item.image} alt={item.name} /> : <div className="no-image">No Image</div>}
                      </div>
                      <h4>{item.name}</h4>
                      <p>{item.brand || "BlinkieFash"}</p>
                      <div className="price-section compact">
                        <span className="price-final">{formatCurrency(itemDisplay)}</span>
                        {itemHasDiscount ? <span className="price-original">{formatCurrency(itemOriginal)}</span> : null}
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="pdp-bottom-features">
            {FEATURE_POINTS.map((item) => (
              <div key={item} className="pdp-bottom-feature">{item}</div>
            ))}
          </div>

          <footer className="pdp-footer">
            <div>
              <strong>BLINKIEFASH</strong>
              <p>Your daily fashion delivered in minutes.</p>
            </div>
            <div>
              <span>Shop</span>
              <span>Women</span>
              <span>Men</span>
              <span>Beauty</span>
            </div>
            <div>
              <span>Customer Care</span>
              <span>Contact Us</span>
              <span>Returns</span>
              <span>Track Order</span>
            </div>
          </footer>
        </div>
      </div>
    </>
  );
}
