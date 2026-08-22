# Creating Two New Vendors with Darkstores

Due to database permission restrictions with Neon's pooler connection, vendors must be created through the Seller Registration page. Here's how to set up the two vendors:

## Vendor 1: Manjulagrand@blinkiefash.in

1. **Go to:** `https://yourdomain.com/vendor-register` (or your seller registration page)

2. **Fill in the form:**
   - **Email:** `Manjulagrand@blinkiefash.in`
   - **Password:** `Manjula@121216`
   - **Store Name:** `Manjula Grand`
   - **Owner Name:** `Manjula Grand`
   - **City:** `Cuttack`
   - **State:** `Odisha`
   - **Pincode:** `753001`
   - **Latitude:** `20.3768252`
   - **Longitude:** `85.8877655`
   - **Business Type:** `Retail`
   - **Category:** `Fashion`

3. **Complete Registration** and wait for approval

---

## Vendor 2: Crimsouneclubcuttack@blinkiefash.in

1. **Go to:** `https://yourdomain.com/vendor-register`

2. **Fill in the form:**
   - **Email:** `Crimsouneclubcuttack@blinkiefash.in`
   - **Password:** `Crimcuttack@121216`
   - **Store Name:** `Crimson Club Cuttack`
   - **Owner Name:** `Crimson Club Cuttack`
   - **City:** `Cuttack`
   - **State:** `Odisha`
   - **Pincode:** `753001`
   - **Latitude:** `20.4703600`
   - **Longitude:** `85.8875637`
   - **Business Type:** `Retail`
   - **Category:** `Fashion`

3. **Complete Registration** and wait for approval

---

## Auto-Approval for Testing

If the vendors aren't auto-approved, you can manually approve them:

### Option A: Via Admin Panel
1. Log in as admin: `superadminsatyam@blinkiefash.in`
2. Navigate to Vendor Management
3. Find the vendors and set `is_approved = true` and `is_operational = true`

### Option B: Using Frontend Admin Panel (if available)
1. Go to `/admin` or admin vendor management page
2. Search for the vendor emails
3. Click "Approve" button

---

## Linking Darkstores (Optional)

Once vendors are created, they can optionally be linked to darkstores:

### Via SQL (if you have direct DB access):
```sql
-- Get vendor IDs first
SELECT id, email, store_name FROM vendors 
WHERE email IN ('Manjulagrand@blinkiefash.in', 'Crimsouneclubcuttack@blinkiefash.in');

-- Create darkstores (if table exists)
INSERT INTO dark_stores (name, city, pincode, address, lat, lng, is_active, created_at, updated_at)
VALUES 
  ('Manjula Grand Store', 'Cuttack', '753001', 'Cuttack, Odisha', 20.3768252, 85.8877655, true, NOW(), NOW()),
  ('Crimson Club Cuttack Store', 'Cuttack', '753001', 'Cuttack, Odisha', 20.4703600, 85.8875637, true, NOW(), NOW());

-- Link vendors to darkstores
UPDATE vendors SET dark_store_id = <darkstore_id_1> WHERE email = 'Manjulagrand@blinkiefash.in';
UPDATE vendors SET dark_store_id = <darkstore_id_2> WHERE email = 'Crimsouneclubcuttack@blinkiefash.in';
```

---

## Testing

After both vendors are created and approved:

1. **Log in as each vendor** using their credentials
2. **Add Products** via the vendor dashboard
3. **Check visibility** in EditProduct, ProductAnalytics, StockMonitoring pages

The products should now be visible (thanks to the dark_store_id fix we deployed earlier).

---

## Notes

- **Darkstores are optional**: Products will display even without linked darkstores
- **Coordinates format**: Decimals with 7 digits precision (e.g., `20.3768252`)
- **Auto-approval**: Check if the registration sets `is_approved = true` automatically, or requires manual approval
- **Email confirmation**: No email verification required (just storing emails)
