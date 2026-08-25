import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixAddressSchema() {
  try {
    console.log("🔧 Fixing addresses.user_id schema...\n");

    // Drop FK if exists
    try {
      console.log("Dropping foreign key constraint on addresses.user_id...");
      await pool.query(`
        ALTER TABLE addresses 
        DROP CONSTRAINT IF EXISTS addresses_user_id_fkey
      `);
      console.log("✅ Constraint dropped\n");
    } catch (err) {
      console.log("⚠️ No FK constraint found, continuing...\n");
    }

    // Convert to TEXT
    try {
      console.log("Converting addresses.user_id from UUID to TEXT...");
      await pool.query(`
        ALTER TABLE addresses 
        ALTER COLUMN user_id TYPE TEXT USING user_id::text
      `);
      console.log("✅ addresses.user_id converted to TEXT\n");
    } catch (err) {
      console.error("❌ Error:", err.message, "\n");
    }

    // Verify
    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'addresses' 
      AND column_name = 'user_id'
    `);
    
    console.log("📋 Verified addresses.user_id:");
    console.log(`  Type: ${result.rows[0].data_type}`);
    console.log("\n✅ Schema fixed!");

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixAddressSchema();
