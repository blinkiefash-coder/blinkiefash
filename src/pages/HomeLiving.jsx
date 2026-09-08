import {
	MdBed,
	MdCardGiftcard,
	MdHome,
	MdStorage,
} from "react-icons/md";
import CategoryCatalogPage from "../components/CategoryCatalogPage";

const FALLBACK_SUBCATEGORIES = ["Home Decor", "Bed and Furnishing", "Storage", "Gifting"];

const SUBCATEGORY_ICONS = {
	"home decor": MdHome,
	"bed and furnishing": MdBed,
	storage: MdStorage,
	gifting: MdCardGiftcard,
};

export default function HomeLiving() {
	return (
		<CategoryCatalogPage
			sectionLabel="Home & Living"
			rootNames={["home living", "home & living", "home"]}
			fallbackSubcategories={FALLBACK_SUBCATEGORIES}
			subcategoryIcons={SUBCATEGORY_ICONS}
			cacheKey="home-living:catalog:v1"
			searchPlaceholder="Search home decor, furnishing, storage..."
			pageTitle="Home & Living | BlinkieFash"
			pageDescription="Shop home decor, furnishings, storage and gifting products — delivered fast."
		/>
	);
}
