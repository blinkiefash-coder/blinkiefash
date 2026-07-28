# Product Images: Complete API & Database Map

## 1. DATABASE TABLE: product_media

Location: `blinkiefash/backend/db.js` (Lines 561-605)

```sql
CREATE TABLE product_media (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id UUID REFERENCES products(id) ON DELETE CASCADE,
  variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
  url TEXT NOT NULL,                           -- ⭐ THE IMAGE URL
  media_type VARCHAR(20) DEFAULT 'image',      -- 'image', 'video', etc.
  is_primary BOOLEAN DEFAULT false,            -- ⭐ MARKS PRIMARY IMAGE
  sort_order INT DEFAULT 0,                    -- Order of images for variant
  created_at TIMESTAMP DEFAULT now()
);

-- Indexes for fast lookup:
idx_product_media_product  ON product_media(product_id)
idx_product_media_variant  ON product_media(variant_id)
```

### Key Points:
- **product_id + variant_id = NULL** → Product-level images (shared by all variants)
- **product_id + variant_id = NOT NULL** → Variant-specific images
- **is_primary = true** → Preferred image to show in product cards
- **sort_order** → Display order when multiple images exist

---

## 2. ALL API ENDPOINTS THAT RETURN PRODUCT IMAGES

### 🟢 PRIMARY ENDPOINTS (Used for Product Listings)

#### A. `GET /products` - Main Product List (Product Cards)
📍 File: `blinkiefash/backend/routes/products.js:656`
📊 Limit: 100 products per request, with pagination (offset)
📌 Used by: Frontend Shop.jsx, Homepage cards

**Query Strategy:**
1. Variant-specific primary image (`is_primary = true` on variant)
2. Any variant-specific image (fallback if no primary)
3. Product-level primary image (`variant_id IS NULL AND is_primary = true`)
4. Any product-level image (last resort fallback)

```javascript
// Returns fields:
{
  id,              // Product ID
  name,            // Product name
  category_id,
  brand,           // Brand name
  category_name,
  pv.image,        // ⭐ IMAGE URL (from COALESCE query above)
  pv.variant_id,   // Variant ID shown
  pv.color,        // Color of variant
  pv.mrp,          // Original price
  pv.sell_price,   // Discount price
  is_bestseller,
  is_try_and_buy,
  buy_2, buy_3, buy_4  // Bundle offers
}
```

Query filters available:
- `?limit=40&offset=0` → Pagination
- `?brand_id=<uuid>` → Filter by brand
- `?category_id=<uuid>` → Filter by category
- `?color=<color>` → Filter by color
- `?min_price=100&max_price=500` → Price range
- `?search=<term>` → Search by name/brand
- `?sort=price-low|price-high|discount|popularity`
- `?lat=<lat>&lng=<lng>` → Geolocation for nearby stores
- `?store_id=<uuid>` → Specific dark store

---

#### B. `GET /products/bestsellers` - Bestseller Products
📍 File: `blinkiefash/backend/routes/products.js:298`
📊 Returns: Top N bestselling products
📌 Used by: Homepage featured section

**Query Strategy:**
1. Variant-specific primary image (`JOIN variant AND is_primary = true`)
2. Any variant image (fallback)

Query parameters:
- `?limit=10` → Max 20 products
- `?store_id=<uuid>` → Filter by store (optional)
- `?store_ids=<uuid>,<uuid>` → Multiple stores

---

#### C. `GET /products/price-range` - Price Filtered Products
📍 File: `blinkiefash/backend/routes/products.js:371`
📊 Returns: Products within price range
📌 Used by: Price filter sidebar

**Query Strategy:**
Same as bestsellers - variant primary then any variant image

Query parameters:
- `?min_price=100`
- `?max_price=500`
- `?limit=40`
- `?store_id=<uuid>`
- `?store_ids=<uuid>,<uuid>`

---

#### D. `GET /products/bulk-offers` - Bulk Offer Products
📍 File: `blinkiefash/backend/routes/products.js:447`
📊 Returns: Products with active bulk offers
📌 Used by: Bulk offers section

**Query Strategy:**
1. Variant-specific primary image
2. Any variant image

Query parameters:
- `?limit=10`
- `?store_id=<uuid>`

---

### 🔵 DETAIL ENDPOINTS (Used for Product Details)

#### E. `GET /products/:id` - Product Detail
📍 File: `blinkiefash/backend/routes/products.js:579`
📌 Used by: ProductDetail.jsx page, Mobile app detail screen

**Returns:**
```javascript
{
  product: { /* full product data */ },
  images: [
    {
      url,           // ⭐ IMAGE URL
      variant_id,    // Which variant (null = product-level)
      is_primary     // ⭐ Is this the primary image?
    },
    // ... more images
  ],
  variants: [
    {
      id,
      size,
      color,
      price,
      discount_price,
      available_stock
    }
  ]
}
```

Query: No parameters - just the product ID in URL

---

#### F. `GET /products/full/:id` - Full Product with All Details
📍 File: `blinkiefash/backend/routes/products.js:276`
📌 Used by: Legacy/admin endpoints

Returns complete product info using `get_product_full()` function

---

### 🟡 SECONDARY ENDPOINTS (Images in Other Contexts)

#### G. `GET /cart/:userId` - Shopping Cart Items with Images
📍 File: `blinkiefash/backend/routes/cart.js:29`
📌 Shows images for items in cart

