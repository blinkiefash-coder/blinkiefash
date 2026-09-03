import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  MdFavoriteBorder,
  MdFavorite,
  MdAddShoppingCart,
  MdCheckroom,
  MdStar,
} from "react-icons/md";
import { API_API_BASE_URL } from "../apiBase";
import { useCart } from "../context/CartContext";
import { useWishlist } from "../context/WishlistContext";
import {
  productImageUrlContain,
  productImageSrcSetContain,
} from "../utils/cloudinaryImage";
import "./ProductCard.css";

const API_BASE = API_API_BASE_URL;

const formatPrice = (value) =>
  `₹${Number(value || 0).toLocaleString("en-IN")}`;

function getAuth() {
  const userId =
    localStorage.getItem("userUuid") ||
    localStorage.getItem("userId") ||
    localStorage.getItem("uuid") ||
    "";
  const token =
    localStorage.getItem("token") ||
    localStorage.getItem("authToken") ||
    localStorage.getItem("accessToken") ||
    "";
  return { userId, token };
}

async function resolveAvailableVariantId(product) {
  if (product?.variant_id) return product.variant_id;
  if (product?.variantId) return product.variantId;
  if (product?.variants?.[0]?.id) return product.variants[0].id;
  if (product?.variants?.[0]?.variant_id) return product.variants[0].variant_id;

  try {
    const { token } = getAuth();
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    const response = await fetch(`${API_BASE}/products/${product.id}`, { headers });
    if (!response.ok) return product.id || "";

    const detail = await response.json();
    const variants = detail?.variants || detail?.product?.variants || [];
    const available =
      variants.find(
        (v) =>
          Number(v.available_stock || 0) > 0 || v.available_stock === undefined
      ) || variants[0];

    return available?.id || available?.variant_id || product.id || "";
  } catch {
    return product.id || "";
  }
}

/**
 * Single reusable product card.
 *
 * Props:
 * - product
 * - onWishlistAdded?: () => void
 * - onCartAdded?: () => void
 */
