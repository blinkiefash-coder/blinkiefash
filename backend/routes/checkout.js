import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ── GET /api/checkout/addresses?userId=xxx ──────────────────────────────────
router.get("/addresses", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: "userId required" });
  try {
    const { rows } = await pool.query(
      `SELECT id, address_line, city, pincode, is_default
       FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC`,
      [userId]
    );
    res.json({ success: true, addresses: rows });
  } catch (err) {
    console.error("GET addresses error:", err);
    res.status(500).json({ success: false, message: "Server error" });
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
// Body: { userId, addressId, items: [{variantId, quantity, price}], totalAmount }
router.post("/orders", async (req, res) => {
  const { userId, addressId, items, totalAmount } = req.body;
  if (!userId || !addressId || !items?.length || !totalAmount) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find the address city and match to nearest dark store
    const { rows: addrRows } = await client.query(
      `SELECT city FROM addresses WHERE id = $1 AND user_id = $2`, [addressId, userId]
    );
    if (!addrRows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Address not found" });
    }
    const city = addrRows[0].city;

    // Find a matching active dark store in the same city (case-insensitive)
    const { rows: storeRows } = await client.query(
      `SELECT id FROM dark_stores
       WHERE is_active = true AND lower(city) = lower($1)
       LIMIT 1`,
      [city]
    );
    const darkStoreId = storeRows.length ? storeRows[0].id : null;

    // Create order
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
         (user_id, address_id, status, total_amount, final_amount,
          payment_method, dark_store_id)
       VALUES ($1, $2, 'placed', $3, $3, 'cod', $4)
       RETURNING id, status, total_amount, created_at`,
      [userId, addressId, totalAmount, darkStoreId]
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
      LEFT JOIN riders r      ON r.id = d.rider_id
      LEFT JOIN users ru      ON ru.id = r.user_id
      WHERE o.dark_store_id = $1
    `;
    const values = [storeId];
    if (status) {
      query += ` AND o.status = $2`;
      values.push(status);
    }
    query += ` GROUP BY o.id, u.name, u.phone, a.address_line, a.city, a.pincode, d.id, ru.name, ru.phone, r.vehicle_type, r.vehicle_number ORDER BY o.created_at DESC`;

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
    const { rows } = await pool.query(
      `UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status`,
      [status, orderId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Order not found" });
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
  } catch (err) {
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
       JOIN riders r ON r.id = d.rider_id
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

export default router;
