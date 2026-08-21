#!/usr/bin/env node
/**
 * Database Connection Test Script
 * Run this to verify Neon database connectivity
 * Usage: node test-db-connection.js
 */

import pkg from "pg";
const { Pool } = pkg;
import "dotenv/config";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("❌ ERROR: DATABASE_URL environment variable not set");
  console.error("   Please create /backend/.env with DATABASE_URL");
  process.exit(1);
}

console.log("🔍 Testing Database Connection...\n");
console.log("📍 Connection String (partially masked):");
const masked = connectionString.replace(/:[^:/@]+@/, ":***@");
console.log("   " + masked + "\n");

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
});

// Test 1: Basic connection
console.log("Test 1: Basic Connection");
console.log("------------------------");
pool
  .query("SELECT NOW()")
  .then((result) => {
    console.log("✅ Connected successfully!");
    console.log("   Server time:", result.rows[0].now);
  })
  .catch((err) => {
    console.error("❌ Connection failed:", err.message);
    if (err.message.includes("ECONNREFUSED")) {
      console.error("   → Neon compute might be suspended. Resume in Neon console.");
    } else if (err.message.includes("authentication failed")) {
      console.error("   → Invalid credentials. Check DATABASE_URL in .env");
    } else if (err.message.includes("timeout")) {
      console.error("   → Connection timeout. Verify connection string and network.");
    }
    process.exit(1);
  })
  .then(() => {
    // Test 2: Check tables
    console.log("\nTest 2: Database Tables");
    console.log("------------------------");
    return pool.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name;"
    );
  })
  .then((result) => {
    if (result && result.rows && result.rows.length > 0) {
      console.log("✅ Found " + result.rows.length + " tables:");
      result.rows.forEach((row) => console.log("   - " + row.table_name));
    } else {
      console.warn(
        "⚠️  No tables found. Database may be empty. Run migrations if needed."
      );
    }
  })
  .catch((err) => {
    console.error("❌ Table check failed:", err.message);
  })
  .then(() => {
    // Test 3: Connection pool info
    console.log("\nTest 3: Pool Information");
    console.log("------------------------");
    console.log("✅ Pool created successfully");
    console.log("   Max connections: " + (pool.options?.max || "unlimited"));
  })
  .finally(() => {
    pool.end();
    console.log("\n✨ Test complete. Connection closed.\n");
  });
