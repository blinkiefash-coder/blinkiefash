#!/usr/bin/env node

import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgresql://neondb_owner:npg_yw6RXdt0sKvB@ep-falling-block-amfecyj6-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({ connectionString });

const vendors = [
  {
    email: 'Manjulagrand@blinkiefash.in',
    password: 'Manjula@121216',
    businessName: 'Manjula Grand',
    ownerName: 'Manjula Grand',
    phone: '+919999999991',
    storeName: 'Manjula Grand',
    city: 'Cuttack',
    state: 'Odisha',
    pincode: '753001',
    lat: 20.3768252,
    lng: 85.8877655,
    passwordHash: 'scrypt:s=16:N=16384:r=8:p=1$c8c1397d50e19b81c27817086a484799$a2f196c1e000842d9f8d5f51aa828fc2937314c6e51bff98b607dff9e09549d85777f99f04ff819e48d70e5e17e656079b487ccabad44dbb494ce92aad5dd6f1'
  },
  {
    email: 'Crimsouneclubcuttack@blinkiefash.in',
    password: 'Crimcuttack@121216',
    businessName: 'Crimson Club Cuttack',
    ownerName: 'Crimson Club Cuttack',
    phone: '+919999999992',
    storeName: 'Crimson Club Cuttack',
    city: 'Cuttack',
    state: 'Odisha',
    pincode: '753001',
    lat: 20.4703600,
    lng: 85.8875637,
    passwordHash: 'scrypt:s=16:N=16384:r=8:p=1$a55fdfae057e88092c9dfc98ea3ab733$f38c987e60c74d5bd655b2a42f1fc50517b8f863bcb30a92a83a5639b4a918f8086cb38f7188cfaa0d6bb580c3b043afe6ed3454202fbe4173abf7eab7de47dd'
  }
];

async function createVendors() {
  const client = await pool.connect();
  
  try {
    console.log('🚀 Creating vendors with Neon owner credentials...\n');

    for (const vendor of vendors) {
      console.log(`📍 Creating vendor: ${vendor.email}`);

      // Start transaction
      await client.query('BEGIN');

      try {
        // 1. Insert user
        console.log('  → Creating user...');
        const userResult = await client.query(
          `INSERT INTO users (name, email, phone, password_hash, role, is_active, created_at)
           VALUES ($1, $2, $3, $4, $5, true, NOW())
           ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
           RETURNING id, email`,
          [vendor.ownerName, vendor.email, vendor.phone, vendor.passwordHash, 'vendor']
        );
        const userId = userResult.rows[0].id;
        console.log(`    ✅ User created (ID: ${userId})`);

        // 2. Insert vendor
        console.log('  → Creating vendor...');
        const vendorResult = await client.query(
          `INSERT INTO vendors (user_id, business_name, owner_name, email, phone, business_type, category, store_name, description, address, city, state, pincode, is_active, is_approved, is_verified, status, created_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, true, true, 'approved', NOW())
           ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
           RETURNING id, email`,
          [userId, vendor.businessName, vendor.ownerName, vendor.email, vendor.phone, 'retail', 'Fashion', vendor.storeName, `${vendor.storeName} Darkstore`, `${vendor.city}, ${vendor.state}`, vendor.city, vendor.state, vendor.pincode]
        );
        const vendorId = vendorResult.rows[0].id;
        console.log(`    ✅ Vendor created (ID: ${vendorId})`);

        // 3. Insert darkstore
        console.log('  → Creating darkstore...');
        const darkstoreResult = await client.query(
          `INSERT INTO dark_stores (name, address, city, lat, lng, is_active)
           VALUES ($1, $2, $3, $4, $5, true)
           RETURNING id, name, lat, lng`,
          [`${vendor.storeName} Darkstore`, `${vendor.city}, ${vendor.state}`, vendor.city, vendor.lat, vendor.lng]
        );
        const darkstoreId = darkstoreResult.rows[0].id;
        console.log(`    ✅ Darkstore created (ID: ${darkstoreId})`);
        console.log(`       Coordinates: ${vendor.lat}, ${vendor.lng}\n`);

        // 4. Link darkstore to vendor
        console.log('  → Linking darkstore to vendor...');
        await client.query(
          `UPDATE vendors SET dark_store_id = $1 WHERE id = $2`,
          [darkstoreId, vendorId]
        );
        console.log(`    ✅ Darkstore linked\n`);

        // Commit transaction
        await client.query('COMMIT');

      } catch (innerError) {
        await client.query('ROLLBACK');
        console.error(`  ❌ Error creating vendor: ${innerError.message}`);
        throw innerError;
      }
    }

    // Verification
    console.log('✨ Verification:\n');
    const usersResult = await client.query(
      `SELECT email, role, created_at FROM users WHERE email IN ($1, $2)`,
      ['Manjulagrand@blinkiefash.in', 'Crimsouneclubcuttack@blinkiefash.in']
    );
    console.log('Users:');
    usersResult.rows.forEach(row => console.log(`  • ${row.email} (${row.role})`));

    const vendorsResult = await client.query(
      `SELECT id, email, store_name, city FROM vendors WHERE email IN ($1, $2)`,
      ['Manjulagrand@blinkiefash.in', 'Crimsouneclubcuttack@blinkiefash.in']
    );
    console.log('\nVendors:');
    vendorsResult.rows.forEach(row => console.log(`  • ${row.email} - ${row.store_name}`));

    const darkstoresResult = await client.query(
      `SELECT id, name, city, lat, lng FROM dark_stores WHERE name LIKE $1 OR name LIKE $2`,
      ['%Manjula%', '%Crimson%']
    );
    console.log('\nDarkstores:');
    darkstoresResult.rows.forEach(row => console.log(`  • ${row.name} (${row.lat}, ${row.lng})`));

    console.log('\n✅ All vendors created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Email: Manjulagrand@blinkiefash.in | Password: Manjula@121216');
    console.log('   Email: Crimsouneclubcuttack@blinkiefash.in | Password: Crimcuttack@121216');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

createVendors();
