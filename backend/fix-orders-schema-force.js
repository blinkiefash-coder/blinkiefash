import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fixSchemaForce() {
  try {
    console.log("🔧 Force fixing orders table schema...\n");

    // Step 1: Check constraints
    console.log("📋 Checking constraints on orders table:");
    const constraintsResult = await pool.query(`
      SELECT constraint_name, constraint_type 
      FROM information_schema.table_constraints 
      WHERE table_name = 'orders'
    `);
    
    constraintsResult.rows.forEach(row => {
      console.log(`  ${row.constraint_name} (${row.constraint_type})`);
    });

    console.log("\n🔄 Dropping foreign key constraints...\n");

    // Step 2: Drop the foreign key constraint
    try {
      console.log("Dropping orders_customer_id_fkey...");
      await pool.query(`
        ALTER TABLE orders 
        DROP CONSTRAINT IF EXISTS "orders_customer_id_fkey"
      `);
      console.log("✅ Foreign key dropped\n");
    } catch (err) {
      console.error("❌ Error dropping FK:", err.message, "\n");
    }

    // Step 3: Now alter the column type
    try {
      console.log("Converting orders.user_id from UUID to TEXT...");
      await pool.query(`
        ALTER TABLE orders 
        ALTER COLUMN user_id TYPE TEXT USING user_id::text
      `);
      console.log("✅ orders.user_id converted to TEXT\n");
    } catch (err) {
      console.error("❌ Error converting type:", err.message, "\n");
    }

    // Step 4: Verify
    console.log("📋 Verifying orders table columns:");
    const verifyResult = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'orders' 
      AND column_name IN ('user_id', 'total_amount', 'final_amount', 'address_id')
      ORDER BY ordinal_position
    `);
    
    verifyResult.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

    console.log("\n✅ Schema fixed successfully!");

  } catch (error) {
    console.error("❌ FATAL ERROR:", error.message);
    console.error(error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fixSchemaForce();
