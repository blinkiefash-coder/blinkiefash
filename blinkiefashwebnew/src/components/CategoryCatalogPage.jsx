import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { MdGridView } from "react-icons/md";

import Footer from "./Footer";
import Navbar from "./Navbar";
import PageSEO from "./PageSEO";
import ProductCard, { ProductCardSkeleton } from "./ProductCard";
import FilterBar from "./FilterBar";
import { getProducts, getCategories } from "../api";
import { API_BASE_URL } from "../apiBase";
import { getCached, setCached } from "../hooks/useProductCache";
import "../pages/Shop.css"; // reuse catalog-* layout classes for visual parity with Shop/Men/Women/Kids
import "./CategoryCatalogPage.css";

const PAGE_SIZE = 24;
const FETCH_LIMIT = 100; // coarse fetch; filtering/sorting happens client-side

/* ------------------------------------------------------------------ */
/* Data-shape + category helpers                                       */
/* (same pattern Men.jsx/Women.jsx/Kids.jsx each already duplicate —    */
/* centralized once here since Electronics.jsx and Footwear.jsx share  */
/* this component instead of each re-implementing it.)                 */
/* ------------------------------------------------------------------ */

function resolveImageUrl(raw) {
  const value = (raw ?? "").toString().trim();
  if (!value) return null;
  if (value.startsWith("http")) return value;
  if (value.startsWith("/")) return `${API_BASE_URL}${value}`;
  return `${API_BASE_URL}/${value}`;
}

function extractProducts(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.products)) return payload.products;
  return [];
}

// Finds the root category id for a name, tolerating slight naming
// differences ("Electronics" vs "Electronic Gadgets") without accidentally
// matching an unrelated root.
function rootIdForAny(allCats, names) {
  const needles = (Array.isArray(names) ? names : [names])
    .map((n) => (n || "").toString().toLowerCase().trim())
    .filter(Boolean);
  if (!needles.length) return null;

  const exact = allCats.find((c) => {
    if (c.parent_id) return false;
    const name = (c?.name || "").toString().toLowerCase().trim();
    return needles.some((needle) => name === needle);
  });
  if (exact) return exact.id;

  const loose = allCats.find((c) => {
    if (c.parent_id) return false;
    const name = (c?.name || "").toString().toLowerCase().trim();
    return needles.some((needle) => name.includes(needle) || needle.includes(name));
  });
  return loose?.id || null;
}

function childCatsFor(allCats, rootId) {
  if (!rootId) return [];
  return allCats
    .filter((c) => String(c.parent_id) === String(rootId))
    .map((c) => ({ id: c.id, name: (c?.name || "").toString().trim() }))
    .filter((c) => c.name);
}

function directChildNameFor(allCats, categoryId, rootId) {
  const categoriesById = new Map(allCats.map((category) => [String(category.id), category]));
  let current = categoriesById.get(String(categoryId));

  while (current?.parent_id) {
    if (String(current.parent_id) === String(rootId)) return current.name;
    current = categoriesById.get(String(current.parent_id));
  }

  return current && String(current.id) === String(rootId) ? current.name : "";
}

/**
 * Normalizes a raw API row into the same shape ProductCard (and every
 * other section) already expects: id, name, price (MRP), discount_price
 * (sale price), image, rating, stock. Extra fields are harmless —
 * ProductCard ignores anything it doesn't read.
 */
function normalizeProduct(p, sectionLabel) {
  const salePrice = Number(p.discount_price ?? p.price ?? 0);
  const originalPrice = Number(p.price ?? p.original_price ?? salePrice);
  const image = resolveImageUrl(p.image || p.image_url || p.thumbnail);
  const stock = Number(p.available_stock ?? p.stock ?? 0);

  return {
    ...p,
    id: p.id,
    name: p.name,
    brand: p.brand,
    category: p.category_name || sectionLabel,
    category_name: p.category_name || sectionLabel,
    image,
    image_url: image,
    price: originalPrice,
    discount_price: salePrice,
    rating: Number(p.rating ?? p.avg_rating ?? 0), // backend doesn't return this yet — see migration notes
    review_count: Number(p.review_count ?? 0),
    stock,
    in_stock: p.in_stock ?? stock > 0,
    subcategory: (p.category_name || "").toString().trim(),
  };
}

