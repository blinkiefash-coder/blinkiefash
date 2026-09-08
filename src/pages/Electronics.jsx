import {
  MdPhoneIphone,
  MdHeadphones,
  MdWatch,
  MdTv,
  MdCameraAlt,
} from "react-icons/md";
import CategoryCatalogPage from "../components/CategoryCatalogPage";

const FALLBACK_SUBCATEGORIES = ["Phones", "Audio", "Laptops", "Wearables", "Cameras"];

const SUBCATEGORY_ICONS = {
  phones: MdPhoneIphone,
  audio: MdHeadphones,
  wearables: MdWatch,
  laptops: MdTv,
  cameras: MdCameraAlt,
};

export default function Electronics() {
  return (
    <CategoryCatalogPage
      sectionLabel="Electronics"
      rootNames={["electronics", "electronic"]}
      fallbackSubcategories={FALLBACK_SUBCATEGORIES}
      subcategoryIcons={SUBCATEGORY_ICONS}
      cacheKey="electronics:catalog:v2"
      searchPlaceholder="Search phones, audio, laptops..."
      pageTitle="Electronics | BlinkieFash"
      pageDescription="Shop phones, audio, laptops, wearables and cameras — delivered fast."
    />
  );
}
