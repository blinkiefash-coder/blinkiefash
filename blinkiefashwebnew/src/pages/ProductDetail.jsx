import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  MdArrowBack,
  MdAutorenew,
  MdBolt,
  MdCheckroom,
  MdChevronLeft,
  MdChevronRight,
  MdFavoriteBorder,
  MdKeyboardArrowDown,
  MdLocalShipping,
  MdLocationOn,
  MdLock,
  MdOutlineShoppingCart,
  MdPayments,
  MdPersonOutline,
  MdSearch,
  MdShare,
  MdStar,
  MdTrackChanges,
  MdVerified,
  MdVerifiedUser,
} from 'react-icons/md';
import { FaFacebookF, FaLink, FaRegEnvelope, FaTwitter, FaWhatsapp } from 'react-icons/fa';
import Loader from '../components/Loader';
import { getAddresses, getProductById, getProducts } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { detectCurrentCity } from '../utils/location';
import './ProductDetail.css';
import './Home.css';

const RECENTLY_VIEWED_KEY = 'bfw_recently_viewed_products';

const TRUST_STRIP_ITEMS = [
  { icon: MdBolt, title: '60 MIN', subtitle: 'Express' },
  { icon: MdCheckroom, title: 'TRY & BUY', subtitle: '15 mins' },
  { icon: MdVerified, title: 'ORIGINAL', subtitle: 'Genuine' },
  { icon: MdLock, title: 'SECURE', subtitle: 'Safe pay' },
];