**Uses product_media table:**
```sql
SELECT pm.url FROM product_media WHERE variant_id = v.id LIMIT 1
```

---

#### H. `GET /checkout/orders` - Order Items with Images
📍 File: `blinkiefash/backend/routes/checkout.js:581`
📌 Shows images in checkout preview

**Query Strategy:**
1. Variant-specific primary image
2. Any variant image  
3. Product-level images

---

#### I. `GET /checkout/orders/:orderId` - Order Details
📍 File: `blinkiefash/backend/routes/checkout.js:635`
📌 Shows images in order confirmation

Same query strategy as checkout/orders

---

#### J. `GET /checkout/orders/:orderId/invoice` - Invoice/Receipt
📍 File: `blinkiefash/backend/routes/checkout.js:760`
📌 Printable/shareable invoice with images

---

#### K. `GET /checkout/darkstore/:storeId/products` - Dark Store Inventory
📍 File: `blinkiefash/backend/routes/checkout.js:949`
📌 Shows products available at specific dark store

---

#### L. `GET /vendor/:id/products` - Vendor's Products
📍 File: `blinkiefash/backend/routes/vendor.js:178`
📌 Shows all products for a specific vendor

**Query Strategy:**
1. Variant-specific primary image
2. Any variant image
3. Product-level images

---

#### M. `GET /wishlist/:userId` - Wishlist Items
📍 File: `blinkiefash/backend/routes/wishlist.js:11`
📌 Shows images in user's wishlist

---

## 3. IMAGE SELECTION HIERARCHY (Priority Order)

Used in most endpoints:

```
For a Variant:
1. ✅ Variant-specific image marked as is_primary = true
2. ✅ Any variant-specific image (by sort_order)
3. ✅ Product-level image marked as is_primary = true
4. ✅ Any product-level image (last resort)
5. ❌ NULL / "No Image" placeholder
```

---

## 4. HOW FRONTEND FETCHES IMAGES

### Shop Page (Product Cards)
📍 File: `src/pages/Shop.jsx:140`

```javascript
// Fetches all products from GET /products
const fetchAllProducts = async () => {
  let offset = 0;
  const all = [];
  
  while (true) {
    const response = await fetch(
      `${API_BASE}/products?limit=100&offset=${offset}`
    );
    const data = await response.json();
    const pageItems = extractProducts(data);  // Get .products array
    all.push(...pageItems);
    
    if (pageItems.length < 100) break;
    offset += 100;
  }
  
  return all;
};

// Then renders with:
{p.image ? (
  <img src={p.image} alt={p.name} />
) : (
  <div className="no-image">No Image</div>
)}
```

---

## 5. QUICK REFERENCE: API ENDPOINTS

| Endpoint | Method | Purpose | Image Source | Used By |
|----------|--------|---------|-------------|---------|
| `/products` | GET | Main product list | pv.image (COALESCE) | Shop cards, Home |
| `/products/bestsellers` | GET | Top selling products | Variant primary + any | Homepage featured |
| `/products/price-range` | GET | Products by price | Variant primary + any | Price filter |
| `/products/bulk-offers` | GET | Bulk deal products | Variant primary + any | Bulk offers section |
| `/products/:id` | GET | Product details | product_media rows | Product detail page |
| `/products/full/:id` | GET | Full product info | Via function | Admin/legacy |
| `/cart/:userId` | GET | Cart items | variant images | Cart page |
| `/checkout/orders` | GET | Order preview | Multi-strategy | Checkout page |
| `/checkout/orders/:id` | GET | Order details | Multi-strategy | Order confirmation |
| `/checkout/orders/:id/invoice` | GET | Invoice | Multi-strategy | Receipt/print |
| `/checkout/darkstore/:id/products` | GET | Store inventory | Multi-strategy | Dark store view |
| `/vendor/:id/products` | GET | Vendor products | Multi-strategy | Vendor store page |
| `/wishlist/:userId` | GET | Wishlist items | variant images | Wishlist page |

---

## 6. DEBUGGING STEPS

To verify images are being fetched correctly:

1. **Check Database:**
   ```bash
   node backend/diagnose_images.js
   # Shows all product_media rows for cuttackpuma vendor
   ```

2. **Test API Query:**
   ```bash
   node backend/test_product_list.js
   # Runs exact GET /products query, shows image presence
   ```

3. **Check Frontend Logs:**
   - Open browser DevTools Console
   - Look for: `[Shop] Fetched products data:` logs
   - Shows what data was received from API

4. **Check Backend Logs:**
   - Look for: `[GET /products] Result summary:` logs
   - Shows what data API returned before sending to frontend

---

## 7. COMMON IMAGE DISPLAY ISSUES

| Problem | Cause | Solution |
|---------|-------|----------|
| No images in product cards | No images in product_media table | Add images during product creation |
| No images in product cards | is_primary not set | Ensure first image per variant is marked primary |
| No images in product cards | Stock = 0 filter | ✅ Already fixed (stock filter removed) |
| Images show in detail but not cards | Same stock filter issue | ✅ Already fixed |
| NULL image URLs | product_media.url is NULL | Check CloudinaryAPI upload success |
| Wrong image showing | is_primary set incorrectly | Reset primary flags per variant |
| Variant image not showing | variant_id mismatch in product_media | Verify variant_id matches product_variants.id |