/**
 * Fetches products for ONE category root only (Electronics OR Footwear,
 * never both — that's the point of splitting the page). Backend's
 * GET /api/products?category_id=... already returns the full subtree
 * (root + children + grandchildren), so this is a single scoped call.
 */
async function fetchCategoryProducts({ rootNames, sectionLabel }) {
  const categories = await getCategories();
  const rootId = rootIdForAny(categories, rootNames);

  const res = rootId
    ? await getProducts({ category_id: rootId, limit: FETCH_LIMIT, sort: "newest" })
    : { products: [] };

  return {
    products: extractProducts(res).map((p) => ({
      ...normalizeProduct(p, sectionLabel),
      subcategory:
        directChildNameFor(categories, p.category_id, rootId) ||
        (p.category_name || "").toString().trim(),
    })),
    subcategories: childCatsFor(categories, rootId),
  };
}

/* ------------------------------------------------------------------ */
/* Generic page component                                              */
/* ------------------------------------------------------------------ */

/**
 * Config-driven single-category catalog page.
 *
 * Props:
 * - sectionLabel: "Electronics" | "Footwear"  (used for normalization + empty states)
 * - rootNames: string[]  category-name candidates to resolve the root id
 * - fallbackSubcategories: string[]  shown until real subcategories load
 * - subcategoryIcons: { [lowercaseLabel]: IconComponent }
 * - cacheKey: string  unique per page so Electronics/Footwear caches don't collide
 * - pageTitle / pageDescription: SEO
 */
