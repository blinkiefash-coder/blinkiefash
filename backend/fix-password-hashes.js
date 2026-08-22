#!/usr/bin/env node

import pg from 'pg';
import crypto from 'crypto';
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

const createPasswordHash = (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
};

async function fixPasswordHashes() {
  const client = await pool.connect();

  try {
    console.log('🔐 Fixing password hashes to correct format...\n');

    for (const vendor of vendors) {
      console.log(`📍 Fixing: ${vendor.email}`);

      const newHash = createPasswordHash(vendor.password);
      console.log(`  Generated hash: ${newHash}\n`);

      // Update vendors table
      const result = await client.query(
        `UPDATE vendors SET password_hash = $1 WHERE email = $2 RETURNING id, email`,
        [newHash, vendor.email]
      );

      if (result.rows.length > 0) {
        console.log(`  ✅ Password hash updated for vendor\n`);
      }
    }

    // Verify
    console.log('✨ Verification:\n');
    for (const vendor of vendors) {
      const result = await client.query(
        `SELECT email, password_hash FROM vendors WHERE email = $1`,
        [vendor.email]
      );

      if (result.rows.length > 0) {
        const row = result.rows[0];
        console.log(`📧 ${row.email}`);
        console.log(`   Password Hash: ${row.password_hash}\n`);
      }
    }

    console.log('✅ All password hashes fixed successfully!');
    console.log('\n📋 Login Credentials:');
    console.log('   Manjulagrand@blinkiefash.in | Manjula@121216');
    console.log('   Crimsouneclubcuttack@blinkiefash.in | Crimcuttack@121216');

  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  } finally {
    await client.release();
    await pool.end();
  }
}

fixPasswordHashes();
