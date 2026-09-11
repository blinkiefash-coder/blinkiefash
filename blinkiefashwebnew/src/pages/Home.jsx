import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdChevronRight,
  MdChevronLeft,
  MdTune,
  MdLogin,
} from 'react-icons/md';

import Loader from '../components/Loader';
import Footer from '../components/Footer';
import PageSEO from '../components/PageSEO';
import Navbar from '../components/Navbar';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
import Filter from '../components/filter';
import { useAuth } from '../context/AuthContext';
import { getCategories, getBestsellers, getProducts, getBrands, getProductById } from '../api';
import { API_BASE_URL } from '../apiBase';

import banner1 from '../assets/banner1.png';
import banner2 from '../assets/banner2.png';
import banner3 from '../assets/banner3.png';
import banner4 from '../assets/banner4.png';
import banner5 from '../assets/banner5.png';
import banner6 from '../assets/banner6.png';
import playAndWinImage from '../assets/play&win.png';
import spinAndWinImage from '../assets/spin&win.png';
import referAndEarnImage from '../assets/refer&earn.png';
import freeDeliveryImage from '../assets/freedelivery.png';

import mobilebanner1 from '../assets/mobilebanner1.png';
import mobilebanner2 from '../assets/mobilebanner2.png';
import mobilebanner3 from '../assets/mobilebanner3.png';
import mobilebanner4 from '../assets/mobilebanner4.png';
import mobilebanner5 from '../assets/mobilebanner5.png';
import mobilebanner6 from '../assets/mobilebanner6.png';

import { applyThemeVariables, removeThemeVariables } from '../utils/themeUtils';
import couponImage from '../assets/coupon.png';

import dealsOfTheDayIcon from '../assets/dealsoftheday.png';
import shopByBrandIcon from '../assets/shopbybrand.png';
import recentlyViewedIcon from '../assets/recentlyviewed.png';
import newOnBlinkiefashIcon from '../assets/new.png';
import mensCollectionIcon from '../assets/menicon.png';
import womensCollectionIcon from '../assets/womanicon.png';
import kidsCollectionIcon from '../assets/kidsicon.png';
import electronicsCollectionIcon from '../assets/electronicsicon.png';
import trendyShoesIcon from '../assets/shoeicon.png';
import under999Icon from '../assets/prices.png';
import priceRangeIcon from '../assets/prices.png';
import moreToExploreIcon from '../assets/explore.png';

// Login-prompt popup images shown to logged-out users on the reward cards
import spinWheelPopup from '../assets/spinwheelpopup.png';
import playWinPopup from '../assets/playwinpopup.png';
import referEarnPopup from '../assets/referearnpopup.png';

import './Shop.css';
import './Home.css';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.blinkiefash.app';

// Maps each reward card to its login-prompt image, destination route
// (once logged in), and CTA copy shown below the image.
const REWARD_LOGIN_PROMPTS = {
  spin: {
    image: spinWheelPopup,
    to: '/spin-wheel',
    cta: 'Log In to Spin Now',
  },
  play: {
    image: playWinPopup,
    to: '/play-and-win',
    cta: 'Log In to Play Now',
  },
  refer: {
    image: referEarnPopup,
    to: '/refer-earn',
    cta: 'Log In to Refer Now',
  },
};

function resolveImageUrl(raw) {
  const value = (raw ?? '').toString().trim();
  if (!value) return null;
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

// Shown until /api/hero-cards responds, and kept as the fallback if the admin
// has no active cards configured so the hero never renders empty.
const FALLBACK_HERO_SLIDES = [
  {
    id: 'hero-men-women',
    image: banner1,
    mobileImage: mobilebanner1,
    to: '/shop?search=men%women',
    pos: 'center',
    hotspots: true,
  },
  {
    id: 'hero-puma',
    image: banner2,
    mobileImage: mobilebanner2,
    brand: 'Puma',
    pos: 'center 20%',
  },
  {
    id: 'hero-xinso',
    image: banner3,
    mobileImage: mobilebanner3,
    brand: 'Xinso',
  },
  {
    id: 'hero-kids',
    image: banner4,
    mobileImage: mobilebanner4,
    to: '/kids',
  },
  {
    id: 'hero-crimsone',
    image: banner5,
    mobileImage: mobilebanner5,
    brand: 'Crimsone Club',
  },
  {
    id: 'hero-mk',
    image: banner6,
    mobileImage: mobilebanner6,
    brand: 'MK',
  },
];

// Maps a hero_cards row onto the shape the carousel renders.
function heroCardToSlide(card) {
  const value = card.reference_value || '';
  const slide = {
    id: card.id,
    title: card.title || '',
    image: card.image_url,
    mobileImage: card.mobile_image_url || null,
    pos: 'center',
  };

  switch (card.reference_type) {
    case 'brand':
      slide.brand = value;
      break;
    case 'category':
      slide.to = `/${value.toLowerCase()}`;
      break;
    case 'search':
      slide.to = `/shop?search=${encodeURIComponent(value)}`;
      // The men/women banner is a split image with two tappable halves.
      slide.hotspots = /men/i.test(value) && /women/i.test(value);
      break;
    default:
      slide.to = value || '/shop';
  }

  return slide;
}

const CAT_PRIORITY = { women: 0, men: 1, footwear: 2, electronics: 3, lifestyle: 4 };
function sortCategories(list) {
  return [...list].sort((a, b) => {
    const an = (a.name || '').toLowerCase();
    const bn = (b.name || '').toLowerCase();
    const ap = CAT_PRIORITY[an] ?? 99;
    const bp = CAT_PRIORITY[bn] ?? 99;
    if (ap !== bp) return ap - bp;
    return an.localeCompare(bn);
  });
}

const NIKE_LOGO_URL = 'https://upload.wikimedia.org/wikipedia/commons/a/a6/Logo_NIKE.svg';

const UNIVERSE_BRANDS = [
  {
    name: 'Puma',
    image: 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438409/Pumabanner_cd8wwz.jpg',
    to: '/brands/Puma',
  },
  {
    name: 'Dhanista Boutique',
    image: 'https://res.cloudinary.com/vu2qpoeq/image/upload/v1787657759/file_00000000eae882079e6b5c085825a239.png',
    to: '/brands/Dhanista%20Boutique',
  },
  {
    name: 'FCUK',
    image: 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438315/FcukandFrenchconnection_a8ovf0.png',
    to: '/brands/FCUK',
    pos: 'left center',
  },
  {
    name: 'Libas',
    image: 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438322/libasbanner_gtuogs.jpg',
    to: '/brands/Libas',
  },
  {
    name: 'MK',
    image: 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438329/mkbanner_habbh6.jpg',
    to: '/brands/MK',
  },
  {
    name: 'Toys',
    image: 'https://res.cloudinary.com/vu2qpoeq/image/upload/v1787574337/file_00000000ba04820ba8d817a1a5912ca2.png',
    to: '/shop?search=Toys',
  },
];

const normalizeBrandName = (value) => (value || '').toString().toLowerCase().replace(/\./g, '').trim();

const CHIP_ICON_HINTS = [
  { re: /t-?shirt|tee/i, icon: '👕' },
  { re: /jeans|denim|trouser|pant/i, icon: '👖' },
  { re: /shirt/i, icon: '👔' },
  { re: /jacket|coat|hoodie/i, icon: '🧥' },
  { re: /shorts/i, icon: '🩳' },
  { re: /sneaker|shoe|sports|footwear/i, icon: '👟' },
  { re: /ethnic|kurti|kurta|saree|dress|top/i, icon: '👗' },
  { re: /watch|smartwatch/i, icon: '⌚' },
  { re: /baby|kids|children/i, icon: '👶' },
  { re: /bag|handbag|wallet|school/i, icon: '👜' },
  { re: /toy/i, icon: '🧸' },
  { re: /headphone|earbud|audio/i, icon: '🎧' },
  { re: /mobile|phone/i, icon: '📱' },
  { re: /speaker/i, icon: '🔊' },
  { re: /gaming|game/i, icon: '🎮' },
  { re: /laptop|computer/i, icon: '💻' },
  { re: /camera/i, icon: '📷' },
  { re: /accessor/i, icon: '🔌' },
  { re: /heel/i, icon: '👠' },
  { re: /flat/i, icon: 'Flat' },
  { re: /sandal/i, icon: '👡' },
];

const CHIP_ICON_BY_AUDIENCE = {
  men: '👕',
  women: '👗',
  kids: '👶',
  electronics: '📱',
  'trendy shoes': '👟',
};

function chipFallbackIcon(label, audience) {
  const text = (label || '').toString();
  const hit = CHIP_ICON_HINTS.find((entry) => entry.re.test(text));
  if (hit) return hit.icon;
  const audienceKey = (audience || '').toString().toLowerCase();
  return CHIP_ICON_BY_AUDIENCE[audienceKey] || '🛍️';
}

const RECENTLY_VIEWED_KEY = 'bfw_recently_viewed_products';

let _homeCache = null;

function scrollRailByCards(el, direction = 1, cardsPerPage = 6) {
  if (!el) return;
  const dir = direction < 0 ? -1 : 1;
  const card = el.querySelector('.hp-deal-card, .hp-collection-chip, .hp-subcat-chip, .pc-card, .hp-shop-brand-card');
  let step = Math.round(el.clientWidth * 0.95);
  if (card) {
    const styles = window.getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap || '14') || 14;
    const cardW = card.getBoundingClientRect().width;
    step = Math.round((cardW + gap) * cardsPerPage);
  }
  el.scrollBy({ left: dir * step, behavior: 'smooth' });
}

