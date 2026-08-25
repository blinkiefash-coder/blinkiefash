import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixAddressSchemaDeeply() {
  try {
    console.log("🔧 Force fixing addresses.user_id schema...\n");

    // Check all constraints
    console.log("📋 Checking constraints:");
    const constraintsResult = await pool.query(`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = 'addresses'
    `);
    
    constraintsResult.rows.forEach(row => {
      console.log(`  ${row.constraint_name}`);
    });

    console.log("\n🔄 Dropping all FK constraints on addresses.user_id...\n");

    // Drop all FK constraints
    const dropCodes = [
      'DROP CONSTRAINT IF EXISTS addresses_user_id_fkey',
      'DROP CONSTRAINT IF EXISTS "fk_addresses_user"',
      'DROP CONSTRAINT IF EXISTS "fk_addresses_user_id"',
    ];

    for (const dropCode of dropCodes) {
      try {
        console.log(`Dropping: ${dropCode}...`);
        await pool.query(`ALTER TABLE addresses ${dropCode}`);
        console.log("✅ Dropped\n");
      } catch (err) {
        // Silently continue
      }
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

fixAddressSchemaDeeply();
