-- SQL Statements to Create Two Vendors with Darkstores
-- Run these in your Neon PostgreSQL database

-- ============================================
-- VENDOR 1: Manjula Grand
-- ============================================

-- Create user record
INSERT INTO users (email, password_hash, user_type, created_at)
VALUES (
  'Manjulagrand@blinkiefash.in',
  'scrypt:s=16:N=16384:r=8:p=1$' || encode(decode('4a5f8c2d1e3b9a4f7c6e5d2a', 'hex'), 'base64') || '$' || encode(decode('a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0', 'hex'), 'base64'),
  'vendor',
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create vendor record (link to user)
INSERT INTO vendors (
  user_id,
  business_name,
  owner_name,
  email,
  phone,
  business_type,
  category,
  store_name,
  description,
  address,
  city,
  state,
  pincode,
  account_status,
  created_at
)
SELECT 
  id,
  'Manjula Grand',
  'Manjula Grand',
  'Manjulagrand@blinkiefash.in',
  '+919876543210',
  'retail',
  'Fashion',
  'Manjula Grand',
  'Manjula Grand Store',
  'Cuttack, Odisha',
  'Cuttack',
  'Odisha',
  '753001',
  'approved',
  NOW()
FROM users
WHERE email = 'Manjulagrand@blinkiefash.in'
ON CONFLICT DO NOTHING;

-- Create darkstore for Vendor 1
INSERT INTO dark_stores (
  vendor_id,
  store_name,
  address,
  city,
  state,
  pincode,
  latitude,
  longitude,
  manager_name,
  manager_phone,
  created_at
)
SELECT
  id,
  'Manjula Grand Darkstore',
  'Cuttack, Odisha',
  'Cuttack',
  'Odisha',
  '753001',
  20.3768252,
  85.8877655,
  'Manjula Grand',
  '+919876543210',
  NOW()
FROM vendors
WHERE email = 'Manjulagrand@blinkiefash.in'
ON CONFLICT DO NOTHING;

-- ============================================
-- VENDOR 2: Crimson Club Cuttack
-- ============================================

-- Create user record
INSERT INTO users (email, password_hash, user_type, created_at)
VALUES (
  'Crimsouneclubcuttack@blinkiefash.in',
  'scrypt:s=16:N=16384:r=8:p=1$' || encode(decode('5b6g9d3e2f4c0b5g8d7e6f3b', 'hex'), 'base64') || '$' || encode(decode('b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1', 'hex'), 'base64'),
  'vendor',
  NOW()
) ON CONFLICT (email) DO NOTHING;

-- Create vendor record (link to user)
INSERT INTO vendors (
  user_id,
  business_name,
  owner_name,
  email,
  phone,
  business_type,
  category,
  store_name,
  description,
  address,
  city,
  state,
  pincode,
  account_status,
  created_at
)
SELECT 
  id,
  'Crimson Club Cuttack',
  'Crimson Club Cuttack',
  'Crimsouneclubcuttack@blinkiefash.in',
  '+919876543211',
  'retail',
  'Fashion',
  'Crimson Club Cuttack',
  'Crimson Club Cuttack Store',
  'Cuttack, Odisha',
  'Cuttack',
  'Odisha',
  '753001',
  'approved',
  NOW()
FROM users
WHERE email = 'Crimsouneclubcuttack@blinkiefash.in'
ON CONFLICT DO NOTHING;

-- Create darkstore for Vendor 2
INSERT INTO dark_stores (
  vendor_id,
  store_name,
  address,
  city,
  state,
  pincode,
  latitude,
  longitude,
  manager_name,
  manager_phone,
  created_at
)
SELECT
  id,
  'Crimson Club Cuttack Darkstore',
  'Cuttack, Odisha',
  'Cuttack',
  'Odisha',
  '753001',
  20.4703600,
  85.8875637,
  'Crimson Club Cuttack',
  '+919876543211',
  NOW()
FROM vendors
WHERE email = 'Crimsouneclubcuttack@blinkiefash.in'
ON CONFLICT DO NOTHING;

-- ============================================
-- VERIFICATION QUERIES
-- ============================================

-- Verify users created
SELECT email, user_type, created_at FROM users 
WHERE email IN ('Manjulagrand@blinkiefash.in', 'Crimsouneclubcuttack@blinkiefash.in');

-- Verify vendors created
SELECT id, email, store_name, city FROM vendors 
WHERE email IN ('Manjulagrand@blinkiefash.in', 'Crimsouneclubcuttack@blinkiefash.in');

-- Verify darkstores created with coordinates
SELECT vendor_id, store_name, latitude, longitude FROM dark_stores 
WHERE store_name LIKE '%Manjula%' OR store_name LIKE '%Crimson%';
