import {
	MdFace,
	MdLocalFlorist,
	MdSpa,
	MdWaterDrop,
} from "react-icons/md";
import CategoryCatalogPage from "../components/CategoryCatalogPage";

const FALLBACK_SUBCATEGORIES = [
	"Makeup",
	"Skin care and Body care",
	"Hair care",
	"Fragnances",
	"Men's Grooming",
];

const SUBCATEGORY_ICONS = {
	makeup: MdFace,
	"skin care and body care": MdWaterDrop,
	"hair care": MdSpa,
	fragnances: MdLocalFlorist,
	"men's grooming": MdFace,
};

export default function Beauty() {
	return (
		<CategoryCatalogPage
			sectionLabel="Beauty"
			rootNames={["beauty"]}
			fallbackSubcategories={FALLBACK_SUBCATEGORIES}
			subcategoryIcons={SUBCATEGORY_ICONS}
			cacheKey="beauty:catalog:v1"
			searchPlaceholder="Search makeup, skincare, hair care..."
			pageTitle="Beauty | BlinkieFash"
			pageDescription="Shop makeup, skincare, hair care and grooming products — delivered fast."
		/>
	);
}
