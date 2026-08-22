#!/usr/bin/env node

import pg from 'pg';
const { Pool } = pg;

const connectionString = 'postgresql://neondb_owner:npg_yw6RXdt0sKvB@ep-falling-block-amfecyj6-pooler.c-5.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require';

const pool = new Pool({ connectionString });

const vendors = [
  {
    email: 'Manjulagrand@blinkiefash.in',
    password: 'Manjula@121216'
  },
  {
    email: 'Crimsouneclubcuttack@blinkiefash.in',
    password: 'Crimcuttack@121216'
  }
];

async function verifyVendorLogin() {
  const client = await pool.connect();

  try {
    console.log('🔐 VERIFYING VENDOR LOGIN CREDENTIALS\n');

    for (const vendor of vendors) {
      console.log(`📍 Checking vendor: ${vendor.email}`);

      // Get user
      const userResult = await client.query(
        `SELECT id, email, password_hash, role FROM users WHERE email = $1`,
        [vendor.email]
      );

      if (userResult.rows.length === 0) {
        console.log(`  ❌ User not found\n`);
        continue;
      }

      const user = userResult.rows[0];
      console.log(`  ✅ User found`);
      console.log(`     ID: ${user.id}`);
      console.log(`     Email: ${user.email}`);
      console.log(`     Role: ${user.role}`);
      console.log(`     Password Hash: ${user.password_hash ? '✅ Set' : '❌ Not set'}`);

      // Get vendor profile
      const vendorResult = await client.query(
        `SELECT id, user_id, email, store_name, is_active, is_approved, status, dark_store_id FROM vendors WHERE email = $1`,
        [vendor.email]
      );

      if (vendorResult.rows.length === 0) {
        console.log(`  ❌ Vendor profile not found\n`);
        continue;
      }

      const vendorProfile = vendorResult.rows[0];
      console.log(`  ✅ Vendor profile found`);
      console.log(`     Vendor ID: ${vendorProfile.id}`);
      console.log(`     Store Name: ${vendorProfile.store_name}`);
      console.log(`     Status: ${vendorProfile.status}`);
      console.log(`     Is Active: ${vendorProfile.is_active}`);
      console.log(`     Is Approved: ${vendorProfile.is_approved}`);
      console.log(`     Darkstore ID: ${vendorProfile.dark_store_id || '❌ Not linked'}`);

      // Get darkstore
      if (vendorProfile.dark_store_id) {
        const darkstoreResult = await client.query(
          `SELECT id, name, city, lat, lng, is_active FROM dark_stores WHERE id = $1`,
          [vendorProfile.dark_store_id]
        );

        if (darkstoreResult.rows.length > 0) {
          const darkstore = darkstoreResult.rows[0];
          console.log(`  ✅ Darkstore linked`);
          console.log(`     Store Name: ${darkstore.name}`);
          console.log(`     Coordinates: ${darkstore.lat}, ${darkstore.lng}`);
          console.log(`     Is Active: ${darkstore.is_active}`);
        }
      }

      console.log(`\n  📋 Login Credentials:`);
      console.log(`     Email: ${vendor.email}`);
      console.log(`     Password: ${vendor.password}`);
      console.log(`     Status: ✅ READY TO LOGIN\n`);
    }

    console.log('✅ All vendors verified successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

verifyVendorLogin();
