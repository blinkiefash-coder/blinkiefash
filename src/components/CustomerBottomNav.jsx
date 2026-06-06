import { useNavigate } from "react-router-dom";

const ITEMS = [
  { key: "home", label: "Home", path: "/home" },
  { key: "categories", label: "Categories", path: "/shop" },
  { key: "orders", label: "Orders", path: "/orders" },
  { key: "wishlist", label: "Wishlist", path: "/wishlist" },
];

export default function CustomerBottomNav({ active }) {
  const navigate = useNavigate();

  return (
    <nav className="bf-bottom-nav" aria-label="Customer app navigation">
      {ITEMS.map((item) => (
        <button
          key={item.key}
          type="button"
          className={active === item.key ? "active" : ""}
          onClick={() => navigate(item.path)}
        >
          {item.label}
        </button>
      ))}
    </nav>
  );
}