export default function CategoryCatalogPage({
  sectionLabel,
  rootNames,
  fallbackSubcategories = [],
  subcategoryIcons = {},
  cacheKey,
  pageTitle,
  pageDescription,
}) {
  const [searchParams, setSearchParams] = useSearchParams();

  const [allProducts, setAllProducts] = useState([]);
  const [subcategories, setSubcategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters synced to the URL so state survives refresh/share/back-button
  // (?sub=Sneakers&maxPrice=3000&minRating=4&sort=price_asc).
  const subcategory = searchParams.get("sub") || null;
  const maxPrice = Number(searchParams.get("maxPrice")) || 100000;
  const minRating = Number(searchParams.get("minRating")) || 0;
  const sort = searchParams.get("sort") || "popularity";
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const applyFilterPatch = useCallback(
    (patch) => {
      const next = new URLSearchParams(searchParams);
      Object.entries(patch).forEach(([key, value]) => {
        const paramKey = { subcategory: "sub" }[key] || key;
        if (value === null || value === undefined || value === "") {
          next.delete(paramKey);
        } else {
          next.set(paramKey, String(value));
        }
      });
      setSearchParams(next, { replace: true });
      setVisibleCount(PAGE_SIZE);
    },
    [searchParams, setSearchParams]
  );

  const clearAllFilters = useCallback(() => {
    setSearchParams({}, { replace: true });
    setVisibleCount(PAGE_SIZE);
  }, [setSearchParams]);

  /* ---- Fetch (with cross-navigation cache) ---- */
  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);

      const cached = getCached(cacheKey);
      if (cached) {
        setAllProducts(cached.products);
        setSubcategories(cached.subcategories);
        setLoading(false);
        return; // fresh cache hit — no network call at all
      }

      setLoading(true);
      try {
        const data = await fetchCategoryProducts({ rootNames, sectionLabel });
        if (cancelled) return;
        setCached(cacheKey, data);
        setAllProducts(data.products);
        setSubcategories(data.subcategories);
      } catch (err) {
        console.error(`[${sectionLabel}] failed to load products`, err);
        if (!cancelled) setError(err.message || "Failed to load products");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey]);

  /* ---- Derived: subcategory chips ---- */
  const activeSubcategories = useMemo(() => {
    const list = subcategories.length
      ? subcategories
      : fallbackSubcategories.map((name) => ({ id: name, name }));
    return list.map((c) => ({ id: c.id, label: c.name }));
  }, [subcategories, fallbackSubcategories]);

  const priceBounds = useMemo(() => {
    if (!allProducts.length) return { min: 0, max: 10000 };
    const prices = allProducts.map((p) => p.discount_price || p.price || 0);
    return { min: 0, max: Math.max(1000, Math.ceil(Math.max(...prices) / 100) * 100) };
  }, [allProducts]);

  /* ---- Client-side filter + sort pipeline ---- */
  const filteredProducts = useMemo(() => {
    let list = allProducts;

    if (subcategory) {
      list = list.filter(
        (p) => p.subcategory?.toLowerCase() === subcategory.toLowerCase()
      );
    }
    list = list.filter((p) => (p.discount_price || p.price || 0) <= maxPrice);
    if (minRating > 0) {
      list = list.filter((p) => (p.rating || 0) >= minRating);
    }

    const sorted = [...list];
    switch (sort) {
      case "price_asc":
        sorted.sort((a, b) => (a.discount_price || a.price) - (b.discount_price || b.price));
        break;
      case "price_desc":
        sorted.sort((a, b) => (b.discount_price || b.price) - (a.discount_price || a.price));
        break;
      case "rating":
        sorted.sort((a, b) => (b.rating || 0) - (a.rating || 0));
        break;
      case "popularity":
      default:
        // No popularity/sales metric from the backend yet — falls back to
        // bestseller flag first, then review_count as a proxy.
        sorted.sort((a, b) => {
          const bestsellerDelta = Number(b.is_bestseller) - Number(a.is_bestseller);
          if (bestsellerDelta !== 0) return bestsellerDelta;
          return (b.review_count || 0) - (a.review_count || 0);
        });
        break;
    }
    return sorted;
  }, [allProducts, subcategory, maxPrice, minRating, sort]);

  const visibleProducts = filteredProducts.slice(0, visibleCount);

  return (
    <div className="catalog-page ccp-page">
      <PageSEO title={pageTitle} description={pageDescription} />

      <Navbar />

      <main className="ccp-main">
        <div className="ccp-page-title-row">
          <h1 className="ccp-page-title">{sectionLabel}</h1>
        </div>

        <div className="ccp-layout">
          {/* Sidebar categories */}
          <aside className="ccp-sidebar" aria-label="Categories">
            <h2 className="ccp-sidebar-title">Categories</h2>
            <ul className="ccp-sidebar-list">
              <li>
                <button
                  type="button"
                  className={!subcategory ? "active" : ""}
                  onClick={() => applyFilterPatch({ subcategory: null })}
                >
                  <MdGridView aria-hidden="true" /> All {sectionLabel}
                </button>
              </li>
              {activeSubcategories.map((sub) => {
                const Icon = subcategoryIcons[sub.label.toLowerCase()] || MdGridView;
                return (
                  <li key={sub.id}>
                    <button
                      type="button"
                      className={subcategory === sub.label ? "active" : ""}
                      onClick={() => applyFilterPatch({ subcategory: sub.label })}
                    >
                      <Icon aria-hidden="true" /> {sub.label}
                    </button>
                  </li>
                );
              })}
            </ul>
          </aside>

          <div className="ccp-content">
            <FilterBar
              subcategories={activeSubcategories}
              filters={{ subcategory, maxPrice: Math.min(maxPrice, priceBounds.max), minRating, sort }}
              priceBounds={priceBounds}
              onChange={applyFilterPatch}
              onClearAll={clearAllFilters}
            />

            {error ? (
              <div className="catalog-empty-state">
                <h3>Couldn&apos;t load products</h3>
                <p>{error}</p>
              </div>
            ) : (
              <section className="catalog-products-grid">
                {loading
                  ? Array.from({ length: 12 }).map((_, i) => (
                      <ProductCardSkeleton key={`ccp-skeleton-${i}`} />
                    ))
                  : visibleProducts.map((product, index) => (
                      <ProductCard key={`${product.id}-${index}`} product={product} />
                    ))}

                {!loading && visibleProducts.length === 0 ? (
                  <div className="catalog-empty-state">
                    <h3>No products found</h3>
                    <p>Try a different category, or clear your filters.</p>
                  </div>
                ) : null}
              </section>
            )}

            {!loading && visibleCount < filteredProducts.length ? (
              <button
                type="button"
                className="catalog-load-more"
                onClick={() => setVisibleCount((prev) => prev + PAGE_SIZE)}
              >
                Load more products
              </button>
            ) : null}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
