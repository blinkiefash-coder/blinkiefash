import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdLocationOn,
  MdVisibility,
  MdFavoriteBorder,
  MdFavorite,
  MdOutlineShoppingCart,
  MdSearch,
  MdChevronRight,
  MdChevronLeft,
  MdLocalShipping,
  MdVerifiedUser,
  MdAutorenew,
  MdPayments,
  MdTrackChanges,
  MdArrowForward,
  MdPersonOutline,
  MdKeyboardArrowDown,
  MdClose,
} from 'react-icons/md';

import Loader from '../components/Loader';
import Footer from '../components/Footer';
import PageSEO from '../components/PageSEO';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { getCategories, getBestsellers, getAddresses, getProducts, getBrands, getProductById } from '../api';
import { API_BASE_URL } from '../apiBase';
import { detectCurrentCity } from '../utils/location';
import { hasVendorPasswordAuth } from '../utils/vendorSession';
import { productImageUrlContain, productImageSrcSetContain } from '../utils/cloudinaryImage';
import './Shop.css';
import './Home.css';

// Same logic as blinkiefashmob's _imgUrl(): resolves category_url from the database, absolute or relative.
function resolveImageUrl(raw) {
  const value = (raw ?? '').toString().trim();
  if (!value) return null;
  if (value.startsWith('http')) return value;
  if (value.startsWith('/')) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

// Same hero cards as blinkiefashmob's home screen (assets/images/hero_main.jpeg + brand banners).
const HERO_SLIDES = [
  // {
  //   image:
  //     'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786500420/file_00000000a2f48208ac6ff0d873fc6315_yzpvlq.png',
  //   to: '/shop?search=Puma',
  //   pos: 'center 20%',
  // },
  {
    image:
      'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099594/file_00000000445081fab93f08877e2a7788_irgiib.png',
    to: '/shop?search=Puma',
    pos: 'center 20%',
  },
  {
    image:
      'https://res.cloudinary.com/vu2qpoeq/image/upload/v1787574337/file_00000000ba04820ba8d817a1a5912ca2.png',
    to: '/shop?search=Xinso',
  },
  {
    image:
       'https://res.cloudinary.com/vu2qpoeq/image/upload/v1787397902/file_00000000d97882078a43ead8169d48bc.png',
       to: '/shop?search=kids',  
  },
  {
    image:
        'https://res.cloudinary.com/vu2qpoeq/image/upload/v1787397902/file_00000000fe588230bbc34825cce0a0fc.png',
        to:'/shop?search=men',
  },
  {
    image:
        "https://res.cloudinary.com/vu2qpoeq/image/upload/v1787397902/IMG_20260822_123232.png",
        to:'/shop?search=women',
  },
];

const UTILITY_ITEMS = [
  { icon: MdLocalShipping, label: 'Delivered in 60 Minutes' },
  { icon: MdVerifiedUser, label: '100% Authentic Products' },
  { icon: MdAutorenew, label: 'Easy Returns' },
  { icon: MdPayments, label: 'Cash on Delivery' },
  { icon: MdTrackChanges, label: 'Track Your Order' },
];

// Same root category ordering as blinkiefashmob: Women, Men, Footwear, Electronics, Beauty first, then A-Z.
const CAT_PRIORITY = { women: 0, men: 1, footwear: 2, electronics: 3, beauty: 4 };
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

const UNIVERSE_BRANDS = [
  {
    name: "Puma",
    image:
      "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438409/Pumabanner_cd8wwz.jpg",
    to: "/shop?search=Puma",
  },
  {
    name: "FCUK",
    image:
      "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438315/FcukandFrenchconnection_a8ovf0.png",
    to: "/shop?search=FCUK",
  },
  {
    name: "Libas",
    image:
      "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438322/libasbanner_gtuogs.jpg",
    to: "/shop?search=Libas",
  },
  {
    name: "MK",
    image:
      "https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438329/mkbanner_habbh6.jpg",
    to: "/shop?search=MK",
  },
  
];

const KNOWN_BRANDS = [
  'nike',
  'adidas',
  'puma',
  "levi's",
  'levis',
  'zara',
  'h&m',
  'reebok',
  'tommy hilfiger',
  'calvin klein',
  'us polo',
  'us polo assn',
  'allen solly',
  'peter england',
  'van heusen',
  'raymond',
  'pepe jeans',
  'wrangler',
  'jack & jones',
  'vero moda',
  'biba',
  'fabindia',
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
  { re: /flat/i, icon: '🥿' },
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

// ---- Search-suggestion helpers (mirrors Shop.jsx's suggestion ranking exactly) ----
const normalizeText = (value) => String(value || '').trim().toLowerCase();

const rankedMatches = (items, query, limit, getter) => {
  const prefix = [];
  const contains = [];
  const lower = normalizeText(query);

  for (const item of items) {
    const text = normalizeText(getter(item));
    if (!text) continue;
    if (text.startsWith(lower)) {
      prefix.push(item);
    } else if (text.includes(lower)) {
      contains.push(item);
    }
    if (prefix.length >= limit) break;
  }

  return [...prefix, ...contains].slice(0, limit);
};

const RECENTLY_VIEWED_KEY = 'bfw_recently_viewed_products';
const RECENT_SEARCH_KEY = 'bfw_recent_searches';

// Module-level cache — survives navigation, cleared on full page reload
let _homeCache = null;


/** Scroll a product/chip rail by N cards (default 6). */
function scrollRailByCards(el, direction = 1, cardsPerPage = 6) {
  if (!el) return;
  const dir = direction < 0 ? -1 : 1;
  const card = el.querySelector('.hp-deal-card, .hp-collection-chip, .hp-subcat-chip');
  let step = Math.round(el.clientWidth * 0.95);
  if (card) {
    const styles = window.getComputedStyle(el);
    const gap = parseFloat(styles.columnGap || styles.gap || '14') || 14;
    const cardW = card.getBoundingClientRect().width;
    step = Math.round((cardW + gap) * cardsPerPage);
  }
  el.scrollBy({ left: dir * step, behavior: 'smooth' });
}

export default function Home() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const canSwitchToVendor = user?.role === 'vendor' && hasVendorPasswordAuth();
  const headerUserName = String(user?.name || localStorage.getItem('userName') || '').trim();
  const headerFirstName = headerUserName ? headerUserName.split(/\s+/)[0] : '';
  const { count, addToCart } = useCart();
  const { items: wishlistItems, isWishlisted, toggleWishlist } = useWishlist();

  const [city, setCity] = useState(() => localStorage.getItem('bfw_city') || 'Cuttack');
  const [locating, setLocating] = useState(false);
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
  const [beautyCats, setBeautyCats] = useState(() => c?.beautyCats ?? []);
  const [homeLivingCats, setHomeLivingCats] = useState(() => c?.homeLivingCats ?? []);
  const [travelCats, setTravelCats] = useState(() => c?.travelCats ?? []);
  const [hoveredNav, setHoveredNav] = useState(null);
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
  // Skip loading state when returning to cached data
  const [loading, setLoading] = useState(!_homeCache);
  const [error, setError] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [locationError, setLocationError] = useState('');
  const [recentlyViewedProductsData, setRecentlyViewedProductsData] = useState([]);
  const heroTrackRef = useRef(null);
  const dealsRef = useRef(null);
  const recentlyViewedRailRef = useRef(null);
  const newOnBlinkiefashRailRef = useRef(null);

  // ---- Search bar state (matches Shop.jsx's header search exactly) ----
  const [searchInput, setSearchInput] = useState('');
  const [searchSuggestions, setSearchSuggestions] = useState([]);
  const [showSearchSuggestions, setShowSearchSuggestions] = useState(false);
  const [recentSearches, setRecentSearches] = useState(() => {
    try {
      const stored = JSON.parse(localStorage.getItem(RECENT_SEARCH_KEY) || '[]');
      return Array.isArray(stored) ? stored.filter(Boolean).slice(0, 8) : [];
    } catch {
      return [];
    }
  });
  const searchBlurTimerRef = useRef(null);
  const searchSuggestTimerRef = useRef(null);

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

  // If stored recently-viewed snapshots lack price info (0), fetch product details
  // in the background and enrich the cached snapshots so the UI can show correct prices.
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
        // ignore enrichment errors
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

          // Exact match first to avoid "women" matching when searching "men"
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
          menRes,
          womenRes,
          kidsRes,
          electronicsRes,
          trendyShoesRes,
          under999Res,
          under1999Res,
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
        const fallbackElectronics = pickByKeywords(sourcePool, [
          'electronics',
          'headphone',
          'speaker',
          'mobile',
          'earbuds',
          'watch',
        ]);
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
        const knownIndex = (name) => {
          const normalized = normalizeBrandName(name);
          const idx = KNOWN_BRANDS.findIndex((known) => known === normalized);
          return idx === -1 ? KNOWN_BRANDS.length : idx;
        };

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
        const brandsList = [...brandsSource]
          .sort((a, b) => {
            const ar = knownIndex(a.name);
            const br = knownIndex(b.name);
            if (ar !== br) return ar - br;
            const ac = Number(a._count || 0);
            const bc = Number(b._count || 0);
            if (bc !== ac) return bc - ac;
            return a.name.localeCompare(b.name);
          })
          .slice(0, 12);

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
        const freshBeautyCats = childCatsFor('Beauty');
        const freshHomeLivingCats = childCatsFor(['Home Living', 'Living', 'Home & Living']);
        const freshTravelCats = childCatsFor(['Travel and Backpack', 'Travel & Backpack', 'Travel']);

        // Persist to module-level cache so next visit skips the loader
        _homeCache = {
          categories: freshCategories, deals: freshDeals, newProducts: freshNewProducts,
          pinnedNewProduct: freshPinned, mensProducts: freshMens, womensProducts: freshWomens,
          kidsProducts: freshKids, electronicsProducts: freshElectronics, trendyShoesProducts: freshShoes,
          under999Products: freshUnder999, under1999Products: freshUnder1999, topBrands: brandsList,
          mensCats: freshMensCats, womensCats: freshWomensCats, kidsCats: freshKidsCats,
          electronicsCats: freshElectronicsCats, trendyShoesCats: freshShoesCats,
          beautyCats: freshBeautyCats, homeLivingCats: freshHomeLivingCats, travelCats: freshTravelCats,
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
        setBeautyCats(freshBeautyCats);
        setHomeLivingCats(freshHomeLivingCats);
        setTravelCats(freshTravelCats);
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
      setHeroIndex((i) => (i + 1) % HERO_SLIDES.length);
    }, 15000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const track = heroTrackRef.current;
    if (!track) return;
    const left = heroIndex * track.clientWidth;
    track.scrollTo({ left, behavior: 'smooth' });
  }, [heroIndex]);

  useEffect(() => {
    let cancelled = false;
    const loadExploreProducts = async () => {
      setExploreLoading(true);
      try {
        const res = await getProducts({
          category_id: exploreCatId || undefined,
          sort: 'newest',
          limit: 8,
          offset: 0,
        });
        const items = res?.products || (Array.isArray(res) ? res : []);
        if (cancelled) return;
        setExploreProducts(Array.isArray(items) ? items : []);
        setExploreOffset(Array.isArray(items) ? items.length : 0);
        setExploreHasMore(Array.isArray(items) && items.length === 8);
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
        limit: 8,
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
      setExploreHasMore(nextItems.length === 8);
    } finally {
      setExploreLoading(false);
    }
  };

  const goToSlide = (delta) => {
    setHeroIndex((i) => (i + delta + HERO_SLIDES.length) % HERO_SLIDES.length);
  };

  const enrichedDeals = useMemo(() => {
    return (Array.isArray(deals) ? deals : []).map((item) => {
      const price = Number(item?.discount_price ?? item?.price ?? 0);
      const mrp = Number(item?.price ?? item?.original_price ?? price);
      const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
      return { ...item, _price: price, _mrp: mrp, _discount: discount };
    });
  }, [deals]);

  const topDeals = useMemo(() => {
    const ranked = [...enrichedDeals].sort((a, b) => b._discount - a._discount);
    return ranked.slice(0, 10);
  }, [enrichedDeals]);

  const recentlyViewedProducts = useMemo(() => {
    return recentlyViewedProductsData
      .map((p) => ({
        ...p,
        id: p.id,
        // be permissive with possible field names saved by older clients
        _price: Number(p._price ?? p.discount_price ?? p.price ?? 0) || 0,
        _mrp:
          Number(
            p._mrp ?? p.original_price ?? p.mrp ?? p.price ?? p._price ?? 0
          ) || 0,
        _discount: Number(p._discount ?? p.discount ?? 0) || 0,
      }))
      .filter((p) => p.id)
      .slice(0, 8);
  }, [recentlyViewedProductsData]);

  const newOnBlinkiefash = useMemo(() => {
    const items = (Array.isArray(newProducts) ? newProducts : [])
      .map((item) => {
        const price = Number(item?.discount_price ?? item?.price ?? 0);
        const mrp = Number(item?.price ?? item?.original_price ?? price);
        const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
        const hasDiscount = mrp > 0 && price > 0 && price < mrp;
        const isPalermo = (item?.name || '').toString().toLowerCase().includes('palermo');
        return { ...item, _price: price, _mrp: mrp, _discount: discount, _hasDiscount: hasDiscount, _isPalermo: isPalermo };
      })
      .filter((item) => !item._hasDiscount && !item._isPalermo);

    const pinned = pinnedNewProduct
      ? (() => {
          const price = Number(pinnedNewProduct?.discount_price ?? pinnedNewProduct?.price ?? 0);
          const mrp = Number(pinnedNewProduct?.price ?? pinnedNewProduct?.original_price ?? price);
          const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
          if (mrp > 0 && price > 0 && price < mrp) return null;
          return { ...pinnedNewProduct, _price: price, _mrp: mrp, _discount: discount };
        })()
      : null;

    const rest = items.slice(0, 10 - (pinned ? 1 : 0));
    return pinned ? [pinned, ...rest] : rest;
  }, [newProducts, pinnedNewProduct]);

  // Combined, de-duplicated pool of already-loaded products used to power header search suggestions.
  const suggestionProductPool = useMemo(() => {
    const seen = new Set();
    const pool = [];
    [newProducts, mensProducts, womensProducts, kidsProducts, electronicsProducts, trendyShoesProducts].forEach(
      (list) => {
        (Array.isArray(list) ? list : []).forEach((item) => {
          const key = String(item?.id ?? '');
          if (!key || seen.has(key)) return;
          seen.add(key);
          pool.push(item);
        });
      }
    );
    return pool;
  }, [newProducts, mensProducts, womensProducts, kidsProducts, electronicsProducts, trendyShoesProducts]);

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

  // ---- Search bar handlers (mirrors Shop.jsx exactly) ----
  const saveRecentSearch = (rawValue) => {
    const value = String(rawValue || '').trim();
    if (!value) return;
    const deduped = [value, ...recentSearches.filter((item) => normalizeText(item) !== normalizeText(value))].slice(0, 8);
    setRecentSearches(deduped);
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(deduped));
  };

  const updateSearchSuggestions = (value) => {
    if (searchSuggestTimerRef.current) {
      clearTimeout(searchSuggestTimerRef.current);
      searchSuggestTimerRef.current = null;
    }

    const query = String(value || '').trim();
    if (!query) {
      searchSuggestTimerRef.current = setTimeout(() => {
        setSearchSuggestions(
          recentSearches.map((item) => ({ text: item, type: 'search', subtitle: 'Recent search' })).slice(0, 8)
        );
      }, 50);
      return;
    }

    searchSuggestTimerRef.current = setTimeout(() => {
      const q = normalizeText(query);
      const seen = new Set();
      const ranked = [];

      const pushCandidate = (entry) => {
        const clean = String(entry?.text || '').trim();
        if (!clean) return;
        const key = `${entry.type}:${clean.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        ranked.push(entry);
      };

      // 0) Explicit search query first.
      pushCandidate({ text: query, type: 'search' });

      // 1) Categories max 2, prefix first.
      rankedMatches(categories, q, 2, (item) => item.name).forEach((item) => {
        pushCandidate({ text: item.name, type: 'category', id: item.id ? String(item.id) : '' });
      });

      // 2) Brands max 2, fallback top 2 when no matches.
      const matchingBrands = rankedMatches(topBrands, q, 2, (item) => item.name);
      const brandsToShow = matchingBrands.length > 0 ? matchingBrands : topBrands.slice(0, 2);
      brandsToShow.forEach((item) => {
        pushCandidate({
          text: item.name,
          type: 'brand',
          subtitle: matchingBrands.length === 0 ? 'Popular brand' : '',
        });
      });

      // 3) Product names max 4, prefix first.
      rankedMatches(suggestionProductPool, q, 4, (item) => item.name).forEach((item) => {
        pushCandidate({ text: item.name, type: 'product' });
      });

      setSearchSuggestions(ranked.slice(0, 8));
    }, 150);
  };

  const handleTopSearch = (event) => {
    event.preventDefault();
    const value = String(searchInput || '').trim();
    saveRecentSearch(value);
    setShowSearchSuggestions(false);
    navigate(value ? `/shop?search=${encodeURIComponent(value)}` : '/shop');
  };

  // FIX: Tapping/focusing the search box now takes the user straight to the
  // Shop (all products) page instead of just opening the inline suggestions
  // dropdown. If they'd already typed something, we carry it over as the
  // initial search query on the Shop page.
  const handleSearchInputFocus = () => {
    setShowSearchSuggestions(false);
    const value = String(searchInput || '').trim();
    navigate(value ? `/shop?search=${encodeURIComponent(value)}` : '/shop');
  };

  const handleSearchInputBlur = () => {
    searchBlurTimerRef.current = setTimeout(() => {
      setShowSearchSuggestions(false);
    }, 120);
  };

  const applySuggestion = (item) => {
    const type = item?.type || 'product';
    const text = String(item?.text || '').trim();
    const id = String(item?.id || '').trim();

    if (!text) return;

    setShowSearchSuggestions(false);

    if (type === 'category') {
      setSearchInput('');
      navigate(id ? `/shop?category_id=${id}` : '/shop');
      return;
    }

    setSearchInput(text);
    saveRecentSearch(text);
    navigate(`/shop?search=${encodeURIComponent(text)}`);
  };

  const enrichItems = (items) =>
    (Array.isArray(items) ? items : []).map((item) => {
      const price = Number(item?.discount_price ?? item?.price ?? 0);
      const mrp = Number(item?.price ?? item?.original_price ?? price);
      const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
      return { ...item, _price: price, _mrp: mrp, _discount: discount };
    });

  return (
    <div className={`hp${loading ? ' hp-loading' : ''}`}>
      <PageSEO
        title="Fashion Delivered in 60 Minutes — Cuttack & Bhubaneswar"
        description="Shop top brands like Puma, Nike, Adidas & more. Get ethnic wear, footwear, electronics & latest styles delivered to your door in 60 minutes across Odisha."
        path="/"
      />
      {loading ? (
        <Loader
          overlay
          label="Preparing Blinkiefash..."
          subtitle="Fetching style secrets and polishing the universe."
        />
      ) : null}

      <div className="hp-top-fixed">
        <div className="hp-utility-bar">
          <div className="hp-utility-marquee">
            <div className="hp-utility-track">
              {[...UTILITY_ITEMS, ...UTILITY_ITEMS].map((item, idx) => (
                <span key={`${item.label}-${idx}`} className="hp-utility-item">
                  <item.icon /> {item.label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="hp-sticky-head">
          {/* ---- Navbar: exact markup/classes copied from Shop.jsx's catalog header ---- */}
          <header className="hp-main-header catalog-main-header">
            <button type="button" className="hp-brand" onClick={() => navigate('/')}>
              <img src="https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786438169/Image_1_idh5gu.jpg" alt="Blinkiefash" className="hp-logo" />
              <span className="hp-brand-text">
                <span className="hp-brand-name">
                  BLINKIE<span className="hp-brand-accent">FASH</span>
                </span>
                <span className="hp-tagline">DELIVERED IN 60 MINUTES</span>
              </span>
            </button>

            <form className="hp-header-search catalog-mobile-search" onSubmit={handleTopSearch}>
              <MdSearch className="hp-search-icon" />
              <input
                name="q"
                value={searchInput}
                readOnly
                onChange={(e) => {
                  const value = e.target.value;
                  setSearchInput(value);
                  updateSearchSuggestions(value);
                }}
                onFocus={handleSearchInputFocus}
                onBlur={handleSearchInputBlur}
                onClick={handleSearchInputFocus}
                placeholder="Search Ethnic Wear, Sneakers, Bags & more..."
              />
              {searchInput.trim() ? (
                <button
                  type="button"
                  className="catalog-search-clear"
                  aria-label="Clear search"
                  onClick={() => {
                    setSearchInput('');
                    updateSearchSuggestions('');
                  }}
                >
                  <MdClose />
                </button>
              ) : null}
              <button type="submit" className="hp-search-btn" aria-label="Search products">
                <MdSearch />
              </button>
              {showSearchSuggestions && searchSuggestions.length > 0 ? (
                <div className="catalog-search-suggestions" role="listbox" aria-label="Search suggestions">
                  {searchSuggestions.map((item, idx) => (
                    <button
                      key={`${item.type}-${item.text}-${idx}`}
                      type="button"
                      className="catalog-suggestion-item"
                      onMouseDown={(event) => event.preventDefault()}
                      onClick={() => applySuggestion(item)}
                    >
                      <MdSearch />
                      <span className="catalog-suggestion-text">{item.text}</span>
                      <span className="catalog-suggestion-type">{item.subtitle || item.type}</span>
                    </button>
                  ))}
                </div>
              ) : null}
            </form>

            <div className="catalog-header-actions-wrap">
              <button type="button" className="catalog-location-pill" onClick={openLocationSheet}>
                <MdLocationOn />
                <span>{locating ? 'Detecting...' : city}</span>
                <MdKeyboardArrowDown />
              </button>

              <div className="hp-header-actions">
                {canSwitchToVendor && (
                  <button type="button" onClick={() => navigate('/vendor/orders')}>
                    <MdArrowForward />
                    <span>Vendor</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => navigate(isLoggedIn ? '/Account' : '/login')}
                >
                  <MdPersonOutline />
                  <span>{isLoggedIn ? (headerFirstName || 'Profile') : 'Login'}</span>
                </button>
                <button type="button" onClick={() => navigate('/wishlist')}>
                  <MdFavoriteBorder />
                  {wishlistItems.length > 0 && (
                    <span className="hp-icon-badge">{wishlistItems.length}</span>
                  )}
                  <span>Wishlist</span>
                </button>
                <button type="button" onClick={() => navigate('/cart')}>
                  <MdOutlineShoppingCart />
                  {count > 0 && <span className="hp-icon-badge">{count}</span>}
                  <span>Cart</span>
                </button>
              </div>
            </div>
          </header>

          <nav className="hp-category-nav">
            <div
              className="hp-nav-links"
              onMouseLeave={() => setHoveredNav(null)}
            >
              {categories.slice(0, 8).map((cat) => {
                const nameKey = String(cat.name || '').toLowerCase().trim();
                const goCategory = () => {
                  if (nameKey === 'men' || nameKey === 'mens') navigate('/men');
                  else if (nameKey === 'women' || nameKey === 'womens') navigate('/women');
                  else if (nameKey === 'kids' || nameKey === 'kid' || nameKey === 'children') navigate('/kids');
                  else navigate(`/shop?category_id=${cat.id}`);
                };
                return (
                <button
                  key={cat.id}
                  type="button"
                  className="hp-nav-link"
                  onClick={goCategory}
                  onMouseEnter={() => setHoveredNav(cat.name)}
                  onFocus={() => setHoveredNav(cat.name)}
                >
                  {cat.name}
                </button>
                );
              })}

              {/* Mega menu panel shown on hover */}
              {hoveredNav ? (
                <div className="hp-mega-menu" onMouseEnter={() => {}} onMouseLeave={() => setHoveredNav(null)}>
                  <div className="hp-mega-columns">
                    {(function getCols() {
                      const key = (hoveredNav || '').toString().toLowerCase();
                      let cols = [];
                      if (key.includes('women')) cols = womensCats;
                      else if (key.includes('men')) cols = mensCats;
                      else if (key.includes('kids')) cols = kidsCats;
                      else if (key.includes('beaut') || key.includes('beauty')) cols = beautyCats;
                      else if (key.includes('living') || key.includes('home')) cols = homeLivingCats;
                      else if (key.includes('travel') || key.includes('backpack')) cols = travelCats;
                      else if (key.includes('elect')) cols = electronicsCats;
                      else if (key.includes('shoe') || key.includes('foot')) cols = trendyShoesCats;
                      // fallback: try to find a matching category id's children if available
                      return cols.length > 0 ? cols : [];
                    })().map((parent) => (
                      <div key={parent.id} className="hp-mega-col">
                        <button type="button" className="hp-mega-col-title" onClick={() => navigate(`/shop?category_id=${parent.id}`)}>
                          {parent.name}
                        </button>
                        {Array.isArray(parent.subcategories) && parent.subcategories.length > 0 ? (
                          <ul className="hp-mega-sublist">
                            {parent.subcategories.map((sub) => (
                              <li key={sub.id}>
                                <button type="button" onClick={() => navigate(`/shop?category_id=${sub.id}`)} className="hp-mega-sublink">
                                  {(() => {
                                    const subImg = resolveImageUrl(sub.image || parent.image);
                                    return subImg ? <img src={subImg} alt={sub.name} /> : <span className="hp-mega-sub-fallback">•</span>;
                                  })()} {sub.name}
                                </button>
                              </li>
                            ))}
                          </ul>
                        ) : null}
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          </nav>
        </div>
      </div>

      <main className="hp-main">
        <section className="hp-hero-carousel">
          <button type="button" className="hp-hero-arrow left" onClick={() => goToSlide(-1)} aria-label="Previous">
            <MdChevronLeft />
          </button>
          <div className="hp-hero-track" ref={heroTrackRef}>
            {HERO_SLIDES.map((slide) => (
              <button type="button" key={slide.image} className="hp-slide" onClick={() => navigate(slide.to)}>
                <img
                  src={slide.image}
                  alt=""
                  className="hp-slide-img"
                  style={slide.pos ? { objectPosition: slide.pos } : undefined}
                />
              </button>
            ))}
          </div>
          <button type="button" className="hp-hero-arrow right" onClick={() => goToSlide(1)} aria-label="Next">
            <MdChevronRight />
          </button>
          <div className="hp-hero-dots">
            {HERO_SLIDES.map((slide, i) => (
              <span key={slide.image} className={`hp-hero-dot${i === heroIndex ? ' active' : ''}`} />
            ))}
          </div>
        </section>

        {error && <p className="state-msg">{error}</p>}
        {loading && <Loader label="Loading todays picks..." />}

        <section className="section hp-rewards-section">
          <div className="hp-rewards-grid">
            <div className="hp-reward-panel hp-reward-spin">
              <div className="hp-reward-copy">
                <h3>SPIN &amp; WIN</h3>
                <p>Spin the wheel &amp; win exciting discounts!</p>
                <div className="hp-reward-amount">Up To ₹500</div>
                <button type="button" onClick={() => navigate('/spin-wheel')}>
                  SPIN NOW <MdArrowForward />
                </button>
              </div>
              <div className="hp-reward-graphic hp-spin-wheel" aria-hidden="true">
                🎡
              </div>
            </div>

            <div className="hp-reward-panel hp-reward-play">
              <div className="hp-reward-copy">
                <h3>PLAY &amp; WIN</h3>
                <p>Play fun games &amp; win big discounts!</p>
                <div className="hp-reward-amount">Up To ₹250</div>
                <button type="button" onClick={() => navigate('/play-and-win')}>
                  PLAY NOW <MdArrowForward />
                </button>
              </div>
              <div className="hp-reward-graphic" aria-hidden="true">
                🎮
              </div>
            </div>

            <div className="hp-reward-panel hp-reward-refer">
              <div className="hp-reward-copy">
                <h3>REFER &amp; EARN</h3>
                <p>Refer your friend &amp; you both get ₹100 off!</p>
                <div className="hp-referral-code">
                  <span>YOUR REFERRAL CODE</span>
                  <strong>BLINK100</strong>
                </div>
                <button type="button" onClick={() => navigate('/refer-earn')}>
                  REFER NOW <MdArrowForward />
                </button>
              </div>
              <div className="hp-reward-graphic" aria-hidden="true">
                🎁
              </div>
            </div>
          </div>
        </section>

        {topDeals.length > 0 && (
          <section className="section">
            <div className="hp-section-head">
              <h2>DEALS OF THE DAY</h2>
              <button type="button" onClick={() => navigate('/shop?sort=bestseller')}>
                View All <MdChevronRight />
              </button>
            </div>
            <div className="hp-deals-wrap">
              <button
                type="button"
                className="hp-deals-prev"
                aria-label="Previous deals"
                onClick={() => {
                  const el = dealsRef.current;
                  if (!el) return;
                  scrollRailByCards(el, -1, 6);
                }}
              >
                <MdChevronLeft />
              </button>

              <div className="hp-deals-rail" role="list" ref={dealsRef}>
                {topDeals.map((p, idx) => {
                const image = resolveImageUrl(p.image);
                const wishlistPayload = {
                  productId: p.id,
                  name: p.name,
                  image: image || p.image,
                  price: p._price,
                };

                return (
                  <article
                    key={`deal-${p.id}-${idx}`}
                    className="hp-deal-card"
                    role="listitem"
                    onClick={() => navigate(`/product/${p.id}`)}
                  >
                    <div className="hp-deal-media">
                      {image ? <img src={image} alt={p.name} loading="lazy" /> : <div className="hp-deal-fallback">No image</div>}
                      <span className="hp-deal-ribbon">HOT DEAL</span>
                      <button
                        type="button"
                        className={`hp-deal-wish${isWishlisted(p.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(wishlistPayload);
                        }}
                        aria-label="Toggle wishlist"
                      >
                        {isWishlisted(p.id) ? <MdFavorite /> : <MdFavoriteBorder />}
                      </button>
                    </div>
                    <div className="hp-deal-body">
                      {p.brand && <p className="hp-deal-brand">{p.brand}</p>}
                      <p className="hp-deal-name">{p.name}</p>
                      <div className="hp-deal-price-row">
                        <span className="hp-deal-price">₹{p._price}</span>
                        {p._mrp > p._price && <span className="hp-deal-mrp">₹{p._mrp}</span>}
                      </div>
                      <div className="hp-deal-footer-row">
                        <span className={`hp-deal-off${p._discount > 0 ? ' discount' : ''}`}>{p._discount > 0 ? `${p._discount}% OFF` : 'BESTSELLER'}</span>
                        <button
                          type="button"
                          className="hp-deal-cart"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({
                              productId: p.id,
                              variantId: p.id,
                              name: p.name,
                              image: image || p.image,
                              price: p._price,
                            });
                          }}
                          aria-label="Add to cart"
                        >
                          <MdOutlineShoppingCart />
                        </button>
                      </div>
                    </div>
                  </article>
                );
                })}
              </div>

              <button
                type="button"
                className="hp-deals-next"
                aria-label="Next deals"
                onClick={() => {
                  const el = dealsRef.current;
                  if (!el) return;
                  scrollRailByCards(el, 1, 6);
                }}
              >
                <MdChevronRight />
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
          <p className="hp-universe-jump">JUMP INTO</p>
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
                <img src={brand.image} alt={`${brand.name} banner`} loading="lazy" />
              </button>
            ))}
          </div>
        </section>

        {recentlyViewedProducts.length > 0 && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>
                <MdVisibility /> Recently Viewed
              </h2>
              <button type="button" onClick={() => navigate('/shop')}>
                View All <MdChevronRight />
              </button>
            </div>
            <div className="hp-deals-wrap">
              <button
                type="button"
                className="hp-deals-prev"
                aria-label="Previous recently viewed"
                onClick={() => {
                  const el = recentlyViewedRailRef.current;
                  if (!el) return;
                  scrollRailByCards(el, -1, 6);
                }}
              >
                <MdChevronLeft />
              </button>
              <div className="hp-deals-rail" role="list" ref={recentlyViewedRailRef}>
              {recentlyViewedProducts.map((p, idx) => {
                const image = resolveImageUrl(p.image);
                const wishlistPayload = {
                  productId: p.id,
                  name: p.name,
                  image: image || p.image,
                  price: p._price,
                };

                return (
                  <article
                    key={`recent-${p.id}-${idx}`}
                    className="hp-deal-card"
                    role="listitem"
                    onClick={() => navigate(`/product/${p.id}`)}
                  >
                    <div className="hp-deal-media">
                      {image ? <img src={image} alt={p.name} loading="lazy" /> : <div className="hp-deal-fallback">No image</div>}
                      <span className={`hp-deal-ribbon${p._discount === 0 ? ' new' : ''}`}>
                        {p._discount > 0 ? `${p._discount}% OFF` : 'NEW'}
                      </span>
                      <button
                        type="button"
                        className={`hp-deal-wish${isWishlisted(p.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(wishlistPayload);
                        }}
                        aria-label="Toggle wishlist"
                      >
                        {isWishlisted(p.id) ? <MdFavorite /> : <MdFavoriteBorder />}
                      </button>
                    </div>
                    <div className="hp-deal-body">
                      {p.brand && <p className="hp-deal-brand">{p.brand}</p>}
                      <p className="hp-deal-name">{p.name}</p>
                      <div className="hp-deal-price-row">
                        <span className="hp-deal-price">₹{p._price}</span>
                        {p._mrp > p._price && <span className="hp-deal-mrp">₹{p._mrp}</span>}
                      </div>
                      <div className="hp-deal-footer-row">
                        <span className={`hp-deal-off${p._discount > 0 ? ' discount' : ''}`}>{p._discount > 0 ? `${p._discount}% OFF` : 'JUST IN'}</span>
                        <button
                          type="button"
                          className="hp-deal-cart"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({
                              productId: p.id,
                              variantId: p.id,
                              name: p.name,
                              image: image || p.image,
                              price: p._price,
                            });
                          }}
                          aria-label="Add to cart"
                        >
                          <MdOutlineShoppingCart />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
              <button
                type="button"
                className="hp-deals-next"
                aria-label="Next recently viewed"
                onClick={() => {
                  const el = recentlyViewedRailRef.current;
                  if (!el) return;
                  scrollRailByCards(el, 1, 6);
                }}
              >
                <MdChevronRight />
              </button>
            </div>
          </section>
        )}

        {newOnBlinkiefash.length > 0 && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>New on Blinkiefash</h2>
              <button type="button" onClick={() => navigate('/shop?sort=newest')}>
                View All <MdChevronRight />
              </button>
            </div>
            <div className="hp-deals-wrap">
              <button
                type="button"
                className="hp-deals-prev"
                aria-label="Previous New on Blinkiefash"
                onClick={() => {
                  const el = newOnBlinkiefashRailRef.current;
                  if (!el) return;
                  scrollRailByCards(el, -1, 6);
                }}
              >
                <MdChevronLeft />
              </button>
              <div className="hp-deals-rail" role="list" ref={newOnBlinkiefashRailRef}>
              {newOnBlinkiefash.map((p, idx) => {
                const image = resolveImageUrl(p.image);
                const wishlistPayload = {
                  productId: p.id,
                  name: p.name,
                  image: image || p.image,
                  price: p._price,
                };

                return (
                  <article
                    key={`new-${p.id}-${idx}`}
                    className="hp-deal-card"
                    role="listitem"
                    onClick={() => navigate(`/product/${p.id}`)}
                  >
                    <div className="hp-deal-media">
                      {image ? <img src={image} alt={p.name} loading="lazy" /> : <div className="hp-deal-fallback">No image</div>}
                      <span className="hp-deal-ribbon new">NEW</span>
                      <button
                        type="button"
                        className={`hp-deal-wish${isWishlisted(p.id) ? ' active' : ''}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleWishlist(wishlistPayload);
                        }}
                        aria-label="Toggle wishlist"
                      >
                        {isWishlisted(p.id) ? <MdFavorite /> : <MdFavoriteBorder />}
                      </button>
                    </div>
                    <div className="hp-deal-body">
                      {p.brand && <p className="hp-deal-brand">{p.brand}</p>}
                      <p className="hp-deal-name">{p.name}</p>
                      <div className="hp-deal-price-row">
                        <span className="hp-deal-price">₹{p._price}</span>
                        {p._mrp > p._price && <span className="hp-deal-mrp">₹{p._mrp}</span>}
                      </div>
                      <div className="hp-deal-footer-row">
                        <span className="hp-deal-off">NEW</span>
                        <button
                          type="button"
                          className="hp-deal-cart"
                          onClick={(e) => {
                            e.stopPropagation();
                            addToCart({
                              productId: p.id,
                              variantId: p.id,
                              name: p.name,
                              image: image || p.image,
                              price: p._price,
                            });
                          }}
                          aria-label="Add to cart"
                        >
                          <MdOutlineShoppingCart />
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
            <button
              type="button"
              className="hp-deals-next"
              aria-label="Next New on Blinkiefash"
              onClick={() => {
                const el = newOnBlinkiefashRailRef.current;
                if (!el) return;
                scrollRailByCards(el, 1, 6);
              }}
            >
              <MdChevronRight />
            </button>
          </div>
          </section>
        )}

        {(mensProducts.length > 0 || mensCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>MEN&apos;S COLLECTION</h2>
              <button type="button" onClick={() => navigate('/men')}>
                View All <MdChevronRight />
              </button>
            </div>
            <CategoryChipsRail
              chips={mensCats}
              audienceLabel="Men"
              activeId={activeCollectionCats.Men ?? mensCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, Men: id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {mensProducts.length > 0 ? <RailCards items={mensProducts} keyPrefix="men" /> : null}
          </section>
        )}

        {(womensProducts.length > 0 || womensCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>WOMEN&apos;S COLLECTION</h2>
              <button type="button" onClick={() => navigate('/women')}>
                View All <MdChevronRight />
              </button>
            </div>
            <CategoryChipsRail
              chips={womensCats}
              audienceLabel="Women"
              activeId={activeCollectionCats.Women ?? womensCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, Women: id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {womensProducts.length > 0 ? <RailCards items={womensProducts} keyPrefix="women" /> : null}
          </section>
        )}

        {(kidsProducts.length > 0 || kidsCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>KIDS COLLECTION</h2>
              <button type="button" onClick={() => navigate('/kids')}>
                View All <MdChevronRight />
              </button>
            </div>
            <CategoryChipsRail
              chips={kidsCats}
              audienceLabel="Kids"
              activeId={activeCollectionCats.Kids ?? kidsCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, Kids: id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {kidsProducts.length > 0 ? <RailCards items={kidsProducts} keyPrefix="kids" /> : null}
          </section>
        )}

        {(electronicsProducts.length > 0 || electronicsCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>ELECTRONICS COLLECTION</h2>
              <button type="button" onClick={() => navigate('/shop?search=electronics')}>
                View All <MdChevronRight />
              </button>
            </div>
            <CategoryChipsRail
              chips={electronicsCats}
              audienceLabel="Electronics"
              activeId={activeCollectionCats.Electronics ?? electronicsCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, Electronics: id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {electronicsProducts.length > 0 ? <RailCards items={electronicsProducts} keyPrefix="electronics" /> : null}
          </section>
        )}

        {(trendyShoesProducts.length > 0 || trendyShoesCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>TRENDY SHOES</h2>
              <button type="button" onClick={() => navigate('/shop?search=shoes')}>
                View All <MdChevronRight />
              </button>
            </div>
            <CategoryChipsRail
              chips={trendyShoesCats}
              audienceLabel="Trendy Shoes"
              activeId={activeCollectionCats['Trendy Shoes'] ?? trendyShoesCats[0]?.id}
              onChipSelect={(id) => setActiveCollectionCats((prev) => ({ ...prev, 'Trendy Shoes': id }))}
              onSubSelect={(id) => navigate(`/shop?category_id=${id}`)}
            />
            {trendyShoesProducts.length > 0 ? <RailCards items={trendyShoesProducts} keyPrefix="shoes" /> : null}
          </section>
        )}

        {under999Products.length > 0 && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>UNDER ₹999</h2>
              <button type="button" onClick={() => navigate('/shop?max_price=999&sort=price_asc')}>
                View All <MdChevronRight />
              </button>
            </div>
            {under999Products.length > 0 ? <RailCards items={under999Products} keyPrefix="under999" /> : null}
          </section>
        )}

        {under1999Products.length > 0 && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>₹999 - ₹1999</h2>
              <button type="button" onClick={() => navigate('/shop?min_price=1000&max_price=1999&sort=price_asc')}>
                View All <MdChevronRight />
              </button>
            </div>
            {under1999Products.length > 0 ? <RailCards items={under1999Products} keyPrefix="under1999" /> : null}
          </section>
        )}

        {topBrands.length > 0 && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>TOP BRANDS</h2>
              <button type="button" onClick={() => navigate('/shop')}>
                View All <MdChevronRight />
              </button>
            </div>
            <div className="hp-top-brands-rail">
              {topBrands.map((brand, idx) => {
                const logo = resolveImageUrl(brand.logo_url || brand.image);
                const label = (brand.name || '').toString().trim();
                const initials = label
                  ? label
                      .split(/\s+/)
                      .map((part) => part[0])
                      .join('')
                      .slice(0, 2)
                      .toUpperCase()
                  : 'BR';
                return (
                  <button
                    key={`${brand.id || label || 'brand'}-${idx}`}
                    type="button"
                    className="hp-top-brand-card"
                    onClick={() => navigate(`/shop?search=${encodeURIComponent(label)}`)}
                    aria-label={`Shop ${label}`}
                  >
                    <span className="hp-top-brand-logo" aria-hidden="true">
                      {logo ? <img src={logo} alt="" loading="lazy" /> : <span>{initials}</span>}
                    </span>
                    <span className="hp-top-brand-name">{label}</span>
                  </button>
                );
              })}
              <button
                type="button"
                className="hp-top-brand-card hp-top-brand-card-more"
                onClick={() => navigate('/shop')}
                aria-label="Browse more brands"
              >
                <span className="hp-top-brand-logo" aria-hidden="true">
                  <span>+</span>
                </span>
                <span className="hp-top-brand-name">More</span>
              </button>
            </div>
          </section>
        )}

        <section className="section hp-feed-rail-section">
          <div className="hp-section-head hp-feed-head">
            <h2>MORE TO EXPLORE</h2>
            <button type="button" onClick={() => navigate('/shop')}>
              View All <MdChevronRight />
            </button>
          </div>
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
              {enrichItems(exploreProducts).map((p, idx) => {
                const image = resolveImageUrl(p.image);
                return (
                  <article
                    key={`explore-${p.id}-${idx}`}
                    className="hp-explore-card"
                    role="listitem"
                    onClick={() => navigate(`/product/${p.id}`)}
                  >
                    <div className="hp-explore-media">
                      {image ? (
                        <img
                          src={productImageUrlContain(image, 320, 305)}
                          srcSet={productImageSrcSetContain(image, [200, 280, 320, 480, 600], 1 / 1.05)}
                          sizes="(max-width: 900px) 46vw, 15vw"
                          alt={p.name}
                          loading="lazy"
                          width="320"
                          height="305"
                        />
                      ) : (
                        <div className="hp-deal-fallback">No image</div>
                      )}
                    </div>
                    <div className="hp-explore-body">
                      {p.brand ? <p className="hp-explore-brand">{p.brand.toUpperCase()}</p> : null}
                      <p className="hp-explore-name">{p.name}</p>
                      <div className="hp-explore-price-row">
                        <span className="hp-explore-price">₹{p._price}</span>
                        {p._mrp > p._price ? <span className="hp-explore-mrp">₹{p._mrp}</span> : null}
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          ) : !exploreLoading ? (
            <p className="hp-location-sheet-muted">No products in this category yet.</p>
          ) : null}

          {!exploreLoading && exploreHasMore ? (
            <button type="button" className="hp-explore-more" onClick={loadMoreExploreProducts}>
              Show More Products
            </button>
          ) : null}

          {exploreLoading ? (
            <div className="hp-explore-loading">
              <Loader label="Loading products..." />
            </div>
          ) : null}
        </section>

        <Footer />
      </main>

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

// Category chip rail with left/right scroll-arrow controls (keyboard-focusable <button>s).
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
        <button
          type="button"
          className="hp-deals-prev"
          aria-label={`Scroll ${audienceLabel} categories left`}
          onClick={() => scrollBy(-1)}
        >
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

        <button
          type="button"
          className="hp-deals-next"
          aria-label={`Scroll ${audienceLabel} categories right`}
          onClick={() => scrollBy(1)}
        >
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

function RailCards({ items, keyPrefix, ribbonType = 'discount' }) {
  const railRef = useRef(null);
  const navigate = useNavigate();
  const { isWishlisted, toggleWishlist } = useWishlist();
  const { addToCart } = useCart();

  const list = (Array.isArray(items) ? items : []).slice(0, 10).map((item) => {
    const price = Number(item?.discount_price ?? item?.price ?? 0);
    const mrp = Number(item?.price ?? item?.original_price ?? price);
    const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
    return { ...item, _price: price, _mrp: mrp, _discount: discount };
  });

  return (
    <div className="hp-deals-wrap">
      <button
        type="button"
        className="hp-deals-prev"
        aria-label="Previous"
        onClick={() => {
          const el = railRef.current;
          if (!el) return;
          scrollRailByCards(el, -1, 6);
        }}
      >
        <MdChevronLeft />
      </button>

      <div className="hp-deals-rail" role="list" ref={railRef}>
        {list.map((p, idx) => {
          const image = resolveImageUrl(p.image);
          const wishlistPayload = {
            productId: p.id,
            name: p.name,
            image: image || p.image,
            price: p._price,
          };
          const ribbonText = ribbonType === 'new' ? 'NEW' : p._discount > 0 ? `${p._discount}% OFF` : 'TRENDING';

          return (
            <article
              key={`${keyPrefix}-${p.id}-${idx}`}
              className="hp-deal-card"
              role="listitem"
              onClick={() => navigate(`/product/${p.id}`)}
            >
              <div className="hp-deal-media">
                {image ? <img src={image} alt={p.name} loading="lazy" /> : <div className="hp-deal-fallback">No image</div>}
                <span className={`hp-deal-ribbon${ribbonType === 'new' ? ' new' : ''}`}>{ribbonText}</span>
                <button
                  type="button"
                  className={`hp-deal-wish${isWishlisted(p.id) ? ' active' : ''}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleWishlist(wishlistPayload);
                  }}
                  aria-label="Toggle wishlist"
                >
                  {isWishlisted(p.id) ? <MdFavorite /> : <MdFavoriteBorder />}
                </button>
              </div>
              <div className="hp-deal-body">
                {p.brand && <p className="hp-deal-brand">{p.brand}</p>}
                <p className="hp-deal-name">{p.name}</p>
                <div className="hp-deal-price-row">
                  <span className="hp-deal-price">₹{p._price}</span>
                  {p._mrp > p._price && <span className="hp-deal-mrp">₹{p._mrp}</span>}
                </div>
                <div className="hp-deal-footer-row">
                  <span className={`hp-deal-off${p._discount > 0 ? ' discount' : ''}`}>{p._discount > 0 ? `${p._discount}% OFF` : 'NEW'}</span>
                  <button
                    type="button"
                    className="hp-deal-cart"
                    onClick={(e) => {
                      e.stopPropagation();
                      addToCart({
                        productId: p.id,
                        variantId: p.id,
                        name: p.name,
                        image: image || p.image,
                        price: p._price,
                      });
                    }}
                    aria-label="Add to cart"
                  >
                    <MdOutlineShoppingCart />
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <button
        type="button"
        className="hp-deals-next"
        aria-label="Next"
        onClick={() => {
          const el = railRef.current;
          if (!el) return;
          scrollRailByCards(el, 1, 6);
        }}
      >
        <MdChevronRight />
      </button>
    </div>
  );
}