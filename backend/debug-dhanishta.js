import { pool } from "./db.js";

async function debugDhanishta() {
  try {
    // Check if user dhanishta exists
    console.log("\n=== Checking user 'dhanishta' ===");
    const userResult = await pool.query(
      `SELECT id, name, email, role FROM users WHERE lower(name) LIKE '%dhanishta%' OR lower(email) LIKE '%dhanishta%' LIMIT 10`
    );
    console.log("Users found:", userResult.rows);

    // Check vendors
    console.log("\n=== Checking vendors ===");
    const vendorResult = await pool.query(
      `SELECT id, user_id, email, store_name, owner_name FROM vendors WHERE lower(owner_name) LIKE '%dhanishta%' OR lower(store_name) LIKE '%dhanishta%' OR lower(email) LIKE '%dhanishta%' LIMIT 10`
    );
    console.log("Vendors found:", vendorResult.rows);

    if (vendorResult.rows.length > 0) {
      const vendor = vendorResult.rows[0];
      console.log(`\n=== Checking products for vendor_id ${vendor.id} ===`);
      const productResult = await pool.query(
        `SELECT id, name, vendor_id FROM products WHERE vendor_id::text = $1 OR vendor_id = $2 LIMIT 20`,
        [String(vendor.id), vendor.id]
      );
      console.log(`Products found for vendor: ${productResult.rows.length}`);
      productResult.rows.forEach(p => console.log(`  - ${p.name} (vendor_id: ${p.vendor_id})`));

      // Check what vendor_ids exist in products table
      console.log(`\n=== All unique vendor_ids in products table ===`);
      const vendorIdsResult = await pool.query(
        `SELECT DISTINCT vendor_id FROM products LIMIT 20`
      );
      console.log("Unique vendor_ids:", vendorIdsResult.rows.map(r => r.vendor_id));

      // Check if any products have NULL vendor_id
      console.log(`\n=== Products with NULL vendor_id ===`);
      const nullResult = await pool.query(
        `SELECT id, name FROM products WHERE vendor_id IS NULL LIMIT 10`
      );
      console.log(`Found ${nullResult.rows.length} products with NULL vendor_id`);
      nullResult.rows.forEach(p => console.log(`  - ${p.name}`));
    }

    // Show all vendors
    console.log("\n=== All vendors in database ===");
    const allVendors = await pool.query(
      `SELECT id, user_id, email, store_name, owner_name FROM vendors LIMIT 20`
    );
    console.log(`Total vendors: ${allVendors.rows.length}`);
    allVendors.rows.forEach(v => console.log(`  - [${v.id}] ${v.store_name} (${v.owner_name}) - ${v.email}`));

  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    process.exit(0);
  }
}

debugDhanishta();
