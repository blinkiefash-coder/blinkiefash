import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixSchema() {
  try {
    console.log("🔧 Fixing orders table schema...\n");

    // Step 1: Check current schema
    console.log("📋 Current orders table columns:");
    const schemaResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      ORDER BY ordinal_position
    `);
    
    schemaResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    console.log("\n🔄 Running ALTER TABLE commands...\n");

    // Step 2: Fix user_id from UUID to TEXT
    try {
      console.log("Converting orders.user_id from UUID to TEXT...");
      await pool.query(`
        ALTER TABLE orders 
        ALTER COLUMN user_id TYPE TEXT USING user_id::text
      `);
      console.log("✅ orders.user_id fixed\n");
    } catch (err) {
      console.error("❌ Error fixing user_id:", err.message, "\n");
    }

    // Step 3: Verify fixed schema
    console.log("📋 Updated orders table columns:");
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('user_id', 'total_amount', 'final_amount')
      ORDER BY ordinal_position
    `);
    
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    console.log("\n✅ Schema fixed successfully!");

  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error(error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixSchema();
