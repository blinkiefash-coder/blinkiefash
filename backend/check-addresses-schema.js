import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function checkAddressesSchema() {
  try {
    console.log("📋 Checking addresses table schema...\n");

    const result = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'addresses'
      ORDER BY ordinal_position
    `);
    
    console.log("Columns in addresses table:");
    result.rows.forEach(row => {
      console.log(`  ${row.column_name}: ${row.data_type}`);
    });

  } catch (error) {
    console.error("❌ ERROR:", error.message);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

checkAddressesSchema();
