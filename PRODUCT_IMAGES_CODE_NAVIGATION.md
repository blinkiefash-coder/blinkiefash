# PRODUCT IMAGES: CODE NAVIGATION GUIDE

## Database Layer
```
blinkiefash/backend/db.js
├── Line 561: CREATE TABLE product_media
│   ├── id (UUID primary key)
│   ├── product_id (UUID foreign key → products)
│   ├── variant_id (UUID foreign key → product_variants)
│   ├── url (TEXT - THE IMAGE URL)
│   ├── media_type (VARCHAR - 'image', 'video', etc.)
│   ├── is_primary (BOOLEAN - marks preferred image)
│   ├── sort_order (INT - display order)
│   └── created_at (TIMESTAMP)
│
└── Lines 596-601: Create indexes for fast queries
    ├── idx_product_media_product (on product_id)
    └── idx_product_media_variant (on variant_id)
```

---

## API Routes Layer

### Main Product Listing (GET /products)
```
blinkiefash/backend/routes/products.js

Line 656: router.get("/", async (req, res) => {
          
   Query starts at:
   ├── Line 750: SELECT p.id, p.name, ..., pv.image, ...
   │
   ├── Line 769: LEFT JOIN LATERAL (
   │   └── Lines 771-815: LATERAL subquery selects ONE variant per color
   │       ├── Line 781: DISTINCT ON (lower(COALESCE(v.color, '')))
   │       │            (Gets one variant per color)
   │       │
   │       ├── Lines 787-816: COALESCE chain for image selection
   │       │   ├── Line 790-795: Try variant-specific PRIMARY image
   │       │   │   SELECT pm.url FROM product_media pm
   │       │   │   WHERE pm.variant_id = v.id AND pm.is_primary = true
   │       │   │
   │       │   ├── Line 798-803: Try ANY variant-specific image
   │       │   │   SELECT pm.url FROM product_media pm
   │       │   │   WHERE pm.variant_id = v.id
   │       │   │
   │       │   ├── Line 806-811: Try product-level PRIMARY image
   │       │   │   SELECT pm.url FROM product_media pm
   │       │   │   WHERE pm.product_id = p.id AND pm.variant_id IS NULL
   │       │   │   AND pm.is_primary = true
   │       │   │
   │       │   └── Line 814-819: Try ANY product-level image
   │       │       SELECT pm.url FROM product_media pm
   │       │       WHERE pm.product_id = p.id AND pm.variant_id IS NULL
   │       │
   │       ├── Line 821: FROM product_variants v
   │       ├── Line 822: LEFT JOIN inventory inv ON inv.variant_id = v.id
   │       ├── Line 823: WHERE v.product_id = p.id AND v.is_active = true
   │       │            ${storeInvCondition}
   │       │            (NO STOCK FILTER - allows 0 stock)
   │       │
   │       └── Line 824-825: ORDER BY lower(COALESCE(v.color, '')), v.price ASC
   │
   ├── Line 826: ) pv ON true
   │   WHERE 1=1 AND pv.variant_id IS NOT NULL
   │
   ├── Optional filters (Lines 828+):
   │   ├── if (brand_id): ... AND p.brand_id = $...
   │   ├── if (category_id): ... AND p.category_id IN (...)
   │   ├── if (min_price/max_price): EXISTS (variant price checks)
   │   ├── if (color): EXISTS (variant color check)
   │   └── if (search): LIKE clause on name/brand/description
   │
   ├── Sort options (Lines 880-889):
   │   ├── 'popularity' → p.id DESC
   │   ├── 'price-low' → MIN(v.price) ASC
   │   ├── 'price-high' → MIN(v.price) DESC
   │   ├── 'discount' → discount percentage DESC
   │   └── 'name_asc' → p.name ASC
   │
   ├── Line 893: Pagination
   │   └── LIMIT $... OFFSET $...
   │
   └── Lines 909-920: res.json() response
       └── products: result.rows (with image field populated)
```

