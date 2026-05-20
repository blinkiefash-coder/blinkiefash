import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const isUuid = (value = "") =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value)
  );

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isUuid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const result = await pool.query(
      `SELECT
        w.id,
        w.variant_id,
        w.created_at,
        p.id AS product_id,
        p.name,
        p.description,
        b.name AS brand,
        pv.size,
        pv.color,
        pv.price,
        NULL AS discount_price,
        COALESCE(pm.url, '') AS image,
        COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0) AS available_stock
      FROM wishlists w
      JOIN product_variants pv ON pv.id = w.variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN LATERAL (
        SELECT url
        FROM product_media
        WHERE variant_id = w.variant_id
        ORDER BY is_primary DESC, id ASC
        LIMIT 1
      ) pm ON true
      LEFT JOIN inventory inv ON inv.variant_id = pv.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC`,
      [userId]
    );

    return res.json({ success: true, items: result.rows });
  } catch (err) {
    console.error("Wishlist fetch error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/add", async (req, res) => {
  try {
    const { userId, variantId } = req.body;

    if (!isUuid(userId) || !isUuid(variantId)) {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }

    await pool.query(
      `INSERT INTO wishlists (user_id, variant_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, variant_id) DO NOTHING`,
      [userId, variantId]
    );

    return res.json({ success: true, message: "Added to wishlist" });
  } catch (err) {
    console.error("Wishlist add error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/remove", async (req, res) => {
  try {
    const { userId, variantId } = req.body;

    if (!isUuid(userId) || !isUuid(variantId)) {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }

    await pool.query(
      `DELETE FROM wishlists
       WHERE user_id = $1 AND variant_id = $2`,
      [userId, variantId]
    );

    return res.json({ success: true, message: "Removed from wishlist" });
  } catch (err) {
    console.error("Wishlist remove error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/clear/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isUuid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    await pool.query(`DELETE FROM wishlists WHERE user_id = $1`, [userId]);

    return res.json({ success: true, message: "Wishlist cleared" });
  } catch (err) {
    console.error("Wishlist clear error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
