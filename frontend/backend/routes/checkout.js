import express from "express";
import { pool } from "../db.js";
import { notifyAvailableRiders, notifyCustomerOfStatus, notifyVendorOfNewOrder } from "../utils/firebaseAdmin.js";

const router = express.Router();

// ── Haversine helper (km) ────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Bundle pricing rules ────────────────────────────────────────────────────
// Check bundle offers from database for cart items
// Returns discount amount (positive value to subtract from subtotal)
async function calculateBundleDiscount(items, subtotal, client = pool) {
  if (!Array.isArray(items) || items.length === 0 || subtotal <= 0) {
    return 0;
  }

  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Get all unique product IDs from items
  const productIds = [...new Set(items.map((item) => item.variantId))];
  if (productIds.length === 0) return 0;

  try {
    // Find applicable bundle offers
    const { rows: offers } = await client.query(
      `SELECT product_id, quantity_min, quantity_max, discount_value, discount_type
       FROM bundle_offers
       WHERE product_id = ANY($1::uuid[])
       AND is_active = true
       AND quantity_min <= $2
       AND (quantity_max IS NULL OR quantity_max >= $2)
       ORDER BY quantity_min DESC
       LIMIT 1`,
      [productIds, totalQuantity]
    );

    if (offers.length > 0) {
      const offer = offers[0];
      // For fixed_price offers, return the discount
      if (offer.discount_type === 'fixed_price' && subtotal > offer.discount_value) {
        return subtotal - offer.discount_value;
      }
      // For percentage offers (future use)
      if (offer.discount_type === 'percentage') {
        return (subtotal * offer.discount_value) / 100;
      }
    }

    return 0;
  } catch (err) {
    console.error("Bundle discount calculation error:", err);
    return 0;
  }
}

// ── Delivery fee rules ────────────────────────────────────────────────────────
// - subtotal >= 999 → 0 (free delivery)
// - distance ≤ 15 km → 49
// - distance > 15 km → null (out of range)
function calcDeliveryFee(subtotal, distanceKm) {
  if (subtotal >= 999) return 0;
  if (distanceKm <= 15) return 49;
  return null; // out of range
}

