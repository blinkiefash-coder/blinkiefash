import { MdStar, MdClose } from "react-icons/md";
import "./FilterBar.css";

/**
 * Reusable filter/sort bar for catalog-style pages.
 *
 * Fully controlled: the parent owns `filters` state (typically synced to
 * the URL via useSearchParams — see ElectronicsFootwear.jsx) and passes
 * it down along with a single onChange(patch) callback. FilterBar never
 * calls the API itself; it only ever hands back partial filter updates,
 * e.g. onChange({ subcategory: "Phones" }).
 *
 * Props:
 * - subcategories: [{ id, label, count? }]  chips for the active section
 * - filters: { subcategory, minPrice, maxPrice, minRating, sort }
 * - priceBounds: { min, max }  slider bounds (from the loaded product set)
 * - sortOptions: [{ value, label }]
 * - onChange(patch): merges patch into parent's filter state
 * - onClearAll(): resets every filter
 */
export default function FilterBar({
  subcategories = [],
  filters,
  priceBounds = { min: 0, max: 10000 },
  sortOptions = [
    { value: "popularity", label: "Popularity" },
    { value: "price_asc", label: "Price: Low to High" },
    { value: "price_desc", label: "Price: High to Low" },
    { value: "rating", label: "Customer Rating" },
  ],
  onChange,
  onClearAll,
}) {
  const activeFilterCount =
    (filters.subcategory ? 1 : 0) +
    (filters.minRating > 0 ? 1 : 0) +
    (filters.maxPrice < priceBounds.max ? 1 : 0);

  return (
    <div className="fbar" role="region" aria-label="Filter and sort products">
      {/* Subcategory chips */}
      <div className="fbar-row fbar-chips" role="group" aria-label="Filter by subcategory">
        <button
          type="button"
          className={`fbar-chip ${!filters.subcategory ? "active" : ""}`}
          onClick={() => onChange({ subcategory: null })}
        >
          All
        </button>
        {subcategories.map((sub) => (
          <button
            key={sub.id}
            type="button"
            className={`fbar-chip ${filters.subcategory === sub.label ? "active" : ""}`}
            onClick={() => onChange({ subcategory: sub.label })}
            aria-pressed={filters.subcategory === sub.label}
          >
            {sub.label}
            {typeof sub.count === "number" ? (
              <span className="fbar-chip-count">{sub.count}</span>
            ) : null}
          </button>
        ))}
      </div>

      <div className="fbar-row fbar-controls">
        {/* Price range */}
        <label className="fbar-control fbar-price">
          <span className="fbar-control-label">
            Max price: ₹{filters.maxPrice.toLocaleString("en-IN")}
          </span>
          <input
            type="range"
            min={priceBounds.min}
            max={priceBounds.max}
            step={Math.max(100, Math.round((priceBounds.max - priceBounds.min) / 50))}
            value={filters.maxPrice}
            onChange={(e) => onChange({ maxPrice: Number(e.target.value) })}
            aria-label="Maximum price"
          />
        </label>

        {/* Rating */}
        <div className="fbar-control fbar-rating" role="group" aria-label="Minimum rating">
          <span className="fbar-control-label">Rating</span>
          <div className="fbar-rating-buttons">
            {[4, 3, 2, 1].map((stars) => (
              <button
                key={stars}
                type="button"
                className={`fbar-rating-btn ${filters.minRating === stars ? "active" : ""}`}
                onClick={() =>
                  onChange({ minRating: filters.minRating === stars ? 0 : stars })
                }
                aria-pressed={filters.minRating === stars}
                aria-label={`${stars} stars and up`}
              >
                {stars}<MdStar aria-hidden="true" />+
              </button>
            ))}
          </div>
        </div>

        {/* Sort */}
        <label className="fbar-control fbar-sort">
          <span className="fbar-control-label">Sort by</span>
          <select
            value={filters.sort}
            onChange={(e) => onChange({ sort: e.target.value })}
            aria-label="Sort products"
          >
            {sortOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </label>

        {activeFilterCount > 0 ? (
          <button type="button" className="fbar-clear" onClick={onClearAll}>
            <MdClose aria-hidden="true" /> Clear filters ({activeFilterCount})
          </button>
        ) : null}
      </div>
    </div>
  );
}
