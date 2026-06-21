import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const isUuid = (value = "") =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value)
  );

const getOrCreateCartId = async (client, userId) => {
  const existing = await client.query(
    `SELECT id FROM carts WHERE user_id = $1 LIMIT 1`,
    [userId]
  );

  if (existing.rows.length > 0) return existing.rows[0].id;

  const created = await client.query(
    `INSERT INTO carts (user_id)
     VALUES ($1)
     RETURNING id`,
    [userId]
  );

  return created.rows[0].id;
};

router.get("/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isUuid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    const result = await pool.query(
      `SELECT
        ci.id,
        ci.variant_id,
        ci.quantity,
        p.id AS product_id,
        p.name,
        b.name AS brand,
        pv.size,
        pv.color,
        pv.price,
        NULL AS discount_price,
        COALESCE(pm.url, '') AS image,
        COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0) AS available_stock
      FROM carts c
      JOIN cart_items ci ON ci.cart_id = c.id
      JOIN product_variants pv ON pv.id = ci.variant_id
      JOIN products p ON p.id = pv.product_id
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN LATERAL (
        SELECT url
        FROM product_media
        WHERE variant_id = ci.variant_id
        ORDER BY is_primary DESC, id ASC
        LIMIT 1
      ) pm ON true
      LEFT JOIN inventory inv ON inv.variant_id = pv.id
      WHERE c.user_id = $1
      ORDER BY ci.created_at DESC`,
      [userId]
    );

    return res.json({ success: true, items: result.rows });
  } catch (err) {
    console.error("Cart fetch error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/add", async (req, res) => {
  const client = await pool.connect();
  try {
    const { userId, variantId, quantity } = req.body;
    const safeQty = Math.max(1, Number(quantity || 1));

    if (!isUuid(userId) || !isUuid(variantId)) {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }

    await client.query("BEGIN");

    const cartId = await getOrCreateCartId(client, userId);

    await client.query(
      `INSERT INTO cart_items (cart_id, variant_id, quantity)
       VALUES ($1, $2, $3)
       ON CONFLICT (cart_id, variant_id)
       DO UPDATE SET
         quantity = cart_items.quantity + EXCLUDED.quantity,
         updated_at = NOW()`,
      [cartId, variantId, safeQty]
    );

    await client.query("COMMIT");

    return res.json({ success: true, message: "Added to cart" });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Cart add error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

router.put("/quantity", async (req, res) => {
  try {
    const { userId, variantId, quantity } = req.body;
    const safeQty = Math.max(1, Number(quantity || 1));

    if (!isUuid(userId) || !isUuid(variantId)) {
      return res.status(400).json({ success: false, message: "Invalid payload" });
    }

    await pool.query(
      `UPDATE cart_items ci
       SET quantity = $3, updated_at = NOW()
       FROM carts c
       WHERE c.id = ci.cart_id
         AND c.user_id = $1
         AND ci.variant_id = $2`,
      [userId, variantId, safeQty]
    );

    return res.json({ success: true, message: "Cart quantity updated" });
  } catch (err) {
    console.error("Cart quantity update error:", err);
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
      `DELETE FROM cart_items ci
       USING carts c
       WHERE c.id = ci.cart_id
         AND c.user_id = $1
         AND ci.variant_id = $2`,
      [userId, variantId]
    );

    return res.json({ success: true, message: "Removed from cart" });
  } catch (err) {
    console.error("Cart remove error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/clear/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    if (!isUuid(userId)) {
      return res.status(400).json({ success: false, message: "Invalid user id" });
    }

    await pool.query(
      `DELETE FROM cart_items ci
       USING carts c
       WHERE c.id = ci.cart_id
         AND c.user_id = $1`,
      [userId]
    );

    return res.json({ success: true, message: "Cart cleared" });
  } catch (err) {
    console.error("Cart clear error:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
