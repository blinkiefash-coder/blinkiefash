import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  MdLocationOn,
  MdKeyboardArrowDown,
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
  MdMenu,
  MdArrowForward,
  MdMoreHoriz,
  MdPersonOutline,
} from 'react-icons/md';
import Loader from '../components/Loader';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { getCategories, getBestsellers, getAddresses, getProducts, getBrands } from '../api';
import { API_BASE_URL } from '../apiBase';
import { detectCurrentCity } from '../utils/location';
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
  {
    image:
      'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099594/file_00000000445081fab93f08877e2a7788_irgiib.png',
    to: '/shop?search=Puma',
    pos: 'center 20%',
  },
  {
    image:
      'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099580/file_00000000357c821196db94748aec7bb3_hz9eko.png',
    to: '/shop?search=Nike',
  },
  {
    image:
      'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099597/file_00000000b408820bb1ef180a5b19df30_scfowa.png',
    to: '/shop?search=Adidas',
    pos: 'center 20%',
  },
  {
    image:
      'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099594/file_000000009d9881fab007f8a4bd7a5b81_o7dash.png',
    to: '/shop?search=US Polo',
  },
];

const UTILITY_ITEMS = [
  { icon: MdLocalShipping, label: 'Delivered in 60 Minutes' },
  { icon: MdVerifiedUser, label: '100% Authentic Products' },
  { icon: MdAutorenew, label: 'Easy Returns' },
  { icon: MdPayments, label: 'Cash on Delivery' },
  { icon: MdTrackChanges, label: 'Track Your Order' },
];

// Same rotating pastel tile backgrounds as blinkiefashmob's _exploreCategories().
const CAT_TILE_BG = ['#FFF1F2', '#F0FDF4', '#EFF6FF', '#FFFBEB', '#FFF1F2', '#F7FEE7'];

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
  { name: 'Puma', image: '/images/Pumabanner.jpeg', to: '/shop?search=Puma' },
  { name: 'FCUK', image: '/images/FcukandFrenchconnection.jpeg', to: '/shop?search=FCUK' },
  { name: 'Libas', image: '/images/libasbanner.jpeg', to: '/shop?search=Libas%20Kurti%20Kurta%20Set' },
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

const RECENTLY_VIEWED_KEY = 'bfw_recently_viewed_products';

