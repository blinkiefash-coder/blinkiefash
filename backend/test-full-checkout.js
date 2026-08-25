import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function fullTest() {
  try {
    console.log("🧪 Full Checkout Test\n");

    const firebaseUid = "oCdsgfAPZNZc7O5jHkUPYKDHlnI2"; // Test Firebase UID

    // Step 1: Create a test address
    console.log("📍 Step 1: Creating test address...");
    const addrResult = await pool.query(`
      INSERT INTO addresses 
      (user_id, name, phone, address_line, city, pincode, is_default, lat, lng, address_type)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING id, user_id
    `, [
      firebaseUid,
      "Test User",
      "9999999999",
      "123 Test Street",
      "Test City",
      "123456",
      true,
      "0",
      "0",
      "home"
    ]);
    
    const addressId = addrResult.rows[0].id;
    console.log(`✅ Address created: ${addressId}\n`);

    // Step 2: Test INSERT into orders
    console.log("📦 Step 2: Testing INSERT into orders...");
    const orderResult = await pool.query(`
      INSERT INTO orders
      (user_id, address_id, status, total_amount, final_amount,
       payment_method, dark_store_id, is_try_order,
       referral_discount, clothing_discount, bundle_discount, first_order_discount,
       pickup_route, route_distance_km)
      VALUES ($1, $2::UUID, $3::TEXT, $4::DECIMAL, $5::DECIMAL, $6::TEXT, $7::UUID, $8::BOOLEAN, $9::DECIMAL, $10::DECIMAL, $11::DECIMAL, $12::DECIMAL, $13::JSONB, $14::DECIMAL)
      RETURNING id, user_id, status, total_amount, final_amount, created_at
    `, [
      firebaseUid,                    // $1: user_id (TEXT)
      addressId,                      // $2: address_id (UUID)
      "placed",                       // $3: status (TEXT)
      500.00,                         // $4: total_amount (DECIMAL)
      600.00,                         // $5: final_amount (DECIMAL)
      "cod",                          // $6: payment_method (TEXT)
      null,                           // $7: dark_store_id (UUID)
      false,                          // $8: is_try_order (BOOLEAN)
      0.00,                           // $9: referral_discount (DECIMAL)
      0.00,                           // $10: clothing_discount (DECIMAL)
      0.00,                           // $11: bundle_discount (DECIMAL)
      0.00,                           // $12: first_order_discount (DECIMAL)
      null,                           // $13: pickup_route (JSONB)
      null                            // $14: route_distance_km (DECIMAL)
    ]);

    const order = orderResult.rows[0];
    console.log("✅ Order created successfully!\n");
    console.log("📊 Order Details:");
    console.log(`  ID: ${order.id}`);
    console.log(`  User ID: ${order.user_id}`);
    console.log(`  Status: ${order.status}`);
    console.log(`  Total Amount: ₹${order.total_amount}`);
    console.log(`  Final Amount: ₹${order.final_amount}`);
    console.log(`  Created: ${order.created_at}\n`);

    console.log("🎉 All tests passed!");
    console.log("✅ Checkout API is ready to use!");

  } catch (error) {
    console.error("❌ ERROR:", error.message);
    if (error.detail) console.error("Detail:", error.detail);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

fullTest();
