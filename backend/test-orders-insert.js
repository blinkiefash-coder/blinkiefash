import pkg from "pg";
const { Pool } = pkg;
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

async function testInsert() {
  try {
    console.log("🧪 Testing direct INSERT into orders table...\n");

    // Test data
    const testData = {
      userId: "oCdsgfAPZNZc7O5jHkUPYKDHlnI2", // Firebase UID
      addressId: "550e8400-e29b-41d4-a716-446655440000", // Random UUID
      status: "placed",
      itemsSubtotal: 500.00,
      finalAmount: 600.00,
      paymentMethod: "cod",
      darkStoreId: null,
      isTryOrder: false,
      referralDiscount: 0.00,
      clothingDiscount: 0.00,
      bundleDiscount: 0.00,
      firstOrderDiscount: 0.00,
      pickupRoute: null,
      distanceKm: null,
    };

    console.log("📝 Test Data:");
    console.log(JSON.stringify(testData, null, 2));
    console.log("\n");

    // Run the exact query from checkout.js
    const query = `INSERT INTO orders
         (user_id, address_id, status, total_amount, final_amount,
          payment_method, dark_store_id, is_try_order,
          referral_discount, clothing_discount, bundle_discount, first_order_discount,
          pickup_route, route_distance_km)
       VALUES ($1, $2::UUID, $3::TEXT, $4::DECIMAL, $5::DECIMAL, $6::TEXT, $7::UUID, $8::BOOLEAN, $9::DECIMAL, $10::DECIMAL, $11::DECIMAL, $12::DECIMAL, $13::JSONB, $14::DECIMAL)
       RETURNING id, status, total_amount, final_amount, created_at`;

    const params = [
      testData.userId,
      testData.addressId,
      testData.status,
      testData.itemsSubtotal,
      testData.finalAmount,
      testData.paymentMethod,
      testData.darkStoreId,
      testData.isTryOrder,
      testData.referralDiscount,
      testData.clothingDiscount,
      testData.bundleDiscount,
      testData.firstOrderDiscount,
      testData.pickupRoute,
      testData.distanceKm,
    ];

    console.log("🔍 Query Parameters:");
    params.forEach((p, i) => {
      console.log(`  $${i + 1}: ${JSON.stringify(p)} (${typeof p})`);
    });

    console.log("\n📤 Executing query...\n");
    const result = await pool.query(query, params);

    console.log("✅ SUCCESS!");
    console.log("📊 Result:", JSON.stringify(result.rows[0], null, 2));
  } catch (error) {
    console.error("❌ ERROR:", error.message);
    console.error("\n📋 Full Error:");
    console.error(error);
  } finally {
    await pool.end();
    process.exit(0);
  }
}

testInsert();
