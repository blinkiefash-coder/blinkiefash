import express from "express";
import { pool } from "../db.js";
import { notifyAvailableRiders } from "../utils/firebaseAdmin.js";

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

// ── Delivery fee rules ────────────────────────────────────────────────────────
// - subtotal > 1499 → 0
// - distance ≤ 20 km → 0
// - 20 km < distance ≤ 30 km → 59
// - distance > 30 km → null (out of range)
function calcDeliveryFee(subtotal, distanceKm) {
  if (subtotal > 1499) return 0;
  if (distanceKm <= 20) return 0;
  if (distanceKm <= 30) return 59;
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
      fee = sub > 1499 ? 0 : 49; // default ₹49 when no coordinates
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

// ── POST /api/checkout/orders ─────────────────────────────────────────────────
// Body: { userId, addressId, items: [{variantId, quantity, price}], totalAmount, isTryOrder? }
router.post("/orders", async (req, res) => {
  const { userId, addressId, items, totalAmount, isTryOrder } = req.body;
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

    // Calculate delivery fee
    const itemsSubtotal = totalAmount; // client now sends subtotal (items only)
    let deliveryFee = 0;
    if (distanceKm !== null) {
      const calcFee = calcDeliveryFee(itemsSubtotal, distanceKm);
      if (calcFee === null) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Sorry, delivery is not available beyond 30 km from our nearest store." });
      }
      deliveryFee = calcFee;
    } else {
      deliveryFee = itemsSubtotal > 1499 ? 0 : 49;
    }
    const finalAmount = itemsSubtotal + deliveryFee;

    // Create order
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
         (user_id, address_id, status, total_amount, final_amount,
          payment_method, dark_store_id, is_try_order)
       VALUES ($1, $2, 'placed', $3, $4, 'cod', $5, $6)
       RETURNING id, status, total_amount, final_amount, created_at`,
      [userId, addressId, itemsSubtotal, finalAmount, darkStoreId, isTryOrder === true]
    );
    const order = orderRows[0];

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, variant_id, quantity, price, item_status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [order.id, item.variantId, item.quantity, item.price]
      );
    }

    await client.query("COMMIT");
    res.json({
      success: true,
      orderId: order.id,
      status: order.status,
      totalAmount: order.total_amount,
      deliveryFee: deliveryFee,
      finalAmount: order.final_amount,
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
  try {
    // Auto-create confirmed_at column if it doesn't exist
    await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`).catch(() => {});
    const confirmClause = status === 'confirmed' ? ', confirmed_at = COALESCE(confirmed_at, NOW())' : '';
    const { rows } = await pool.query(
      `UPDATE orders SET status = $1${confirmClause} WHERE id = $2 RETURNING id, status`,
      [status, orderId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Order not found" });
    // Notify available riders when order becomes confirmed
    if (status === 'confirmed') {
      notifyAvailableRiders(pool, rows[0].id).catch(() => {});
    }
    res.json({ success: true, order: rows[0] });
  } catch (err) {
    console.error("PATCH order status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
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
    const { rows } = await pool.query(
      `SELECT o.delivery_otp,
              o.otp_verified_at,
              o.is_try_order,
              o.try_buy_mode,
              o.try_buy_started_at,
              o.try_buy_deadline,
              o.try_buy_decision,
              o.status AS order_status,
              d.status AS delivery_status
       FROM orders o
       LEFT JOIN deliveries d ON d.order_id = o.id AND d.is_active = TRUE
       WHERE o.id = $1`,
      [orderId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("GET delivery-status error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
