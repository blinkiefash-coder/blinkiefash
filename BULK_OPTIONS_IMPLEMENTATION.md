# Bulk Options Feature Implementation

## Overview
The bulk options feature allows customers to purchase products in bulk quantities (Buy 2, Buy 3, Buy 4) at a fixed discounted price of ₹999 per item.

## Database Schema Updates
The `products` table now includes the following boolean fields:
- `buy_2` (BOOLEAN): Enable Buy 2 @ ₹999 option
- `buy_3` (BOOLEAN): Enable Buy 3 @ ₹999 option
- `buy_4` (BOOLEAN): Enable Buy 4 @ ₹999 option

## Frontend Implementation

### 1. **CartItem Model** (`lib/services/cart_manager.dart`)
Updated to store bulk options:
```dart
class CartItem {
  int? bulkQuantity;      // 2, 3, or 4
  double? bulkPrice;      // Fixed price (typically 999.0)
}
```

**Subtotal Calculation:**
- If `bulkPrice` is set, uses: `bulkPrice × quantity`
- Otherwise uses: `rawPrice × quantity`

### 2. **Product Detail Screen** (`lib/pages/product_detail_screen.dart`)

**Added State Variable:**
```dart
int? _selectedBulkQuantity; // 2, 3, or 4
```

**UI Features:**
- Shows "Bulk Options" section if product has any buy_X flag enabled
- Displays 3 containers (Buy 2 @₹999, Buy 3 @₹999, Buy 4 @₹999)
- Containers are clickable to toggle selection
- Selected option highlighted with green border and background
- Updates "Add to Cart" snackbar to show bulk selection

**Add to Cart Logic:**
- Captures `_selectedBulkQuantity` and sets `bulkPrice = 999.0`
- Passes bulk info to CartManager

### 3. **Cart Screen** (`lib/pages/cart_screen.dart`)

**Enhanced Item Display:**
- Shows bulk option badge if applicable: "Buy 2 @ ₹999"
- Displays bulk price if selected, otherwise regular price
- Badge styling: Green background with green border

### 4. **Checkout Screen** (`lib/pages/checkout_screen.dart`)

**Updated Calculations:**
- `_effectiveSubtotal`: Uses bulk price if available
- `_CartItemRow`: Shows bulk badge and calculates correct total

**Order Data Sent to Backend:**
```json
{
  "variantId": "...",
  "quantity": 1,
  "price": 999.0,          // bulk price if selected
  "bulkQuantity": 2,       // optional, only if bulk selected
  "bulkPrice": 999.0       // optional, only if bulk selected
}
```

## Flow Diagram

```
Product Detail Screen
        ↓
   [User sees bulk options if enabled]
   - Buy 2 @ ₹999
   - Buy 3 @ ₹999
   - Buy 4 @ ₹999
        ↓
[User selects bulk option]
        ↓
[Add to Cart]
        ↓
Cart Screen
        ↓
[Shows bulk badge & bulk price]
        ↓
Checkout
        ↓
[Displays bulk info with correct pricing]
        ↓
Order Placement
        ↓
Backend receives:
  - bulkQuantity: 2
  - bulkPrice: 999.0
```

## Pricing Examples

**Regular Product (₹1,299):**
- Without bulk: ₹1,299 per item
- Add to cart: quantity 1 → Total: ₹1,299

**Bulk Product (₹1,299, Buy 2 @ ₹999):**
- Select "Buy 2 @ ₹999"
- Add to cart: quantity 1 → Total: ₹999
- Add to cart: quantity 2 → Total: ₹1,998 (₹999 × 2)

## Backend Integration

The backend receives bulk information in the order items:

```javascript
// Order placement API receives:
{
  "items": [
    {
      "variantId": "uuid",
      "quantity": 1,
      "price": 999.0,
      "bulkQuantity": 2,    // NEW
      "bulkPrice": 999.0    // NEW
    }
  ],
  "totalAmount": 999.0
}
```

**Backend should:**
1. Validate bulk quantity is within allowed range (2, 3, or 4)
2. Apply bulk price if `bulkQuantity` is present
3. Calculate invoice using bulk price instead of regular price
4. Store order items with bulk metadata for reference

## Database Query to Create Bulk Offers (Alternative)

If using the `bulk_offers` table:
```sql
INSERT INTO bulk_offers (product_id, offer_type, quantity, offer_price, is_active)
VALUES 
  ('product-uuid', 'buy_in_bulk', 2, 999.0, true),
  ('product-uuid', 'buy_in_bulk', 3, 999.0, true),
  ('product-uuid', 'buy_in_bulk', 4, 999.0, true);
```

## Testing Checklist

- [ ] Product with buy_2=true shows "Buy 2 @₹999" option
- [ ] Product with buy_3=true shows "Buy 3 @₹999" option
- [ ] Product with buy_4=true shows "Buy 4 @₹999" option
- [ ] Selecting bulk option highlights it (green border)
- [ ] Cart shows bulk badge and bulk price
- [ ] Checkout displays bulk item correctly
- [ ] Order summary shows bulk price calculation
- [ ] Subtotal uses bulk price (₹999) not regular price
- [ ] Toggling bulk option updates cart subtotal
- [ ] Can add same product with and without bulk (different cart items)
- [ ] Backend receives bulkQuantity and bulkPrice

## Notes

- Bulk price is hardcoded as ₹999 in frontend; can be made dynamic from backend if needed
- Bulk options are mutually exclusive (only one selection per product)
- Toggling a bulk option deselects previous selection
- Bulk discount persists through cart → checkout → payment flow
- Each bulk quantity level (2, 3, 4) is independent
