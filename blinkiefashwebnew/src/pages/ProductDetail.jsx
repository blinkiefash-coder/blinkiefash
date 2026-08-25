import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useSmartBack } from '../utils/navigation';
import {
  MdArrowBack,
  MdAutorenew,
  MdBolt,
  MdCheck,
  MdCheckroom,
  MdChevronLeft,
  MdChevronRight,
  MdEdit,
  MdFavorite,
  MdFavoriteBorder,
  MdHeadsetMic,
  MdKeyboardArrowDown,
  MdLocalShipping,
  MdLocationOn,
  MdLock,
  MdOutlineShoppingCart,
  MdPayments,
  MdPersonOutline,
  MdSchedule,
  MdSearch,
  MdShare,
  MdVerified,
  MdVerifiedUser,
  MdZoomIn,
} from 'react-icons/md';
import { FaFacebookF, FaLink, FaRegEnvelope, FaTwitter, FaWhatsapp } from 'react-icons/fa';
import Loader from '../components/Loader';
import PageSEO from '../components/PageSEO';
import { getAddresses, getProductById, getProducts } from '../api';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { detectCurrentCity } from '../utils/location';
import { hasVendorPasswordAuth } from '../utils/vendorSession';
import './ProductDetail.css';
import './Home.css';

const RECENTLY_VIEWED_KEY = 'bfw_recently_viewed_products';
const DESC_COLLAPSED_H = 132;

const UTILITY_ITEMS = [
  { icon: MdLocalShipping, label: 'Delivery promise by distance' },
  { icon: MdVerifiedUser, label: '100% Authentic Products' },
  { icon: MdAutorenew, label: 'Easy Returns' },
  { icon: MdPayments, label: 'Cash on Delivery' },
];

const FEATURES = [
  { icon: MdBolt, title: '60 MIN', sub: 'Express Delivery' },
  { icon: MdCheckroom, title: 'TRY & BUY', sub: '15 mins' },
  { icon: MdVerified, title: 'ORIGINAL', sub: 'Genuine Products' },
  { icon: MdLock, title: 'SECURE', sub: 'Safe Payment' },
];

const TABS = [
  { key: 'description', label: 'Product Description' },
  { key: 'details', label: 'Product Details' },
  { key: 'reviews', label: 'Ratings & Reviews' },
];

function toCurrency(value) {
  const num = Number(value || 0);
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(Math.max(num, 0));
}