---

### Product Detail (GET /products/:id)
```
blinkiefash/backend/routes/products.js:579

Line 579: router.get("/:id", async (req, res) => {
   
   ├── Line 589-597: Get PRODUCT
   │   SELECT p.*, b.name AS brand, c.name AS category_name
   │   FROM products p
   │   LEFT JOIN brands b, LEFT JOIN categories c
   │   WHERE p.id = $1
   │
   ├── Line 606-615: Get ALL IMAGES (not just one per color)
   │   SELECT pm.url, pm.variant_id, pm.is_primary FROM product_media pm
   │   WHERE pm.variant_id IS NULL
   │      OR pm.variant_id IN (
   │            SELECT v.id FROM product_variants v
   │            WHERE v.product_id = $1
   │        )
   │   ORDER BY pm.sort_order ASC, pm.id ASC
   │
   └── Line 628-648: Get ALL VARIANTS
       SELECT v.id, v.sku, v.size, v.color, v.price, v.mrp, 
              available_stock
       FROM product_variants v
       LEFT JOIN inventory inv ON inv.variant_id = v.id
       WHERE v.product_id = $1 AND v.is_active = true
       ORDER BY v.price ASC, v.id ASC
```

---

### Bestsellers (GET /products/bestsellers)
```
blinkiefash/backend/routes/products.js:298

Line 298: router.get("/bestsellers", async (req, res) => {
   
   ├── Lines 335-346: Image selection
   │   COALESCE(
   │     (SELECT pm.url FROM product_media pm
   │      JOIN product_variants pv ON pv.id = pm.variant_id
   │      WHERE pv.product_id = p.id AND pm.is_primary = true LIMIT 1),
   │     (SELECT pm.url FROM product_media pm
   │      JOIN product_variants pv ON pv.id = pm.variant_id
   │      WHERE pv.product_id = p.id LIMIT 1)
   │   ) AS image
   │
   └── Lines 350-366: Filter by p.bestseller = true
```

---

### Price Range (GET /products/price-range)
```
blinkiefash/backend/routes/products.js:371

Line 371: router.get("/price-range", async (req, res) => {
   
   ├── Lines 394-405: Image selection
   │   (Same COALESCE strategy as bestsellers)
   │
   └── Lines 414-441: Price range filters
       WHERE p.id IS NOT NULL
       GROUP BY ...
       HAVING MIN(v.price) >= $1 AND MIN(v.price) <= $2
```

---

### Bulk Offers (GET /products/bulk-offers)
```
blinkiefash/backend/routes/products.js:447

Line 447: router.get("/bulk-offers", async (req, res) => {
   
   ├── Lines 461-472: Image selection
   │   (Same COALESCE strategy)
   │
   └── Lines 476-485: Filter by active bulk_offers
       WHERE EXISTS (
           SELECT 1 FROM bulk_offers bo
           WHERE bo.product_id = p.id AND bo.is_active = true
       )
```

---

## Frontend Layer

### Shop Page (Product Cards)
```
src/pages/Shop.jsx

Line 140: const fetchAllProducts = async () => {
   │
   ├── Line 143-146: Fetch with pagination
   │   fetch(`${API_BASE}/products?limit=100&offset=${offset}`)
   │   .then(res => res.json())
   │
   ├── Line 147: const pageItems = extractProducts(data)
   │   (Gets data.products array from response)
   │
   ├── Line 157: setProducts(Array.isArray(data) ? data : [])
   │   (Stores fetched products in state)
   │
   └── Line 298-650: Render Loop
       products.map((p) => {
       
       ├── Line 598: key={`${p.id}-${p.variant_id || ''}-${p.color}-${p.image}`}
       │
       ├── Line 611-614: Display image
       │   {p.image ? (
       │     <img src={p.image} alt={p.name} />
       │   ) : (
       │     <div className="no-image">No Image</div>
       │   )}
       │
       └── Line 626: onClick={() => navigate(`/product/${p.id}`)}
           (Navigate to product detail)
```

