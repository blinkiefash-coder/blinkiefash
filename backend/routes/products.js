import express from "express";
import { pool } from "../db.js";

const router = express.Router();


// ✅ ✅ ✅ CREATE PRODUCT (YOUR EXISTING CODE)
router.post("/create", async (req, res) => {

  const client = await pool.connect();

  try {
    const {
      vendor_id,
      brand_id,
      category_id,
      name,
      description,
      gender,
      material,
      variants,
      images
    } = req.body;

    if (!vendor_id || !name || !category_id) {
      return res.json({
        success: false,
        message: "Missing required fields"
      });
    }

    await client.query("BEGIN");

    const productRes = await client.query(
      `INSERT INTO products (
        vendor_id,
        brand_id,
        category_id,
        name,
        description,
        gender,
        material
      )
      VALUES ($1,$2,$3,$4,$5,$6,$7)
      RETURNING id`,
      [
        vendor_id,
        brand_id || null,
        category_id,
        name,
        description,
        gender,
        material
      ]
    );

    const productId = productRes.rows[0].id;

    // ✅ VARIANTS
    for (const v of variants || []) {

      const sku = `${name}-${v.color}-${v.size}`
        .replace(/\s+/g, "-")
        .toUpperCase();

      const variantRes = await client.query(
        `INSERT INTO product_variants (
          product_id,
          sku,
          size,
          color,
          price,
          discount_price
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id`,
        [
          productId,
          sku,
          v.size,
          v.color,
          v.price,
          v.discount_price || null
        ]
      );

      const variantId = variantRes.rows[0].id;

      // inventory
      await client.query(
        `INSERT INTO inventory (variant_id, stock)
         VALUES ($1,$2)`,
        [variantId, v.stock]
      );
    }

    // ✅ IMAGES
    if (images && images.length > 0) {
      for (let i = 0; i < images.length; i++) {
        await client.query(
          `INSERT INTO product_media (
            product_id,
            media_type,
            url,
            is_primary
          )
          VALUES ($1,'image',$2,$3)`,
          [
            productId,
            images[i],
            i === 0
          ]
        );
      }
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "✅ Product created successfully"
    });

  } catch (err) {

    await client.query("ROLLBACK");
    console.error("❌ PRODUCT ERROR:", err);

    res.status(500).json({
      success: false,
      message: "Server error"
    });

  } finally {
    client.release();
  }
});


// ✅ ✅ ✅ GET PRODUCTS (🔥 THIS IS WHAT YOU WERE MISSING)
router.get("/", async (req, res) => {
  try {

    const result = await pool.query(`
      SELECT 
        p.id,
        p.name,
        p.description,
        p.gender,

        b.name AS brand,

        pm.url AS image,

        MIN(v.price) AS price,
        MIN(v.discount_price) AS discount_price
        
      FROM products p

      LEFT JOIN brands b 
        ON b.id = p.brand_id

      LEFT JOIN product_media pm 
        ON pm.product_id = p.id AND pm.is_primary = true

      LEFT JOIN product_variants v 
        ON v.product_id = p.id

      GROUP BY p.id, pm.url, b.name
      ORDER BY p.id DESC
    `);

    res.json(result.rows);

  } catch (err) {
    console.error("❌ GET PRODUCTS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// ✅ IMPORTANT EXPORT
export default router;
