import { pool } from "./db.js";

async function checkSchema() {
  try {
    // Check orders table columns
    const result = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'orders'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 ORDERS TABLE SCHEMA:");
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check addresses table schema
    const addressResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'addresses'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 ADDRESSES TABLE SCHEMA:");
    addressResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check user_rewards table schema
    const rewardsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable
      FROM information_schema.columns
      WHERE table_name = 'user_rewards'
      ORDER BY ordinal_position
    `);
    
    console.log("\n📋 USER_REWARDS TABLE SCHEMA:");
    rewardsResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();
