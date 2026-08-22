# SQL Statements to Create Vendors with Darkstores

## Instructions
1. Go to Neon PostgreSQL console
2. Copy each SQL statement below
3. Paste and execute

---

## VENDOR 1: Manjula Grand

### Create User
```sql
INSERT INTO users (email, password_hash, user_type, created_at)
VALUES (
  'Manjulagrand@blinkiefash.in',
  'scrypt:s=16:N=16384:r=8:p=1$c8c1397d50e19b81c27817086a484799$a2f196c1e000842d9f8d5f51aa828fc2937314c6e51bff98b607dff9e09549d85777f99f04ff819e48d70e5e17e656079b487ccabad44dbb494ce92aad5dd6f1',
  'vendor',
  NOW()
);
```

### Create Vendor (replace USER_ID_FROM_ABOVE)
```sql
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
VALUES (
  (SELECT id FROM users WHERE email = 'Manjulagrand@blinkiefash.in'),
  'Manjula Grand',
  'Manjula Grand',
  'Manjulagrand@blinkiefash.in',
  '+919876543210',
  'retail',
  'Fashion',
  'Manjula Grand',
  'Manjula Grand Darkstore',
  'Cuttack, Odisha',
  'Cuttack',
  'Odisha',
  '753001',
  'approved',
  NOW()
);
```

### Create Darkstore (replace VENDOR_ID_FROM_ABOVE)
```sql
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
VALUES (
  (SELECT id FROM vendors WHERE email = 'Manjulagrand@blinkiefash.in'),
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
);
```

---

## VENDOR 2: Crimson Club Cuttack

### Create User
```sql
INSERT INTO users (email, password_hash, user_type, created_at)
VALUES (
  'Crimsouneclubcuttack@blinkiefash.in',
  'scrypt:s=16:N=16384:r=8:p=1$a55fdfae057e88092c9dfc98ea3ab733$f38c987e60c74d5bd655b2a42f1fc50517b8f863bcb30a92a83a5639b4a918f8086cb38f7188cfaa0d6bb580c3b043afe6ed3454202fbe4173abf7eab7de47dd',
  'vendor',
  NOW()
);
```

### Create Vendor
```sql
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
VALUES (
  (SELECT id FROM users WHERE email = 'Crimsouneclubcuttack@blinkiefash.in'),
  'Crimson Club Cuttack',
  'Crimson Club Cuttack',
  'Crimsouneclubcuttack@blinkiefash.in',
  '+919876543211',
  'retail',
  'Fashion',
  'Crimson Club Cuttack',
  'Crimson Club Cuttack Darkstore',
  'Cuttack, Odisha',
  'Cuttack',
  'Odisha',
  '753001',
  'approved',
  NOW()
);
```

### Create Darkstore
```sql
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
VALUES (
  (SELECT id FROM vendors WHERE email = 'Crimsouneclubcuttack@blinkiefash.in'),
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
);
```

---

## Verification
Run this to verify both vendors were created:

```sql
SELECT 
  v.id,
  v.email,
  v.store_name,
  ds.store_name as darkstore_name,
  ds.latitude,
  ds.longitude
FROM vendors v
LEFT JOIN dark_stores ds ON v.id = ds.vendor_id
WHERE v.email IN ('Manjulagrand@blinkiefash.in', 'Crimsouneclubcuttack@blinkiefash.in')
ORDER BY v.email;
```

---

## Login Credentials

| Email | Password |
|-------|----------|
| Manjulagrand@blinkiefash.in | Manjula@121216 |
| Crimsouneclubcuttack@blinkiefash.in | Crimcuttack@121216 |
