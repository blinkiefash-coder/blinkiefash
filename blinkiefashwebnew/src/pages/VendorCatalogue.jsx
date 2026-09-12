import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import VendorLayout from "../components/VendorLayout";
import { API_API_BASE_URL } from "../apiBase";
import { fetchVendorProfile } from "../utils/vendorSession";
import { isAdmin } from "../utils/adminSession";
import "./VendorCatalogue.css";

const PAGE_SIZE = 100;

function getNumber(value) {
	const number = Number(value);
	return Number.isFinite(number) ? number : null;
}

function formatPrice(value) {
	const number = getNumber(value);
	return number === null ? "Price on request" : `Rs. ${number.toLocaleString("en-IN")}`;
}

function groupProducts(rows) {
	const productsById = new Map();

	rows.forEach((row) => {
		const id = String(row.id || row.name || Math.random());
		const existing = productsById.get(id);
		const price = getNumber(row.discount_price ?? row.price);
		const mrp = getNumber(row.price);

		if (!existing) {
			productsById.set(id, {
				id,
				name: row.name || "Unnamed product",
				brand: row.brand || "Unbranded",
				category: row.category_name || "Uncategorised",
				image: row.image || "",
				price,
				mrp,
				colors: row.color ? [row.color] : [],
			});
			return;
		}

		if (price !== null && (existing.price === null || price < existing.price)) existing.price = price;
		if (mrp !== null && (existing.mrp === null || mrp < existing.mrp)) existing.mrp = mrp;
		if (!existing.image && row.image) existing.image = row.image;
		if (row.color && !existing.colors.includes(row.color)) existing.colors.push(row.color);
	});

	return Array.from(productsById.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function VendorCatalogue() {
	const navigate = useNavigate();
	const adminMode = isAdmin();
	const [storeName, setStoreName] = useState(() => localStorage.getItem("store_name") || "My Store");
	const [products, setProducts] = useState([]);
	const [searchTerm, setSearchTerm] = useState("");
	const [loading, setLoading] = useState(true);
	const [refreshing, setRefreshing] = useState(false);
	const [error, setError] = useState("");
	const [lastUpdated, setLastUpdated] = useState(null);
	const [selectedBrand, setSelectedBrand] = useState("");

	const loadCatalogue = useCallback(async () => {
		setRefreshing(true);
		setError("");

		try {
			const rows = [];
			let offset = 0;

			while (true) {
				const response = await fetch(
					`${API_API_BASE_URL}/products?catalog=all&sort=name_asc&limit=${PAGE_SIZE}&offset=${offset}`
				);
				if (!response.ok) throw new Error(`Request failed (${response.status})`);
				const data = await response.json();
				const page = Array.isArray(data.products) ? data.products : [];
				rows.push(...page);
				if (page.length < PAGE_SIZE) break;
				offset += page.length;
			}

			setProducts(groupProducts(rows));
			setLastUpdated(new Date());
		} catch (loadError) {
			setError(loadError.message || "Could not load the catalogue.");
		} finally {
			setLoading(false);
			setRefreshing(false);
		}
	}, []);

	useEffect(() => {
		if (!adminMode && !localStorage.getItem("vendor_id")) {
			navigate("/vendor", { replace: true });
			return;
		}

		fetchVendorProfile(localStorage.getItem("vendor_id") || "").then((vendor) => {
			if (vendor?.store_name) {
				setStoreName(vendor.store_name);
				localStorage.setItem("store_name", vendor.store_name);
			}
		});
		const catalogueLoad = window.setTimeout(loadCatalogue, 0);
		const catalogueRefresh = window.setInterval(loadCatalogue, 60000);
		return () => {
			window.clearTimeout(catalogueLoad);
			window.clearInterval(catalogueRefresh);
		};
	}, [adminMode, loadCatalogue, navigate]);

	const brands = useMemo(() => {
		const search = searchTerm.trim().toLowerCase();
		const matchingProducts = products.filter((product) => {
			if (!search) return true;
			return [product.name, product.brand, product.category].some((value) =>
				value.toLowerCase().includes(search)
			);
		});
		const grouped = new Map();

		matchingProducts.forEach((product) => {
			if (!grouped.has(product.brand)) grouped.set(product.brand, []);
			grouped.get(product.brand).push(product);
		});

		return Array.from(grouped.entries()).sort(([a], [b]) => a.localeCompare(b));
	}, [products, searchTerm]);

	const visibleBrands = selectedBrand
		? brands.filter(([brand]) => brand === selectedBrand)
		: brands;

	const handleMenuClick = (item) => {
		if (item.key === "catalogue") return;
		if (item.key === "orders") navigate("/vendor/orders");
		if (item.key === "products") navigate("/vendor/add-product");
		if (item.key === "edit") navigate("/vendor/edit-product");
		if (item.key === "stock") navigate("/vendor/stock-monitoring");
		if (item.key === "analytics") navigate("/vendor/product-analytics");
		if (item.key === "profile") navigate("/vendor/profile");
		if (item.key === "create-vendor") navigate("/vendor/create-vendor");
		if (item.key === "manage-categories") navigate("/vendor/manage-categories");
	};

	const downloadPdf = () => {
		const previousTitle = document.title;
		document.title = "BlinkieFash Vendor Catalogue";
		window.print();
		window.setTimeout(() => {
			document.title = previousTitle;
		}, 1000);
	};

	const downloadBrandPdf = () => {
		if (!selectedBrand) return;
		const previousTitle = document.title;
		document.title = `BlinkieFash ${selectedBrand} Catalogue`;
		window.print();
		window.setTimeout(() => {
			document.title = previousTitle;
		}, 1000);
	};

	return (
		<VendorLayout activeKey="catalogue" storeName={storeName} onMenuClick={handleMenuClick}>
			<section className="vendor-catalogue-page">
				<div className="vendor-catalogue-heading">
					<div>
						<span className="vendor-catalogue-kicker">Live product directory</span>
						<h1>{selectedBrand || "Vendor Catalogue"}</h1>
						<p>{selectedBrand ? `Products listed under ${selectedBrand}.` : "Every active brand and product in the catalogue, ready to share as a PDF."}</p>
					</div>
					<div className="vendor-catalogue-actions">
						{selectedBrand ? (
							<button type="button" className="vendor-catalogue-secondary" onClick={() => setSelectedBrand("")}>
								All brands
							</button>
						) : null}
						<button type="button" className="vendor-catalogue-secondary" onClick={loadCatalogue} disabled={refreshing}>
							{refreshing ? "Refreshing..." : "Refresh catalogue"}
						</button>
						<button type="button" className="vendor-catalogue-primary" onClick={selectedBrand ? downloadBrandPdf : downloadPdf} disabled={loading || products.length === 0}>
							{selectedBrand ? `Download ${selectedBrand} PDF` : "Download PDF"}
						</button>
					</div>
				</div>

				<div className="vendor-catalogue-toolbar">
					<label htmlFor="catalogue-search">Search brands or products</label>
					<input
						id="catalogue-search"
						type="search"
						value={searchTerm}
						onChange={(event) => setSearchTerm(event.target.value)}
						placeholder="Search the live catalogue"
					/>
					<span className="vendor-catalogue-updated">
						{lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}` : "Loading latest products"}
					</span>
				</div>

				{error ? <div className="vendor-catalogue-message error">{error}</div> : null}
				{loading ? <div className="vendor-catalogue-message">Loading brands and products...</div> : null}
				{!loading && !error && brands.length === 0 ? <div className="vendor-catalogue-message">No products match this search.</div> : null}

				{!loading && !error ? (
					<div className="vendor-catalogue-brands">
						{visibleBrands.map(([brand, brandProducts]) => (
							<section className="vendor-brand-section" key={brand}>
								<button type="button" className="vendor-brand-heading" onClick={() => setSelectedBrand(brand)}>
									<h2>{brand}</h2>
									<span>{brandProducts.length} product{brandProducts.length === 1 ? "" : "s"} · View brand PDF</span>
								</button>
								<div className="vendor-catalogue-table-wrap">
									<table className="vendor-catalogue-table">
										<thead>
											<tr><th>Product</th><th>Category</th><th>Available colours</th><th>From</th></tr>
										</thead>
										<tbody>
											{brandProducts.map((product) => (
												<tr key={product.id}>
													<td>
														<div className="vendor-product-name">
															{product.image ? (
																<img src={product.image} alt="" className="vendor-product-thumbnail" />
															) : <span className="vendor-product-thumbnail vendor-product-thumbnail-empty">No image</span>}
															<span>{product.name}</span>
														</div>
													</td>
													<td>{product.category}</td>
													<td>{product.colors.length ? product.colors.join(", ") : "-"}</td>
													<td>{formatPrice(product.price)}</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</section>
						))}
					</div>
				) : null}
			</section>
		</VendorLayout>
	);
}
