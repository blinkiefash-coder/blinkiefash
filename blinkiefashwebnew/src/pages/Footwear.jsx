import { MdDirectionsRun, MdHiking } from "react-icons/md";
import CategoryCatalogPage from "../components/CategoryCatalogPage";

const FALLBACK_SUBCATEGORIES = ["Sneakers", "Boots", "Sandals", "Formal Shoes", "Sports Shoes"];

const SUBCATEGORY_ICONS = {
  sneakers: MdDirectionsRun,
  boots: MdHiking,
  "sports shoes": MdDirectionsRun,
};

export default function Footwear() {
  return (
    <CategoryCatalogPage
      sectionLabel="Footwear"
      rootNames={["footwear", "shoes"]}
      fallbackSubcategories={FALLBACK_SUBCATEGORIES}
      subcategoryIcons={SUBCATEGORY_ICONS}
      cacheKey="footwear:catalog:v2"
      searchPlaceholder="Search sneakers, boots, sandals..."
      pageTitle="Footwear | BlinkieFash"
      pageDescription="Shop sneakers, boots, sandals and formal shoes — delivered fast."
    />
  );
}
