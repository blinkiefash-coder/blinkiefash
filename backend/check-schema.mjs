import { pool } from "./db.js";

const { rows } = await pool.query(`
  SELECT column_name, data_type 
  FROM information_schema.columns 
  WHERE table_name = 'addresses' AND column_name = 'user_id'
`);

console.log("addresses.user_id column type:", rows[0]?.data_type);
process.exit(0);
