import { useEffect, useMemo, useRef, useState } from "react";
import { MdClose, MdStar, MdTune } from "react-icons/md";
import "./filter.css";

const DEFAULT_COLORS = [
  ["Pink", "#ec4899"],
  ["Blue", "#2563eb"],
  ["Black", "#111827"],
  ["Green", "#22c55e"],
  ["Purple", "#7c3aed"],
  ["Red", "#ef4444"],
  ["Yellow", "#facc15"],
  ["White", "#ffffff"],
  ["Grey", "#9ca3af"],
];

const DEFAULT_DISCOUNT_BUCKETS = [10, 20, 30, 40, 50, 60, 70];
const DEFAULT_RATINGS = [4, 3, 2, 1];
const DEFAULT_SORT_OPTIONS = [
  { value: "popularity", label: "Popularity" },
  { value: "newest", label: "Newest first" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Customer rating" },
];

const emptyFilters = (priceBounds) => ({
  subcategory: null,
  brand: [],
  color: [],
  gender: [],
  minDiscount: 0,
  minRating: 0,
  inStockOnly: false,
  maxPrice: priceBounds.max,
  sort: DEFAULT_SORT_OPTIONS[0].value,
});

/**
 * One filter component for every catalog-style page (Home, Men, Women, Kids,
 * Shop, category listings). Replaces the old standalone `Filter` modal and
 * `FilterBar` inline bar.
 *
 * A slim, always-visible bar holds the subcategory chips and sort control;
 * everything else (brand, color, price, gender, rating, discount,
 * availability) lives in a panel opened from the "Filters" button — a
 * bottom sheet on narrow screens, a centered dialog on wider ones.
 *
 * Fully controlled: the parent owns `filters` and gets patches back via
 * `onChange(patch)`, e.g. `onChange({ subcategory: "Shirts" })`. Picks up
 * the page's accent color automatically through the existing
 * `--theme-primary` / `--theme-dark` CSS variables (falls back to
 * `--brand-green`), so it needs no per-page theming.
 *
 * Panel-only mode: pass `hideBar` + `open` + `onOpenChange` when the page
 * already has its own "Filter" trigger button and just wants this
 * component to render the panel itself — no second chips/sort/Filters bar
 * on top of it. In this mode, clicking the page's own trigger toggles
 * `open` directly, so the panel opens immediately with no extra click.
 */
export default function ProductFilter({
  ariaLabel = "Product filters",
  subcategories = [],
  brands = [],
  colors = DEFAULT_COLORS,
  availableGenders = [],
  discountBuckets = DEFAULT_DISCOUNT_BUCKETS,
  ratingOptions = DEFAULT_RATINGS,
  sortOptions = DEFAULT_SORT_OPTIONS,
  priceBounds = { min: 0, max: 10000 },
  filters,
  onChange,
  onClearAll,
  // Panel-only mode: pass `open` + `onOpenChange` when the page already has
  // its own "Filter" trigger button and just wants this component to render
  // the panel itself — no second chips/sort/Filters bar on top of it.
  open,
  onOpenChange,
  hideBar = false,
}) {
  const [internalOpen, setInternalOpen] = useState(false);
  const panelOpen = open ?? internalOpen;
  const setPanelOpen = onOpenChange ?? setInternalOpen;
  const [brandSearch, setBrandSearch] = useState("");
  const chipsRailRef = useRef(null);

  const defaults = useMemo(() => emptyFilters(priceBounds), [priceBounds]);
  const active = { ...defaults, ...filters };

  const activeFilterCount =
    (active.subcategory ? 1 : 0) +
    active.brand.length +
    active.color.length +
    active.gender.length +
    (active.minDiscount > 0 ? 1 : 0) +
    (active.minRating > 0 ? 1 : 0) +
    (active.inStockOnly ? 1 : 0) +
    (active.maxPrice < priceBounds.max ? 1 : 0);

  const patch = (fields) => onChange?.(fields);

  const toggleInList = (key, value) => {
    const list = active[key] || [];
    patch({
      [key]: list.includes(value) ? list.filter((v) => v !== value) : [...list, value],
    });
  };

  const clearAll = () => {
    setBrandSearch("");
    onClearAll?.();
  };

  const visibleBrands = useMemo(() => {
    const q = brandSearch.trim().toLowerCase();
    if (!q) return brands;
    return brands.filter((b) => b.name.toLowerCase().includes(q));
  }, [brands, brandSearch]);

  // Lock page scroll while the panel is open, and allow Escape to close it.
  //
  // `overflow: hidden` on the body alone stops desktop wheel-scrolling but
  // does NOT reliably stop touch-scrolling on mobile browsers — a drag that
  // starts on the backdrop, or one that "runs out" of scrollable content
  // inside the panel, can still chain through to scroll the page behind it
  // (iOS Safari in particular). Pinning the body with `position: fixed`
  // is the standard, reliable cross-browser fix: the page literally cannot
  // move while the panel is open, no matter where the touch/scroll starts.
  useEffect(() => {
    if (!panelOpen) return undefined;

    const onKey = (e) => e.key === "Escape" && setPanelOpen(false);
    document.addEventListener("keydown", onKey);

    const { body } = document;
    const scrollY = window.scrollY || window.pageYOffset || 0;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };

    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", onKey);
      body.style.position = prev.position;
      body.style.top = prev.top;
      body.style.left = prev.left;
      body.style.right = prev.right;
      body.style.width = prev.width;
      body.style.overflow = prev.overflow;
      // Restore the exact scroll position the page was at before the
      // panel opened, since fixing the body resets it to 0.
      window.scrollTo(0, scrollY);
    };
  }, [panelOpen, setPanelOpen]);

  // Lets the chip rail be scrolled programmatically (e.g. from left/right
  // arrow buttons) in addition to native touch/trackpad scrolling.
  const scrollChips = (dir) => {
    chipsRailRef.current?.scrollBy({ left: dir * 160, behavior: "smooth" });
  };

  return (
    <div className={`pf${hideBar ? " pf-embedded" : ""}`} role="region" aria-label={ariaLabel}>
      {/* ── Always-visible bar: subcategory chips + sort + filters button ── */}
      {!hideBar && (
      <div className="pf-bar">
        {subcategories.length > 0 && (
          <div className="pf-chips-rail-wrap">
            <button
              type="button"
              className="pf-chip-scroll pf-chip-scroll-left"
              onClick={() => scrollChips(-1)}
              aria-label="Scroll categories left"
            >
              ‹
            </button>

            <div className="pf-chips-rail" ref={chipsRailRef}>
              <button
                type="button"
                className={`pf-chip${!active.subcategory ? " active" : ""}`}
                onClick={() => patch({ subcategory: null })}
              >
                All
              </button>
              {subcategories.map((sub) => (
                <button
                  key={sub.id ?? sub.label}
                  type="button"
                  className={`pf-chip${active.subcategory === sub.label ? " active" : ""}`}
                  onClick={() => patch({ subcategory: sub.label })}
                  aria-pressed={active.subcategory === sub.label}
                >
                  {sub.label}
                  {typeof sub.count === "number" && <span className="pf-chip-count">{sub.count}</span>}
                </button>
              ))}
            </div>

            <button
              type="button"
              className="pf-chip-scroll pf-chip-scroll-right"
              onClick={() => scrollChips(1)}
              aria-label="Scroll categories right"
            >
              ›
            </button>
          </div>
        )}

        <div className="pf-bar-actions">
          <label className="pf-sort">
            <span>Sort</span>
            <select value={active.sort} onChange={(e) => patch({ sort: e.target.value })}>
              {sortOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            className="pf-open-btn"
            onClick={() => setPanelOpen(true)}
            aria-haspopup="dialog"
          >
            <MdTune aria-hidden="true" />
            Filters
            {activeFilterCount > 0 && <span className="pf-badge">{activeFilterCount}</span>}
          </button>

          {activeFilterCount > 0 && (
            <button type="button" className="pf-clear-inline" onClick={clearAll}>
              <MdClose aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>
      )}

      {/* ── Full filter panel: bottom sheet on mobile, dialog on desktop ── */}
      {panelOpen && (
        <div className="pf-backdrop" role="presentation" onClick={() => setPanelOpen(false)}>
          <section
            className="pf-panel"
            role="dialog"
            aria-modal="true"
            aria-label="All filters"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="pf-panel-handle" aria-hidden="true" />

            <header className="pf-panel-header">
              <div className="pf-panel-heading">
                <span className="pf-panel-icon">
                  <MdTune aria-hidden="true" />
                </span>
                <div>
                  <h3>Filters</h3>
                  <p>Narrow down what you see</p>
                </div>
              </div>
              <div className="pf-panel-header-actions">
                {activeFilterCount > 0 && (
                  <button type="button" className="pf-text-btn" onClick={clearAll}>
                    Clear all
                  </button>
                )}
                <button
                  type="button"
                  className="pf-icon-btn"
                  onClick={() => setPanelOpen(false)}
                  aria-label="Close filters"
                >
                  <MdClose />
                </button>
              </div>
            </header>

            <div className="pf-panel-body">
              {brands.length > 0 && (
                <div className="pf-section">
                  <h4>Brand</h4>
                  <input
                    className="pf-search"
                    value={brandSearch}
                    onChange={(e) => setBrandSearch(e.target.value)}
                    placeholder="Search brand"
                  />
                  <div className="pf-list pf-list-scroll">
                    {visibleBrands.map((brand) => (
                      <label key={brand.id ?? brand.name} className="pf-check">
                        <input
                          type="checkbox"
                          checked={active.brand.includes(brand.name)}
                          onChange={() => toggleInList("brand", brand.name)}
                        />
                        <span>{brand.name}</span>
                      </label>
                    ))}
                    {visibleBrands.length === 0 && (
                      <p className="pf-empty">No brands match &quot;{brandSearch}&quot;</p>
                    )}
                  </div>
                </div>
              )}

              <div className="pf-section">
                <h4>Color</h4>
                <div className="pf-swatches">
                  {colors.map(([name, hex]) => {
                    const checked = active.color.includes(name);
                    return (
                      <label key={name} className={`pf-swatch${checked ? " checked" : ""}`}>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleInList("color", name)}
                        />
                        <span className="pf-swatch-dot" style={{ background: hex }} />
                        <span>{name}</span>
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="pf-section">
                <h4>Price</h4>
                <input
                  type="range"
                  className="pf-range"
                  min={priceBounds.min}
                  max={priceBounds.max}
                  step={Math.max(100, Math.round((priceBounds.max - priceBounds.min) / 50))}
                  value={active.maxPrice}
                  onChange={(e) => patch({ maxPrice: Number(e.target.value) })}
                />
                <p className="pf-range-value">Up to ₹{active.maxPrice.toLocaleString("en-IN")}</p>
              </div>

              {availableGenders.length > 0 && (
                <div className="pf-section">
                  <h4>Gender</h4>
                  <div className="pf-chip-group">
                    {availableGenders.map((name) => (
                      <button
                        key={name}
                        type="button"
                        className={`pf-mini-chip${active.gender.includes(name) ? " active" : ""}`}
                        onClick={() => toggleInList("gender", name)}
                        aria-pressed={active.gender.includes(name)}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {ratingOptions.length > 0 && (
                <div className="pf-section">
                  <h4>Rating</h4>
                  <div className="pf-rating-group">
                    {ratingOptions.map((stars) => (
                      <button
                        key={stars}
                        type="button"
                        className={`pf-rating-btn${active.minRating === stars ? " active" : ""}`}
                        onClick={() =>
                          patch({ minRating: active.minRating === stars ? 0 : stars })
                        }
                        aria-pressed={active.minRating === stars}
                      >
                        {stars}
                        <MdStar aria-hidden="true" />+
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="pf-section">
                <h4>Discount</h4>
                <div className="pf-chip-group">
                  {discountBuckets.map((value) => (
                    <button
                      key={value}
                      type="button"
                      className={`pf-mini-chip${active.minDiscount === value ? " active" : ""}`}
                      onClick={() => patch({ minDiscount: active.minDiscount === value ? 0 : value })}
                    >
                      {value}% and above
                    </button>
                  ))}
                </div>
              </div>

              <div className="pf-section">
                <h4>Availability</h4>
                <label className="pf-toggle-row">
                  <span>In stock only</span>
                  <span className="pf-toggle">
                    <input
                      type="checkbox"
                      checked={active.inStockOnly}
                      onChange={(e) => patch({ inStockOnly: e.target.checked })}
                    />
                    <span className="pf-toggle-track">
                      <span className="pf-toggle-thumb" />
                    </span>
                  </span>
                </label>
              </div>
            </div>

            <footer className="pf-panel-footer">
              <span className="pf-live-note">Results update instantly</span>
              <button type="button" className="pf-apply-btn" onClick={() => setPanelOpen(false)}>
                Show results
              </button>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}