// ── GET /api/checkout/addresses?userId=xxx ──────────────────────────────────
router.get("/addresses", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: "userId required" });
  try {
    const { rows } = await pool.query(
      `SELECT id, address_line, city, pincode, is_default, lat, lng
       FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC`,
      [userId]
    );
    res.json({ success: true, addresses: rows });
  } catch (err) {
    console.error("GET addresses error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/delivery-fee?addressId=xxx&subtotal=nnn ────────────────
router.get("/delivery-fee", async (req, res) => {
  const { addressId, subtotal } = req.query;
  if (!addressId) return res.status(400).json({ success: false, message: "addressId required" });
  try {
    const { rows: addrRows } = await pool.query(
      `SELECT city, lat, lng FROM addresses WHERE id = $1`, [addressId]
    );
    if (!addrRows.length) return res.status(404).json({ success: false, message: "Address not found" });

    const { city, lat: addrLat, lng: addrLng } = addrRows[0];
    const sub = parseFloat(subtotal) || 0;
    let fee = 0;
    let distance = null;
    let withinRange = true;

    if (addrLat != null && addrLng != null) {
      // Find nearest active dark store by actual distance
      const { rows: storeRows } = await pool.query(
        `SELECT id, name, lat, lng FROM dark_stores WHERE is_active = true AND lat IS NOT NULL AND lng IS NOT NULL`,
        []
      );
      if (storeRows.length) {
        let nearest = storeRows[0];
        let minDist = haversineKm(parseFloat(addrLat), parseFloat(addrLng), parseFloat(nearest.lat), parseFloat(nearest.lng));
        for (const s of storeRows.slice(1)) {
          const d = haversineKm(parseFloat(addrLat), parseFloat(addrLng), parseFloat(s.lat), parseFloat(s.lng));
          if (d < minDist) { minDist = d; nearest = s; }
        }
        distance = Math.round(minDist * 10) / 10;
        const calcFee = calcDeliveryFee(sub, distance);
        if (calcFee === null) {
          withinRange = false;
          fee = null;
        } else {
          fee = calcFee;
        }
      }
    } else {
      // No coordinates — city-based fallback, assume in range
      const { rows: storeRows } = await pool.query(
        `SELECT id FROM dark_stores WHERE is_active = true AND lower(city) = lower($1) LIMIT 1`, [city]
      );
      if (!storeRows.length) withinRange = false;
      fee = sub >= 999 ? 0 : 49; // free delivery on ₹999+ orders
    }

    res.json({ success: true, fee, distance, withinRange });
  } catch (err) {
    console.error("delivery-fee error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/checkout/addresses ─────────────────────────────────────────────
router.post("/addresses", async (req, res) => {
  const { userId, address_line, city, pincode, lat, lng } = req.body;
  if (!userId || !address_line || !city || !pincode) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }
  try {
    // If this is the first address, make it default
    const { rows: existing } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM addresses WHERE user_id = $1`, [userId]
    );
    const isDefault = parseInt(existing[0].cnt) === 0;

    const { rows } = await pool.query(
      `INSERT INTO addresses (user_id, address_line, city, pincode, is_default, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, address_line.trim(), city.trim(), pincode.trim(), isDefault,
       lat ?? null, lng ?? null]
    );
    res.json({ success: true, address: rows[0] });
  } catch (err) {
    console.error("POST addresses error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── DELETE /api/checkout/addresses/:id ────────────────────────────────────────
router.delete("/addresses/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, message: "Address ID required" });
  try {
    await pool.query(`DELETE FROM addresses WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE address error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/rewards?userId=xxx ─────────────────────────────────────
// Returns the user's available reward credits.
router.get("/rewards", async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }
  try {
    const { rows: refRows } = await pool.query(
      `SELECT COALESCE(SUM(value), 0)::float AS amount,
              COUNT(*)::int AS count
       FROM user_rewards
       WHERE user_id = $1 AND type = 'referral_50' AND status = 'available'`,
      [userId]
    );
    const { rows: clothRows } = await pool.query(
      `SELECT COALESCE(SUM(value), 0)::int AS items,
              COUNT(*)::int AS count
       FROM user_rewards
       WHERE user_id = $1 AND type = 'clothing_pct' AND status = 'available'`,
      [userId]
    );
    const items = clothRows[0].items;
    res.json({
      success: true,
      referralAmount: refRows[0].amount,
      referralCount: refRows[0].count,
      clothingItems: items,
      clothingPercent: Math.min(items, 5),
    });
  } catch (err) {
    console.error("GET rewards error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/checkout/orders ─────────────────────────────────────────────────
// Body: { userId, addressId, items: [{variantId, quantity, price}], totalAmount, isTryOrder?, useReferralReward?, useClothingReward? }
router.post("/orders", async (req, res) => {
  const {
    userId,
    addressId,
    items,
    totalAmount,
    isTryOrder,
    useReferralReward,
    useClothingReward,
  } = req.body;
  if (!userId || !addressId || !items?.length || !totalAmount) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find the address with city and coordinates
    const { rows: addrRows } = await client.query(
      `SELECT city, lat, lng FROM addresses WHERE id = $1 AND user_id = $2`, [addressId, userId]
    );
    if (!addrRows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Address not found" });
    }
    const city = addrRows[0].city;

    // Get address lat/lng for fee calculation
    const addrLat = addrRows[0]?.lat;
    const addrLng = addrRows[0]?.lng;

    // Find nearest active dark store
    const { rows: storeRows } = await client.query(
      `SELECT id, lat, lng FROM dark_stores WHERE is_active = true AND lat IS NOT NULL AND lng IS NOT NULL`
    );
    let darkStoreId = null;
    let distanceKm = null;
    if (storeRows.length && addrLat != null && addrLng != null) {
      let nearest = storeRows[0];
      let minDist = haversineKm(parseFloat(addrLat), parseFloat(addrLng), parseFloat(nearest.lat), parseFloat(nearest.lng));
      for (const s of storeRows.slice(1)) {
        const d = haversineKm(parseFloat(addrLat), parseFloat(addrLng), parseFloat(s.lat), parseFloat(s.lng));
        if (d < minDist) { minDist = d; nearest = s; }
      }
      darkStoreId = nearest.id;
      distanceKm = Math.round(minDist * 10) / 10;
    } else {
      // Fallback: city match
      const { rows: cityStore } = await client.query(
        `SELECT id FROM dark_stores WHERE is_active = true AND lower(city) = lower($1) LIMIT 1`, [city]
      );
      darkStoreId = cityStore.length ? cityStore[0].id : null;
    }

    // Validate requested quantities against live inventory and lock rows.
    const requestedByVariant = new Map();
    for (const item of items) {
      const variantId = item?.variantId?.toString();
      const qty = Math.max(1, parseInt(item?.quantity, 10) || 1);
      if (!variantId) {
        await client.query("ROLLBACK");
        return res
          .status(400)
          .json({ success: false, message: "Invalid order item variant" });
      }
      requestedByVariant.set(
        variantId,
        (requestedByVariant.get(variantId) || 0) + qty
      );
    }

    const reservedRows = [];
    for (const [variantId, qty] of requestedByVariant.entries()) {
      let invRows;
      if (darkStoreId) {
        ({ rows: invRows } = await client.query(
          `SELECT id, stock, COALESCE(reserved_stock, 0) AS reserved_stock
           FROM inventory
           WHERE variant_id = $1 AND store_id = $2
           FOR UPDATE`,
          [variantId, darkStoreId]
        ));
      } else {
        ({ rows: invRows } = await client.query(
          `SELECT id, stock, COALESCE(reserved_stock, 0) AS reserved_stock
           FROM inventory
           WHERE variant_id = $1
           ORDER BY (COALESCE(stock, 0) - COALESCE(reserved_stock, 0)) DESC
           LIMIT 1
           FOR UPDATE`,
          [variantId]
        ));
      }

      if (!invRows?.length) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "One or more variants are unavailable",
          variantId,
        });
      }

      const inv = invRows[0];
      const available =
        (parseInt(inv.stock, 10) || 0) - (parseInt(inv.reserved_stock, 10) || 0);
      if (available < qty) {
        await client.query("ROLLBACK");
        return res.status(409).json({
          success: false,
          message: "Insufficient stock for one or more variants",
          variantId,
          available,
          requested: qty,
        });
      }

      reservedRows.push({ inventoryId: inv.id, quantity: qty });
    }

    // Calculate delivery fee
    const itemsSubtotal = totalAmount; // client now sends subtotal (items only)
    
    // ── Calculate bundle discount ───
    const bundleDiscount = await calculateBundleDiscount(items, itemsSubtotal, client);
    const subtotalAfterBundle = itemsSubtotal - bundleDiscount;

    let deliveryFee = 0;
    if (distanceKm !== null) {
      const calcFee = calcDeliveryFee(subtotalAfterBundle, distanceKm);
      if (calcFee === null) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Sorry, delivery is not available beyond 15 km from our nearest store." });
      }
      deliveryFee = calcFee;
    } else {
      deliveryFee = subtotalAfterBundle > 1499 ? 0 : 49;
    }

    // ── Apply rewards (referral ₹50 + clothing up to 5% for next order) ───
    let referralRewardId = null;
    let clothingRewardIds = [];
    let referralDiscount = 0;
    let clothingDiscount = 0;

    if (useReferralReward) {
      const { rows: refRewards } = await client.query(
        `SELECT id, value FROM user_rewards
         WHERE user_id = $1 AND type = 'referral_50' AND status = 'available'
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE`,
        [userId]
      );
      if (refRewards.length) {
        referralRewardId = refRewards[0].id;
        referralDiscount = Math.min(parseFloat(refRewards[0].value) || 0, subtotalAfterBundle);
      }
    }

    if (useClothingReward) {
      const { rows: clothRewards } = await client.query(
        `SELECT id, value FROM user_rewards
         WHERE user_id = $1 AND type = 'clothing_pct' AND status = 'available'
         ORDER BY created_at ASC
         FOR UPDATE`,
        [userId]
      );
      if (clothRewards.length) {
        const totalItems = clothRewards.reduce(
          (s, r) => s + (parseFloat(r.value) || 0),
          0
        );
        const percent = Math.min(totalItems, 5);
        clothingDiscount = Math.round((subtotalAfterBundle * percent) / 100 * 100) / 100;
        clothingRewardIds = clothRewards.map((r) => r.id);
      }
    }

    const totalDiscount = referralDiscount + clothingDiscount;
    const discountedSubtotal = Math.max(subtotalAfterBundle - totalDiscount, 0);
    const finalAmount = discountedSubtotal + deliveryFee;

    // Create order
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
         (user_id, address_id, status, total_amount, final_amount,
          payment_method, dark_store_id, is_try_order,
          referral_discount, clothing_discount, bundle_discount)
       VALUES ($1, $2, 'placed', $3, $4, 'cod', $5, $6, $7, $8, $9)
       RETURNING id, status, total_amount, final_amount, created_at`,
      [userId, addressId, itemsSubtotal, finalAmount, darkStoreId, isTryOrder === true,
       referralDiscount, clothingDiscount, bundleDiscount]
    );
    const order = orderRows[0];

    // Generate 4-digit OTP for delivery verification
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
    await client.query(
      `UPDATE orders SET delivery_otp = $1 WHERE id = $2`,
      [deliveryOtp, order.id]
    );

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, variant_id, quantity, price, item_status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [order.id, item.variantId, item.quantity, item.price]
      );
    }

    // Reserve inventory immediately so remaining stock becomes unavailable to others.
    for (const row of reservedRows) {
      await client.query(
        `UPDATE inventory
         SET reserved_stock = COALESCE(reserved_stock, 0) + $1
         WHERE id = $2`,
        [row.quantity, row.inventoryId]
      );
    }

    // Mark consumed reward credits as used.
    if (referralRewardId) {
      await client.query(
        `UPDATE user_rewards SET status = 'used', used_at = NOW(), order_id = $1
         WHERE id = $2`,
        [order.id, referralRewardId]
      );
    }
    if (clothingRewardIds.length) {
      await client.query(
        `UPDATE user_rewards SET status = 'used', used_at = NOW(), order_id = $1
         WHERE id = ANY($2::uuid[])`,
        [order.id, clothingRewardIds]
      );
    }

    // ── Track referral: if this user was referred, credit the referrer ₹50 on first order ──
    const { rows: userRows } = await client.query(
      `SELECT referred_by FROM users WHERE id = $1`, [userId]
    );
    if (userRows.length && userRows[0].referred_by) {
      // Check if this is the user's first order (excluding try orders)
      const { rows: orderCountRows } = await client.query(
        `SELECT COUNT(*) AS cnt FROM orders WHERE user_id = $1 AND is_try_order = false AND id != $2`,
        [userId, order.id]
      );
      if (parseInt(orderCountRows[0].cnt) === 0) {
        // This is the first order! Credit the referrer ₹50
        const referrerId = userRows[0].referred_by;
        
        // Create a referral tracking record
        await client.query(
          `INSERT INTO referrals (referrer_id, referred_user_id, order_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (referrer_id, referred_user_id) DO UPDATE
           SET order_id = $3, created_at = NOW()`,
          [referrerId, userId, order.id]
        );
        
        // Credit ₹50 to the referrer
        await client.query(
          `INSERT INTO user_rewards (user_id, type, value, status, source_order_id)
           VALUES ($1, 'referral_50', 50, 'available', $2)`,
          [referrerId, order.id]
        );
      }
    }

    await client.query("COMMIT");
    // Push "order placed" to the customer and vendor (best-effort)
    notifyCustomerOfStatus(pool, order.id, 'placed').catch(() => {});
    notifyVendorOfNewOrder(pool, order.id).catch(() => {});
    res.json({
      success: true,
      orderId: order.id,
      status: order.status,
      totalAmount: order.total_amount,
      bundleDiscount: bundleDiscount,
      deliveryFee: deliveryFee,
      referralDiscount,
      clothingDiscount,
      finalAmount: order.final_amount,
      deliveryOtp: deliveryOtp,
      distanceKm: distanceKm,
      createdAt: order.created_at,
      darkStoreAssigned: !!darkStoreId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST orders error:", err.message, err.detail ?? '');
    res.status(500).json({ success: false, message: err.detail ?? err.message ?? "Server error" });
  } finally {
    client.release();
  }
});

// ── GET /api/checkout/orders?userId=xxx ──────────────────────────────────────
router.get("/orders", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: "userId required" });
  try {
    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.total_amount,
         o.final_amount,
         o.payment_method,
         o.is_try_order,
         o.created_at,
         a.address_line,
         a.city,
         a.pincode,
         json_agg(json_build_object(
           'variant_id',  oi.variant_id,
           'variant_code',v.variant_code,
           'quantity',    oi.quantity,
           'price',       oi.price,
           'item_status', oi.item_status,
           'product_name',p.name,
           'size',        v.size,
           'color',       v.color,
           'image',       (SELECT url FROM product_media WHERE variant_id = v.id AND is_primary = true LIMIT 1)
         ) ORDER BY oi.id) AS items
       FROM orders o
       LEFT JOIN addresses a ON a.id = o.address_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE o.user_id = $1
       GROUP BY o.id, a.address_line, a.city, a.pincode
       ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json({ success: true, orders: rows });
  } catch (err) {
    console.error("GET user orders error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/checkout/orders/:orderId ─────────────────────────────────────────
router.get("/orders/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows: orderRows } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.total_amount,
         o.final_amount,
         o.payment_method,
         o.is_try_order,
         o.created_at,
         o.confirmed_at,
         u.name   AS customer_name,
         u.phone  AS customer_phone,
         a.address_line,
         a.city,
         a.pincode,
         a.lat    AS address_lat,
         a.lng    AS address_lng,
         COALESCE(ds.name, (SELECT name FROM dark_stores WHERE is_active=true AND lower(city)=lower(a.city) LIMIT 1)) AS dark_store_name,
         COALESCE(ds.lat,  (SELECT lat  FROM dark_stores WHERE is_active=true AND lower(city)=lower(a.city) LIMIT 1)) AS dark_store_lat,
         COALESCE(ds.lng,  (SELECT lng  FROM dark_stores WHERE is_active=true AND lower(city)=lower(a.city) LIMIT 1)) AS dark_store_lng
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN addresses a ON a.id = o.address_id
       LEFT JOIN dark_stores ds ON ds.id = o.dark_store_id
       WHERE o.id = $1`,
      [orderId]
    );
    if (!orderRows.length) return res.status(404).json({ success: false, message: "Order not found" });

    const { rows: itemRows } = await pool.query(
      `SELECT
         oi.variant_id,
        v.variant_code,
         oi.quantity,
         oi.price,
         oi.item_status,
         p.name  AS product_name,
         v.size,
         v.color,
         (SELECT url FROM product_media WHERE variant_id = v.id AND is_primary = true LIMIT 1) AS image
       FROM order_items oi
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.json({ success: true, order: { ...orderRows[0], items: itemRows } });
  } catch (err) {
    console.error("GET order detail error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/checkout/orders/darkstore/:storeId ───────────────────────────────
router.get("/orders/darkstore/:storeId", async (req, res) => {
  const { storeId } = req.params;
  const { status } = req.query; // optional filter: pending, confirmed, etc.
  try {
    let query = `
      SELECT
        o.id,
        o.status,
        o.total_amount,
        o.payment_method,
        o.created_at,
        u.name   AS customer_name,
        u.phone  AS customer_phone,
        a.address_line,
        a.city,
        a.pincode,
        CASE WHEN d.id IS NOT NULL THEN json_build_object(
          'name', ru.name, 'phone', ru.phone,
          'vehicle_type', r.vehicle_type, 'vehicle_number', r.vehicle_number
        ) END AS rider,
        d.store_pickup_otp,
        d.store_pickup_verified_at,
        json_agg(json_build_object(
          'variant_id', oi.variant_id,
          'variant_code', v.variant_code,
          'quantity',   oi.quantity,
          'price',      oi.price,
          'item_status',oi.item_status,
          'product_name', p.name,
          'size',       v.size,
          'color',      v.color
        ) ORDER BY oi.id) AS items
      FROM orders o
      JOIN users u ON u.id = o.user_id
      JOIN addresses a ON a.id = o.address_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN product_variants v ON v.id = oi.variant_id
      JOIN products p ON p.id = v.product_id
      LEFT JOIN deliveries d  ON d.order_id = o.id AND d.is_active = TRUE
      LEFT JOIN "Riders" r     ON r.id = d.rider_id
      LEFT JOIN users ru      ON ru.id = r.user_id
      WHERE o.dark_store_id = $1
    `;
    const values = [storeId];
    if (status) {
      query += ` AND o.status = $2`;
      values.push(status);
    }
    query += ` GROUP BY o.id, u.name, u.phone, a.address_line, a.city, a.pincode, d.id, d.store_pickup_otp, d.store_pickup_verified_at, ru.name, ru.phone, r.vehicle_type, r.vehicle_number ORDER BY o.created_at DESC`;

    const { rows } = await pool.query(query, values);
    res.json({ success: true, orders: rows });
  } catch (err) {
    console.error("GET darkstore orders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /api/checkout/orders/:orderId/status ────────────────────────────────
router.patch("/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  const { status } = req.body;
  const validStatuses = ["placed", "confirmed", "packed", "picked", "out_for_delivery", "delivered", "trial_started", "trial_completed", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Auto-create confirmed_at column if it doesn't exist
    await client.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`).catch(() => {});

    const { rows: existingRows } = await client.query(
      `SELECT id, status, dark_store_id FROM orders WHERE id = $1 FOR UPDATE`,
      [orderId]
    );
    if (!existingRows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const previousStatus = existingRows[0].status;
    const darkStoreId = existingRows[0].dark_store_id;

    const confirmClause = status === 'confirmed' ? ', confirmed_at = COALESCE(confirmed_at, NOW())' : '';
    const { rows } = await client.query(
      `UPDATE orders SET status = $1${confirmClause} WHERE id = $2 RETURNING id, status`,
      [status, orderId]
    );

    const movedToDelivered =
      ["delivered", "completed"].includes(status) &&
      !["delivered", "completed"].includes(previousStatus);
    const movedToCancelled =
      status === "cancelled" &&
      previousStatus !== "cancelled" &&
      !["delivered", "completed"].includes(previousStatus);

    if (movedToDelivered || movedToCancelled) {
      const { rows: qtyRows } = await client.query(
        `SELECT variant_id, SUM(quantity)::int AS qty
         FROM order_items
         WHERE order_id = $1
         GROUP BY variant_id`,
        [orderId]
      );

      for (const q of qtyRows) {
        const qty = parseInt(q.qty, 10) || 0;
        if (qty <= 0) continue;

        let invRows;
        if (darkStoreId) {
          ({ rows: invRows } = await client.query(
            `SELECT id FROM inventory WHERE variant_id = $1 AND store_id = $2 FOR UPDATE`,
            [q.variant_id, darkStoreId]
          ));
        } else {
          ({ rows: invRows } = await client.query(
            `SELECT id FROM inventory
             WHERE variant_id = $1
             ORDER BY COALESCE(reserved_stock, 0) DESC
             LIMIT 1
             FOR UPDATE`,
            [q.variant_id]
          ));
        }
        if (!invRows.length) continue;

        if (movedToDelivered) {
          await client.query(
            `UPDATE inventory
             SET reserved_stock = GREATEST(COALESCE(reserved_stock, 0) - $1, 0),
                 stock = GREATEST(COALESCE(stock, 0) - $1, 0)
             WHERE id = $2`,
            [qty, invRows[0].id]
          );
        } else if (movedToCancelled) {
          await client.query(
            `UPDATE inventory
             SET reserved_stock = GREATEST(COALESCE(reserved_stock, 0) - $1, 0)
             WHERE id = $2`,
            [qty, invRows[0].id]
          );
        }
      }
    }

    await client.query("COMMIT");

    // ── IMPORTANT: When order is cancelled, also cancel associated delivery requests ──
    if (status === 'cancelled') {
      try {
        await pool.query(
          `UPDATE deliver_requests SET status = 'cancelled' 
           WHERE order_id = $1 AND status NOT IN ('completed', 'delivered', 'cancelled')`,
          [orderId]
        );
      } catch (err) {
        // If deliver_requests doesn't have order_id column, silently continue
        console.warn("Could not cancel delivery requests for order (order_id column may not exist):", err.message);
      }
    }

    // Notify available riders when order becomes confirmed
    if (status === 'confirmed') {
      notifyAvailableRiders(pool, rows[0].id).catch(() => {});
    }
    // Push the status update to the customer's device
    notifyCustomerOfStatus(pool, rows[0].id, status).catch(() => {});
    res.json({ success: true, order: rows[0] });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH order status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

// ── GET /api/checkout/darkstores ──────────────────────────────────────────────
router.get("/darkstores", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, city, address FROM dark_stores WHERE is_active = true ORDER BY name`
    );
    res.json({ success: true, stores: rows });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/darkstore/:id/products ──────────────────────────────────
// Get all products available in a specific dark store with inventory
router.get("/darkstore/:storeId/products", async (req, res) => {
  try {
    const { storeId } = req.params;

    // Get all products with variants that have inventory in this dark store
    const result = await pool.query(
      `SELECT DISTINCT
         p.id, p.name, p.vendor_id, p.category_id, p.brand_id,
         b.name AS brand_name,
         c.name AS category_name,
         (SELECT pm.url FROM product_media pm
          JOIN product_variants pv2 ON pv2.id = pm.variant_id
          WHERE pv2.product_id = p.id
          ORDER BY pm.is_primary DESC, pm.id ASC LIMIT 1) AS image_url,
         (SELECT v.price FROM product_variants v
          WHERE v.product_id = p.id AND v.is_active = true
          ORDER BY v.price ASC LIMIT 1) AS price
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       JOIN product_variants pv ON pv.product_id = p.id
       JOIN inventory i ON i.variant_id = pv.id
       WHERE p.is_active = true AND i.store_id = $1 AND i.stock > 0`,
      [storeId]
    );

    const products = result.rows;

    // For each product, fetch its variants with inventory in this store
    const productsWithVariants = await Promise.all(
      products.map(async (product) => {
        const variantsResult = await pool.query(
          `SELECT pv.id, pv.product_id, pv.size, pv.color, pv.price, pv.mrp, pv.is_active,
                  COALESCE(i.stock, 0) as quantity,
                  i.store_id
           FROM product_variants pv
           LEFT JOIN inventory i ON i.variant_id = pv.id AND i.store_id = $1
           WHERE pv.product_id = $2 AND pv.is_active = true`,
          [storeId, product.id]
        );

        return {
          ...product,
          variants: variantsResult.rows || []
        };
      })
    );

    res.json(productsWithVariants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /api/checkout/orders/:orderId/rider ───────────────────────────────────
router.get("/orders/:orderId/rider", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         u.name        AS name,
         u.phone       AS phone,
         r.vehicle_type,
         r.vehicle_number,
         r.current_lat AS lat,
         r.current_lng AS lng,
         d.id          AS delivery_id,
         d.status      AS delivery_status
       FROM deliveries d
       JOIN "Riders" r ON r.id = d.rider_id
       JOIN users  u ON u.id = r.user_id
       WHERE d.order_id = $1 AND d.is_active = TRUE
       LIMIT 1`,
      [orderId]
    );
    if (!rows.length) return res.json({ success: false, message: "No rider assigned" });
    res.json({ success: true, rider: rows[0] });
  } catch (err) {
    console.error("GET rider error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/checkout/orders/:orderId/location ────────────────────────────────
router.get("/orders/:orderId/location", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT dt.lat, dt.lng, dt.recorded_at
       FROM delivery_tracking dt
       JOIN deliveries d ON d.id = dt.delivery_id
       WHERE d.order_id = $1 AND d.is_active = TRUE
       ORDER BY dt.recorded_at DESC
       LIMIT 1`,
      [orderId]
    );
    if (!rows.length) return res.json({ success: false, message: "No location yet" });
    res.json({ success: true, location: rows[0] });
  } catch (err) {
    console.error("GET location error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/checkout/orders/:orderId/delivery-status ────────────────────────
// Customer polls this to get OTP + try-buy status
router.get("/orders/:orderId/delivery-status", async (req, res) => {
  const { orderId } = req.params;
  try {
    console.log(`\n🔍 [delivery-status] Querying for order: ${orderId}`);
    const { rows } = await pool.query(
      `SELECT o.id AS order_id,
              o.delivery_otp,
              o.otp_verified_at,
              o.is_try_order,
              o.try_buy_mode,
              o.try_buy_started_at,
              o.try_buy_deadline,
              o.try_buy_decision,
              o.status AS order_status,
              d.id AS delivery_id,
              d.status AS delivery_status,
              d.is_active,
              d.started_at
       FROM orders o
       LEFT JOIN deliveries d ON d.order_id = o.id 
         AND d.is_active = TRUE
         AND d.status NOT IN ('cancelled', 'returned')
       WHERE o.id = $1
       ORDER BY d.started_at DESC NULLS LAST
       LIMIT 1`,
      [orderId]
    );
    if (!rows.length) {
      console.log(`❌ [delivery-status] No order found with ID: ${orderId}`);
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const row = rows[0];
    console.log(`📋 [delivery-status] Order ${orderId}:`);
    console.log(`  - order_status=${row.order_status}`);
    console.log(`  - delivery_id=${row.delivery_id}`);
    console.log(`  - delivery_status=${row.delivery_status}`);
    console.log(`  - delivery_otp=${row.delivery_otp}`);
    console.log(`  - otp_verified_at=${row.otp_verified_at}`);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error("GET delivery-status error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