const UTILITY_ITEMS = [
  { icon: MdLocalShipping, label: 'Delivered in 60 Minutes' },
  { icon: MdVerifiedUser, label: '100% Authentic Products' },
  { icon: MdAutorenew, label: 'Easy Returns' },
  { icon: MdPayments, label: 'Cash on Delivery' },
  { icon: MdTrackChanges, label: 'Track Your Order' },
];

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { addToCart, count } = useCart();
  const { isWishlisted, toggleWishlist, items: wishlistItems } = useWishlist();
  const { user } = useAuth();
  const isLoggedIn = Boolean(localStorage.getItem('userUuid') || localStorage.getItem('token'));

  const [data, setData] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [visibleRelatedCount, setVisibleRelatedCount] = useState(4);
  const relatedListRef = useRef(null);
  const [recentlyViewed, setRecentlyViewed] = useState([]);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('description');
  const [city, setCity] = useState(
    () => localStorage.getItem('bfw_city') || localStorage.getItem('selectedCity') || 'Cuttack'
  );
  const [locating, setLocating] = useState(false);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [locationError, setLocationError] = useState('');
  const [shareOpen, setShareOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);

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
          const byCategory = await getProducts({ category_id: categoryId, limit: 12 });
          rows = byCategory?.products || (Array.isArray(byCategory) ? byCategory : []);
        }

        if ((!rows || rows.length === 0) && brand) {
          const byBrand = await getProducts({ search: brand, limit: 12 });
          rows = byBrand?.products || (Array.isArray(byBrand) ? byBrand : []);
        }

        if (!cancelled) {
          setRelatedProducts(
            (rows || [])
              .filter((item) => String(item.id) !== String(data.product.id))
              .slice(0, 10)
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
    const container = relatedListRef.current;
    if (!container || relatedProducts.length === 0) return;

    const MIN_ITEM_WIDTH = 140;
    const GAP = 12;

    const computeVisible = () => {
      // Below the desktop breakpoint the sidebar no longer stretches to a
      // fixed height, so there's nothing meaningful to measure — fall back
      // to a fixed count instead.
      if (!window.matchMedia('(min-width: 1181px)').matches) {
        setVisibleRelatedCount(Math.min(relatedProducts.length, 4));
        return;
      }

      const width = container.clientWidth;
      const height = container.clientHeight;
      if (!width || !height) return;

      const columns = Math.max(1, Math.floor((width + GAP) / (MIN_ITEM_WIDTH + GAP)));
      const itemWidth = (width - GAP * (columns - 1)) / columns;
      const itemHeight = itemWidth * (4 / 3) + 70; // media aspect-ratio 3/4 + title/price block
      const rows = Math.max(1, Math.floor((height + GAP) / (itemHeight + GAP)));

      const count = Math.min(relatedProducts.length, Math.max(columns, columns * rows));
      setVisibleRelatedCount(count);
    };

    computeVisible();
    const observer = new ResizeObserver(computeVisible);
    observer.observe(container);
    window.addEventListener('resize', computeVisible);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', computeVisible);
    };
  }, [relatedProducts]);

  useEffect(() => {
    const pid = data?.product?.id;
    if (!pid) return;
    try {
      const stored = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
      const list = Array.isArray(stored) ? stored : [];
      setRecentlyViewed(list.filter((v) => String(v?.id) !== String(pid)).slice(0, 6));
    } catch {
      setRecentlyViewed([]);
    }
  }, [data]);

  useEffect(() => {
    const pid = data?.product?.id;
    if (!pid) return;
    // Prefer selected variant pricing when available (variants may hold price info)
    const selPriceRaw = selectedVariant?.discount_price ?? selectedVariant?.price;
    const selBaseRaw = selectedVariant?.price ?? selectedVariant?.discount_price;
    const basePrice = Number(selBaseRaw ?? data?.product?.price ?? 0);
    const baseDiscountPrice = Number(selPriceRaw ?? data?.product?.discount_price ?? basePrice);
    const price = baseDiscountPrice > 0 ? baseDiscountPrice : basePrice;
    const mrp = basePrice > 0 ? basePrice : price;
    const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
    const imageUrl = data?.images?.[0]?.url || null;
    const snapshot = {
      id: data.product.id,
      name: data.product.name,
      brand: data.product.brand || '',
      image: imageUrl,
      // include both underscored and plain fields for compatibility
      _price: price,
      price,
      _mrp: mrp,
      mrp,
      _discount: discount,
      discount_price: price,
    };
    try {
      const current = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
      const list = Array.isArray(current) ? current : [];
      const next = [snapshot, ...list.filter((v) => String(v?.id) !== String(pid))].slice(0, 20);
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
    } catch {
      localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify([snapshot]));
    }
  }, [data, selectedVariant]);

  if (loading)
    return (
      <div className="pd-screen pd-loading">
        <Loader
          overlay
          label="Loading product..."
          subtitle="Summoning the fashion elves to get your details right."
        />
      </div>
    );
  if (error) return <div className="page"><p className="state-msg">{error}</p></div>;
  if (!data) return null;

  const { product, images, variants } = data;
  const price = Number(selectedVariant?.discount_price ?? product.price ?? 0);
  const mrp = Number(selectedVariant?.price ?? price);
  const wishlisted = isWishlisted(product.id);
  const canPurchase = !(variants?.length > 0 && !selectedVariant);
  const gallery = images?.length ? images : [{ url: null }];
  const rating = Number(product.rating || 4.8);
  const reviewCount = Number(product.review_count || 120);
  const discountPct = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
  const hasRelated = relatedProducts.length > 0;
  const hasRecentlyViewed = recentlyViewed.length > 0;

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

  const handleDetectLocation = async () => {
    setLocating(true);
    setLocationError('');
    const detected = await detectCurrentCity();
    if (detected) {
      setCity(detected);
      localStorage.setItem('bfw_city', detected);
      setLocationSheetOpen(false);
    } else {
      setLocationError('Unable to detect current location. Please pick from saved addresses.');
    }
    setLocating(false);
  };

  const openLocationSheet = async () => {
    setLocationSheetOpen(true);
    setLocationError('');
    if (!isLoggedIn || !user?.id) {
      setSavedAddresses([]);
      return;
    }
    setAddressLoading(true);
    try {
      const res = await getAddresses(user.id);
      setSavedAddresses(Array.isArray(res?.addresses) ? res.addresses : []);
    } catch {
      setLocationError('Could not load saved addresses right now.');
    } finally {
      setAddressLoading(false);
    }
  };

  const selectSavedAddress = (addr) => {
    const resolved = (addr?.city || addr?.address_line || '').toString().trim();
    if (!resolved) return;
    setCity(resolved);
    localStorage.setItem('bfw_city', resolved);
    setLocationSheetOpen(false);
  };

  const shareUrl = typeof window !== 'undefined' ? window.location.href : '';
  const shareText = `Check out ${product.name} on Blinkiefash`;

  const openSocialShare = (url) => {
    window.open(url, '_blank', 'noopener,noreferrer,width=600,height=560');
    setShareOpen(false);
  };

  const handleNativeShare = async () => {
    try {
      await navigator.share({ title: product.name, text: shareText, url: shareUrl });
    } catch {
      // user dismissed the native share sheet, nothing to do
    }
    setShareOpen(false);
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // clipboard blocked, silently ignore
    }
  };

  const SHARE_OPTIONS = [
    {
      label: 'WhatsApp',
      icon: FaWhatsapp,
      className: 'pd-share-whatsapp',
      action: () =>
        openSocialShare(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`),
    },
    {
      label: 'Facebook',
      icon: FaFacebookF,
      className: 'pd-share-facebook',
      action: () =>
        openSocialShare(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`),
    },
    {
      label: 'X (Twitter)',
      icon: FaTwitter,
      className: 'pd-share-twitter',
      action: () =>
        openSocialShare(
          `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`
        ),
    },
    {
      label: 'Email',
      icon: FaRegEnvelope,
      className: 'pd-share-email',
      action: () => {
        window.location.href = `mailto:?subject=${encodeURIComponent(shareText)}&body=${encodeURIComponent(shareUrl)}`;
        setShareOpen(false);
      },
    },
  ];

  return (
    <div className="pd-screen">
      <div className="hp-utility-bar">
        <div className="hp-utility-left">
          {UTILITY_ITEMS.map((item) => (
            <span key={item.label} className="hp-utility-item">
              <item.icon /> {item.label}
            </span>
          ))}
        </div>
      </div>

      <header className="pd-header">
        <button type="button" className="hp-brand pd-brand-logo" onClick={() => navigate('/')}>
          <img src="https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg" alt="Blinkiefash" className="hp-logo" />
          <span className="hp-brand-text">
            <span className="hp-brand-name">
              BLINKIE<span className="hp-brand-accent">FASH</span>
            </span>
            <span className="hp-tagline">DELIVERED IN 60 MINUTES</span>
          </span>
        </button>

        <form className="hp-header-search" onSubmit={handleSearchSubmit}>
          <MdSearch className="hp-search-icon" />
          <input name="q" type="text" placeholder="Search Ethnic Wear, Sneakers, Bags & more..." />
          <button type="submit" className="hp-search-btn" aria-label="Search products">
            <MdSearch />
          </button>
        </form>

        <div className="hp-header-actions">
          <button type="button" onClick={() => navigate(isLoggedIn ? '/account' : '/login')}>
            <MdPersonOutline />
            <span>{isLoggedIn ? 'My Account' : 'Login / Signup'}</span>
          </button>
          <button type="button" onClick={() => navigate('/wishlist')}>
            <MdFavoriteBorder />
            <span>Wishlist</span>
            {wishlistItems.length > 0 && <span className="hp-icon-badge">{wishlistItems.length}</span>}
          </button>
          <button type="button" onClick={() => navigate('/cart')}>
            <MdOutlineShoppingCart />
            <span>Cart</span>
            {count > 0 && <span className="hp-icon-badge">{count}</span>}
          </button>
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

        <section className="pd-page-grid">
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
            <div className="pd-info-top-row">
              <div className="pd-badges">
                <span><MdBolt /> 60 MIN DELIVERY</span>
                {product.is_try_and_buy ? <span><MdVerified /> Try &amp; Buy</span> : null}
              </div>

              <div className="pd-share-wrap">
                <button
                  type="button"
                  className="pd-share-trigger"
                  onClick={() => setShareOpen((v) => !v)}
                  aria-label="Share this product"
                  aria-expanded={shareOpen}
                >
                  <MdShare />
                </button>

                {shareOpen && (
                  <>
                    <div className="pd-share-backdrop" onClick={() => setShareOpen(false)} />
                    <div className="pd-share-menu" role="menu">
                      <p className="pd-share-menu-title">Share this product</p>

                      {typeof navigator !== 'undefined' && navigator.share && (
                        <button type="button" className="pd-share-option" onClick={handleNativeShare}>
                          <span className="pd-share-icon pd-share-device"><MdShare /></span>
                          More options
                        </button>
                      )}

                      {SHARE_OPTIONS.map((opt) => (
                        <button type="button" key={opt.label} className="pd-share-option" onClick={opt.action}>
                          <span className={`pd-share-icon ${opt.className}`}><opt.icon /></span>
                          {opt.label}
                        </button>
                      ))}

                      <button type="button" className="pd-share-option" onClick={handleCopyLink}>
                        <span className="pd-share-icon pd-share-copy"><FaLink /></span>
                        {linkCopied ? 'Link copied!' : 'Copy link'}
                      </button>
                    </div>
                  </>
                )}
              </div>
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

            <div className="pd-quick-facts">
              <p><strong>Category:</strong> {product.category_name || product.category || 'Fashion'}</p>
              <p><strong>Brand:</strong> {product.brand || 'Blinkiefash'}</p>
              <p><strong>Stock:</strong> {selectedVariant?.available_stock ?? 'Available'}</p>
            </div>

            <div className="pd-trust-strip">
              {TRUST_STRIP_ITEMS.map((item) => (
                <div className="pd-trust-item" key={item.title}>
                  <span className="pd-trust-icon-badge">
                    <item.icon className="pd-trust-icon" />
                  </span>
                  <strong>{item.title}</strong>
                  <span>{item.subtitle}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="pd-side-col">
            <aside className="pd-buybox">
              <button type="button" className="pd-deliver-row" onClick={openLocationSheet}>
                <span className="pd-deliver-text">
                  <span className="pd-deliver-label">Deliver to</span>
                  <span className="pd-deliver-city">{locating ? 'Detecting...' : city}</span>
                </span>
                <MdKeyboardArrowDown className="pd-deliver-chevron" />
              </button>
              <div className="pd-perks">
                <p><MdBolt /> 60-Minute Express Delivery</p>
                <p><MdLocalShipping /> Cash on Delivery available</p>
                <p><MdVerified /> Easy Returns</p>
              </div>
              <button
                type="button"
                className="pd-buy-btn"
                disabled={canPurchase === false}
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
                disabled={canPurchase === false}
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

            {hasRelated ? (
              <div className="pd-related-card">
                <div className="pd-related-head">
                  <h3>You May Also Like</h3>
                  <button type="button" onClick={() => navigate('/shop')}>View All</button>
                </div>
                <div className="pd-related-list" ref={relatedListRef}>
                  {relatedProducts.slice(0, visibleRelatedCount).map((item) => {
                    const itemPrice = Number(item.discount_price || item.price || 0);
                    return (
                      <article key={item.id} onClick={() => navigate(`/product/${item.id}`)}>
                        <div className="pd-related-media">
                          {item.image ? <img src={item.image} alt={item.name} /> : <div className="pd-rel-fallback" />}
                        </div>
                        <div>
                          <h4>{item.name}</h4>
                          <p>₹{itemPrice.toLocaleString('en-IN')}</p>
                        </div>
                      </article>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <div className="pd-description-card">
            <div className="pd-tabs">
              <button type="button" className={activeTab === 'description' ? 'active' : ''} onClick={() => setActiveTab('description')}>
                Product Description
              </button>
              <button type="button" className={activeTab === 'details' ? 'active' : ''} onClick={() => setActiveTab('details')}>
                Product Details
              </button>
              <button type="button" className={activeTab === 'reviews' ? 'active' : ''} onClick={() => setActiveTab('reviews')}>
                Ratings &amp; Reviews ({reviewCount})
              </button>
            </div>
            <div className="pd-tab-body">
              {activeTab === 'description' && (
                <>
                  <p>{product.description || 'No description available for this product yet.'}</p>
                  <ul>
                    <li><MdVerified /> 100% Original product</li>
                    <li><MdLocalShipping /> Easy returns within 5 days</li>
                    <li><MdLock /> Secure payment and protected checkout</li>
                  </ul>
                </>
              )}

              {activeTab === 'details' && (
                <div className="pd-details-table">
                  <div><span>Brand</span><strong>{product.brand || 'Blinkiefash'}</strong></div>
                  <div><span>Category</span><strong>{product.category_name || product.category || 'Fashion'}</strong></div>
                  {selectedVariant?.color && <div><span>Color</span><strong>{selectedVariant.color}</strong></div>}
                  {selectedVariant?.size && <div><span>Size</span><strong>{selectedVariant.size}</strong></div>}
                  <div><span>Stock</span><strong>{selectedVariant?.available_stock ?? 'Available'}</strong></div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="pd-reviews">
                  <div className="pd-reviews-summary">
                    <div className="pd-reviews-score">
                      <strong>{rating.toFixed(1)}</strong>
                      <div className="pd-stars">{Array.from({ length: 5 }).map((_, i) => <MdStar key={i} />)}</div>
                      <span>{reviewCount} ratings</span>
                    </div>
                  </div>
                  <p className="pd-reviews-empty">Detailed reviews for this product aren&apos;t available yet. Check back soon!</p>
                </div>
              )}
            </div>
          </div>
        </section>

        {hasRecentlyViewed ? (
          <section className="pd-recent-card">
            <div className="pd-related-head">
              <h3>Recently Viewed</h3>
            </div>
            <div className="pd-recent-list">
              {recentlyViewed.map((item) => (
                <article key={item.id} onClick={() => navigate(`/product/${item.id}`)}>
                  <div className="pd-related-media">
                    {item.image ? <img src={item.image} alt={item.name} /> : <div className="pd-rel-fallback" />}
                  </div>
                  <div>
                    <h4>{item.name}</h4>
                    <p>₹{Number(item._price || 0).toLocaleString('en-IN')}</p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>

      <div className="pd-mobile-actionbar">
        <div className="pd-mobile-price">
          <strong>₹{price.toLocaleString('en-IN')}</strong>
          {mrp > price ? <span>₹{mrp.toLocaleString('en-IN')}</span> : null}
        </div>
        <div className="pd-mobile-actions">
          <button type="button" className="pd-mobile-cart" disabled={canPurchase === false} onClick={handleAddToCart}>
            <MdOutlineShoppingCart />
            <span>Cart</span>
          </button>
          <button
            type="button"
            className="pd-mobile-buy"
            disabled={canPurchase === false}
            onClick={() => {
              handleAddToCart();
              navigate('/checkout');
            }}
          >
            <MdBolt />
            <span>Buy Now</span>
          </button>
        </div>
      </div>

      {locationSheetOpen && (
        <div className="hp-location-sheet-backdrop" role="presentation" onClick={() => setLocationSheetOpen(false)}>
          <section
            className="hp-location-sheet"
            role="dialog"
            aria-modal="true"
            aria-label="Select delivery location"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="hp-location-sheet-handle" aria-hidden="true" />
            <h3>Choose delivery location</h3>
            <button type="button" className="hp-location-current-btn" onClick={handleDetectLocation}>
              <MdLocationOn /> {locating ? 'Detecting your location...' : 'Use current location'}
            </button>

            {locationError && <p className="hp-location-error">{locationError}</p>}

            {isLoggedIn ? (
              <>
                <p className="hp-location-sheet-subtitle">Saved addresses</p>
                {addressLoading ? (
                  <p className="hp-location-sheet-muted">Loading addresses...</p>
                ) : savedAddresses.length > 0 ? (
                  <div className="hp-location-address-list">
                    {savedAddresses.map((addr) => (
                      <button
                        key={addr.id}
                        type="button"
                        className="hp-location-address-item"
                        onClick={() => selectSavedAddress(addr)}
                      >
                        <strong>{addr.name || 'Address'}</strong>
                        <span>
                          {addr.address_line}, {addr.city} - {addr.pincode}
                        </span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="hp-location-sheet-muted">No saved addresses found yet.</p>
                )}
              </>
            ) : (
              <p className="hp-location-sheet-muted">
                Log in to choose from saved addresses. For now, use current location.
              </p>
            )}
          </section>
        </div>
      )}
    </div>
  );
}