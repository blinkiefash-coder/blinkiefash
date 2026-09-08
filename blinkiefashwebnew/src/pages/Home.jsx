import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdChevronRight,
  MdChevronLeft,
} from 'react-icons/md';

import Loader from '../components/Loader';
import Footer from '../components/Footer';
import PageSEO from '../components/PageSEO';
import Navbar from '../components/Navbar';
import ProductCard, { ProductCardSkeleton } from '../components/ProductCard';
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

// ---- Section heading icons (replace filenames below with your actual
// asset names if they differ from this guess) ----
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

import './Shop.css';
import './Home.css';

const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.blinkiefash.app';

function resolveImageUrl(raw) {
  const value = (raw ?? '').toString().trim();
  if (!value) return null;
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

const HERO_SLIDES = [
  {
    id: 'hero-men-women',
    image: banner1,
    mobileImage: mobilebanner1,
    to: '/shop?search=men%women',
    pos: 'center',
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

function SectionHead({ icon, title, accentWord, subtitle, viewAllLabel = 'View All', onViewAll }) {
/**
 * Deterministic "random" shuffle seeded by a number, so the same seed
 * always produces the same order. Used to rotate Deals of the Day once
 * per calendar day without needing any backend change.
 */
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

/** Numeric seed that changes once every calendar day (YYYYMMDD). */
function todaysSeed() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}

/** Milliseconds remaining until local midnight (when deals rotate). */
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

// Keywords that flag a product as NOT fashion, so Deals of the Day
// stays clothing/footwear/accessories only.
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

/**
 * Unified section heading, used by every rail on the home page (Deals,
 * Shop by Brands, Picks for You, Recently Viewed, New In, the audience
 * collections, price bands, Top Brands, More to Explore). Mirrors the
 * "Shop by Brands" heading style everywhere so the page reads as one
 * consistent system instead of a mix of header treatments.
 *
 * `icon` is expected to be an imported image (png/svg) — it's rendered
 * inside the rounded `hp-shead-mark` badge via `hp-shead-mark-img`.
 */
function SectionHead({ icon, iconAlt = '', title, accentWord, viewAllLabel = 'View All', onViewAll, iconClassName }) {
  return (
    <div className="hp-shead">
      <div className="hp-shead-title-group">
        <div className="hp-shead-title-wrap">
          {icon ? (
            <span className={`hp-shead-mark${iconClassName ? ` ${iconClassName}` : ''}`} aria-hidden="true">
              <img src={icon} alt={iconAlt} className="hp-shead-mark-img" />
            </span>
          ) : null}
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
        </div>
      </div>
      {onViewAll ? (
        <button type="button" className="hp-shead-action" onClick={onViewAll}>
          {viewAllLabel} <MdChevronRight />
        </button>
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
  const [pinnedNewProduct, setPinnedNewProduct] = useState(() => c?.pinnedNewProduct ?? null);
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
  const [under999Products, setUnder999Products] = useState(() => c?.under999Products ?? []);
  const [under1999Products, setUnder1999Products] = useState(() => c?.under1999Products ?? []);
  const [topBrands, setTopBrands] = useState(() => c?.topBrands ?? []);
  const [exploreCatChipIndex, setExploreCatChipIndex] = useState(0);
  const [exploreCatId, setExploreCatId] = useState('');
  const [exploreProducts, setExploreProducts] = useState([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [exploreHasMore, setExploreHasMore] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [loading, setLoading] = useState(!_homeCache);
  const [error, setError] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPosition, setHeroPosition] = useState(0);
  const [recentlyViewedProductsData, setRecentlyViewedProductsData] = useState([]);

  const [dealsCountdown, setDealsCountdown] = useState(() => formatCountdown(getMsUntilMidnight()));

  const [brandsPaused, setBrandsPaused] = useState(false);

  const heroTrackRef = useRef(null);
  const dealsRef = useRef(null);
  const brandsPauseTimerRef = useRef(null);
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
      if (!isLoggedIn) {
        removeThemeVariables();
      }
    };
  }, [isLoggedIn, userGender]);

  // Deals of the Day: countdown to the next daily refresh (local midnight).
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

    return () => {
      cancelled = true;
    };
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
                name: (c?.name || '').toString().trim(),
                image: c.category_url || c.image || '',
              }))
              .filter((c) => c.name)
              .slice(0, 6);

          return allCats
            .filter((c) => String(c.parent_id) === String(rootId))
            .map((c) => ({
              id: c.id,
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
            limit: 10,
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
          fetchCollection('Footwear', 'shoes sneakers sandals footwear'),
          getProducts({ min_price: 0, max_price: 999, limit: 10, sort: 'price_asc' }),
          getProducts({ min_price: 1000, max_price: 1999, limit: 10, sort: 'price_asc' }),
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
        const dealsPoolRes = await getProducts({ sort: 'newest', limit: 100 });
        const dealsPool = dealsPoolRes?.products || (Array.isArray(dealsPoolRes) ? dealsPoolRes : []);
        if (Array.isArray(dealsPool) && dealsPool.length > 0) {
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
        const brandsList = [...brandsSource].sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
        );

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
        const freshShoesCats = childCatsFor('Footwear');

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
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const timer = setInterval(() => {
      setHeroPosition((position) => (position + 1) % HERO_SLIDES.length);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  // Fixed scroll calculation – measures the active slide instead of always the first one
  useEffect(() => {
    const track = heroTrackRef.current;
    if (!track) return;

    const slides = track.querySelectorAll('.hp-slide');
    if (!slides.length) return;

    const active = slides[heroPosition % slides.length] || slides[0];
    const gap = parseFloat(window.getComputedStyle(track).gap || '0') || 0;
    const step = active.getBoundingClientRect().width + gap;

    track.scrollTo({ left: heroPosition * step, behavior: 'smooth' });
    setHeroIndex(heroPosition % HERO_SLIDES.length);
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
    return () => {
      cancelled = true;
    };
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
    setHeroPosition((position) => {
      return (position + delta + HERO_SLIDES.length) % HERO_SLIDES.length;
    });
  };

  const handleCouponClick = () => {
    window.open(PLAY_STORE_URL, '_blank', 'noopener,noreferrer');
  };

  const topDeals = useMemo(() => {
    const fashionOnly = (Array.isArray(deals) ? deals : []).filter(isFashionProduct);

    const enriched = fashionOnly.map((item) => {
      const price = Number(item?.discount_price ?? item?.price ?? 0);
      const mrp = Number(item?.price ?? item?.original_price ?? price);
      const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
      return { ...item, _discount: discount };
    });

    // Rank by discount first, then take a generous pool from the top so
    // there's enough to rotate from, and reshuffle that pool using a seed
    // tied to today's date — the selection/order changes once every 24
    // hours (at local midnight) without needing a backend change.
    const ranked = [...enriched].sort((a, b) => b._discount - a._discount);
    const pool = ranked.slice(0, Math.max(30, Math.min(80, ranked.length)));
    const rotated = seededShuffle(pool, todaysSeed());
    return rotated.slice(0, 30);
  }, [deals]);

  const recentlyViewedProducts = useMemo(() => {
    return recentlyViewedProductsData
      .map((p) => ({ ...p, id: p.id }))
      .filter((p) => p.id)
      .slice(0, 8);
  }, [recentlyViewedProductsData]);

  const newOnBlinkiefash = useMemo(() => {
    const items = (Array.isArray(newProducts) ? newProducts : [])
      .map((item) => {
        const price = Number(item?.discount_price ?? item?.price ?? 0);
        const mrp = Number(item?.price ?? item?.original_price ?? price);
        const hasDiscount = mrp > 0 && price > 0 && price < mrp;
        const isPalermo = (item?.name || '').toString().toLowerCase().includes('palermo');
        return { ...item, _hasDiscount: hasDiscount, _isPalermo: isPalermo };
      })
      .filter((item) => !item._hasDiscount && !item._isPalermo);

    const pinned = pinnedNewProduct
      ? (() => {
          const price = Number(pinnedNewProduct?.discount_price ?? pinnedNewProduct?.price ?? 0);
          const mrp = Number(pinnedNewProduct?.price ?? pinnedNewProduct?.original_price ?? price);
          if (mrp > 0 && price > 0 && price < mrp) return null;
          return { ...pinnedNewProduct };
        })()
      : null;

    const rest = items.slice(0, 10 - (pinned ? 1 : 0));
    return pinned ? [pinned, ...rest] : rest;
  }, [newProducts, pinnedNewProduct]);

  const recommendedProducts = useMemo(() => {
    if (!isLoggedIn || !userGender) return [];
    
    const normalizedGender = (userGender || '').toLowerCase().trim();
    if (normalizedGender === 'women') {
      return womensProducts.slice(0, 10);
    }
    if (normalizedGender === 'men') {
      return mensProducts.slice(0, 10);
    }
    return [];
  }, [isLoggedIn, userGender, womensProducts, mensProducts]);

  return (
    <div className={`hp${loading ? ' hp-loading' : ''}`}>
      <PageSEO
        title="Fashion Delivered in 60 Minutes — Cuttack & Bhubaneswar"
        description="Shop top brands like Puma, Nike, Adidas & more. Get ethnic wear, footwear, electronics & latest styles delivered to your door in 60 minutes across Odisha."
        path="/"
      />
      {loading ? (
        <Loader overlay />
      ) : null}

      <Navbar />

      <main className="hp-main">

        <section className="hp-coupon-section">
          <button
            type="button"
            className="hp-coupon-banner"
            onClick={handleCouponClick}
            aria-label="Open Blinkiefash app on Play Store for exclusive coupon"
          >
            <img src={couponImage} alt="Exclusive app coupon" className="hp-coupon-img" loading="lazy" />
          </button>
        </section>

        <section className="hp-hero-carousel">
          <button type="button" className="hp-hero-arrow left" onClick={() => goToSlide(-1)} aria-label="Previous">
            <MdChevronLeft />
          </button>

          <div className="hp-hero-track" ref={heroTrackRef}>
            {HERO_SLIDES.map((slide, index) => {
              const isFirst = index === 0;

              const content = (
                <picture>
                  {slide.mobileImage ? (
                    <source media="(max-width: 767px)" srcSet={slide.mobileImage} />
                  ) : null}
                  <img
                    src={slide.image}
                    alt=""
                    className="hp-slide-img"
                    style={slide.pos ? { objectPosition: slide.pos } : undefined}
                    draggable={false}
                  />
                </picture>
              );

              if (isFirst) {
                return (
                  <div
                    key={slide.id}
                    className="hp-slide hp-slide-first"
                  >
                    {content}
                    <button
                      type="button"
                      className="hp-hero-hotspot hp-hero-hotspot-men"
                      onClick={() => navigate('/men')}
                      aria-label="Shop men's fashion"
                    />
                    <button
                      type="button"
                      className="hp-hero-hotspot hp-hero-hotspot-women"
                      onClick={() => navigate('/women')}
                      aria-label="Shop women's fashion"
                    />
                  </div>
                );
              }

              return (
                <button
                  type="button"
                  key={slide.id}
                  className="hp-slide"
                  onClick={() =>
                    navigate(
                      slide.brand
                        ? `/brands/${encodeURIComponent(slide.brand)}`
                        : slide.to
                    )
                  }
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
            {HERO_SLIDES.map((slide, i) => (
              <span
                key={slide.id}
                className={`hp-hero-dot${i === heroIndex ? ' active' : ''}`}
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
            />
            <div className="hp-deals-timer" aria-live="polite">
              <span className="hp-deals-timer-label">Fresh picks refresh in</span>
              <span className="hp-deals-timer-value">{dealsCountdown}</span>
            </div>
            <ProductRail items={topDeals} keyPrefix="deal" railRef={dealsRef} limit={30} />
          </section>
        )}

        <section className="section hp-rewards-section">
          <div className="hp-rewards-grid">
            <button type="button" className="hp-reward-image-card" onClick={() => navigate('/spin-wheel')}>
              <img src={spinAndWinImage} alt="Spin and win up to 500 rupees off" />
            </button>
            <button type="button" className="hp-reward-image-card" onClick={() => navigate('/play-and-win')}>
              <img src={playAndWinImage} alt="Play and win up to 250 rupees off" />
            </button>
            <button type="button" className="hp-reward-image-card" onClick={() => navigate('/refer-earn')}>
              <img src={referAndEarnImage} alt="Refer a friend and both get 100 rupees off" />
            </button>
            <button type="button" className="hp-reward-image-card" onClick={() => navigate('/shop')}>
              <img src={freeDeliveryImage} alt="Free delivery on orders above 1499 rupees" />
            </button>
          </div>
        </section>

        {topBrands.length > 0 && (
          <section className="section hp-shop-brands-section" aria-label="Shop by brands">
            <SectionHead
              icon={shopByBrandIcon}
              iconAlt="Shop by brands"
              title="Shop by"
              accentWord="Brands"
              onViewAll={() => navigate('/shop')}
            />

            <div
              className={`hp-shop-brands-wrap${brandsPaused ? ' is-paused' : ''}`}
              onMouseEnter={pauseBrandCarousel}
              onFocus={pauseBrandCarousel}
            >
              {brandRows.map((row, rowIndex) => {
                const loopedRow = [...row, ...row];
                return (
                  <div className="hp-shop-brands-row" key={`brand-row-${rowIndex}`} role="list">
                    <div className={`hp-shop-brands-track ${rowIndex === 0 ? 'move-right' : 'move-left'}`}>
                      {loopedRow.map((brand, idx) => {
                        const label = (brand.name || '').toString().trim();
                        const displayName = label || 'Brand';
                        const normalizedDisplayName = normalizeBrandName(displayName);
                        const logo = normalizedDisplayName === 'nike'
                          ? NIKE_LOGO_URL
                          : resolveImageUrl(brand.logo_url || brand.image);
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
                                <img
                                  src={logo}
                                  alt={displayName}
                                  loading="lazy"
                                  className={`hp-shop-brand-logo${normalizedDisplayName === 'nike' ? ' hp-shop-brand-nike-logo' : ''}`}
                                />
                              ) : (
                                <div className="hp-shop-brand-fallback" aria-label={displayName}>
                                  {displayName.slice(0, 5).toUpperCase()}
                                </div>
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
              <button
                key={brand.name}
                type="button"
                className="hp-brand-banner"
                onClick={() => navigate(brand.to)}
                aria-label={`Explore ${brand.name}`}
              >
                <img
                  src={brand.image}
                  alt={`${brand.name} banner`}
                  loading="lazy"
                  style={brand.pos ? { objectPosition: brand.pos } : undefined}
                />
              </button>
            ))}
          </div>
        </section>

        {recommendedProducts.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={<MdFavorite />}
              title="Picks for"
              iconAlt="Picks for you"
              title={userGender?.toLowerCase() === 'women' ? 'Picks for' : 'Picks for'}
              accentWord={userGender?.toLowerCase() === 'women' ? 'Her' : 'Him'}
              onViewAll={() => navigate(userGender?.toLowerCase() === 'women' ? '/women' : '/men')}
            />
            <ProductRail items={recommendedProducts} keyPrefix="recommended" />
          </section>
        )}

        {recentlyViewedProducts.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={recentlyViewedIcon}
              iconAlt="Recently viewed"
              title="Recently"
              accentWord="Viewed"
              onViewAll={() => navigate('/shop')}
            />
            <ProductRail items={recentlyViewedProducts} keyPrefix="recent" railRef={recentlyViewedRailRef} />
          </section>
        )}

        {newOnBlinkiefash.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={newOnBlinkiefashIcon}
              iconAlt="New on Blinkiefash"
              title="New on"
              accentWord="Blinkiefash"
              onViewAll={() => navigate('/shop?sort=newest')}
            />
            <ProductRail items={newOnBlinkiefash} keyPrefix="new" railRef={newOnBlinkiefashRailRef} />
          </section>
        )}

        {(mensProducts.length > 0 || mensCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={mensCollectionIcon}
              iconAlt="Men's collection"
              title="Men's"
              accentWord="Collection"
              onViewAll={() => navigate('/men')}
            />
            <CategoryChipsRail
              chips={mensCats}
              audienceLabel="Men"
              activeId={activeCollectionCats.Men ?? mensCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, Men: id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {mensProducts.length > 0 ? <ProductRail items={mensProducts} keyPrefix="men" /> : null}
          </section>
        )}

        {(womensProducts.length > 0 || womensCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={womensCollectionIcon}
              iconAlt="Women's collection"
              title="Women's"
              accentWord="Collection"
              onViewAll={() => navigate('/women')}
            />
            <CategoryChipsRail
              chips={womensCats}
              audienceLabel="Women"
              activeId={activeCollectionCats.Women ?? womensCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, Women: id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {womensProducts.length > 0 ? <ProductRail items={womensProducts} keyPrefix="women" /> : null}
          </section>
        )}

        {(kidsProducts.length > 0 || kidsCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={kidsCollectionIcon}
              iconAlt="Kids collection"
              title="Kids"
              accentWord="Collection"
              onViewAll={() => navigate('/kids')}
            />
            <CategoryChipsRail
              chips={kidsCats}
              audienceLabel="Kids"
              activeId={activeCollectionCats.Kids ?? kidsCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, Kids: id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {kidsProducts.length > 0 ? <ProductRail items={kidsProducts} keyPrefix="kids" /> : null}
          </section>
        )}

        {(electronicsProducts.length > 0 || electronicsCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={electronicsCollectionIcon}
              iconAlt="Electronics collection"
              title="Electronics"
              accentWord="Collection"
              onViewAll={() => navigate('/electronics')}
            />
            <CategoryChipsRail
              chips={electronicsCats}
              audienceLabel="Electronics"
              activeId={activeCollectionCats.Electronics ?? electronicsCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, Electronics: id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {electronicsProducts.length > 0 ? <ProductRail items={electronicsProducts} keyPrefix="electronics" /> : null}
          </section>
        )}

        {(trendyShoesProducts.length > 0 || trendyShoesCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={trendyShoesIcon}
              iconAlt="Trendy shoes"
              title="Trendy"
              accentWord="Shoes"
              onViewAll={() => navigate('/footwear')}
            />
            <CategoryChipsRail
              chips={trendyShoesCats}
              audienceLabel="Trendy Shoes"
              activeId={activeCollectionCats['Trendy Shoes'] ?? trendyShoesCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, 'Trendy Shoes': id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {trendyShoesProducts.length > 0 ? <ProductRail items={trendyShoesProducts} keyPrefix="shoes" /> : null}
          </section>
        )}

        {under999Products.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={under999Icon}
              iconAlt="Under ₹999"
              title="Under"
              accentWord="₹999"
              onViewAll={() => navigate('/shop?max_price=999&sort=price_asc')}
            />
            <ProductRail items={under999Products} keyPrefix="under999" />
          </section>
        )}

        {under1999Products.length > 0 && (
          <section className="section hp-feed-rail-section">
            <SectionHead
              icon={priceRangeIcon}
              iconAlt="₹999 to ₹1999"
              title="₹999 –"
              accentWord="₹1999"
              onViewAll={() => navigate('/shop?min_price=1000&max_price=1999&sort=price_asc')}
            />
            <ProductRail items={under1999Products} keyPrefix="under1999" />
          </section>
        )}

        <section className="section hp-feed-rail-section">
          <SectionHead
            icon={moreToExploreIcon}
            iconAlt="More to explore"
            title="More to"
            accentWord="Explore"
            onViewAll={() => navigate('/shop')}
          />
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
              {exploreLoading
                ? Array.from({ length: 3 }).map((_, idx) => (
                    <ProductCardSkeleton key={`explore-skeleton-loading-${idx}`} />
                  ))
                : null}
            </div>
          ) : !exploreLoading ? (
            <p className="hp-location-sheet-muted">No products in this category yet.</p>
          ) : (
            <div className="hp-explore-grid" role="list">
              {Array.from({ length: 6 }).map((_, idx) => (
                <ProductCardSkeleton key={`explore-skeleton-initial-${idx}`} />
              ))}
            </div>
          )}

          {!exploreLoading && exploreHasMore ? (
            <button type="button" className="hp-explore-more" onClick={loadMoreExploreProducts}>
              Show More Products
            </button>
          ) : null}
        </section>

        <Footer />
      </main>
    </div>
  );
}

function CategoryChipsRail({ chips, audienceLabel, activeId, onChipSelect, onSubSelect }) {
  const chipsRef = useRef(null);
  if (!Array.isArray(chips) || chips.length === 0) return null;
  const activeCat = chips.find((cat) => String(cat.id) === String(activeId)) || chips[0];

  const scrollBy = (dir) => {
    scrollRailByCards(chipsRef.current, dir, 6);
  };

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
                onClick={() => onChipSelect(cat.id)}
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
            return (
              <button
                key={`${sub.id || sub.name || 'sub'}-${subIdx}`}
                type="button"
                className="hp-subcat-chip"
                role="listitem"
                onClick={() => onSubSelect(sub.id)}
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

function ProductRail({ items, keyPrefix, railRef: externalRef }) {
/**
 * Horizontally scrollable rail of ProductCard tiles, reused across every
 * "Deals of the day / Recently viewed / New on Blinkiefash / Men's / Women's
 * / ..." row on the home page. Card rendering (image, badge, wishlist,
 * cart, price) now all comes from the shared ProductCard component.
 * `limit` controls how many items are rendered into the scroll rail — the
 * Deals of the Day rail passes 30 so its arrows/swipe reveal all 30 items
 * (including on mobile); every other rail keeps the default of 10.
 */
function ProductRail({ items, keyPrefix, railRef: externalRef, limit = 10 }) {
  const internalRef = useRef(null);
  const railRef = externalRef || internalRef;

  const list = (Array.isArray(items) ? items : []).slice(0, limit);
  if (list.length === 0) return null;

  return (
    <div className="hp-deals-wrap">
      <button
        type="button"
        className="hp-deals-prev"
        aria-label="Previous"
        onClick={() => scrollRailByCards(railRef.current, -1, 6)}
      >
        <MdChevronLeft />
      </button>

      <div
        className={`hp-deals-rail${keyPrefix === 'recent' ? ' is-recently-viewed' : ''}`}
        role="list"
        ref={railRef}
      >
        {list.map((p, idx) => (
          <ProductCard
            key={`${keyPrefix}-${p.id}-${idx}`}
            product={p}
            isNew={keyPrefix === 'new'}
          />
        ))}
      </div>

      <button
        type="button"
        className="hp-deals-next"
        aria-label="Next"
        onClick={() => scrollRailByCards(railRef.current, 1, 6)}
      >
        <MdChevronRight />
      </button>
    </div>
  );
}