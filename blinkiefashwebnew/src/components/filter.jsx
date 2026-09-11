import { useEffect, useRef } from "react";
import { MdClose, MdTune } from "react-icons/md";
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

export default function Filter({
	prefix = "catalog",
	ariaLabel = "Product filters",
	brands = [],
	visibleBrands = brands,
	colors = DEFAULT_COLORS,
	discountBuckets = DEFAULT_DISCOUNT_BUCKETS,
	availableGenders = [],
	activeBrand,
	setActiveBrand,
	activeColor,
	setActiveColor,
	activeGender,
	setActiveGender,
	minDiscount,
	setMinDiscount,
	inStockOnly,
	setInStockOnly,
	maxPrice,
	setMaxPrice,
	brandSearch,
	setBrandSearch,
	activeFilterCount,
	clearAllFilters,
	applyFilters,
	onClose,
	minPrice = 500,
	maxPriceLimit = 12000,
}) {
	const className = (name) => `${prefix}-${name}`;
	const hasGender = availableGenders.length > 0 && activeGender && setActiveGender;
	const autoApplyPending = useRef(false);

	const requestAutoApply = () => {
		autoApplyPending.current = true;
	};

	useEffect(() => {
		if (!autoApplyPending.current) return;
		autoApplyPending.current = false;
		applyFilters({ close: false });
	}, [activeBrand, activeColor, activeGender, minDiscount, inStockOnly, maxPrice, applyFilters]);

	useEffect(() => {
		const handleEscape = (event) => {
			if (event.key === "Escape") onClose();
		};

		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		document.addEventListener("keydown", handleEscape);
		return () => {
			document.body.style.overflow = previousOverflow;
			document.removeEventListener("keydown", handleEscape);
		};
	}, [onClose]);

	const toggleValue = (value, values, setValues) => {
		requestAutoApply();
		setValues((previous) =>
			previous.includes(value)
				? previous.filter((item) => item !== value)
				: [...previous, value]
		);
	};

	return (
		<div className="filter-modal-backdrop" role="presentation" onClick={onClose}>
		<section
			className={`${className("filters-panel")} filter-panel-shell${hasGender ? " has-gender" : ""}`}
			role="dialog"
			aria-modal="true"
			aria-label={ariaLabel}
			onClick={(event) => event.stopPropagation()}
		>
			<div className={className("filters-panel-header")}>
				<div className="filter-panel-heading">
					<span className="filter-panel-icon"><MdTune aria-hidden="true" /></span>
					<div>
						<h3>Filters</h3>
						<p>Refine your style, your way</p>
					</div>
				</div>
				<div className={className("filters-panel-header-actions")}>
					{activeFilterCount > 0 ? (
						<button type="button" className={className("filters-clear")} onClick={clearAllFilters}>
							Clear All
						</button>
					) : null}
					<button type="button" className={className("filters-close")} onClick={onClose} aria-label="Close filters">
						<MdClose />
					</button>
				</div>
			</div>

			<div className={`${className("filter-col")} filter-section`}>
				<h4>
					Brand
					{prefix === "catalog" && brands.length > 0 ? (
						<span className={className("filter-col-count")}> ({brands.length})</span>
					) : null}
				</h4>
				<input
					className={className("filter-search")}
					value={brandSearch}
					onChange={(event) => setBrandSearch(event.target.value)}
					placeholder="Search brand"
				/>
				<div className={`${className("filter-list")} ${prefix === "catalog" ? className("filter-list-brands") : ""}`}>
					{visibleBrands.map((brand) => (
						<label key={brand.id || brand.name}>
							<input
								type="checkbox"
								checked={activeBrand.includes(brand.name)}
								onChange={() => toggleValue(brand.name, activeBrand, setActiveBrand)}
							/>
							<span>{brand.name}</span>
						</label>
					))}
					{prefix === "catalog" && visibleBrands.length === 0 ? (
						<p className={className("filter-empty")}>No brands match &quot;{brandSearch}&quot;</p>
					) : null}
				</div>
			</div>

			<div className={`${className("filter-col")} filter-section`}>
				<h4>Color</h4>
				<div className={`${className("filter-list")} ${className("filter-swatches")}`}>
					{colors.map(([name, hex]) => {
						const checked = activeColor.includes(name.toLowerCase()) || activeColor.includes(name);
						return (
							<label key={name} className={`${className("swatch-label")}${checked ? " checked" : ""}`}>
								<input
									type="checkbox"
									checked={checked}
									onChange={() => toggleValue(name, activeColor, setActiveColor)}
								/>
								<span className={className("swatch-dot")} style={{ background: hex }} />
								<span>{name}</span>
							</label>
						);
					})}
				</div>
			</div>

			<div className={`${className("filter-col")} filter-section`}>
				<h4>Price</h4>
				<input
					type="range"
					min={minPrice}
					max={maxPriceLimit}
					step="100"
					value={maxPrice}
					onChange={(event) => {
						requestAutoApply();
						setMaxPrice(Number(event.target.value));
					}}
				/>
				<p>Up to {prefix === "catalog" ? "Rs. " : "₹"}{maxPrice.toLocaleString("en-IN")}</p>
			</div>

			{hasGender ? (
				<div className={`${className("filter-col")} filter-section`}>
					<h4>Gender</h4>
					<div className={className("filter-list")}>
						{availableGenders.map((name) => (
							<label key={name}>
								<input
									type="checkbox"
									checked={activeGender.includes(name)}
									onChange={() => toggleValue(name, activeGender, setActiveGender)}
								/>
								<span>{name}</span>
							</label>
						))}
					</div>
				</div>
			) : null}

			<div className={`${className("filter-col")} filter-section`}>
				<h4>Discount Range</h4>
				<div className={className(prefix === "catalog" || prefix === "men" ? "filter-chips" : "filter-discount-chips")}>
					{discountBuckets.map((value) => (
						<button
							key={value}
							type="button"
							  className={`${className(prefix === "catalog" ? "filter-chip" : "filter-chip-item")} ${minDiscount === value ? "active" : ""}`}
							onClick={() => {
								requestAutoApply();
								setMinDiscount((previous) => (previous === value ? 0 : value));
							}}
						>
							{value}% and above
						</button>
					))}
				</div>
			</div>

			<div className={`${className("filter-col")} filter-section`}>
				<h4>Availability</h4>
				<div className={className("filter-list")}>
					<label>
						<input
							type="checkbox"
							checked={inStockOnly}
							onChange={(event) => {
								requestAutoApply();
								setInStockOnly(event.target.checked);
							}}
						/>
						<span>In stock only</span>
					</label>
				</div>
			</div>

			<div className={`${className("filters-footer")} filter-panel-footer`}>
				<span className="filter-live-note">Filters update instantly</span>
				<button type="button" className={className("filters-apply")} onClick={applyFilters}>
					Done
				</button>
			</div>
		</section>
		</div>
	);
}
