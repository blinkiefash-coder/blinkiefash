-- ============================================
-- INSERT STATEMENTS FOR VENDORS
-- ============================================
-- Run these INSERT statements in Neon database

-- VENDOR 1: Manjula Grand
INSERT INTO users (email, password_hash, user_type, created_at)
VALUES (
  'Manjulagrand@blinkiefash.in',
  'scrypt:s=16:N=16384:r=8:p=1$c8c1397d50e19b81c27817086a484799$a2f196c1e000842d9f8d5f51aa828fc2937314c6e51bff98b607dff9e09549d85777f99f04ff819e48d70e5e17e656079b487ccabad44dbb494ce92aad5dd6f1',
  'vendor',
  NOW()
);

INSERT INTO vendors (user_id, business_name, owner_name, email, phone, business_type, category, store_name, description, address, city, state, pincode, account_status, created_at)
SELECT id, 'Manjula Grand', 'Manjula Grand', 'Manjulagrand@blinkiefash.in', '+919876543210', 'retail', 'Fashion', 'Manjula Grand', 'Manjula Grand Darkstore', 'Cuttack, Odisha', 'Cuttack', 'Odisha', '753001', 'approved', NOW()
FROM users WHERE email = 'Manjulagrand@blinkiefash.in' AND NOT EXISTS (SELECT 1 FROM vendors WHERE email = 'Manjulagrand@blinkiefash.in');

INSERT INTO dark_stores (vendor_id, store_name, address, city, state, pincode, latitude, longitude, manager_name, manager_phone, created_at)
SELECT id, 'Manjula Grand Darkstore', 'Cuttack, Odisha', 'Cuttack', 'Odisha', '753001', 20.3768252, 85.8877655, 'Manjula Grand', '+919876543210', NOW()
FROM vendors WHERE email = 'Manjulagrand@blinkiefash.in' AND NOT EXISTS (SELECT 1 FROM dark_stores WHERE vendor_id = vendors.id);

-- VENDOR 2: Crimson Club Cuttack
INSERT INTO users (email, password_hash, user_type, created_at)
VALUES (
  'Crimsouneclubcuttack@blinkiefash.in',
  'scrypt:s=16:N=16384:r=8:p=1$a55fdfae057e88092c9dfc98ea3ab733$f38c987e60c74d5bd655b2a42f1fc50517b8f863bcb30a92a83a5639b4a918f8086cb38f7188cfaa0d6bb580c3b043afe6ed3454202fbe4173abf7eab7de47dd',
  'vendor',
  NOW()
);

INSERT INTO vendors (user_id, business_name, owner_name, email, phone, business_type, category, store_name, description, address, city, state, pincode, account_status, created_at)
SELECT id, 'Crimson Club Cuttack', 'Crimson Club Cuttack', 'Crimsouneclubcuttack@blinkiefash.in', '+919876543211', 'retail', 'Fashion', 'Crimson Club Cuttack', 'Crimson Club Cuttack Darkstore', 'Cuttack, Odisha', 'Cuttack', 'Odisha', '753001', 'approved', NOW()
FROM users WHERE email = 'Crimsouneclubcuttack@blinkiefash.in' AND NOT EXISTS (SELECT 1 FROM vendors WHERE email = 'Crimsouneclubcuttack@blinkiefash.in');

INSERT INTO dark_stores (vendor_id, store_name, address, city, state, pincode, latitude, longitude, manager_name, manager_phone, created_at)
SELECT id, 'Crimson Club Cuttack Darkstore', 'Cuttack, Odisha', 'Cuttack', 'Odisha', '753001', 20.4703600, 85.8875637, 'Crimson Club Cuttack', '+919876543211', NOW()
FROM vendors WHERE email = 'Crimsouneclubcuttack@blinkiefash.in' AND NOT EXISTS (SELECT 1 FROM dark_stores WHERE vendor_id = vendors.id);

-- VERIFY
SELECT 'Vendors created' as status;
SELECT email, store_name FROM vendors WHERE email IN ('Manjulagrand@blinkiefash.in', 'Crimsouneclubcuttack@blinkiefash.in');
SELECT store_name, latitude, longitude FROM dark_stores WHERE store_name LIKE '%Manjula%' OR store_name LIKE '%Crimson%';
