import { pool } from "./db.js";
import crypto from "crypto";

const createPasswordHash = (password = "") => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
};

const buildSlug = (value = "") => {
  const base = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return base || `vendor-${Date.now()}`;
};

async function createVendorWithDarkstore(vendorData) {
  const client = await pool.connect();
  
  try {
    // 1. Try to create darkstore (table might not exist yet)
    let darkStoreId = null;
    try {
      await client.query("BEGIN");
      const darkstoreResult = await client.query(
        `INSERT INTO dark_stores (name, city, pincode, address, lat, lng, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, true, NOW(), NOW())
         RETURNING id`,
        [
          vendorData.storeName,
          vendorData.city || "Cuttack",
          vendorData.pincode || "753001",
          vendorData.address || "Cuttack, Odisha",
          vendorData.lat,
          vendorData.lng
        ]
      );
      
      darkStoreId = darkstoreResult.rows[0].id;
      console.log(`✅ Created darkstore: ${darkStoreId} at (${vendorData.lat}, ${vendorData.lng})`);
      await client.query("COMMIT");
    } catch (err) {
      try { await client.query("ROLLBACK"); } catch {}
      if (err.message.includes("dark_stores") || err.message.includes("does not exist")) {
        console.log(`⚠️  dark_stores table not found, continuing without darkstore`);
        darkStoreId = null;
      } else {
        throw err;
      }
    }

    // 2. Create vendor user
    await client.query("BEGIN");
    try {
      const userResult = await client.query(
        `INSERT INTO users (name, email, phone, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'vendor', true, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE
           SET role = 'vendor', phone = COALESCE($3, phone), updated_at = NOW()
         RETURNING id`,
        [vendorData.storeName, vendorData.email, vendorData.phone || '+919876543210']
      );
      
      const userId = userResult.rows[0].id;
      console.log(`✅ Created/updated user: ${userId} (${vendorData.email})`);

      // 3. Create vendor
      const passwordHash = createPasswordHash(vendorData.password);
      const slug = buildSlug(vendorData.storeName);
      
      // Build vendor insert - try with dark_store_id first, fall back without it
      let vendorResult;
      try {
        vendorResult = await client.query(
          `INSERT INTO vendors (
            user_id, business_name, owner_name, email, phone, password_hash,
            business_type, category, store_name, dark_store_id, slug, description,
            address, city, state, pincode, lat, lng,
            account_holder_name, ifsc_code, bank_name,
            status, is_verified, is_active, is_approved, is_operational,
            created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, $6,
            $7, $8, $9, $10, $11, $12,
            $13, $14, $15, $16, $17, $18,
            $19, $20, $21,
            'approved', true, true, true, true,
            NOW(), NOW()
          )
          RETURNING id`,
          [
            userId,
            vendorData.storeName,
            vendorData.storeName,
            vendorData.email,
            vendorData.phone || "+91-9876543210",
            passwordHash,
            "retail",
            "Fashion",
            vendorData.storeName,
            darkStoreId,
            slug,
            `${vendorData.storeName} Store`,
            vendorData.address || "Cuttack, Odisha",
            vendorData.city || "Cuttack",
            vendorData.state || "Odisha",
            vendorData.pincode || "753001",
            vendorData.lat,
            vendorData.lng,
            vendorData.storeName,
            "AXIS0000000",
            "AXIS Bank"
          ]
        );
      } catch (err) {
        if (err.message.includes("dark_store_id")) {
          // dark_store_id column doesn't exist, insert without it
          console.log(`⚠️  dark_store_id column not found, creating vendor without it`);
          vendorResult = await client.query(
            `INSERT INTO vendors (
              user_id, business_name, owner_name, email, phone, password_hash,
              business_type, category, store_name, slug, description,
              address, city, state, pincode, lat, lng,
              account_holder_name, ifsc_code, bank_name,
              status, is_verified, is_active, is_approved, is_operational,
              created_at, updated_at
            ) VALUES (
              $1, $2, $3, $4, $5, $6,
              $7, $8, $9, $10, $11,
              $12, $13, $14, $15, $16, $17,
              $18, $19, $20,
              'approved', true, true, true, true,
              NOW(), NOW()
            )
            RETURNING id`,
            [
              userId,
              vendorData.storeName,
              vendorData.storeName,
              vendorData.email,
              vendorData.phone || "+91-9876543210",
              passwordHash,
              "retail",
              "Fashion",
              vendorData.storeName,
              slug,
              `${vendorData.storeName} Store`,
              vendorData.address || "Cuttack, Odisha",
              vendorData.city || "Cuttack",
              vendorData.state || "Odisha",
              vendorData.pincode || "753001",
              vendorData.lat,
              vendorData.lng,
              vendorData.storeName,
              "AXIS0000000",
              "AXIS Bank"
            ]
          );
        } else {
          throw err;
        }
      }
      
      const vendorId = vendorResult.rows[0].id;
      console.log(`✅ Created vendor: ${vendorId}`);
      if (darkStoreId) {
        console.log(`   Linked to darkstore: ${darkStoreId}`);
      }

      await client.query("COMMIT");
      
      return {
        success: true,
        vendorId,
        userId,
        darkStoreId: darkStoreId || null,
        email: vendorData.email
      };
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    }
  } catch (err) {
    console.error(`❌ Error creating vendor:`, err.message);
    throw err;
  } finally {
    client.release();
  }
}

async function main() {
  try {
    console.log("🚀 Creating vendors with darkstores...\n");

    // Vendor 1
    console.log("📍 Vendor 1: Manjulagrand");
    const vendor1 = await createVendorWithDarkstore({
      email: "Manjulagrand@blinkiefash.in",
      password: "Manjula@121216",
      storeName: "Manjula Grand",
      lat: 20.3768252,
      lng: 85.8877655,
      city: "Cuttack",
      state: "Odisha",
      pincode: "753001"
    });
    console.log(`   Vendor ID: ${vendor1.vendorId}`);
    console.log(`   Darkstore ID: ${vendor1.darkStoreId}\n`);

    // Vendor 2
    console.log("📍 Vendor 2: Crimson Club Cuttack");
    const vendor2 = await createVendorWithDarkstore({
      email: "Crimsouneclubcuttack@blinkiefash.in",
      password: "Crimcuttack@121216",
      storeName: "Crimson Club Cuttack",
      lat: 20.4703600,
      lng: 85.8875637,
      city: "Cuttack",
      state: "Odisha",
      pincode: "753001"
    });
    console.log(`   Vendor ID: ${vendor2.vendorId}`);
    console.log(`   Darkstore ID: ${vendor2.darkStoreId}\n`);

    console.log("✅ Both vendors created successfully!");
    console.log("\nVendor credentials:");
    console.log("1. Email: Manjulagrand@blinkiefash.in | Password: Manjula@121216");
    console.log("2. Email: Crimsouneclubcuttack@blinkiefash.in | Password: Crimcuttack@121216");

  } catch (err) {
    console.error("Setup failed:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
