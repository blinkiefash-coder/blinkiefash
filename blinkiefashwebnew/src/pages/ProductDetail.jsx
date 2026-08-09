import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MdArrowBack,
  MdBolt,
  MdChevronLeft,
  MdChevronRight,
  MdFavoriteBorder,
  MdLocalShipping,
  MdLock,
  MdOutlineShoppingCart,
  MdSearch,
  MdStar,
  MdVerified,
} from 'react-icons/md';
import Loader from '../components/Loader';
import { getProductById, getProducts } from '../api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import './ProductDetail.css';
import './Home.css';

const RECENTLY_VIEWED_KEY = 'bfw_recently_viewed_products';

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, count } = useCart();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const city =
    localStorage.getItem('bfw_city') ||
    localStorage.getItem('selectedCity') ||
    'Cuttack';
  const isLoggedIn = Boolean(localStorage.getItem('userUuid') || localStorage.getItem('token'));

  const [data, setData] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    getProductById(id)
      .then((res) => {
        if (cancelled) return;
        setData(res);
        const firstAvailable =
          (res.variants || []).find((v) => Number(v.available_stock || 0) > 0) ||
          res.variants?.[0] ||
          null;
        setSelectedVariant(firstAvailable);
        setSelectedColor(firstAvailable?.color || '');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message || 'Could not load this product');
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
      if (!data?.product) return;
      const categoryId = data.product.category_id;
      const brand = data.product.brand;

      try {
        let rows = [];
        if (categoryId) {
          const byCategory = await getProducts({ category_id: categoryId, limit: 8 });
          rows = byCategory?.products || (Array.isArray(byCategory) ? byCategory : []);
        }

        if ((!rows || rows.length === 0) && brand) {
          const byBrand = await getProducts({ search: brand, limit: 8 });
          rows = byBrand?.products || (Array.isArray(byBrand) ? byBrand : []);
        }

        if (!cancelled) {
          setRelatedProducts(
            (rows || [])
              .filter((item) => String(item.id) !== String(data.product.id))
              .slice(0, 4)
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
  }, [data]);

  useEffect(() => {
    const pid = data?.product?.id;
    if (!pid) return;
    const basePrice = Number(data?.product?.price ?? 0);
    const baseDiscountPrice = Number(data?.product?.discount_price ?? basePrice);
    const price = baseDiscountPrice > 0 ? baseDiscountPrice : basePrice;
    const mrp = basePrice > 0 ? basePrice : price;
    const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const imageUrl = data?.images?.[0]?.url || null;
    const snapshot = {
      id: data.product.id,
      name: data.product.name,
      brand: data.product.brand || '',
      image: imageUrl,
      _price: price,
      _mrp: mrp,
      _discount: discount,
    };
    try {
      const current = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
      const list = Array.isArray(current) ? current : [];
      const next = [snapshot, ...list.filter((v) => String(v?.id) !== String(pid))].slice(0, 20);
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
    } catch {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify([snapshot]));
    }
  }, [data]);

  if (loading) return <div className="page"><Loader label="Loading product..." /></div>;
  if (error) return <div className="page"><p className="state-msg">{error}</p></div>;
  if (!data) return null;

  const { product, images, variants } = data;
  const price = Number(selectedVariant?.discount_price ?? product.price ?? 0);
  const mrp = Number(selectedVariant?.price ?? price);
  const wishlisted = isWishlisted(product.id);
  const gallery = images?.length ? images : [{ url: null }];
  const rating = Number(product.rating || 4.8);
  const reviewCount = Number(product.review_count || 120);
  const discountPct = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

  const seenColors = new Set();
  const colorOptions = (variants || [])
    .map((v) => (v.color || '').trim())
    .filter((color) => {
      const key = color.toLowerCase();
      if (!key || seenColors.has(key)) return false;
      seenColors.add(key);
      return true;
    });

  const sizeOptions = selectedColor
    ? (variants || []).filter((v) => (v.color || '').toLowerCase() === selectedColor.toLowerCase())
    : variants || [];

  const breadcrumb = [
    'Home',
    product.category_name || product.category || 'Category',
    product.brand || 'Brand',
    product.name,
  ];

  const handleAddToCart = () => {
    addToCart({
      productId: product.id,
      variantId: selectedVariant?.id || null,
      name: product.name,
      image: gallery[0]?.url,
      price,
      size: selectedVariant?.size,
      color: selectedVariant?.color,
    });
  };

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const q = event.currentTarget.elements.q.value.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
  };

  const handlePrevImage = () => {
    setActiveImage((prev) => (prev === 0 ? gallery.length - 1 : prev - 1));
  };

  const handleNextImage = () => {
    setActiveImage((prev) => (prev === gallery.length - 1 ? 0 : prev + 1));
  };

  const pickVariant = (variant) => {
    setSelectedVariant(variant);
    if (variant?.color) setSelectedColor(variant.color);
  };

  const pickSize = (size) => {
    const target = sizeOptions.find((v) => (v.size || 'Default') === size);
    if (target) pickVariant(target);
  };

  return (
    <div className="pd-screen">
      <div className="hp-utility-bar">
        <div className="hp-utility-left">
          <span className="hp-utility-item"><MdBolt /> 60-Minute Delivery</span>
          <span className="hp-utility-item"><MdVerified /> Try &amp; Buy (15 mins)</span>
          <span className="hp-utility-item"><MdLocalShipping /> Free Delivery above ₹1,499</span>
        </div>
      </div>

      <header className="pd-header">
        <button type="button" className="pd-logo" onClick={() => navigate('/')}>
          BLINKIE<span>FASH</span>
        </button>
        <form className="pd-search" onSubmit={handleSearchSubmit}>
          <select defaultValue="all" aria-label="Category selector">
            <option value="all">All Categories</option>
          </select>
          <input name="q" type="text" placeholder="Search ethnic wear, shoes, bags, accessories..." />
          <button type="submit" aria-label="Search products"><MdSearch /></button>
        </form>
        <div className="pd-header-actions">
          <button type="button" onClick={() => navigate('/wishlist')}><MdFavoriteBorder /> Wishlist</button>
          <button type="button" onClick={() => navigate('/cart')}>
            <MdOutlineShoppingCart /> Cart {count > 0 ? <span>{count}</span> : null}
          </button>
          <button type="button" onClick={() => navigate(isLoggedIn ? '/account' : '/login')}>Account</button>
        </div>
      </header>

      <div className="pd-content">
        <div className="pd-breadcrumbs">
          <button type="button" className="pd-back" onClick={() => navigate(-1)}><MdArrowBack /> Back</button>
          {breadcrumb.map((item, idx) => (
            <span key={`${item}-${idx}`}>
              {idx > 0 ? <span className="pd-sep">&gt;</span> : null}
              {item}
            </span>
          ))}
        </div>

        <section className="pd-main-grid">
          <div className="pd-gallery-panel">
            <div className="pd-thumbs-col">
              {gallery.map((img, idx) => (
                <button
                  key={img.url || idx}
                  type="button"
                  className={`pd-thumb${idx === activeImage ? ' active' : ''}`}
                  onClick={() => setActiveImage(idx)}
                >
                  {img.url ? <img src={img.url} alt="" /> : <div className="pd-thumb-fallback" />}
                </button>
              ))}
            </div>
            <div className="pd-gallery">
              {gallery[activeImage]?.url ? (
                <img src={gallery[activeImage].url} alt={product.name} />
              ) : (
                <div className="pd-placeholder">No image available</div>
              )}
              {gallery.length > 1 && (
                <>
                  <button type="button" className="pd-arrow left" onClick={handlePrevImage} aria-label="Previous image"><MdChevronLeft /></button>
                  <button type="button" className="pd-arrow right" onClick={handleNextImage} aria-label="Next image"><MdChevronRight /></button>
                </>
              )}
            </div>
          </div>

          <div className="pd-info-panel">
            <div className="pd-badges">
              <span><MdBolt /> 60 MIN DELIVERY</span>
              {product.is_try_and_buy ? <span><MdVerified /> Try &amp; Buy</span> : null}
            </div>
            {product.brand && <p className="pd-brand">{product.brand}</p>}
            <h1>{product.name}</h1>
            <div className="pd-rating-row">
              <div className="pd-stars">{Array.from({ length: 5 }).map((_, i) => <MdStar key={i} />)}</div>
              <span>{rating.toFixed(1)} ({reviewCount} Reviews)</span>
            </div>

            <div className="pd-price-row">
              <span className="pd-price">₹{price.toLocaleString('en-IN')}</span>
              {mrp > price ? <span className="pd-mrp">₹{mrp.toLocaleString('en-IN')}</span> : null}
              {discountPct > 0 ? <span className="pd-off">{discountPct}% OFF</span> : null}
            </div>
            <p className="pd-tax-note">Inclusive of all taxes</p>

            {colorOptions.length > 0 && (
              <div className="pd-colors">
                <p className="pd-label">Color: {selectedColor || colorOptions[0]}</p>
                <div className="pd-color-row">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      type="button"
                      className={`pd-color-chip${selectedColor.toLowerCase() === color.toLowerCase() ? ' active' : ''}`}
                      onClick={() => {
                        setSelectedColor(color);
                        const target = (variants || []).find((v) => (v.color || '').toLowerCase() === color.toLowerCase());
                        if (target) setSelectedVariant(target);
                      }}
                    >
                      {color}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {variants?.length > 0 && (
              <div className="pd-variants">
                <p className="pd-label">Select size</p>
                <div className="pd-variant-list">
                  {[...new Set(sizeOptions.map((v) => v.size || 'Default'))].map((size) => {
                    const scoped = sizeOptions.find((v) => (v.size || 'Default') === size);
                    const disabled = Number(scoped?.available_stock || 0) <= 0;
                    const active = (selectedVariant?.size || 'Default') === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`pd-variant-chip${active ? ' active' : ''}${disabled ? ' disabled' : ''}`}
                        disabled={disabled}
                        onClick={() => pickSize(size)}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {product.description && <p className="pd-description">{product.description}</p>}
          </div>

          <aside className="pd-buybox">
            <h3>Deliver to</h3>
            <p className="pd-deliver-city">{city}</p>
            <div className="pd-perks">
              <p><MdBolt /> 60-Minute Express Delivery</p>
              <p><MdLocalShipping /> Cash on Delivery available</p>
              <p><MdVerified /> Easy Returns</p>
            </div>
            <button
              type="button"
              className="pd-buy-btn"
              disabled={variants?.length > 0 && !selectedVariant}
              onClick={() => {
                handleAddToCart();
                navigate('/checkout');
              }}
            >
              <MdBolt /> Buy Now
            </button>
            <button
              type="button"
              className="pd-cart-btn"
              disabled={variants?.length > 0 && !selectedVariant}
              onClick={handleAddToCart}
            >
              <MdOutlineShoppingCart /> Add to Cart
            </button>
            <button
              type="button"
              className="pd-wish-btn"
              onClick={() =>
                toggleWishlist({
                  productId: product.id,
                  name: product.name,
                  image: gallery[0]?.url,
                  price,
                })
              }
            >
              <MdFavoriteBorder /> {wishlisted ? 'Wishlisted' : 'Add to Wishlist'}
            </button>
            <p className="pd-secure"><MdLock /> Secure Payment</p>
          </aside>
        </section>

        <section className="pd-bottom-grid">
          <div className="pd-description-card">
            <div className="pd-tabs">
              <button type="button" className="active">Product Description</button>
              <button type="button">Product Details</button>
              <button type="button">Ratings &amp; Reviews ({reviewCount})</button>
            </div>
            <div className="pd-tab-body">
              <p>{product.description || 'No description available for this product yet.'}</p>
              <ul>
                <li><MdVerified /> 100% Original product</li>
                <li><MdLocalShipping /> Easy returns within 5 days</li>
                <li><MdLock /> Secure payment and protected checkout</li>
              </ul>
            </div>
          </div>

          <aside className="pd-related-card">
            <div className="pd-related-head">
              <h3>You May Also Like</h3>
              <button type="button" onClick={() => navigate('/shop')}>View All</button>
            </div>
            <div className="pd-related-list">
              {relatedProducts.length > 0 ? (
                relatedProducts.map((item) => {
                  const itemPrice = Number(item.discount_price || item.price || 0);
                  return (
                    <article key={item.id} onClick={() => navigate(`/product/${item.id}`)}>
                      <div className="pd-related-media">
                        {item.image ? <img src={item.image} alt={item.name} /> : <div className="pd-rel-fallback" />}
                      </div>
                      <h4>{item.name}</h4>
                      <p>₹{itemPrice.toLocaleString('en-IN')}</p>
                    </article>
                  );
                })
              ) : (
                <p className="pd-related-empty">No related products available.</p>
              )}
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
