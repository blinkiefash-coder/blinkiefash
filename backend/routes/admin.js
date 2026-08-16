import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ── Super-admin credentials (override via env vars) ───────────────────────
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL    || "superadminsatyam@blinkiefash.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Satyam";

// ── POST /api/admin/login  Body: { email, password } ─────────────────────────
router.post("/login", async (req, res) => {
  const { email = "", password = "" } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPassword = String(password);

  if (
    normalizedEmail === ADMIN_EMAIL.toLowerCase() &&
    normalizedPassword === ADMIN_PASSWORD
  ) {
    try {
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
        [normalizedEmail]
      );

      let userId = existingUser.rows[0]?.id;

      if (!userId) {
        const insertedUser = await pool.query(
          `INSERT INTO users (name, phone, email, role, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())
           RETURNING id`,
          ["SatyXAlka Admin", "0000000000", normalizedEmail, "admin"]
        );
        userId = insertedUser.rows[0]?.id;
      } else {
        await pool.query(
          `UPDATE users
           SET name = COALESCE(name, $1), role = $2, is_active = true, updated_at = NOW()
           WHERE id = $3`,
          ["SatyXAlka Admin", "admin", userId]
        );
      }

      return res.json({
        success: true,
        is_admin: true,
        admin_name: "SatyXAlka Admin",
        admin_email: ADMIN_EMAIL,
        user_id: userId,
      });
    } catch (error) {
      console.error("[admin/login] error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to create admin user session",
      });
    }
  }

  return res.status(401).json({ success: false, message: "Invalid admin credentials" });
});

// Simple guard — checks the request carries the admin email header set by the frontend.
// This is a lightweight guard for internal dashboards only.
function adminGuard(req, res, next) {
  const adminEmail = req.headers["x-admin-email"] || "";
  if (String(adminEmail).toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

// ── GET /api/admin/orders ─────────────────────────────────────────────────────
// All orders across all vendors, with optional ?status=placed&limit=100
router.get("/orders", adminGuard, async (req, res) => {
  try {
    const { status, limit = 200, from, to } = req.query;
    const values = [];
    let idx = 1;
    let whereClause = "WHERE 1=1";

    if (status) {
      whereClause += ` AND o.status = $${idx++}`;
      values.push(status);
    }
    if (from) {
      whereClause += ` AND o.created_at >= $${idx++}`;
      values.push(from);
    }
    if (to) {
      whereClause += ` AND o.created_at <= ($${idx++}::date + interval '1 day')`;
      values.push(to);
    }

    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.total_amount,
         o.final_amount,
         o.otp_verified_at,
         o.created_at,
         u.name AS customer_name,
         u.phone AS customer_phone,
         a.city,
         a.address_line,
         COALESCE(ds.name, a.city) AS store_name,
         json_agg(DISTINCT jsonb_build_object(
           'product_name', p.name,
           'variant_id',   oi.variant_id,
           'quantity',     oi.quantity,
           'price',        oi.price,
           'item_status',  oi.item_status,
           'vendor_name',  v.store_name,
           'size',         pv.size,
           'color',        pv.color,
           'barcode',      pv.barcode
         )) AS items
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN addresses a ON a.id = o.address_id
       LEFT JOIN dark_stores ds ON ds.id = o.dark_store_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants pv ON pv.id = oi.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN vendors v ON v.id = p.vendor_id
       ${whereClause}
       GROUP BY o.id, u.name, u.phone, a.city, a.address_line, ds.name
       ORDER BY o.created_at DESC
       LIMIT $${idx++}`,
      [...values, parseInt(limit) || 200]
    );

    res.json({ success: true, orders: rows, total: rows.length });
  } catch (err) {
    console.error("[admin/orders] error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/admin/insights ───────────────────────────────────────────────────
// Aggregate metrics across all vendors
router.get("/insights", adminGuard, async (req, res) => {
  try {
    const [orderStats, vendorStats, topProducts, revenueByDay] = await Promise.all([
      // Total orders / revenue
      pool.query(`
        SELECT
          COUNT(*)::int                                           AS total_orders,
          COUNT(*) FILTER (WHERE status = 'placed')::int         AS new_orders,
          COUNT(*) FILTER (WHERE status = 'confirmed')::int      AS confirmed_orders,
          COUNT(*) FILTER (WHERE status = 'delivered')::int      AS delivered_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int      AS cancelled_orders,
          COALESCE(SUM(final_amount), 0)::float                  AS total_revenue,
          COALESCE(SUM(final_amount) FILTER (
            WHERE created_at >= NOW() - interval '30 days'
          ), 0)::float AS revenue_last_30d,
          COALESCE(SUM(final_amount) FILTER (
            WHERE created_at >= CURRENT_DATE
          ), 0)::float AS revenue_today
        FROM orders
        WHERE status NOT IN ('cancelled')
      `),
      // Per-vendor breakdown
      pool.query(`
        SELECT
          v.id,
          v.store_name,
          v.owner_name,
          COUNT(DISTINCT o.id)::int   AS order_count,
          COALESCE(SUM(o.final_amount), 0)::float AS revenue,
          COUNT(DISTINCT p.id)::int   AS product_count,
          v.is_operational
        FROM vendors v
        LEFT JOIN products p ON p.vendor_id = v.id
        LEFT JOIN order_items oi ON oi.variant_id IN (
          SELECT id FROM product_variants WHERE product_id = p.id
        )
        LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
        GROUP BY v.id, v.store_name, v.owner_name, v.is_operational
        ORDER BY revenue DESC
        LIMIT 50
      `),
      // Top products by order count
      pool.query(`
        SELECT
          p.name,
          v.store_name AS vendor_name,
          SUM(oi.quantity)::int  AS units_sold,
          SUM(oi.price * oi.quantity)::float AS revenue
        FROM order_items oi
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN vendors v ON v.id = p.vendor_id
        JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
        GROUP BY p.id, p.name, v.store_name
        ORDER BY units_sold DESC
        LIMIT 10
      `),
      // Revenue by day (last 14 days)
      pool.query(`
        SELECT
          DATE(created_at)::text AS date,
          COUNT(*)::int          AS orders,
          COALESCE(SUM(final_amount), 0)::float AS revenue
        FROM orders
        WHERE created_at >= NOW() - interval '14 days'
          AND status NOT IN ('cancelled')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),
    ]);

    res.json({
      success: true,
      summary: orderStats.rows[0],
      vendors: vendorStats.rows,
      topProducts: topProducts.rows,
      revenueByDay: revenueByDay.rows,
    });
  } catch (err) {
    console.error("[admin/insights] error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/admin/vendors ────────────────────────────────────────────────────
router.get("/vendors", adminGuard, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.id, v.store_name, v.owner_name, v.email, v.phone,
        v.city, v.is_operational, v.is_approved, v.is_active,
        v.created_at,
        COUNT(DISTINCT p.id)::int AS product_count
      FROM vendors v
      LEFT JOIN products p ON p.vendor_id = v.id AND p.is_active = true
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `);
    res.json({ success: true, vendors: rows });
  } catch (err) {
    console.error("[admin/vendors] error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/admin/fix-inventory-store-ids  — one-time migration for null store_id records
router.post("/fix-inventory-store-ids", adminGuard, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE inventory i
      SET store_id = v.dark_store_id
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      JOIN vendors v ON v.id::text = p.vendor_id::text
      WHERE i.variant_id = pv.id
        AND i.store_id IS NULL
        AND v.dark_store_id IS NOT NULL
      RETURNING i.variant_id
    `);
    res.json({ success: true, fixed: result.rowCount });
  } catch (err) {
    console.error("[fix-inventory-store-ids]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