// Picks the first genuinely positive price across variant/product fields,
// instead of trusting whichever field happens to be non-null/undefined.
function pickPrice(...candidates) {
  for (const c of candidates) {
    const n = Number(c);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 0;
}

export default function ProductDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const fromPath = location.state?.fromPath || '/shop';
  const fromLabel = location.state?.fromLabel || null;
  const goBack = useSmartBack(fromPath);
  const { addToCart, count } = useCart();
  const { isWishlisted, toggleWishlist, items: wishlistItems } = useWishlist();
  const { user, isLoggedIn } = useAuth();
  const canSwitchToVendor = user?.role === 'vendor' && hasVendorPasswordAuth();
  const headerUserName = String(user?.name || localStorage.getItem('userName') || '').trim();
  const headerFirstName = headerUserName ? headerUserName.split(/\s+/)[0] : '';
  const accountLabel = isLoggedIn ? (headerFirstName ? `Hi, ${headerFirstName}` : 'My Account') : 'Login / Signup';

  const [data, setData] = useState(null);
  const [relatedProducts, setRelatedProducts] = useState([]);
  const [visibleRelatedCount, setVisibleRelatedCount] = useState(4);
  const relatedListRef = useRef(null);
  const [selectedVariant, setSelectedVariant] = useState(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [activeImage, setActiveImage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('description');
  const [descExpanded, setDescExpanded] = useState(false);
  const [descClipped, setDescClipped] = useState(false);
  const [cartAdded, setCartAdded] = useState(false);
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

  const thumbStripRef = useRef(null);
  const reviewsRef = useRef(null);
  const descClipRef = useRef(null);

  /* Reset image index whenever the selected color changes (render-time
     adjustment, not an effect, per https://react.dev/learn/you-might-not-need-an-effect) */
  const [prevSelectedColor, setPrevSelectedColor] = useState(selectedColor);
  if (selectedColor !== prevSelectedColor) {
    setPrevSelectedColor(selectedColor);
    setActiveImage(0);
  }

  /* Reset all transient/product-scoped UI state whenever the product id
     changes. This replaces the old "setLoading(true) in the fetch effect"
     and the separate "reset transient UI state" effect — both were calling
     setState synchronously in an effect body. */
  const [prevId, setPrevId] = useState(id);
  if (id !== prevId) {
    setPrevId(id);
    setLoading(true);
    setError('');
    setDescExpanded(false);
    setActiveTab('description');
    setCartAdded(false);
    setActiveImage(0);
  }

  useEffect(() => {
    let cancelled = false;
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
          const seen = new Set();
          const unique = [];
          for (const item of rows || []) {
            const pid = String(item.id ?? '');
            if (!pid || pid === String(data.product.id) || seen.has(pid)) continue;
            seen.add(pid);
            unique.push(item);
            if (unique.length >= 10) break;
          }
          setRelatedProducts(unique);
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
    const GAP = 16;

    const computeVisible = () => {
      const width = container.clientWidth;
      if (!width) return;
      const columns = Math.max(1, Math.floor((width + GAP) / (MIN_ITEM_WIDTH + GAP)));
      setVisibleRelatedCount(Math.min(relatedProducts.length, Math.max(columns * 2, 4)));
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

  /* Save this product to the recently-viewed list in localStorage.
     This only writes to an external system (no setState here), so it's
     not subject to the set-state-in-effect rule. The list itself is read
     fresh from localStorage during render below, once `product` is known. */
  useEffect(() => {
    const pid = data?.product?.id;
    if (!pid) return;
    const price = pickPrice(
      selectedVariant?.discount_price,
      selectedVariant?.price,
      data?.product?.discount_price,
      data?.product?.price
    );
    const mrp = pickPrice(selectedVariant?.price, data?.product?.price) || price;
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

  /* Description "read more" clipping, ported from the old page */
  useEffect(() => {
    const measure = () => {
      const el = descClipRef.current;
      if (!el) return;
      setDescClipped(el.scrollHeight > DESC_COLLAPSED_H + 4);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [data?.product?.description, activeTab, loading]);

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
  const price = pickPrice(
    selectedVariant?.discount_price,
    selectedVariant?.price,
    product.discount_price,
    product.price
  );
  const mrp = pickPrice(selectedVariant?.price, product.price) || price;
  const wishlisted = isWishlisted(product.id);
  const hasVariants = Array.isArray(variants) && variants.length > 0;
  const stockLeft = Number(selectedVariant?.available_stock ?? 1);
  const outOfStock = hasVariants && Boolean(selectedVariant) && stockLeft <= 0;
  const canPurchase = hasVariants ? Boolean(selectedVariant) && !outOfStock : true;

  const rating = Number(product.rating || 4.8);
  const roundedAvg = Math.min(Math.max(Math.round(rating), 0), 5);
  const reviewCount = Number(product.review_count || 0);
  const discountPct = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;

  /* Recently viewed list, derived fresh from localStorage on each render
     rather than mirrored into React state via an effect. This is a pure
     read of an external, synchronous store (localStorage) scoped to the
     current product, so it doesn't need its own state or effect. */
  let recentlyViewed;
  try {
    const stored = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
    const list = Array.isArray(stored) ? stored : [];
    recentlyViewed = list
      .filter((v) => String(v?.id) !== String(product.id))
      .filter((v) => Number(v?._price || v?.price) > 0)
      .slice(0, 6);
  } catch {
    recentlyViewed = [];
  }

  const hasRelated = relatedProducts.length > 0;
  const hasRecentlyViewed = recentlyViewed.length > 0;
  const availableStock = Number(selectedVariant?.available_stock || 0);

  const seenColors = new Set();
  const colorOptions = (variants || [])
    .map((v) => (v.color || '').trim())
    .filter((color) => {
      const key = color.toLowerCase();
      if (!key || seenColors.has(key)) return false;
      seenColors.add(key);
      return true;
    });

  const variantIdsForColor = selectedColor
    ? new Set(
        (variants || [])
          .filter((v) => (v.color || '').toLowerCase() === selectedColor.toLowerCase())
          .map((v) => v.id)
      )
    : null;

  const colorFilteredImages =
    variantIdsForColor && variantIdsForColor.size > 0
      ? (images || []).filter((img) => variantIdsForColor.has(img.variant_id))
      : [];

  const gallery = colorFilteredImages.length > 0
    ? colorFilteredImages
    : images?.length
      ? images
      : [{ url: null }];

  const colorThumbnails = {};
  colorOptions.forEach((color) => {
    // Get ALL variant ids for this color (not just the first size found)
    const idsForColor = new Set(
      (variants || [])
        .filter((v) => (v.color || '').toLowerCase() === color.toLowerCase())
        .map((v) => v.id)
    );

    // Find any image tagged to ANY of this color's variant ids
    const img = (images || []).find((i) => idsForColor.has(i.variant_id));

    colorThumbnails[color] = img?.url || null;
  });
  const sizeOptions = selectedColor
    ? (variants || []).filter((v) => (v.color || '').toLowerCase() === selectedColor.toLowerCase())
    : variants || [];

  const breadcrumb = fromLabel
    ? ['Home', fromLabel, product.name]
    : [
        'Home',
        product.category_name || product.category || 'Category',
        product.brand || 'Brand',
        product.name,
      ];

  const hasDetails =
    product.brand || product.category_name || product.category ||
    selectedVariant?.color || selectedVariant?.size || selectedVariant?.sku;

  const handleAddToCart = (fulfillment = 'standard') => {
    if (hasVariants && !selectedVariant) {
      window.alert('Please select a size/color before adding to cart.');
      return false;
    }

    // Prefer variant price; fall back to product-level prices
    const unitPrice = Number(
      pickPrice(
        selectedVariant?.discount_price,
        selectedVariant?.price,
        product.discount_price,
        product.price,
        price
      )
    );
    if (!Number.isFinite(unitPrice) || unitPrice <= 0) {
      window.alert('Price is unavailable for this item. Please try another variant.');
      return false;
    }

    try {
      addToCart({
        productId: product.id,
        variantId: selectedVariant?.id || null,
        name: product.name,
        image: gallery[0]?.url || gallery[activeImage]?.url || null,
        price: unitPrice,
        size: selectedVariant?.size,
        color: selectedVariant?.color,
        qty: 1,
        fulfillment,
      });
      setCartAdded(true);
      window.setTimeout(() => setCartAdded(false), 2000);
      return true;
    } catch (err) {
      console.error('Add to cart failed:', err);
      window.alert('Could not add to cart. Please try again.');
      return false;
    }
  };

  const logEvent = (name, params = {}) => {
    if (typeof window !== 'undefined' && typeof window.gtag === 'function') {
      window.gtag('event', name, params);
    }
  };

  const handleBuyNowClick = () => {
    logEvent('buy_now_clicked', { product_id: product.id });
    if (handleAddToCart()) navigate('/checkout');
  };

  const handleTryAndBuyClick = () => {
    logEvent('try_and_buy_clicked', { product_id: product.id });
    if (handleAddToCart('try_and_buy')) navigate('/checkout');
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

  const scrollThumbs = () => thumbStripRef.current?.scrollBy({ top: 190, behavior: 'smooth' });

  const openReviews = () => {
    setActiveTab('reviews');
    requestAnimationFrame(() =>
      reviewsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    );
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
      <PageSEO
        title={`${product.name}${product.brand ? ` by ${product.brand}` : ''}`}
        description={`Buy ${product.name}${product.brand ? ` by ${product.brand}` : ''} online. ${product.description ? product.description.slice(0, 120) : 'Fast 60-minute delivery in Odisha. 100% authentic products.'}`}
        path={`/product/${product.id}`}
        image={gallery[0]?.url || undefined}
        type="product"
      />
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
          <img
            src="https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg"
            alt="Blinkiefash"
            className="hp-logo"
          />
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
          {canSwitchToVendor ? (
            <button type="button" onClick={() => navigate('/vendor/orders')}>
              <MdCheckroom />
              <span>Switch to Vendor</span>
            </button>
          ) : null}
          <button type="button" onClick={() => navigate(isLoggedIn ? '/account' : '/login')}>
            <MdPersonOutline />
            <span>{accountLabel}</span>
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

      <div className="pp-page">
        {/* Breadcrumb */}
        <nav className="pp-breadcrumb" aria-label="Breadcrumb">
          <button type="button" className="pd-back" onClick={goBack}>
            <MdArrowBack size={13} /> Back
          </button>
          {breadcrumb.map((crumb, i) => {
            const isLast = i === breadcrumb.length - 1;
            const onCrumbClick = () => {
              if (isLast) return;
              if (crumb === 'Home') navigate('/');
              else if (fromPath && crumb === fromLabel) navigate(fromPath);
            };
            return (
              <span key={`${crumb}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <MdChevronRight size={13} />
                {isLast ? (
                  <strong>{crumb}</strong>
                ) : (
                  <button
                    type="button"
                    onClick={onCrumbClick}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'inherit', font: 'inherit' }}
                  >
                    {crumb}
                  </button>
                )}
              </span>
            );
          })}
        </nav>

        <div className="pp-main-grid">

          {/* Gallery */}
          <div className="pp-gallery-col">
            <div className="pp-thumb-col">
              <div className="pp-thumb-strip" ref={thumbStripRef}>
                {gallery.map((img, i) => (
                  <button
                    key={img.url || i}
                    className={`pp-thumb ${activeImage === i ? 'active' : ''}`}
                    onClick={() => setActiveImage(i)}
                    aria-label={`View image ${i + 1}`}
                    aria-current={activeImage === i}
                  >
                    {img.url
                      ? <img src={img.url} alt={`${product.name} view ${i + 1}`} loading="lazy" />
                      : <div className="pd-thumb-fallback" />}
                  </button>
                ))}
              </div>
              {gallery.length > 5 && (
                <button className="pp-thumb-more" onClick={scrollThumbs} aria-label="More images">
                  <MdKeyboardArrowDown size={16} />
                </button>
              )}
            </div>

            <div className="pp-main-image-wrap">
              {gallery.length > 1 && (
                <button className="pp-arrow left" onClick={handlePrevImage} aria-label="Previous image">
                  <MdChevronLeft size={20} />
                </button>
              )}
              {gallery[activeImage]?.url ? (
                <img src={gallery[activeImage].url} alt={product.name} className="pp-main-image" />
              ) : (
                <div className="pd-placeholder">No image available</div>
              )}
              {gallery.length > 1 && (
                <button className="pp-arrow right" onClick={handleNextImage} aria-label="Next image">
                  <MdChevronRight size={20} />
                </button>
              )}
              <span className="pp-zoom-tag"><MdZoomIn size={14} /> Zoom</span>
              {gallery.length > 1 && (
                <span className="pp-image-counter">{activeImage + 1} / {gallery.length}</span>
              )}
            </div>
          </div>

          {/* Info */}
          <div className="pp-info-col">
            <div className="pp-badge-row" style={{ alignItems: 'center' }}>
              <span className="pp-chip"><MdBolt size={13} /> 60 MIN DELIVERY</span>
              {product.is_try_and_buy && (
                <span className="pp-chip pp-chip-outline"><MdVerified size={13} /> Try &amp; Buy</span>
              )}
              <div className="pd-share-wrap" style={{ flex: 'none', marginLeft: 'auto' }}>
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

            <p className="pp-brand">{product.brand || 'BLINKIEFASH'}</p>
            <h1 className="pp-title">{product.name}</h1>

            <div className="pp-rating-line">
              <span className="pp-stars" aria-hidden="true">
                {'★'.repeat(roundedAvg)}{'☆'.repeat(5 - roundedAvg)}
              </span>
              <strong>{rating.toFixed(1)}</strong>
              <span className="pp-muted">({reviewCount} Reviews)</span>
              <button className="pp-write-link" onClick={openReviews}>
                <MdEdit size={13} /> See reviews
              </button>
            </div>

            <div className="pp-price-line">
              <span className="pp-price">₹{toCurrency(price)}</span>
              {mrp > price && <span className="pp-price-old">₹{toCurrency(mrp)}</span>}
              {discountPct > 0 && <span className="pd-off">{discountPct}% OFF</span>}
            </div>
            <p className="pp-tax-note">Inclusive of all taxes</p>

            {colorOptions.length > 0 && (
              <div className="pp-block">
                <p className="pp-label">Color: {selectedColor || colorOptions[0]}</p>
                <div className="pp-swatch-row">
                  {colorOptions.map((color) => (
                    <button
                      key={color}
                      className={`pp-swatch ${selectedColor.toLowerCase() === color.toLowerCase() ? 'active' : ''}`}
                      onClick={() => {
                        setSelectedColor(color);
                        const target = (variants || []).find(
                          (v) => (v.color || '').toLowerCase() === color.toLowerCase()
                        );
                        if (target) setSelectedVariant(target);
                      }}
                      aria-label={`Select color ${color}`}
                      aria-pressed={selectedColor.toLowerCase() === color.toLowerCase()}
                    >
                     {colorThumbnails[color] ? (
                       <img src={colorThumbnails[color]} alt={color} />
                             ) : (
                               <div className="pd-thumb-fallback" />
)}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {variants?.length > 0 && (
              <div className="pp-block">
                <div className="pp-size-header">
                  <p className="pp-label">Select Size</p>
                </div>
                <div className="pp-size-row">
                  {[...new Set(sizeOptions.map((v) => v.size || 'Default'))].map((size) => {
                    const scoped = sizeOptions.find((v) => (v.size || 'Default') === size);
                    // Visual hint only — still allow selection (inventory rows are often missing)
                    const lowStock = Number(scoped?.available_stock || 0) <= 0;
                    const active = (selectedVariant?.size || 'Default') === size;
                    return (
                      <button
                        key={size}
                        type="button"
                        className={`pp-size-btn ${active ? 'active' : ''} ${lowStock ? 'disabled' : ''}`}
                        onClick={() => pickSize(size)}
                        aria-pressed={active}
                      >
                        {size}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {availableStock > 0 && availableStock <= 5 && (
              <p className="pp-stock-warning">
                <MdSchedule size={15} /> Hurry! Only <strong>{availableStock}</strong> left in stock
              </p>
            )}

            <div className="pp-quick-facts">
              <p><strong>Category:</strong> {product.category_name || product.category || 'Fashion'}</p>
              <p><strong>Brand:</strong> {product.brand || 'Blinkiefash'}</p>
              <p><strong>Stock:</strong> {selectedVariant?.available_stock ?? 'Available'}</p>
            </div>
          </div>

          {/* Sidebar */}
          <aside className="pp-sidebar">
            <div className="pp-buy-card">
              <button type="button" className="pp-deliver-row" onClick={openLocationSheet}>
                <span>Deliver to</span>
                <span className="pp-deliver-loc">
                  {locating ? 'Detecting...' : city} <MdKeyboardArrowDown size={14} />
                </span>
              </button>

              <div className="pp-sidebar-row highlight">
                <span className="pp-icon-dot"><MdBolt size={16} /></span>
                <div>
                  <strong>60-Minute Express Delivery</strong>
                  <span>Get it by end of day</span>
                </div>
              </div>

              <div className="pp-sidebar-row">
                <MdPayments size={18} />
                <div>
                  <strong>Cash on Delivery</strong>
                  <span>Available</span>
                </div>
              </div>

              <div className="pp-sidebar-row">
                <MdAutorenew size={18} />
                <div>
                  <strong>Easy Returns</strong>
                  <span>5 day return policy</span>
                </div>
              </div>

              <button
                type="button"
                className="pp-buy-now"
                disabled={canPurchase === false}
                aria-label={`Buy ${product.name} now`}
                data-testid="buy-now-button"
                onClick={handleBuyNowClick}
              >
                <MdBolt size={16} /> Buy Now
              </button>

              <button
                type="button"
                className="pp-try-buy"
                disabled={canPurchase === false}
                aria-label={`Try and buy ${product.name}`}
                data-testid="try-and-buy-button"
                onClick={handleTryAndBuyClick}
              >
                <MdVerified size={16} /> Try and Buy
              </button>

              <button
                type="button"
                className="pp-add-cart"
                disabled={canPurchase === false}
                data-testid="add-to-cart-button"
                onClick={() => handleAddToCart()}
              >
                <MdOutlineShoppingCart size={16} />
                {cartAdded ? 'Added ✓' : 'Add to Cart'}
              </button>

              <button
                type="button"
                className={`pp-wishlist-btn ${wishlisted ? 'active' : ''}`}
                onClick={() =>
                  toggleWishlist({
                    productId: product.id,
                    name: product.name,
                    image: gallery[0]?.url,
                    price,
                  })
                }
                aria-pressed={wishlisted}
              >
                {wishlisted ? <MdFavorite size={16} /> : <MdFavoriteBorder size={16} />}
                {wishlisted ? 'Wishlisted' : 'Add to Wishlist'}
              </button>
              <p className="pd-secure"><MdLock size={13} /> Secure Payment</p>
            </div>

            {hasRelated && (
              <div className="pp-related">
                <div className="pp-related-head">
                  <p>You May Also Like</p>
                  <button type="button" className="pp-related-viewall" onClick={() => navigate(fromPath || '/shop')}>
                    View All
                  </button>
                </div>

                <div className="pp-related-grid" ref={relatedListRef}>
                  {relatedProducts.slice(0, visibleRelatedCount).map((item, idx) => {
                    const itemPrice = Number(item.discount_price || item.price || 0);
                    const itemMrp = Number(item.price || 0);
                    const itemImage = item.image || item.image_url || item.url || null;
                    return (
                      <div key={`${item.id}-${idx}`} className="pp-related-card">
                        <a
                          className="pp-related-link"
                          href={`/product/${item.id}`}
                          onClick={(e) => {
                            if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                            e.preventDefault();
                            navigate(`/product/${item.id}`);
                          }}
                        >
                          <div className="pp-related-media">
                            {itemImage ? <img src={itemImage} alt={item.name} loading="lazy" /> : <div className="pd-rel-fallback" />}
                          </div>
                          <p className="pp-related-name">{item.name}</p>
                          <p className="pp-related-price">
                            ₹{toCurrency(itemPrice)}
                            {itemMrp > itemPrice && <s>₹{toCurrency(itemMrp)}</s>}
                          </p>
                        </a>
                        <button
                          type="button"
                          className="pp-related-cart"
                          aria-label={`Add ${item.name} to cart`}
                          onClick={() =>
                            addToCart({
                              productId: item.id,
                              variantId: item.variant_id || null,
                              name: item.name,
                              image: itemImage,
                              price: itemPrice,
                              size: item.size,
                              color: item.color,
                            })
                          }
                        >
                          <MdOutlineShoppingCart size={14} />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </aside>

          {/* Feature strip */}
          <div className="pp-feature-strip">
            {FEATURES.map(({ icon: Icon, title, sub }) => (
              <div className="pp-feature-item" key={title}>
                <Icon size={20} />
                <div className="pp-feature-text">
                  <strong>{title}</strong>
                  <span>{sub}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Detail card */}
          <section className="pp-detail-card" ref={reviewsRef}>
            <div className="pp-tabs" role="tablist">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  role="tab"
                  aria-selected={activeTab === tab.key}
                  className={`pp-tab ${activeTab === tab.key ? 'active' : ''}`}
                  onClick={() => setActiveTab(tab.key)}
                >
                  {tab.label}{tab.key === 'reviews' && reviewCount > 0 ? ` (${reviewCount})` : ''}
                </button>
              ))}
            </div>

            <div className="pp-detail-body">

              {activeTab === 'description' && (
                <div className="pp-description">
                  <div
                    id="pp-desc-content"
                    ref={descClipRef}
                    className={`pp-desc-clip ${descExpanded ? 'expanded' : ''} ${descClipped ? 'is-clipped' : ''}`}
                  >
                    <p>{product.description || 'No description available for this product yet.'}</p>
                    <ul className="pp-highlights">
                      <li><MdCheck size={14} strokeWidth={3} /><span>100% Original product</span></li>
                      <li><MdCheck size={14} strokeWidth={3} /><span>Easy returns within 5 days</span></li>
                      <li><MdCheck size={14} strokeWidth={3} /><span>Secure payment and protected checkout</span></li>
                    </ul>
                  </div>
                  {descClipped && (
                    <button
                      type="button"
                      className={`pp-read-more ${descExpanded ? 'open' : ''}`}
                      onClick={() => setDescExpanded((v) => !v)}
                      aria-expanded={descExpanded}
                      aria-controls="pp-desc-content"
                    >
                      {descExpanded ? 'Show less' : 'Read more ...'}
                      <MdKeyboardArrowDown size={13} />
                    </button>
                  )}
                </div>
              )}

              {activeTab === 'details' && hasDetails && (
                <div className="pp-details-table">
                  <div><span>Brand</span><strong>{product.brand || 'Blinkiefash'}</strong></div>
                  <div><span>Category</span><strong>{product.category_name || product.category || 'Fashion'}</strong></div>
                  {selectedVariant?.color && <div><span>Color</span><strong>{selectedVariant.color}</strong></div>}
                  {selectedVariant?.size && <div><span>Size</span><strong>{selectedVariant.size}</strong></div>}
                  {selectedVariant?.sku && <div><span>SKU</span><strong>{selectedVariant.sku}</strong></div>}
                  <div><span>Stock</span><strong>{selectedVariant?.available_stock ?? 'Available'}</strong></div>
                </div>
              )}

              {activeTab === 'reviews' && (
                <div className="pp-reviews-tab-content">
                  <div className="pp-reviews-score-inline">
                    <span className="pp-stars" aria-hidden="true">
                      {'★'.repeat(roundedAvg)}{'☆'.repeat(5 - roundedAvg)}
                    </span>
                    <strong>{rating.toFixed(1)}</strong>
                    <span className="pp-muted">({reviewCount} reviews)</span>
                  </div>
                  <p className="pp-review-empty">
                    Detailed reviews for this product aren&apos;t available yet. Check back soon!
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* Trust strip */}
        <section className="pp-trust-strip">
          <div className="pp-trust-item">
            <MdVerified size={20} />
            <div><h4>100% Original Products</h4><p>Sourced directly from brands</p></div>
          </div>
          <div className="pp-trust-item">
            <MdLock size={20} />
            <div><h4>Secure Payments</h4><p>Multiple safe payment options</p></div>
          </div>
          <div className="pp-trust-item">
            <MdAutorenew size={20} />
            <div><h4>Easy Returns</h4><p>Hassle-free returns in 5 days</p></div>
          </div>
          <div className="pp-trust-item">
            <MdHeadsetMic size={20} />
            <div><h4>Dedicated Support</h4><p>We&apos;re here to help you</p></div>
          </div>
        </section>

        {/* Recently Viewed */}
        {hasRecentlyViewed && (
          <section className="pp-related pp-recent">
            <div className="pp-related-head">
              <p>Recently Viewed</p>
            </div>
            <div className="pp-related-grid pp-recent-grid">
              {recentlyViewed.map((item, idx) => (
                <div key={`${item.id}-${idx}`} className="pp-related-card">
                  <a
                    className="pp-related-link"
                    href={`/product/${item.id}`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
                      e.preventDefault();
                      navigate(`/product/${item.id}`);
                    }}
                  >
                    <div className="pp-related-media">
                      {item.image ? <img src={item.image} alt={item.name} loading="lazy" /> : <div className="pd-rel-fallback" />}
                    </div>
                    <p className="pp-related-name">{item.name}</p>
                    <p className="pp-related-price">₹{toCurrency(item._price || 0)}</p>
                  </a>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>

      <div className="pd-mobile-actionbar">
        <div className="pd-mobile-price">
          <strong>₹{toCurrency(price)}</strong>
          {mrp > price ? <span>₹{toCurrency(mrp)}</span> : null}
        </div>
        <div className="pd-mobile-actions">
          <button type="button" className="pd-mobile-cart" disabled={canPurchase === false} onClick={handleAddToCart}>
            <MdOutlineShoppingCart />
            <span>{cartAdded ? 'Added ✓' : 'Add to Cart'}</span>
          </button>
          <button
            type="button"
            className="pd-mobile-buy"
            disabled={canPurchase === false}
            onClick={() => {
              if (handleAddToCart()) navigate('/checkout');
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