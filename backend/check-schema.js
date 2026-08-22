import { pool } from "./db.js";

async function checkSchema() {
  try {
    const result = await pool.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'dark_stores'
      ORDER BY ordinal_position
    `);
    
    console.log("dark_stores table schema:");
    result.rows.forEach(row => {
      console.log(`  - ${row.column_name}: ${row.data_type}`);
    });
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    process.exit(0);
  }
}

checkSchema();