export default function Home() {
  const navigate = useNavigate();
  const { user, isLoggedIn } = useAuth();
  const { count, addToCart } = useCart();
  const { items: wishlistItems, isWishlisted, toggleWishlist } = useWishlist();

  const [city, setCity] = useState(() => localStorage.getItem('bfw_city') || 'Cuttack');
  const [locating, setLocating] = useState(false);
  const [categories, setCategories] = useState([]);
  const [deals, setDeals] = useState([]);
  const [newProducts, setNewProducts] = useState([]);
  const [pinnedNewProduct, setPinnedNewProduct] = useState(null);
  const [mensProducts, setMensProducts] = useState([]);
  const [womensProducts, setWomensProducts] = useState([]);
  const [kidsProducts, setKidsProducts] = useState([]);
  const [electronicsProducts, setElectronicsProducts] = useState([]);
  const [trendyShoesProducts, setTrendyShoesProducts] = useState([]);
  const [mensCats, setMensCats] = useState([]);
  const [womensCats, setWomensCats] = useState([]);
  const [kidsCats, setKidsCats] = useState([]);
  const [electronicsCats, setElectronicsCats] = useState([]);
  const [trendyShoesCats, setTrendyShoesCats] = useState([]);
  const [activeCollectionCats, setActiveCollectionCats] = useState({});
  const [under999Products, setUnder999Products] = useState([]);
  const [under1999Products, setUnder1999Products] = useState([]);
  const [topBrands, setTopBrands] = useState([]);
  const [exploreCatChipIndex, setExploreCatChipIndex] = useState(0);
  const [exploreCatId, setExploreCatId] = useState('');
  const [exploreProducts, setExploreProducts] = useState([]);
  const [exploreOffset, setExploreOffset] = useState(0);
  const [exploreHasMore, setExploreHasMore] = useState(false);
  const [exploreLoading, setExploreLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [heroIndex, setHeroIndex] = useState(0);
  const [locationSheetOpen, setLocationSheetOpen] = useState(false);
  const [addressLoading, setAddressLoading] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [locationError, setLocationError] = useState('');
  const [recentlyViewedProductsData, setRecentlyViewedProductsData] = useState([]);
  const heroTrackRef = useRef(null);

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
        const rootIdFor = (name) =>
          allCats.find(
            (c) => !c.parent_id && (c?.name || '').toString().toLowerCase() === name.toLowerCase()
          )?.id;

        const childCatsFor = (rootName) => {
          const rootId = rootIdFor(rootName);
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
              .slice(0, 8);

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
          const rootId = rootIdFor(rootName);
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
        setCategories(sortCategories((Array.isArray(catRes) ? catRes : []).filter((c) => !c.parent_id)));
        setDeals(Array.isArray(dealList) ? dealList : []);
        setNewProducts(Array.isArray(latestList) ? latestList : []);
        setPinnedNewProduct(Array.isArray(palermoList) && palermoList.length > 0 ? palermoList[0] : null);
        setMensProducts(Array.isArray(menRes) && menRes.length > 0 ? menRes : fallbackMen);
        setWomensProducts(Array.isArray(womenRes) && womenRes.length > 0 ? womenRes : fallbackWomen);
        setKidsProducts(Array.isArray(kidsRes) && kidsRes.length > 0 ? kidsRes : fallbackKids);
        setElectronicsProducts(
          Array.isArray(electronicsRes) && electronicsRes.length > 0 ? electronicsRes : fallbackElectronics
        );
        setTrendyShoesProducts(Array.isArray(trendyShoesRes) && trendyShoesRes.length > 0 ? trendyShoesRes : fallbackShoes);
        setUnder999Products(Array.isArray(under999List) && under999List.length > 0 ? under999List : fallbackUnder999);
        setUnder1999Products(
          Array.isArray(under1999List) && under1999List.length > 0 ? under1999List : fallbackUnder1999
        );
        setTopBrands(brandsList);
        setMensCats(childCatsFor('Men'));
        setWomensCats(childCatsFor('Women'));
        setKidsCats(childCatsFor('Kids'));
        setElectronicsCats(childCatsFor('Electronics'));
        setTrendyShoesCats(childCatsFor('Footwear'));
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
    }, 5000);
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
        _price: Number(p._price ?? p.price ?? 0),
        _mrp: Number(p._mrp ?? p.mrp ?? p.price ?? 0),
        _discount: Number(p._discount ?? p.discount ?? 0),
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

  const handleSearch = (e) => {
    e.preventDefault();
    const q = e.target.elements.q.value.trim();
    navigate(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
  };

  const enrichItems = (items) =>
    (Array.isArray(items) ? items : []).map((item) => {
      const price = Number(item?.discount_price ?? item?.price ?? 0);
      const mrp = Number(item?.price ?? item?.original_price ?? price);
      const discount = mrp > price && mrp > 0 ? Math.round(((mrp - price) / mrp) * 100) : 0;
      return { ...item, _price: price, _mrp: mrp, _discount: discount };
    });

  const renderRailCards = (items, keyPrefix, ribbonType = 'discount') => (
    <div className="hp-deals-rail" role="list">
      {enrichItems(items).slice(0, 10).map((p, idx) => {
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
                <span className="hp-deal-off">{p._discount > 0 ? `${p._discount}% OFF` : 'NEW'}</span>
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
  );

  const renderCategoryChips = (chips, audienceLabel = '') => {
    if (!Array.isArray(chips) || chips.length === 0) return null;
    const activeId = activeCollectionCats[audienceLabel] ?? chips[0]?.id;
    const activeCat = chips.find((cat) => String(cat.id) === String(activeId)) || chips[0];
    return (
      <div className="hp-collection-chip-group">
        <div className="hp-collection-chips" role="list">
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
                onClick={() =>
                  setActiveCollectionCats((prev) => ({
                    ...prev,
                    [audienceLabel]: cat.id,
                  }))
                }
              >
                <span className="hp-collection-chip-icon" aria-hidden="true">
                  {icon ? <img src={icon} alt="" loading="lazy" /> : <span>{fallback}</span>}
                </span>
                <span className="hp-collection-chip-label">{cat.name}</span>
              </button>
            );
          })}
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
                  onClick={() => navigate(`/shop?category_id=${sub.id}`)}
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
  };

  return (
    <div className="hp">
      <div className="hp-utility-bar">
        <div className="hp-utility-left">
          {UTILITY_ITEMS.map((item) => (
            <span key={item.label} className="hp-utility-item">
              <item.icon /> {item.label}
            </span>
          ))}
        </div>
      </div>

      <div className="hp-sticky-head">
        <header className="hp-main-header">
          <button type="button" className="hp-brand" onClick={() => navigate('/')}>
            <img src="/images/logo.png" alt="Blinkiefash" className="hp-logo" />
            <span className="hp-brand-text">
              <span className="hp-brand-name">
                BLINKIE<span className="hp-brand-accent">FASH</span>
              </span>
              <span className="hp-tagline">DELIVERED IN 60 MINUTES</span>
            </span>
          </button>

          <form className="hp-header-search" onSubmit={handleSearch}>
            <MdSearch className="hp-search-icon" />
            <input name="q" type="text" placeholder="Search Ethnic Wear, Sneakers, Bags & more..." />
            <button type="submit" className="hp-search-btn">
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

        <nav className="hp-category-nav">
          <button type="button" className="hp-shop-by-cat" onClick={() => navigate('/shop')}>
            <MdMenu /> Shop By Category
          </button>
          <div className="hp-nav-links">
            {categories.slice(0, 8).map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="hp-nav-link"
                onClick={() => navigate(`/shop?category_id=${cat.id}`)}
              >
                {cat.name}
              </button>
            ))}
            <button type="button" className="hp-nav-link hp-nav-more" onClick={() => navigate('/shop')}>
              More <MdKeyboardArrowDown />
            </button>
          </div>
          <button type="button" className="hp-nav-location" onClick={openLocationSheet}>
            <MdLocationOn />
            <span>{locating ? 'Detecting...' : city}</span>
            <MdKeyboardArrowDown />
          </button>
        </nav>
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

        {categories.length > 0 && (
          <section className="section hp-cat-section">
            <div className="hp-section-head">
              <h2>SHOP BY CATEGORY</h2>
              <button type="button" onClick={() => navigate('/shop')}>
                View All Categories <MdChevronRight />
              </button>
            </div>
            <div className="hp-category-grid">
              {categories.map((cat, i) => {
                const img = resolveImageUrl(cat.category_url ?? cat.image);
                return (
                  <button
                    key={cat.id}
                    type="button"
                    className="hp-cat-tile"
                    onClick={() => navigate(`/shop?category_id=${cat.id}`)}
                  >
                    <span className="hp-cat-square" style={{ background: CAT_TILE_BG[i % CAT_TILE_BG.length] }}>
                      {img ? <img src={img} alt={cat.name} /> : <span className="hp-cat-fallback">{cat.name.slice(0, 1)}</span>}
                    </span>
                    <span className="hp-cat-label">{cat.name}</span>
                  </button>
                );
              })}
              <button type="button" className="hp-cat-tile" onClick={() => navigate('/shop')}>
                <span className="hp-cat-square hp-cat-more-square">
                  <MdMoreHoriz />
                </span>
                <span className="hp-cat-label">More</span>
              </button>
            </div>
          </section>
        )}

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
            <div className="hp-deals-rail" role="list">
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
                        <span className="hp-deal-off">{p._discount > 0 ? `${p._discount}% OFF` : 'BESTSELLER'}</span>
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
            <div className="hp-deals-rail" role="list">
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
                        <span className="hp-deal-off">{p._discount > 0 ? `${p._discount}% OFF` : 'JUST IN'}</span>
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
            <div className="hp-deals-rail" role="list">
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
          </section>
        )}

        {(mensProducts.length > 0 || mensCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>MEN&apos;S COLLECTION</h2>
              <button type="button" onClick={() => navigate('/shop?search=men')}>
                View All <MdChevronRight />
              </button>
            </div>
            {renderCategoryChips(mensCats, 'Men')}
            {mensProducts.length > 0 ? renderRailCards(mensProducts, 'men') : null}
          </section>
        )}

        {(womensProducts.length > 0 || womensCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>WOMEN&apos;S COLLECTION</h2>
              <button type="button" onClick={() => navigate('/shop?search=women')}>
                View All <MdChevronRight />
              </button>
            </div>
            {renderCategoryChips(womensCats, 'Women')}
            {womensProducts.length > 0 ? renderRailCards(womensProducts, 'women') : null}
          </section>
        )}

        {(kidsProducts.length > 0 || kidsCats.length > 0) && (
          <section className="section hp-feed-rail-section">
            <div className="hp-section-head hp-feed-head">
              <h2>KIDS COLLECTION</h2>
              <button type="button" onClick={() => navigate('/shop?search=kids')}>
                View All <MdChevronRight />
              </button>
            </div>
            {renderCategoryChips(kidsCats, 'Kids')}
            {kidsProducts.length > 0 ? renderRailCards(kidsProducts, 'kids') : null}
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
            {renderCategoryChips(electronicsCats, 'Electronics')}
            {electronicsProducts.length > 0 ? renderRailCards(electronicsProducts, 'electronics') : null}
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
            {renderCategoryChips(trendyShoesCats, 'Trendy Shoes')}
            {trendyShoesProducts.length > 0 ? renderRailCards(trendyShoesProducts, 'shoes') : null}
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
            {renderRailCards(under999Products, 'under999')}
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
            {renderRailCards(under1999Products, 'under1999')}
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
                      {image ? <img src={image} alt={p.name} loading="lazy" /> : <div className="hp-deal-fallback">No image</div>}
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
