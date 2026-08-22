import pg from "pg";
import * as dotenv from "dotenv";

dotenv.config();
const { Pool } = pg;

async function checkSchema() {
  const pool = new Pool();
  try {
    // Check users table columns
    console.log("📋 users table columns:");
    const usersResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'users'
      ORDER BY ordinal_position
    `);
    usersResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

    // Check vendors table columns
    console.log("\n📋 vendors table columns:");
    const vendorsResult = await pool.query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name = 'vendors'
      ORDER BY ordinal_position
    `);
    vendorsResult.rows.forEach(row => {
      console.log(`   ${row.column_name}: ${row.data_type} (nullable: ${row.is_nullable})`);
    });

  } catch (err) {
    console.error("❌ Error:", err.message);
  } finally {
    pool.end();
  }
}

checkSchema();