---

### Product Detail Page
```
src/pages/ProductDetail.jsx

Line 240: <img src={img} alt={`${product.name} view ${i + 1}`} />
   (Shows each image from the images array)

Line 247: <img src={activeImage} alt={product.name} />
   (Main carousel image)
```

---

## Database Query Trace: Complete Flow

```
USER NAVIGATES TO SHOP PAGE
│
├─→ Frontend: src/pages/Shop.jsx:140
│   └─→ fetchAllProducts()
│       └─→ fetch(`/products?limit=100&offset=0`)
│
├─→ Backend: blinkiefash/backend/routes/products.js:656
│   └─→ GET / handler
│       ├─→ Parse query params (limit, offset, filters, etc.)
│       │
│       ├─→ SQL Query (Line 750-825):
│       │   ├─→ SELECT FROM products p
│       │   ├─→ LEFT JOIN brands b
│       │   ├─→ LEFT JOIN categories c
│       │   └─→ LEFT JOIN LATERAL (
│       │       ├─→ SELECT FROM product_variants v
│       │       ├─→ LEFT JOIN inventory inv
│       │       ├─→ COALESCE (Lines 787-816)
│       │       │   ├─→ Query product_media WHERE variant_id AND is_primary
│       │       │   ├─→ Query product_media WHERE variant_id (any)
│       │       │   ├─→ Query product_media WHERE product_id AND is_primary
│       │       │   └─→ Query product_media WHERE product_id (any)
│       │       │
│       │       └─→ ORDER BY color, price
│       │   )
│       │
│       ├─→ Execute filters (brand, category, color, price, search)
│       ├─→ Apply sorting
│       ├─→ Pagination (LIMIT + OFFSET)
│       │
│       └─→ res.json({ products: result.rows })
│
├─→ Database: PostgreSQL
│   └─→ product_media table
│       ├─→ Indexed on product_id
│       ├─→ Indexed on variant_id
│       └─→ Returns url for matching query
│
└─→ Frontend: Process response
    ├─→ setProducts(data.products)
    └─→ Render cards with p.image URL
```

---

## Image Storage & Upload Flow

```
User creates product in:
├─→ src/pages/AddProduct.jsx (Frontend)
│   └─→ FormData with images
│
├─→ POST /products/create-full (Backend)
│   blinkiefash/backend/routes/products.js:161
│
├─→ insertProductMediaRows() (Helper function)
│   blinkiefash/backend/routes/products.js:34
│   └─→ For each image URL:
│       ├─→ INSERT INTO product_media
│       │   (url, product_id, variant_id, media_type, is_primary, sort_order)
│       │
│       └─→ is_primary = true for FIRST image of each variant
│           (resetPrimaryState logic - Line 40-42, 74-75)
│
└─→ Database: product_media row created with URL
    └─→ Available to all SELECT queries
```

---

## Key Code Locations Summary

| What | File | Line |
|------|------|------|
| Table Definition | db.js | 561-605 |
| Create/Insert Logic | routes/products.js | 34-76 |
| Product List API | routes/products.js | 656-920 |
| Product Detail API | routes/products.js | 579-648 |
| Bestsellers API | routes/products.js | 298-368 |
| Price Range API | routes/products.js | 371-442 |
| Bulk Offers API | routes/products.js | 447-473 |
| Cart Images | routes/cart.js | 29-95 |
| Checkout Images | routes/checkout.js | 581-685 |
| Vendor Products | routes/vendor.js | 178-243 |
| Wishlist Images | routes/wishlist.js | 11-50 |
| Frontend Shop | src/pages/Shop.jsx | 140-650 |
| Frontend Detail | src/pages/ProductDetail.jsx | 1-400 |