export default function ProductCard({ product, onWishlistAdded, onCartAdded }) {
  const navigate = useNavigate();
  const { addToCart, getCartQty } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();

  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const [announcement, setAnnouncement] = useState("");

  const wishlisted = isWishlisted(product.id);
  const cartQty = getCartQty(product.variant_id || product.id);

  const originalPrice = Number(product.price || product._mrp || 0);
  const salePrice =
    Number(product.discount_price ?? product._price ?? 0) > 0
      ? Number(product.discount_price ?? product._price)
      : originalPrice;
  const hasDiscount = salePrice > 0 && salePrice < originalPrice;
  const offPercent = hasDiscount
    ? Math.round(((originalPrice - salePrice) / originalPrice) * 100)
    : 0;

  const isBestseller = product.is_bestseller === true;
  const isTryAndBuy = product.is_try_and_buy === true;
  const badgeType = isBestseller
    ? "BESTSELLER"
    : isTryAndBuy
      ? "Try & Buy"
      : hasDiscount
        ? `${offPercent}% OFF`
        : "+ 60 MIN";

  const image =
    product.image || product.image_url || product.thumbnail || "";

  const rating = Number(product.rating || product.avg_rating || 0);
  const reviewCount = Number(product.review_count || product.reviews_count || 0);
  const soldCount = Number(product.sold_count || product.sales_count || 0);
  const soldLabel = soldCount > 0 ? `${soldCount.toLocaleString("en-IN")} sold` : "";
  const hasMeta = rating > 0 || Boolean(soldLabel);
  const outOfStock = product.in_stock === false || product.available === false;

  const handleAddToWishlist = async (event) => {
    event.stopPropagation();
    event.preventDefault();

    const { userId, token } = getAuth();
    if (!userId && !token) {
      alert("Please login to add items to wishlist");
      navigate("/login");
      return;
    }

    // Prefer shared context (same path as rest of the app)
    if (typeof toggleWishlist === "function") {
      try {
        await toggleWishlist({
          productId: product.id,
          name: product.name,
          image,
          price: salePrice,
          variantId: product.variant_id || product.variantId,
        });
        window.dispatchEvent(new Event("wishlist:updated"));
        if (onWishlistAdded) onWishlistAdded();
        return;
      } catch (err) {
        console.error("[ProductCard] context wishlist failed", err);
      }
    }

    // API fallback
    try {
      const variantId = await resolveAvailableVariantId(product);
      if (!variantId) {
        alert("No available variant for this product");
        return;
      }

      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/wishlist/add`, {
        method: "POST",
        headers,
        body: JSON.stringify({ userId, variantId, productId: product.id }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.message || `Wishlist failed (${response.status})`);
      }

      window.dispatchEvent(new Event("wishlist:updated"));
      if (onWishlistAdded) onWishlistAdded();
      alert("Added to wishlist");
    } catch (err) {
      console.error("[ProductCard] wishlist failed", err);
      alert(`Unable to add to wishlist: ${err.message}`);
    }
  };

  const handleAddToCart = async (event) => {
    event.stopPropagation();
    event.preventDefault();

    if (isAddingToCart || outOfStock) return;

    const { userId, token } = getAuth();
    if (!userId && !token) {
      alert("Please login to add items to cart");
      navigate("/login");
      return;
    }

    setIsAddingToCart(true);

    if (typeof addToCart === "function") {
      try {
        await addToCart({
          productId: product.id,
          variantId: product.variant_id || product.variantId || product.id,
          name: product.name,
          image,
          price: salePrice,
        });
        window.dispatchEvent(new Event("cart:updated"));
        setAnnouncement(`${product.name} added to cart`);
        if (onCartAdded) onCartAdded();
        setIsAddingToCart(false);
        return;
      } catch (err) {
        console.error("[ProductCard] context cart failed", err);
      }
    }

    try {
      const variantId = await resolveAvailableVariantId(product);
      if (!variantId) {
        alert("No available variant for this product");
        setIsAddingToCart(false);
        return;
      }

      const headers = { "Content-Type": "application/json" };
      if (token) headers.Authorization = `Bearer ${token}`;

      const response = await fetch(`${API_BASE}/cart/add`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          userId,
          variantId,
          productId: product.id,
          quantity: 1,
        }),
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok || data.success === false) {
        throw new Error(data.message || `Cart failed (${response.status})`);
      }

      window.dispatchEvent(new Event("cart:updated"));
      setAnnouncement(`${product.name} added to cart`);
      if (onCartAdded) onCartAdded();
    } catch (err) {
      console.error("[ProductCard] cart failed", err);
      alert(`Unable to add to cart: ${err.message}`);
    } finally {
      setIsAddingToCart(false);
    }
  };

  return (
    <article
      className="pc-card"
      onClick={() => navigate(`/product/${product.id}`)}
    >
      {/* Visually hidden live region so screen reader users hear
          confirmation without relying on the icon-only button. */}
      <span className="pc-sr-only" aria-live="polite">
        {announcement}
      </span>

      <div className="pc-top">
        <span
          className={`pc-badge ${
            isBestseller
              ? "bestseller"
              : isTryAndBuy
                ? "try-buy"
                : hasDiscount
                  ? "discount"
                  : "fresh"
          }`}
        >
          {badgeType}
        </span>
        <button
          type="button"
          className={`pc-wishlist${wishlisted ? " active" : ""}`}
          onClick={handleAddToWishlist}
          aria-label={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          aria-pressed={wishlisted}
        >
          {wishlisted ? <MdFavorite /> : <MdFavoriteBorder />}
        </button>
      </div>

      <div className="pc-image-wrap">
        {image ? (
          <img
            src={productImageUrlContain(image, 400, 533)}
            srcSet={productImageSrcSetContain(image)}
            sizes="(max-width: 420px) 45vw, (max-width: 760px) 46vw, (max-width: 900px) 31vw, (max-width: 1200px) 23vw, (max-width: 1400px) 18vw, 15vw"
            alt={product.name}
            loading="lazy"
            width="400"
            height="533"
          />
        ) : (
          <div className="pc-no-image">
            <MdCheckroom />
          </div>
        )}

        {/* Cart action lives on the image, so its position never
            depends on whether rating/sold metadata exists below. */}
        <button
          type="button"
          className={`pc-cart-fab${cartQty > 0 ? " in-cart" : ""}${
            isAddingToCart ? " is-loading" : ""
          }`}
          onClick={handleAddToCart}
          disabled={isAddingToCart || outOfStock}
          aria-disabled={isAddingToCart || outOfStock}
          aria-busy={isAddingToCart}
          aria-label={
            outOfStock
              ? "Out of stock"
              : cartQty > 0
                ? `In cart, quantity ${cartQty}`
                : "Add to cart"
          }
        >
          {!isAddingToCart &&
            (cartQty > 0 ? (
              <span className="pc-cart-qty">{cartQty}</span>
            ) : (
              <MdAddShoppingCart />
            ))}
        </button>
      </div>

      <div className="pc-body">
        <small>{product.brand || "Brand"}</small>
        <h3>{product.name}</h3>
        {/* Electronics/Footwear rows have no `color` most of the time —
            fall back to the category/spec text instead of a misleading
            "Multi color" label on, say, a pair of headphones. */}
        <p className="pc-sub">
          {product.color || product.category_name || product.category || "Multi color"}
        </p>

        <div className="pc-price-row">
          <strong>{formatPrice(salePrice)}</strong>
          {hasDiscount ? <span>{formatPrice(originalPrice)}</span> : null}
          {hasDiscount ? <em className="pc-off-inline">{offPercent}% OFF</em> : null}
        </div>

        {hasMeta && (
          <div className="pc-meta-row">
            {rating > 0 && (
              <span className="pc-rating">
                <MdStar aria-hidden="true" /> {rating.toFixed(1)}
                {reviewCount > 0 && <span className="pc-review-count"> ({reviewCount})</span>}
              </span>
            )}
            {rating > 0 && soldLabel && <span className="pc-meta-sep">|</span>}
            {soldLabel && <span className="pc-sold">{soldLabel}</span>}
          </div>
        )}
      </div>
    </article>
  );
}

export function ProductCardSkeleton() {
  return <div className="pc-skeleton" />;
}