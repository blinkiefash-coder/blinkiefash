import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET all active vendors (for Explore Shops page)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, store_name, slug, description, address, city, pincode,
              lat, lng, service_radius_km, is_verified, is_active,
              vendor_img_url, created_at
       FROM vendors
       WHERE is_active = true
       ORDER BY is_verified DESC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET single vendor with their products
router.get("/:id/products", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
            `SELECT p.id, p.name,
              p.category_id,
              b.name AS brand_name,
              c.name AS category_name,
              COALESCE(
                (SELECT url FROM product_media WHERE product_id = p.id AND is_primary = true LIMIT 1),
                (SELECT url FROM product_media WHERE product_id = p.id LIMIT 1)
              ) AS image_url,
              pv.price, pv.discount_price
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT v.price, v.discount_price
         FROM product_variants v
         WHERE v.product_id = p.id AND v.is_active = true
         ORDER BY COALESCE(v.discount_price, v.price) ASC
         LIMIT 1
       ) pv ON true
       WHERE p.vendor_id = $1 AND p.is_active = true
       ORDER BY p.created_at DESC
       LIMIT 4`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { email } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const user = userResult.rows[0];

    if (user.role !== "vendor") {
      return res.json({
        success: false,
        message: "Not a vendor"
      });
    }

    const vendorResult = await pool.query(
      "SELECT id FROM vendors WHERE user_id = $1",
      [user.id]
    );

    if (vendorResult.rows.length === 0) {
      return res.json({
        success: false,
        message: "Vendor profile not found"
      });
    }

    const vendor_id = vendorResult.rows[0].id;

    res.json({
      success: true,
      vendor_id
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;