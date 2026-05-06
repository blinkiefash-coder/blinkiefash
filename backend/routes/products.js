import express from "express";
import { pool } from "../db.js";

const router = express.Router();

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
      image_url
    } = req.body;

    await client.query("BEGIN");

    // ✅ 1. INSERT PRODUCT
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

    // ✅ 2. INSERT VARIANTS + INVENTORY
    for (const v of variants) {

      // ✅ SKU GENERATION
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

      // ✅ INVENTORY
      await client.query(
        `INSERT INTO inventory (
          variant_id,
          stock
        )
        VALUES ($1,$2)`,
        [variantId, v.stock]
      );
    }

    // ✅ 3. PRODUCT IMAGE
    await client.query(
      `INSERT INTO product_media (
        product_id,
        media_type,
        url,
        is_primary
      )
      VALUES ($1,'image',$2,true)`,
      [productId, image_url]
    );

    await client.query("COMMIT");

    res.json({
      success: true,
      message: "✅ Product inserted successfully"
    });

  } catch (err) {
    await client.query("ROLLBACK");

    console.error(err);

    res.status(500).json({
      success: false,
      message: "Insert failed",
      error: err.message
    });
  } finally {
    client.release();
  }
});

export default router;