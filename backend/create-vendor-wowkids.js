#!/usr/bin/env node

import pg from 'pg';
import crypto from 'crypto';
const { Pool } = pg;

const connectionString = 'postgresql://neondb_owner:npg_yw6RXdt0sKvB@ep-falling-block-amfecyj6-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({ connectionString });

const vendor = {
  email: 'Wowkidsbbsr@blinkiefash.in',
  password: 'Wowkids@121216',
  businessName: 'Wowkids BBsr',
  ownerName: 'Wowkids BBsr',
  phone: '7855013167',
  storeName: 'Wowkids BBsr',
  city: 'Bhubaneswar',
  state: 'Odisha',
  pincode: '751001',
  lat: 20.2569108,
  lng: 85.7987199
};

const createPasswordHash = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
};

async function createVendor() {
  const client = await pool.connect();

  try {
    console.log('🚀 Creating new vendor with Neon owner credentials...\n');
    console.log(`📍 Creating vendor: ${vendor.email}`);

    // Generate password hash
    const passwordHash = createPasswordHash(vendor.password);
    console.log(`  → Generated password hash\n`);

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
        [vendor.ownerName, vendor.email, vendor.phone, passwordHash, 'vendor']
      );
      const userId = userResult.rows[0].id;
      console.log(`    ✅ User created (ID: ${userId})`);

      // 2. Insert vendor
      console.log('  → Creating vendor...');
      const vendorResult = await client.query(
        `INSERT INTO vendors (user_id, business_name, owner_name, email, phone, business_type, category, store_name, description, address, city, state, pincode, is_active, is_approved, is_verified, status, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, true, true, true, $14, NOW())
         ON CONFLICT (email) DO UPDATE SET updated_at = NOW()
         RETURNING id, email`,
        [userId, vendor.businessName, vendor.ownerName, vendor.email, vendor.phone, 'retail', 'Fashion', vendor.storeName, `${vendor.storeName} Darkstore`, `${vendor.city}, ${vendor.state}`, vendor.city, vendor.state, vendor.pincode, 'approved']
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

    // Verification
    console.log('✨ Verification:\n');
    
    const userCheckResult = await client.query(
      `SELECT email, role FROM users WHERE email = $1`,
      [vendor.email]
    );
    console.log('User:');
    userCheckResult.rows.forEach(row => console.log(`  • ${row.email} (${row.role})`));

    const vendorCheckResult = await client.query(
      `SELECT id, email, store_name, city FROM vendors WHERE email = $1`,
      [vendor.email]
    );
    console.log('\nVendor:');
    vendorCheckResult.rows.forEach(row => console.log(`  • ${row.email} - ${row.store_name}`));

    const darkstoreCheckResult = await client.query(
      `SELECT id, name, city, lat, lng FROM dark_stores WHERE name LIKE $1`,
      ['%Wowkids%']
    );
    console.log('\nDarkstore:');
    darkstoreCheckResult.rows.forEach(row => console.log(`  • ${row.name} (${row.lat}, ${row.lng})`));

    console.log('\n✅ Vendor created successfully!');
    console.log('\n📋 Login Credentials:');
    console.log(`   Email: ${vendor.email}`);
    console.log(`   Password: ${vendor.password}`);
    console.log(`   Phone: +91${vendor.phone}`);
    console.log(`   Status: ✅ READY TO LOGIN`);

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

createVendor();
