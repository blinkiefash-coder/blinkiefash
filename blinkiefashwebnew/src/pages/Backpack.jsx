import {
	MdBackpack,
	MdBusinessCenter,
	MdHiking,
	MdSchool,
	MdWork,
} from "react-icons/md";
import CategoryCatalogPage from "../components/CategoryCatalogPage";

const FALLBACK_SUBCATEGORIES = ["Backpacks", "School Bags", "Laptop Bags", "Travel Bags"];

const SUBCATEGORY_ICONS = {
	backpacks: MdBackpack,
	"school bags": MdSchool,
	"laptop bags": MdWork,
	"travel bags": MdHiking,
	briefcases: MdBusinessCenter,
};

export default function Backpack() {
	return (
		<CategoryCatalogPage
			sectionLabel="Backpack"
			rootNames={["backpack", "backpacks", "bags", "travel bags"]}
			fallbackSubcategories={FALLBACK_SUBCATEGORIES}
			subcategoryIcons={SUBCATEGORY_ICONS}
			cacheKey="backpack:catalog:v1"
			searchPlaceholder="Search backpacks, school bags, laptop bags..."
			pageTitle="Backpack | BlinkieFash"
			pageDescription="Shop backpacks, school bags, laptop bags and travel bags — delivered fast."
		/>
	);
}