function seededShuffle(array, seed) {
  const arr = [...array];
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function todaysSeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

function getMsUntilMidnight() {
  const now = new Date();
  const midnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, midnight.getTime() - now.getTime());
}

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

async function getProductsForCategoryIds(categoryIds) {
  const ids = [...new Set((Array.isArray(categoryIds) ? categoryIds : [categoryIds]).filter(Boolean).map(String))];
  const responses = await Promise.all(
    ids.map((categoryId) => getProducts({ category_id: categoryId, sort: 'newest', limit: 40 }))
  );
  const seen = new Set();
  return responses
    .flatMap((res) => res?.products || (Array.isArray(res) ? res : []))
    .filter((item) => {
      const key = String(item?.id || '');
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

const NON_FASHION_KEYWORDS = [
  'electronics', 'headphone', 'headphones', 'earbud', 'earbuds', 'speaker',
  'mobile', 'phone', 'laptop', 'camera', 'gaming', 'game console',
  'smartwatch', 'toy', 'toys', 'kitchen', 'appliance', 'furniture',
  'home decor', 'stationery', 'grocery',
];

function isFashionProduct(item) {
  const hay = `${item?.name || ''} ${item?.category_name || ''} ${item?.brand || ''}`.toLowerCase();
  return !NON_FASHION_KEYWORDS.some((keyword) => hay.includes(keyword));
}

function SectionHead({
  icon,
  iconAlt = '',
  title,
  accentWord,
  subtitle = '',
  viewAllLabel = 'View All',
  onViewAll,
  iconClassName,
  trailing,
  headerActions,
}) {
  return (
    <div className="hp-shead">
      <div className="hp-shead-title-group">
        <div className="hp-shead-title-wrap">
          {icon ? (
            <span className={`hp-shead-mark${iconClassName ? ` ${iconClassName}` : ''}`} aria-hidden="true">
              <img src={icon} alt={iconAlt} className="hp-shead-mark-img" />
            </span>
          ) : null}
          <div className="hp-shead-text-block">
            <h2 className="hp-shead-title">
              {accentWord ? (
                <>
                  <span>{title} </span>
                  <span className="hp-shead-accent">{accentWord}</span>
                </>
              ) : (
                <span>{title}</span>
              )}
            </h2>
            {subtitle && <p className="hp-shead-subtitle">{subtitle}</p>}
          </div>
          {trailing}
        </div>
      </div>

      {onViewAll || headerActions ? (
        <div className="hp-shead-actions">
          {onViewAll ? (
            <button type="button" className="hp-shead-action" onClick={onViewAll}>
              {viewAllLabel} <MdChevronRight />
            </button>
          ) : null}
          {headerActions}
        </div>
      ) : null}
    </div>
  );
}

export default function Home() {
  const navigate = useNavigate();
  const { isLoggedIn, userGender } = useAuth();
  const c = _homeCache;

  const [categories, setCategories] = useState(() => c?.categories ?? []);
  const [deals, setDeals] = useState(() => c?.deals ?? []);
  const [newProducts, setNewProducts] = useState(() => c?.newProducts ?? []);
  const [, setPinnedNewProduct] = useState(() => c?.pinnedNewProduct ?? null);
  const [mensProducts, setMensProducts] = useState(() => c?.mensProducts ?? []);
  const [womensProducts, setWomensProducts] = useState(() => c?.womensProducts ?? []);
  const [kidsProducts, setKidsProducts] = useState(() => c?.kidsProducts ?? []);
  const [electronicsProducts, setElectronicsProducts] = useState(() => c?.electronicsProducts ?? []);
  const [trendyShoesProducts, setTrendyShoesProducts] = useState(() => c?.trendyShoesProducts ?? []);
  const [mensCats, setMensCats] = useState(() => c?.mensCats ?? []);
  const [womensCats, setWomensCats] = useState(() => c?.womensCats ?? []);
  const [kidsCats, setKidsCats] = useState(() => c?.kidsCats ?? []);
  const [electronicsCats, setElectronicsCats] = useState(() => c?.electronicsCats ?? []);
  const [trendyShoesCats, setTrendyShoesCats] = useState(() => c?.trendyShoesCats ?? []);
  const [activeCollectionCats, setActiveCollectionCats] = useState({});
  const [sectionCategoryFilters, setSectionCategoryFilters] = useState({});
  // Tracks an active SUBCATEGORY filter per audience section (Men/Women/Kids/
  // Electronics/Trendy Shoes). When set for a given audience, that section's
  // product rail shows the fetched subcategory products instead of the
  // default collection products. Shape: { [audienceKey]: { subId, products, loading } }
  const [sectionSubFilters, setSectionSubFilters] = useState({});
  const [under999Products, setUnder999Products] = useState(() => c?.under999Products ?? []);
  const [under1999Products, setUnder1999Products] = useState(() => c?.under1999Products ?? []);
  const [topBrands, setTopBrands] = useState(() => c?.topBrands ?? []);
  const [homeRotationSeed] = useState(
    () => Date.now() + Math.floor(Math.random() * 1000000),
  );
  const [exploreCatChipIndex, setExploreCatChipIndex] = useState(0);
  const [exploreCatId, setExploreCatId] = useState('');
  const [exploreProducts, setExploreProducts] = useState([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [exploreHasMore, setExploreHasMore] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [loading, setLoading] = useState(!_homeCache);
  const [error, setError] = useState('');
  const [heroPosition, setHeroPosition] = useState(0);
  const [heroSlides, setHeroSlides] = useState(FALLBACK_HERO_SLIDES);
  const [heroAspectRatio, setHeroAspectRatio] = useState(null);
  const [recentlyViewedProductsData, setRecentlyViewedProductsData] = useState([]);
  const [dealsCountdown, setDealsCountdown] = useState(() => formatCountdown(getMsUntilMidnight()));
  const [brandsPaused, setBrandsPaused] = useState(false);
  const [dealFilterOpen, setDealFilterOpen] = useState(false);
  const [dealActiveBrand, setDealActiveBrand] = useState([]);
  const [dealActiveColor, setDealActiveColor] = useState([]);
  const [dealActiveGender, setDealActiveGender] = useState([]);
  const [dealMinDiscount, setDealMinDiscount] = useState(0);
  const [dealInStockOnly, setDealInStockOnly] = useState(false);
  const [dealMaxPrice, setDealMaxPrice] = useState(10000);
  const [dealBrandSearch, setDealBrandSearch] = useState('');
  const [appliedDealFilters, setAppliedDealFilters] = useState({
    brand: [],
    color: [],
    gender: [],
    minDiscount: 0,
    inStockOnly: false,
    maxPrice: 10000,
  });
  // Which reward-card login prompt is open: 'spin' | 'play' | 'refer' | null
  const [rewardLoginPrompt, setRewardLoginPrompt] = useState(null);

  const heroTrackRef = useRef(null);
  const heroRatiosRef = useRef(new Map());
  const dealsRef = useRef(null);
  const brandsPauseTimerRef = useRef(null);
  const brandsWrapRef = useRef(null);
  const recentlyViewedRailRef = useRef(null);
  const newOnBlinkiefashRailRef = useRef(null);

  const brandRows = useMemo(() => [
    topBrands.filter((_, index) => index % 2 === 0),
    topBrands.filter((_, index) => index % 2 === 1),
  ], [topBrands]);

  const pauseBrandCarousel = () => {
    setBrandsPaused(true);
    window.clearTimeout(brandsPauseTimerRef.current);
    brandsPauseTimerRef.current = window.setTimeout(() => {
      setBrandsPaused(false);
    }, 5000);
  };

  const scrollBrandsLeft = () => {
    if (brandsWrapRef.current) {
      const rows = brandsWrapRef.current.querySelectorAll('.hp-shop-brands-row');
      rows.forEach((row) => {
        const currentScrollLeft = row.scrollLeft;
        row.scrollTo({
          left: Math.max(0, currentScrollLeft - 300),
          behavior: 'smooth',
        });
      });
      pauseBrandCarousel();
    }
  };

  const scrollBrandsRight = () => {
    if (brandsWrapRef.current) {
      const rows = brandsWrapRef.current.querySelectorAll('.hp-shop-brands-row');
      rows.forEach((row) => {
        const currentScrollLeft = row.scrollLeft;
        const maxScroll = row.scrollWidth - row.clientWidth;
        row.scrollTo({
          left: Math.min(maxScroll, currentScrollLeft + 300),
          behavior: 'smooth',
        });
      });
      pauseBrandCarousel();
    }
  };

  // Opens the login-prompt popup for a reward card when logged out;
  // navigates straight through when already logged in.
  const handleRewardCardClick = (key) => {
    const config = REWARD_LOGIN_PROMPTS[key];
    if (!config) return;
    if (isLoggedIn) {
      navigate(config.to);
    } else {
      setRewardLoginPrompt(key);
    }
  };

  // Selecting a top-level category chip (e.g. switching from "T-Shirts" to
  // "Jeans" within Men's) should drop any subcategory filter that was
  // active for that audience, since its subcategory list is about to change.
  const handleMainCategorySelect = async (audienceKey, id, relatedCategoryIds = []) => {
    const categoryIds = [id, ...relatedCategoryIds].filter(Boolean).map(String);
    const categoryId = categoryIds.join(',');
    setActiveCollectionCats((prev) => ({ ...prev, [audienceKey]: id }));
    setSectionSubFilters((prev) => {
      const next = { ...prev };
      delete next[audienceKey];
      return next;
    });

    setSectionCategoryFilters((prev) => ({
      ...prev,
      [audienceKey]: { categoryId, products: [], loading: true },
    }));

    try {
      const items = await getProductsForCategoryIds(categoryIds);
      setSectionCategoryFilters((prev) => {
        if (prev[audienceKey]?.categoryId !== categoryId) return prev;
        return {
          ...prev,
          [audienceKey]: { categoryId, products: Array.isArray(items) ? items : [], loading: false },
        };
      });
    } catch {
      setSectionCategoryFilters((prev) => {
        if (prev[audienceKey]?.categoryId !== categoryId) return prev;
        return { ...prev, [audienceKey]: { categoryId, products: [], loading: false } };
      });
    }
  };

  // Selecting a subcategory pill fetches products for that subcategory and
  // swaps them into the section's rail in place, instead of navigating away.
  // Clicking the already-active subcategory pill again clears the filter.
  const handleSubcategorySelect = async (audienceKey, subId, relatedCategoryIds = []) => {
    const subcategoryIds = [subId, ...relatedCategoryIds].filter(Boolean).map(String);
    const subIdValue = String(subId);
    const requestKey = subcategoryIds.join(',');
    const current = sectionSubFilters[audienceKey];

    if (current?.subId === subIdValue) {
      setSectionSubFilters((prev) => {
        const next = { ...prev };
        delete next[audienceKey];
        return next;
      });
      return;
    }

    setSectionSubFilters((prev) => ({
      ...prev,
      [audienceKey]: { subId: subIdValue, requestKey, products: [], loading: true },
    }));

    try {
      const items = await getProductsForCategoryIds(subcategoryIds);
      setSectionSubFilters((prev) => {
        // Ignore the response if the user has since switched away from this
        // subcategory (or the whole audience filter was cleared) while the
        // request was in flight.
        if (prev[audienceKey]?.requestKey !== requestKey) return prev;
        return {
          ...prev,
          [audienceKey]: { subId: subIdValue, requestKey, products: Array.isArray(items) ? items : [], loading: false },
        };
      });
    } catch {
      setSectionSubFilters((prev) => {
        if (prev[audienceKey]?.requestKey !== requestKey) return prev;
        return {
          ...prev,
          [audienceKey]: { subId: subIdValue, requestKey, products: [], loading: false },
        };
      });
    }
  };

  useEffect(() => () => window.clearTimeout(brandsPauseTimerRef.current), []);

  useEffect(() => {
    const loadRecent = () => {
      try {
        const parsed = JSON.parse(localStorage.getItem(RECENTLY_VIEWED_KEY) || '[]');
        setRecentlyViewedProductsData(Array.isArray(parsed) ? parsed : []);
      } catch {
        setRecentlyViewedProductsData([]);
      }
    };
    loadRecent();
    window.addEventListener('focus', loadRecent);
    return () => window.removeEventListener('focus', loadRecent);
  }, []);

  useEffect(() => {
    if (isLoggedIn && userGender) {
      applyThemeVariables(userGender);
    } else {
      removeThemeVariables();
    }
    return () => {
      if (!isLoggedIn) removeThemeVariables();
    };
  }, [isLoggedIn, userGender]);

  useEffect(() => {
    const interval = setInterval(() => {
      setDealsCountdown(formatCountdown(getMsUntilMidnight()));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!recentlyViewedProductsData || recentlyViewedProductsData.length === 0) return;
    const idsToFetch = recentlyViewedProductsData
      .filter((p) => Number(p._price ?? p.price ?? 0) <= 0)
      .map((p) => p.id)
      .filter(Boolean);
    if (idsToFetch.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const promises = idsToFetch.map((pid) => getProductById(pid).catch(() => null));
        const results = await Promise.all(promises);
        if (cancelled) return;

        const updated = recentlyViewedProductsData.map((p) => {
          if (!idsToFetch.includes(p.id)) return p;
          const res = results.find((r) => r && String(r.product?.id) === String(p.id));
          if (!res || !res.product) return p;
          const prod = res.product;
          const selVar = (res.variants || []).find((v) => Number(v.available_stock || 0) > 0) || res.variants?.[0] || null;
          const price = Number(selVar?.discount_price ?? prod.discount_price ?? selVar?.price ?? prod.price ?? p.price ?? p._price ?? 0) || 0;
          const mrp = Number(selVar?.price ?? prod.price ?? p.mrp ?? p._mrp ?? price) || price;
          const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
          return {
            ...p,
            _price: price,
            price,
            _mrp: mrp,
            mrp,
            _discount: discount,
            discount_price: price,
          };
        });
        setRecentlyViewedProductsData(updated);
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [recentlyViewedProductsData]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const fetchNewestPool = async () => {
          const pool = [];
          const seen = new Set();
          let offset = 0;
          for (let i = 0; i < 4; i += 1) {
            const res = await getProducts({ sort: 'newest', limit: 100, offset });
            const batch = res?.products || (Array.isArray(res) ? res : []);
            if (!Array.isArray(batch) || batch.length === 0) break;
            batch.forEach((item) => {
              const key = String(item?.id ?? '');
              if (!key || seen.has(key)) return;
              seen.add(key);
              pool.push(item);
            });
            if (batch.length < 100) break;
            offset += 100;
          }
          return pool;
        };

        const [catRes, dealsRes, palermoRes, newestPool, brandsRes] = await Promise.all([
          getCategories(),
          getBestsellers(12),
          getProducts({ search: 'Palermo', limit: 1 }),
          fetchNewestPool(),
          getBrands(),
        ]);

        const allCats = Array.isArray(catRes) ? catRes : [];
        const rootIdForAny = (names) => {
          const normalizedNeedles = (Array.isArray(names) ? names : [names])
            .map((n) => (n || '').toString().toLowerCase().trim())
            .filter(Boolean);
          if (normalizedNeedles.length === 0) return null;
          const root =
            allCats.find((c) => {
              if (c.parent_id) return false;
              const catName = (c?.name || '').toString().toLowerCase().trim();
              return normalizedNeedles.some((needle) => catName === needle);
            }) ||
            allCats.find((c) => {
              if (c.parent_id) return false;
              const catName = (c?.name || '').toString().toLowerCase().trim();
              return normalizedNeedles.some(
                (needle) => catName.includes(needle) || needle.includes(catName)
              );
            });
          return root?.id || null;
        };

        const childCatsFor = (rootNames) => {
          const rootId = rootIdForAny(rootNames);
          if (!rootId) return [];
          const subCatsFor = (categoryId) =>
            allCats
              .filter((c) => String(c.parent_id) === String(categoryId))
              .map((c) => ({
                id: c.id,
                categoryIds: [c.id],
                name: (c?.name || '').toString().trim(),
                image: c.category_url || c.image || '',
              }))
              .filter((c) => c.name)
              .slice(0, 6);
          return allCats
            .filter((c) => String(c.parent_id) === String(rootId))
            .map((c) => ({
              id: c.id,
              categoryIds: [c.id],
              name: c.name,
              image: c.category_url || c.image || '',
              subcategories: subCatsFor(c.id),
            }))
            .slice(0, 10);
        };

        const fetchCollection = async (rootName, fallbackSearch) => {
          const rootId = rootIdForAny(rootName);
          const result = await getProducts({
            category_id: rootId,
            search: rootId ? undefined : fallbackSearch,
            sort: 'newest',
            limit: 40,
          });
          return result?.products || (Array.isArray(result) ? result : []);
        };

        const [
          menRes, womenRes, kidsRes, electronicsRes, trendyShoesRes,
          under999Res, under1999Res,
        ] = await Promise.all([
          fetchCollection('Men', 'men'),
          fetchCollection('Women', 'women'),
          fetchCollection('Kids', 'kids'),
          fetchCollection('Electronics', 'electronics'),
          fetchCollection(['Footwear', 'Shoes'], 'shoes'),
          // Mixed products under ₹999 (newest first, not just cheapest accessories)
          getProducts({ min_price: 0, max_price: 999, limit: 40, sort: 'newest' }),
          // Mixed products ₹1000–₹1999 (newest first)
          getProducts({ min_price: 1000, max_price: 1999, limit: 40, sort: 'newest' }),
        ]);

        const under999List = under999Res?.products || (Array.isArray(under999Res) ? under999Res : []);
        const under1999List = under1999Res?.products || (Array.isArray(under1999Res) ? under1999Res : []);
        let dealList = dealsRes?.bestsellers || dealsRes?.products || [];
        if (!Array.isArray(dealList) || dealList.length === 0) {
          const fallback = await getProducts({ limit: 20 });
          dealList = fallback?.products || (Array.isArray(fallback) ? fallback : []);
        }
        // Deals of the Day pulls from a much larger pool so there is enough
        // fashion inventory left after filtering to rotate 30 items daily.
        // Fetch from multiple sort options to ensure brand diversity
        // (e.g., The Souled Store, US Polo, not just Puma)
        let dealsPool = [];
        const dealsSeen = new Set();
        const sortOptions = ['newest', 'discount', 'price_asc'];
        for (const sortOption of sortOptions) {
          const dealsPoolRes = await getProducts({ sort: sortOption, limit: 100 });
          const poolBatch = dealsPoolRes?.products || (Array.isArray(dealsPoolRes) ? dealsPoolRes : []);
          if (Array.isArray(poolBatch)) {
            poolBatch.forEach((p) => {
              const key = String(p?.id ?? '');
              if (!key || dealsSeen.has(key)) return;
              dealsSeen.add(key);
              dealsPool.push(p);
            });
          }
        }
        if (dealsPool.length > 0) {
          const seen = new Set((Array.isArray(dealList) ? dealList : []).map((p) => String(p?.id)));
          dealList = [...(Array.isArray(dealList) ? dealList : [])];
          dealsPool.forEach((p) => {
            const key = String(p?.id ?? '');
            if (!key || seen.has(key)) return;
            seen.add(key);
            dealList.push(p);
          });
        }

        const latestList = Array.isArray(newestPool) ? newestPool : [];
        const palermoList = palermoRes?.products || (Array.isArray(palermoRes) ? palermoRes : []);
        const sourcePool = latestList.length > 0 ? latestList : Array.isArray(dealList) ? dealList : [];

        const pickByKeywords = (items, keywords) => {
          const terms = keywords.map((k) => k.toLowerCase());
          return items.filter((p) => {
            const hay = `${p?.name || ''} ${p?.brand || ''} ${p?.category_name || ''}`.toLowerCase();
            return terms.some((t) => hay.includes(t));
          });
        };

        const fallbackMen = pickByKeywords(sourcePool, ['men', 'mens', 'shirt', 'trouser', 'hoodie', 't-shirt']);
        const fallbackWomen = pickByKeywords(sourcePool, ['women', 'womens', 'kurti', 'dress', 'saree', 'blouse']);
        const fallbackKids = pickByKeywords(sourcePool, ['kids', 'boys', 'girls', 'children']);
        const fallbackElectronics = pickByKeywords(sourcePool, ['electronics', 'headphone', 'speaker', 'mobile', 'earbuds', 'watch']);
        const fallbackShoes = pickByKeywords(sourcePool, ['shoe', 'sneaker', 'footwear', 'sandal', 'slipper']);

        const priced = sourcePool.map((p) => ({
          ...p,
          _price: Number(p?.discount_price ?? p?.price ?? 0),
        }));
        const fallbackUnder999 = priced.filter((p) => p._price > 0 && p._price <= 999);
        const fallbackUnder1999 = priced.filter((p) => p._price >= 1000 && p._price <= 1999);

        const brandCount = new Map();
        sourcePool.forEach((p) => {
          const name = (p?.brand || '').toString().trim();
          if (!name) return;
          const key = name.toLowerCase();
          if (!brandCount.has(key)) brandCount.set(key, { name, count: 0 });
          brandCount.get(key).count += 1;
        });

        const dbBrands = (Array.isArray(brandsRes) ? brandsRes : [])
          .map((b) => ({
            id: b.id,
            name: (b?.name || '').toString().trim(),
            logo_url: b?.logo_url || '',
          }))
          .filter((b) => b.name);

        const fallbackBrandObjects = [...brandCount.values()].map((b) => ({
          id: null,
          name: b.name,
          logo_url: '',
          _count: b.count,
        }));

        const brandsSource = dbBrands.length > 0 ? dbBrands : fallbackBrandObjects;

        // Force Puma to the front so it appears first in the upper row of Shop by Brands
        const brandsList = [...brandsSource].sort((a, b) => {
          const aName = (a.name || '').toLowerCase();
          const bName = (b.name || '').toLowerCase();
          if (aName === 'puma') return -1;
          if (bName === 'puma') return 1;
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
        });

        if (cancelled) return;

        const freshCategories = sortCategories((Array.isArray(catRes) ? catRes : []).filter((c) => !c.parent_id));
        const freshDeals = Array.isArray(dealList) ? dealList : [];
        const freshNewProducts = Array.isArray(latestList) ? latestList : [];
        const freshPinned = Array.isArray(palermoList) && palermoList.length > 0 ? palermoList[0] : null;
        const freshMens = Array.isArray(menRes) && menRes.length > 0 ? menRes : fallbackMen;
        const freshWomens = Array.isArray(womenRes) && womenRes.length > 0 ? womenRes : fallbackWomen;
        const freshKids = Array.isArray(kidsRes) && kidsRes.length > 0 ? kidsRes : fallbackKids;
        const freshElectronics = Array.isArray(electronicsRes) && electronicsRes.length > 0 ? electronicsRes : fallbackElectronics;
        const freshShoes = Array.isArray(trendyShoesRes) && trendyShoesRes.length > 0 ? trendyShoesRes : fallbackShoes;
        const freshUnder999 = Array.isArray(under999List) && under999List.length > 0 ? under999List : fallbackUnder999;
        const freshUnder1999 = Array.isArray(under1999List) && under1999List.length > 0 ? under1999List : fallbackUnder1999;
        const freshMensCats = childCatsFor('Men');
        const freshWomensCats = childCatsFor('Women');
        const freshKidsCats = childCatsFor('Kids');
        const freshElectronicsCats = childCatsFor('Electronics');
        let freshShoesCats = childCatsFor(['Footwear', 'Shoes']);
        const womenRootId = rootIdForAny('Women');
        const womenFootwearRoot = allCats.find(
          (category) => String(category.parent_id) === String(womenRootId)
            && (category.name || '').toString().toLowerCase().trim() === 'footwear'
        );
        if (womenFootwearRoot) {
          const womenFootwearChildren = allCats
            .filter((category) => String(category.parent_id) === String(womenFootwearRoot.id))
            .map((category) => ({
              id: category.id,
              categoryIds: [category.id],
              name: (category.name || '').toString().trim(),
              image: category.category_url || category.image || '',
            }))
            .filter((category) => category.name);
          const womenFootwearCategory = {
            id: womenFootwearRoot.id,
            categoryIds: [womenFootwearRoot.id],
            name: womenFootwearRoot.name,
            image: womenFootwearRoot.category_url || womenFootwearRoot.image || '',
            subcategories: womenFootwearChildren,
          };
          freshShoesCats = freshShoesCats.map((category) => {
            if ((category.name || '').toString().toLowerCase() !== 'female') return category;
            const subcategories = [...category.subcategories];
            womenFootwearCategory.subcategories.forEach((sub) => {
              const existing = subcategories.find(
                (item) => item.name.toLowerCase() === sub.name.toLowerCase()
              );
              if (existing) {
                existing.categoryIds = [...new Set([...existing.categoryIds, sub.id])];
              } else {
                subcategories.push(sub);
              }
            });
            return {
              ...category,
              categoryIds: [...category.categoryIds, womenFootwearRoot.id],
              subcategories,
            };
          });
        }

        _homeCache = {
          categories: freshCategories, deals: freshDeals, newProducts: freshNewProducts,
          pinnedNewProduct: freshPinned, mensProducts: freshMens, womensProducts: freshWomens,
          kidsProducts: freshKids, electronicsProducts: freshElectronics, trendyShoesProducts: freshShoes,
          under999Products: freshUnder999, under1999Products: freshUnder1999, topBrands: brandsList,
          mensCats: freshMensCats, womensCats: freshWomensCats, kidsCats: freshKidsCats,
          electronicsCats: freshElectronicsCats, trendyShoesCats: freshShoesCats,
        };

        setCategories(freshCategories);
        setDeals(freshDeals);
        setNewProducts(freshNewProducts);
        setPinnedNewProduct(freshPinned);
        setMensProducts(freshMens);
        setWomensProducts(freshWomens);
        setKidsProducts(freshKids);
        setElectronicsProducts(freshElectronics);
        setTrendyShoesProducts(freshShoes);
        setUnder999Products(freshUnder999);
        setUnder1999Products(freshUnder1999);
        setTopBrands(brandsList);
        setMensCats(freshMensCats);
        setWomensCats(freshWomensCats);
        setKidsCats(freshKidsCats);
        setElectronicsCats(freshElectronicsCats);
        setTrendyShoesCats(freshShoesCats);
      } catch (err) {
        if (!cancelled) setError(err.message || 'Could not load the home feed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/api/hero-cards`);
        if (!response.ok) return;
        const payload = await response.json();
        const cards = Array.isArray(payload?.data) ? payload.data : [];
        if (!cancelled && cards.length) {
          setHeroSlides(cards.map(heroCardToSlide));
          setHeroPosition(0);
        }
      } catch {
        // Keep the bundled fallback slides on any failure.
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroPosition((position) => (position + 1) % heroSlides.length);
    }, 15000);
    return () => clearInterval(timer);
  }, [heroSlides.length]);

  useEffect(() => {
    const track = heroTrackRef.current;
    if (!track) return;
    const slides = track.querySelectorAll('.hp-slide');
    if (!slides.length) return;
    const active = slides[heroPosition % slides.length] || slides[0];
    const gap = parseFloat(window.getComputedStyle(track).gap || '0') || 0;
    const step = active.getBoundingClientRect().width + gap;
    track.scrollTo({ left: heroPosition * step, behavior: 'smooth' });
  }, [heroPosition]);

  useEffect(() => {
    let cancelled = false;
    const loadExploreProducts = async () => {
      setExploreLoading(true);
      try {
        const res = await getProducts({
          category_id: exploreCatId || undefined,
          sort: 'newest',
          limit: 6,
          offset: 0,
        });
        const items = res?.products || (Array.isArray(res) ? res : []);
        if (cancelled) return;
        setExploreProducts(Array.isArray(items) ? items : []);
        setExploreOffset(Array.isArray(items) ? items.length : 0);
        setExploreHasMore(Array.isArray(items) && items.length === 6);
      } catch {
        if (!cancelled) {
          setExploreProducts([]);
          setExploreOffset(0);
          setExploreHasMore(false);
        }
      } finally {
        if (!cancelled) setExploreLoading(false);
      }
    };
    loadExploreProducts();
    return () => { cancelled = true; };
  }, [exploreCatId]);

  const loadMoreExploreProducts = async () => {
    if (exploreLoading || !exploreHasMore) return;
    setExploreLoading(true);
    try {
      const res = await getProducts({
        category_id: exploreCatId || undefined,
        sort: 'newest',
        limit: 6,
        offset: exploreOffset,
      });
      const items = res?.products || (Array.isArray(res) ? res : []);
      const nextItems = Array.isArray(items) ? items : [];
      setExploreProducts((prev) => {
        const seen = new Set(prev.map((p) => String(p.id)));
        const merged = [...prev];
        nextItems.forEach((p) => {
          const key = String(p?.id || '');
          if (!key || seen.has(key)) return;
          seen.add(key);
          merged.push(p);
        });
        return merged;
      });
      setExploreOffset((prev) => prev + nextItems.length);
      setExploreHasMore(nextItems.length === 6);
    } finally {
      setExploreLoading(false);
    }
  };

  const goToSlide = (delta) => {
    setHeroPosition((position) => (position + delta + heroSlides.length) % heroSlides.length);
  };

  const handleHeroImageLoad = (slideId, event) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) return;
    const ratio = image.naturalWidth / image.naturalHeight;
    heroRatiosRef.current.set(slideId, ratio);
    const activeSlide = heroSlides[heroPosition % heroSlides.length];
    if (activeSlide?.id === slideId) setHeroAspectRatio(ratio);
  };

  useEffect(() => {
    const activeSlide = heroSlides[heroPosition % heroSlides.length];
    setHeroAspectRatio(activeSlide ? heroRatiosRef.current.get(activeSlide.id) || null : null);
  }, [heroPosition, heroSlides]);

  const handleCouponClick = () => {
    window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
  };

  const topDeals = useMemo(() => {
    const fashionOnly = (Array.isArray(deals) ? deals : []).filter(isFashionProduct);
    const enriched = fashionOnly.map((item) => {
      const price = Number(item?.discount_price ?? item?.price ?? 0);
      const mrp = Number(item?.price ?? item?.original_price ?? price);
      const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
      const brand = (item?.brand || '').toString().trim().toLowerCase();
      const isSouledStore = brand === 'the souled store' || brand === 'souled store';
      return { ...item, _discount: discount, _isSouledStore: isSouledStore };
    });

    // Only discounted products belong on this rail.
    const discountedOnly = enriched.filter((item) => item._discount > 0);

    // Rank by discount first, then take a generous pool from the top so
    // there's enough to rotate from, and reshuffle that pool using a seed
    // tied to today's date — the selection/order changes once every 24
    // hours (at local midnight) without needing a backend change.
    const ranked = [...discountedOnly].sort((a, b) => b._discount - a._discount);
    const pool = ranked.slice(0, Math.max(40, Math.min(80, ranked.length)));

    // Shuffle the pool for daily rotation, then pull Souled Store items to
    // the very front so they always lead the rail, while the rest of the
    // rotation order (including the relative order of the remaining items)
    // stays untouched.
    const rotated = seededShuffle(pool, todaysSeed());
    const souledFirst = rotated.filter((item) => item._isSouledStore);
    const others = rotated.filter((item) => !item._isSouledStore);
    return [...souledFirst, ...others].slice(0, 40);
  }, [deals]);

  const recentlyViewedProducts = useMemo(() => {
    return recentlyViewedProductsData
      .map((p) => ({ ...p, id: p.id }))
      .filter((p) => p.id)
      .slice(0, 8);
  }, [recentlyViewedProductsData]);

  // NEW ON BLINKIEFASH — show ALL newest products (mixed brands), no discount/Palermo filter
  const newOnBlinkiefash = useMemo(() => {
    const unique = [];
    const seen = new Set();
    (Array.isArray(newProducts) ? newProducts : []).forEach((product) => {
      const key = String(product?.id || product?.variant_id || '');
      if (!key || seen.has(key)) return;
      seen.add(key);
      unique.push(product);
    });
    return seededShuffle(unique, homeRotationSeed).slice(0, 40);
  }, [homeRotationSeed, newProducts]);

  const dealVisibleBrands = useMemo(() => {
    const search = dealBrandSearch.trim().toLowerCase();
    return (topBrands || []).filter((brand) => (brand?.name || '').toLowerCase().includes(search));
  }, [topBrands, dealBrandSearch]);

  const filteredTopDeals = useMemo(() => {
    const filters = appliedDealFilters;
    return topDeals.filter((product) => {
      const brand = String(product?.brand || '').trim().toLowerCase();
      const color = String(product?.color || '').trim().toLowerCase();
      const gender = String(product?.gender || '').trim().toLowerCase();
      const price = Number(product?.discount_price ?? product?.price ?? 0);
      const discount = Number(product?._discount || product?.discount || 0);

      if (filters.brand.length && !filters.brand.some((value) => String(value).toLowerCase() === brand)) return false;
      if (filters.color.length && color && !filters.color.some((value) => String(value).toLowerCase() === color)) return false;
      if (filters.gender.length && gender && !filters.gender.some((value) => String(value).toLowerCase() === gender)) return false;
      if (filters.minDiscount > 0 && discount < filters.minDiscount) return false;
      if (filters.inStockOnly && product?.in_stock === false) return false;
      if (price > filters.maxPrice) return false;
      return true;
    });
  }, [topDeals, appliedDealFilters]);

  const dealActiveFilterCount =
    appliedDealFilters.brand.length +
    appliedDealFilters.color.length +
    appliedDealFilters.gender.length +
    (appliedDealFilters.minDiscount > 0 ? 1 : 0) +
    (appliedDealFilters.inStockOnly ? 1 : 0) +
    (appliedDealFilters.maxPrice < 10000 ? 1 : 0);

  const clearDealFilters = () => {
    setDealActiveBrand([]);
    setDealActiveColor([]);
    setDealActiveGender([]);
    setDealMinDiscount(0);
    setDealInStockOnly(false);
    setDealMaxPrice(10000);
    setDealBrandSearch('');
    setAppliedDealFilters({
      brand: [],
      color: [],
      gender: [],
      minDiscount: 0,
      inStockOnly: false,
      maxPrice: 10000,
    });
  };

  const applyDealFilters = () => {
    setAppliedDealFilters({
      brand: dealActiveBrand,
      color: dealActiveColor,
      gender: dealActiveGender,
      minDiscount: dealMinDiscount,
      inStockOnly: dealInStockOnly,
      maxPrice: dealMaxPrice,
    });
    setDealFilterOpen(false);
  };

  const recommendedProducts = useMemo(() => {
    if (!isLoggedIn || !userGender) return [];
    const normalizedGender = (userGender || '').toLowerCase().trim();
    if (normalizedGender === 'women') return womensProducts.slice(0, 40);
    if (normalizedGender === 'men') return mensProducts.slice(0, 40);
    return [];
  }, [isLoggedIn, userGender, womensProducts, mensProducts]);

  // Products actually shown per audience section: the fetched subcategory
  // products when a subcategory pill is active for that section, otherwise
  // the section's default top-level collection products.
  const getSectionDisplay = (audienceKey, defaultProducts) => {
    const subcategory = sectionSubFilters[audienceKey];
    if (subcategory) return { products: subcategory.products, loading: subcategory.loading };
    const category = sectionCategoryFilters[audienceKey];
    if (category) return { products: category.products, loading: category.loading };
    return { products: defaultProducts, loading: false };
  };
  const mensDisplay = getSectionDisplay('Men', mensProducts);
  const womensDisplay = getSectionDisplay('Women', womensProducts);
  const kidsDisplay = getSectionDisplay('Kids', kidsProducts);
  const electronicsDisplay = getSectionDisplay('Electronics', electronicsProducts);
  const trendyShoesDisplay = getSectionDisplay('Trendy Shoes', trendyShoesProducts);
  const mensDisplayProducts = mensDisplay.products;
  const mensDisplayLoading = mensDisplay.loading;
  const womensDisplayProducts = womensDisplay.products;
  const womensDisplayLoading = womensDisplay.loading;
  const kidsDisplayProducts = kidsDisplay.products;
  const kidsDisplayLoading = kidsDisplay.loading;
  const electronicsDisplayProducts = electronicsDisplay.products;
  const electronicsDisplayLoading = electronicsDisplay.loading;
  const trendyShoesDisplayProducts = trendyShoesDisplay.products;
  const trendyShoesDisplayLoading = trendyShoesDisplay.loading;

  return (
    <div className={`hp${loading ? ' hp-loading' : ''}`}>
      <PageSEO
        title="India's Fashion Marketplace | 60-Minute Fashion Delivery"
        description="Shop from brands, boutiques & local stores. Get eligible fashion delivered in as little as 60 minutes."
        path="/"
      />
      {loading ? <Loader overlay /> : null}
      <Navbar />
      <main className="hp-main">
        <section className="hp-coupon-section">
          <button type="button" className="hp-coupon-banner" onClick={handleCouponClick} aria-label="Open Blinkiefash app on Play Store for exclusive coupon">
            <img src={couponImage} alt="Exclusive app coupon" className="hp-coupon-img" loading="lazy" />
          </button>
        </section>

        <section
          className="hp-hero-carousel"
          style={heroAspectRatio ? { '--hp-hero-ratio': heroAspectRatio } : undefined}
        >
          <button type="button" className="hp-hero-arrow left" onClick={() => goToSlide(-1)} aria-label="Previous">
            <MdChevronLeft />
          </button>
          <div className="hp-hero-track" ref={heroTrackRef}>
            {heroSlides.map((slide) => {
              const content = (
                <>
                  <picture className="hp-slide-bg" aria-hidden="true">
                    {slide.mobileImage ? <source media="(max-width: 767px)" srcSet={slide.mobileImage} /> : null}
                    <img src={slide.image} alt="" draggable={false} />
                  </picture>
                  <picture className="hp-slide-fg">
                    {slide.mobileImage ? <source media="(max-width: 767px)" srcSet={slide.mobileImage} /> : null}
                    <img
                      src={slide.image}
                      alt={slide.title || ''}
                      className="hp-slide-img"
                      style={slide.pos ? { objectPosition: slide.pos } : undefined}
                      draggable={false}
                      onLoad={(event) => handleHeroImageLoad(slide.id, event)}
                    />
                  </picture>
                </>
              );
              if (slide.hotspots) {
                return (
                  <div key={slide.id} className="hp-slide hp-slide-first">
                    {content}
                    <button type="button" className="hp-hero-hotspot hp-hero-hotspot-men" onClick={() => navigate('/men')} aria-label="Shop men's fashion" />
                    <button type="button" className="hp-hero-hotspot hp-hero-hotspot-women" onClick={() => navigate('/women')} aria-label="Shop women's fashion" />
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  key={slide.id}
                  className="hp-slide"
                  onClick={() => navigate(slide.brand ? `/brands/${encodeURIComponent(slide.brand)}` : slide.to)}
                >
                  {content}
                </button>
              );
            })}
          </div>
          <button type="button" className="hp-hero-arrow right" onClick={() => goToSlide(1)} aria-label="Next">
            <MdChevronRight />
          </button>
          <div className="hp-hero-dots">
            {heroSlides.map((slide, i) => (
              <span
                key={slide.id}
                className={`hp-hero-dot${i === heroPosition % heroSlides.length ? ' active' : ''}`}
                onClick={() => setHeroPosition(i)}
              />
            ))}
          </div>
        </section>

        {error && <p className="state-msg">{error}</p>}
        {loading && <Loader label="Loading todays picks..." />}

        {topDeals.length > 0 && (
          <section className="section">
            <SectionHead
              icon={dealsOfTheDayIcon}
              iconAlt="Deals of the day"
              iconClassName="hp-shead-mark-deals"
              title="Deals of the"
              accentWord="Day"
              onViewAll={() => navigate('/deals-of-the-day')}
              trailing={
                <div className="hp-deals-timer" aria-live="polite">
                  <span className="hp-deals-timer-label">Deal Ends in</span>
                  <span className="hp-deals-timer-value">{dealsCountdown}</span>
                </div>
              }
              headerActions={
                <button
                  type="button"
                  className={`catalog-filter-toggle ${dealFilterOpen || dealActiveFilterCount ? 'active' : ''}`}
                  onClick={() => {
                    if (!dealFilterOpen) {
                      setDealActiveBrand(appliedDealFilters.brand);
                      setDealActiveColor(appliedDealFilters.color);
                      setDealActiveGender(appliedDealFilters.gender);
                      setDealMinDiscount(appliedDealFilters.minDiscount);
                      setDealInStockOnly(appliedDealFilters.inStockOnly);
                      setDealMaxPrice(appliedDealFilters.maxPrice);
                    }
                    setDealFilterOpen((open) => !open);
                  }}
                >
                  <MdTune /> Filter
                  {dealActiveFilterCount > 0 ? (
                    <span className="catalog-filter-count">{dealActiveFilterCount}</span>
                  ) : null}
                </button>
              }
            />
            {dealFilterOpen ? (
              <Filter
                prefix="catalog"
                ariaLabel="Deals of the Day filters"
                brands={topBrands}
                visibleBrands={dealVisibleBrands}
                availableGenders={['Men', 'Women', 'Kids', 'Unisex']}
                activeBrand={dealActiveBrand}
                setActiveBrand={setDealActiveBrand}
                activeColor={dealActiveColor}
                setActiveColor={setDealActiveColor}
                activeGender={dealActiveGender}
                setActiveGender={setDealActiveGender}
                minDiscount={dealMinDiscount}
                setMinDiscount={setDealMinDiscount}
                inStockOnly={dealInStockOnly}
                setInStockOnly={setDealInStockOnly}
                maxPrice={dealMaxPrice}
                setMaxPrice={setDealMaxPrice}
                brandSearch={dealBrandSearch}
                setBrandSearch={setDealBrandSearch}
                activeFilterCount={dealActiveFilterCount}
                clearAllFilters={clearDealFilters}
                applyFilters={applyDealFilters}
                onClose={() => setDealFilterOpen(false)}
              />
            ) : null}
            <ProductRail items={filteredTopDeals} keyPrefix="deal" railRef={dealsRef} limit={30} />
          </section>
        )}

        <section className="section hp-rewards-section">
          <div className="hp-rewards-grid">
            <button
              type="button"
              className="hp-reward-image-card"
              onClick={() => handleRewardCardClick('spin')}
            >
              <img src={spinAndWinImage} alt="Spin and win up to 500 rupees off" />
            </button>
            <button
              type="button"
              className="hp-reward-image-card"
              onClick={() => handleRewardCardClick('play')}
            >
              <img src={playAndWinImage} alt="Play and win up to 250 rupees off" />
            </button>
            <button
              type="button"
              className="hp-reward-image-card"
              onClick={() => handleRewardCardClick('refer')}
            >
              <img src={referAndEarnImage} alt="Refer a friend and both get 100 rupees off" />
            </button>
            <button type="button" className="hp-reward-image-card" onClick={() => navigate('/shop')}>
              <img src={freeDeliveryImage} alt="Free delivery on orders above 1499 rupees" />
            </button>
          </div>
        </section>

        {topBrands.length > 0 && (
          <section className="section hp-shop-brands-section" aria-label="Shop by brands">
            <SectionHead icon={shopByBrandIcon} iconAlt="Shop by brands" title="Shop by" accentWord="Brands" onViewAll={() => navigate('/shop')} />
            <div className="hp-shop-brands-container">
              <button
                className="hp-brands-scroll-btn hp-brands-scroll-left"
                onClick={scrollBrandsLeft}
                aria-label="Scroll brands left"
                type="button"
              >
                <MdChevronLeft size={24} />
              </button>
              <div className={`hp-shop-brands-wrap${brandsPaused ? ' is-paused' : ''}`} ref={brandsWrapRef} onMouseEnter={pauseBrandCarousel} onFocus={pauseBrandCarousel}>
                {brandRows.map((row, rowIndex) => {
                  const loopedRow = [...row, ...row];
                  return (
                    <div className="hp-shop-brands-row" key={`brand-row-${rowIndex}`} role="list">
                      <div className={`hp-shop-brands-track ${rowIndex === 0 ? 'move-right' : 'move-left'}`}>
                        {loopedRow.map((brand, idx) => {
                          const label = (brand.name || '').toString().trim();
                          const displayName = label || 'Brand';
                          const normalizedDisplayName = normalizeBrandName(displayName);
                          const logo = normalizedDisplayName === 'nike' ? NIKE_LOGO_URL : resolveImageUrl(brand.logo_url || brand.image);
                          const isFeatured = idx === 0;
                          return (
                            <article
                              key={`${brand.id || displayName}-${rowIndex}-${idx}`}
                              className={`hp-shop-brand-card${isFeatured ? ' featured' : ''}`}
                              role="listitem"
                              tabIndex={0}
                              style={{ cursor: 'pointer' }}
                              onClick={() => navigate(`/brands/${encodeURIComponent(displayName)}`)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                  e.preventDefault();
                                  navigate(`/brands/${encodeURIComponent(displayName)}`);
                                }
                              }}
                            >
                              <div className="hp-shop-brand-visual">
                                {logo ? (
                                  <img src={logo} alt={displayName} loading="lazy" className={`hp-shop-brand-logo${normalizedDisplayName === 'nike' ? ' hp-shop-brand-nike-logo' : ''}`} />
                                ) : (
                                  <div className="hp-shop-brand-fallback" aria-label={displayName}>{displayName.slice(0, 5).toUpperCase()}</div>
                                )}
                              </div>
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                className="hp-brands-scroll-btn hp-brands-scroll-right"
                onClick={scrollBrandsRight}
                aria-label="Scroll brands right"
                type="button"
              >
                <MdChevronRight size={24} />
              </button>
            </div>
          </section>
        )}

        <section className="section hp-universe-section" aria-label="Blinkiefash Universe">
          <div className="hp-universe-explore-row">
            <span className="hp-universe-line" />
            <span className="hp-universe-explore-text">E X P L O R E</span>
            <span className="hp-universe-line" />
          </div>
          <h2 className="hp-universe-title" aria-label="Blinkiefash Universe">
            <span>BLINKIE</span>
            <span className="hp-universe-accent">FASH</span>
          </h2>
          <p className="hp-universe-subtitle">✦ U N I V E R S E ✦</p>
          <p className="hp-universe-tagline">Top Brands · Latest Styles · Handpicked for You.</p>
        </section>

        <section className="section hp-brand-grid-section" aria-label="Universe brand banners">
          <div className="hp-brand-grid">
            {UNIVERSE_BRANDS.map((brand) => (
              <button key={brand.name} type="button" className="hp-brand-banner" onClick={() => navigate(brand.to)} aria-label={`Explore ${brand.name}`}>
                <img src={brand.image} alt={`${brand.name} banner`} loading="lazy" style={brand.pos ? { objectPosition: brand.pos } : undefined} />
              </button>
            ))}
          </div>
        </section>

        {recommendedProducts.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              title="Picks for"
              accentWord={userGender?.toLowerCase() === 'women' ? 'Her' : 'Him'}
              onViewAll={() => navigate(userGender?.toLowerCase() === 'women' ? '/women' : '/men')}
            />
            <ProductRail items={recommendedProducts} keyPrefix="recommended" limit={40} />
          </section>
        )}

        {recentlyViewedProducts.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={recentlyViewedIcon} iconAlt="Recently viewed" title="Recently" accentWord="Viewed" onViewAll={() => navigate('/shop')} />
            <ProductRail items={recentlyViewedProducts} keyPrefix="recent" railRef={recentlyViewedRailRef} />
          </section>
        )}

        {newOnBlinkiefash.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={newOnBlinkiefashIcon} iconAlt="New on Blinkiefash" title="New on" accentWord="Blinkiefash" onViewAll={() => navigate('/shop?sort=newest')} />
            <ProductRail items={newOnBlinkiefash} keyPrefix="new" railRef={newOnBlinkiefashRailRef} limit={40} />
          </section>
        )}

        {(mensProducts.length > 0 || mensCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={mensCollectionIcon} iconAlt="Men's collection" title="Men's" accentWord="Collection" onViewAll={() => navigate('/men')} />
            <CategoryChipsRail
              chips={mensCats}
              audienceLabel="Men"
              activeId={activeCollectionCats.Men ?? mensCats[0]?.id}
              onChipSelect={(id) => handleMainCategorySelect('Men', id)}
              activeSubId={sectionSubFilters.Men?.subId}
              onSubSelect={(id) => handleSubcategorySelect('Men', id)}
            />
            {mensDisplayLoading ? (
              <Loader label="Loading products..." />
            ) : mensDisplayProducts.length > 0 ? (
              <ProductRail items={mensDisplayProducts} keyPrefix="men" limit={40} />
            ) : sectionSubFilters.Men || sectionCategoryFilters.Men ? (
              <p className="hp-location-sheet-muted">No products in this subcategory yet.</p>
            ) : null}
          </section>
        )}

        {(womensProducts.length > 0 || womensCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={womensCollectionIcon} iconAlt="Women's collection" title="Women's" accentWord="Collection" onViewAll={() => navigate('/women')} />
            <CategoryChipsRail
              chips={womensCats}
              audienceLabel="Women"
              activeId={activeCollectionCats.Women ?? womensCats[0]?.id}
              onChipSelect={(id) => handleMainCategorySelect('Women', id)}
              activeSubId={sectionSubFilters.Women?.subId}
              onSubSelect={(id) => handleSubcategorySelect('Women', id)}
            />
            {womensDisplayLoading ? (
              <Loader label="Loading products..." />
            ) : womensDisplayProducts.length > 0 ? (
              <ProductRail items={womensDisplayProducts} keyPrefix="women" limit={40} />
            ) : sectionSubFilters.Women || sectionCategoryFilters.Women ? (
              <p className="hp-location-sheet-muted">No products in this subcategory yet.</p>
            ) : null}
          </section>
        )}

        {(kidsProducts.length > 0 || kidsCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={kidsCollectionIcon} iconAlt="Kids collection" title="Kids" accentWord="Collection" onViewAll={() => navigate('/kids')} />
            <CategoryChipsRail
              chips={kidsCats}
              audienceLabel="Kids"
              activeId={activeCollectionCats.Kids ?? kidsCats[0]?.id}
              onChipSelect={(id) => handleMainCategorySelect('Kids', id)}
              activeSubId={sectionSubFilters.Kids?.subId}
              onSubSelect={(id) => handleSubcategorySelect('Kids', id)}
            />
            {kidsDisplayLoading ? (
              <Loader label="Loading products..." />
            ) : kidsDisplayProducts.length > 0 ? (
              <ProductRail items={kidsDisplayProducts} keyPrefix="kids" limit={40} />
            ) : sectionSubFilters.Kids || sectionCategoryFilters.Kids ? (
              <p className="hp-location-sheet-muted">No products in this subcategory yet.</p>
            ) : null}
          </section>
        )}

        {(electronicsProducts.length > 0 || electronicsCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={electronicsCollectionIcon} iconAlt="Electronics collection" title="Electronics" accentWord="Collection" onViewAll={() => navigate('/electronics')} />
            <CategoryChipsRail
              chips={electronicsCats}
              audienceLabel="Electronics"
              activeId={activeCollectionCats.Electronics ?? electronicsCats[0]?.id}
              onChipSelect={(id) => handleMainCategorySelect('Electronics', id)}
              activeSubId={sectionSubFilters.Electronics?.subId}
              onSubSelect={(id) => handleSubcategorySelect('Electronics', id)}
            />
            {electronicsDisplayLoading ? (
              <Loader label="Loading products..." />
            ) : electronicsDisplayProducts.length > 0 ? (
              <ProductRail items={electronicsDisplayProducts} keyPrefix="electronics" limit={40} />
            ) : sectionSubFilters.Electronics || sectionCategoryFilters.Electronics ? (
              <p className="hp-location-sheet-muted">No products in this subcategory yet.</p>
            ) : null}
          </section>
        )}

        {(trendyShoesProducts.length > 0 || trendyShoesCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={trendyShoesIcon} iconAlt="Trendy shoes" title="Trendy" accentWord="Shoes" onViewAll={() => navigate('/footwear')} />
            <CategoryChipsRail
              chips={trendyShoesCats}
              audienceLabel="Trendy Shoes"
              activeId={activeCollectionCats['Trendy Shoes'] ?? trendyShoesCats[0]?.id}
              onChipSelect={(id) => handleMainCategorySelect('Trendy Shoes', id)}
              activeSubId={sectionSubFilters['Trendy Shoes']?.subId}
              onSubSelect={(id) => handleSubcategorySelect('Trendy Shoes', id)}
            />
            {trendyShoesDisplayLoading ? (
              <Loader label="Loading products..." />
            ) : trendyShoesDisplayProducts.length > 0 ? (
              <ProductRail items={trendyShoesDisplayProducts} keyPrefix="shoes" limit={40} />
            ) : sectionSubFilters['Trendy Shoes'] || sectionCategoryFilters['Trendy Shoes'] ? (
              <p className="hp-location-sheet-muted">No products in this subcategory yet.</p>
            ) : null}
          </section>
        )}

        {under999Products.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={under999Icon} iconAlt="Under ₹999" title="Under" accentWord="₹999" onViewAll={() => navigate('/shop?max_price=999&sort=newest')} />
            <ProductRail items={under999Products} keyPrefix="under999" limit={40} />
          </section>
        )}

        {under1999Products.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead icon={priceRangeIcon} iconAlt="₹999 to ₹1999" title="₹999 –" accentWord="₹1999" onViewAll={() => navigate('/shop?min_price=1000&max_price=1999&sort=newest')} />
            <ProductRail items={under1999Products} keyPrefix="under1999" limit={40} />
          </section>
        )}

        <section className="section hp-feed-rail-section">
          <SectionHead icon={moreToExploreIcon} iconAlt="More to explore" title="More to" accentWord="Explore" onViewAll={() => navigate('/shop')} />
          <div className="hp-explore-chips" role="list">
            {[{ id: '', name: 'All' }, ...categories].map((cat, idx) => {
              const selected = exploreCatChipIndex === idx;
              return (
                <button
                  key={`${cat.id || 'all'}-${idx}`}
                  type="button"
                  className={`hp-explore-chip${selected ? ' active' : ''}`}
                  role="listitem"
                  onClick={() => {
                    setExploreCatChipIndex(idx);
                    setExploreCatId(cat.id ? String(cat.id) : '');
                  }}
                >
                  {cat.name}
                </button>
              );
            })}
          </div>
          {exploreProducts.length > 0 ? (
            <div className="hp-explore-grid" role="list">
              {exploreProducts.map((p, idx) => (
                <ProductCard key={`explore-${p.id}-${idx}`} product={p} />
              ))}
              {exploreLoading ? Array.from({ length: 3 }).map((_, idx) => <ProductCardSkeleton key={`explore-skeleton-loading-${idx}`} />) : null}
            </div>
          ) : !exploreLoading ? (
            <p className="hp-location-sheet-muted">No products in this category yet.</p>
          ) : (
            <div className="hp-explore-grid" role="list">
              {Array.from({ length: 6 }).map((_, idx) => <ProductCardSkeleton key={`explore-skeleton-initial-${idx}`} />)}
            </div>
          )}
          {!exploreLoading && exploreHasMore ? (
            <button type="button" className="hp-explore-more" onClick={loadMoreExploreProducts}>Show More Products</button>
          ) : null}
        </section>

        <Footer />
      </main>

      {rewardLoginPrompt && (
        <div
          className="hp-reward-modal-backdrop"
          onClick={() => setRewardLoginPrompt(null)}
          role="presentation"
        >
          <div
            className="hp-reward-modal"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <button
              type="button"
              className="hp-reward-modal-back"
              onClick={() => setRewardLoginPrompt(null)}
            >
              <MdChevronLeft /> Back
            </button>

            <img
              src={REWARD_LOGIN_PROMPTS[rewardLoginPrompt].image}
              alt=""
              className="hp-reward-modal-img"
            />

            <button
              type="button"
              className="hp-reward-modal-login-btn"
              onClick={() => {
                const redirectTo = REWARD_LOGIN_PROMPTS[rewardLoginPrompt].to;
                setRewardLoginPrompt(null);
                navigate('/login', { state: { redirectTo } });
              }}
            >
              <MdLogin /> {REWARD_LOGIN_PROMPTS[rewardLoginPrompt].cta}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function CategoryChipsRail({ chips, audienceLabel, activeId, onChipSelect, activeSubId, onSubSelect }) {
  const chipsRef = useRef(null);
  if (!Array.isArray(chips) || chips.length === 0) return null;
  const activeCat = chips.find((cat) => String(cat.id) === String(activeId)) || chips[0];
  const scrollBy = (dir) => scrollRailByCards(chipsRef.current, dir, 6);

  return (
    <div className="hp-collection-chip-group">
      <div className="hp-deals-wrap">
        <button type="button" className="hp-deals-prev" aria-label={`Scroll ${audienceLabel} categories left`} onClick={() => scrollBy(-1)}>
          <MdChevronLeft />
        </button>
        <div className="hp-collection-chips" role="list" ref={chipsRef}>
          {chips.map((cat, idx) => {
            const icon = resolveImageUrl(cat.image);
            const fallback = chipFallbackIcon(cat.name, audienceLabel);
            const isActive = String(cat.id) === String(activeId);
            return (
              <button
                key={`${cat.id || cat.name || 'chip'}-${idx}`}
                type="button"
                className={`hp-collection-chip${isActive ? ' active' : ''}`}
                role="listitem"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onChipSelect(cat.id, cat.categoryIds);
                }}
              >
                <span className="hp-collection-chip-icon" aria-hidden="true">
                  {icon ? <img src={icon} alt="" loading="lazy" /> : <span>{fallback}</span>}
                </span>
                <span className="hp-collection-chip-label">{cat.name}</span>
              </button>
            );
          })}
        </div>
        <button type="button" className="hp-deals-next" aria-label={`Scroll ${audienceLabel} categories right`} onClick={() => scrollBy(1)}>
          <MdChevronRight />
        </button>
      </div>
      {Array.isArray(activeCat?.subcategories) && activeCat.subcategories.length > 0 ? (
        <div className="hp-subcat-rail" role="list" aria-label={`${activeCat.name} sub categories`}>
          {activeCat.subcategories.map((sub, subIdx) => {
            const subImg = resolveImageUrl(sub.image);
            const subFallback = chipFallbackIcon(sub.name, audienceLabel);
            const isSubActive = String(sub.id) === String(activeSubId);
            return (
              <button
                key={`${sub.id || sub.name || 'sub'}-${subIdx}`}
                type="button"
                className={`hp-subcat-chip${isSubActive ? ' active' : ''}`}
                role="listitem"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  onSubSelect(sub.id, sub.categoryIds);
                }}
              >
                <span className="hp-subcat-chip-icon" aria-hidden="true">
                  {subImg ? <img src={subImg} alt="" loading="lazy" /> : <span>{subFallback}</span>}
                </span>
                <span className="hp-subcat-chip-label">{sub.name}</span>
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

function ProductRail({ items, keyPrefix, railRef: externalRef, limit = 10 }) {
  const internalRef = useRef(null);
  const railRef = externalRef || internalRef;
  const list = (Array.isArray(items) ? items : []).slice(0, limit);
  if (list.length === 0) return null;

  return (
    <div className="hp-deals-wrap">
      <button type="button" className="hp-deals-prev" aria-label="Previous" onClick={() => scrollRailByCards(railRef.current, -1, 6)}>
        <MdChevronLeft />
      </button>
      <div className={`hp-deals-rail${keyPrefix === 'recent' ? ' is-recently-viewed' : ''}`} role="list" ref={railRef}>
        {list.map((p, idx) => (
          <ProductCard key={`${keyPrefix}-${p.id}-${idx}`} product={p} isNew={keyPrefix === 'new'} />
        ))}
      </div>
      <button type="button" className="hp-deals-next" aria-label="Next" onClick={() => scrollRailByCards(railRef.current, 1, 6)}>
        <MdChevronRight />
      </button>
    </div>
  );
}