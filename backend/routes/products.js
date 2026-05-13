import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.post("/create-full", async (req, res) => {
  try {
    const payload = req.body;
    const product = payload?.product || {};

    if (!product.vendor_id || !product.category_id || !product.name) {
      return res.status(400).json({
        success: false,
        message: "vendor_id, category_id, and name are required",
      });
    }

    const result = await pool.query(
      `SELECT insert_full_product($1::jsonb) AS product_id`,
      [JSON.stringify(payload)]
    );

    res.json({
      success: true,
      product_id: result.rows[0]?.product_id,
      message: "Product created successfully",
    });
  } catch (err) {
    console.error("CREATE FULL PRODUCT ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/full/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    await pool.query(`SELECT update_full_product($1::uuid, $2::jsonb)`, [
      id,
      JSON.stringify(payload),
    ]);

    res.json({ success: true, message: "Product updated successfully" });
  } catch (err) {
    console.error("UPDATE FULL PRODUCT ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/full/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `SELECT get_product_full($1::uuid) AS data`,
      [id]
    );

    const data = result.rows[0]?.data;
    if (!data) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, ...data });
  } catch (err) {
    console.error("GET FULL PRODUCT ERROR:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});


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
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ PRODUCT
    const productRes = await pool.query(
      `SELECT p.*, b.name AS brand
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE p.id = $1`,
      [id]
    );

    // ✅ IMAGES
    const imageRes = await pool.query(
      `SELECT url FROM product_media
       WHERE product_id = $1`,
      [id]
    );

    // ✅ VARIANTS
    const variantRes = await pool.query(
      `SELECT
         v.id,
         v.size,
         v.color,
         v.price,
         v.discount_price,
         GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) AS available_stock
       FROM product_variants v
       LEFT JOIN inventory inv ON inv.variant_id = v.id
       WHERE v.product_id = $1
         AND v.is_active = true
         AND GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) > 0
       ORDER BY COALESCE(v.discount_price, v.price) ASC, v.id ASC`,
      [id]
    );

    res.json({
      product: productRes.rows[0],
      images: imageRes.rows.map(i => i.url),
      variants: variantRes.rows
    });

  } catch (err) {
    console.error("PRODUCT DETAIL ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});


// GET PRODUCTS (🔥 THIS IS WHAT YOU WERE MISSING)
router.get("/", async (req, res) => {
  try {
    const {
      brand_id,
      category_id,
      min_price,
      max_price,
      color
    } = req.query;

    let query = `
      SELECT
        p.id,
        p.name,
        p.gender,
        p.category_id,
        b.name AS brand,
        c.name AS category_name,
        pm.url AS image,
        pv.variant_id,
        pv.price,
        pv.discount_price
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN product_media pm
        ON pm.product_id = p.id AND pm.is_primary = true
      LEFT JOIN LATERAL (
        SELECT
          v.id AS variant_id,
          v.size,
          v.color,
          v.price,
          v.discount_price,
          GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) AS available_stock
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          AND GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) > 0
        ORDER BY COALESCE(v.discount_price, v.price) ASC, v.id ASC
        LIMIT 1
      ) pv ON true
      WHERE 1=1
        AND pv.variant_id IS NOT NULL
    `;

    const values = [];
    let index = 1;

    if (brand_id) {
      query += ` AND p.brand_id = $${index++}`;
      values.push(brand_id);
    }

    if (category_id) {
      query += ` AND p.category_id = $${index++}`;
      values.push(category_id);
    }

    if (min_price) {
      query += ` AND EXISTS (
        SELECT 1
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          AND GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) > 0
          AND v.price >= $${index++}
      )`;
      values.push(min_price);
    }

    if (max_price) {
      query += ` AND EXISTS (
        SELECT 1
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          AND GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) > 0
          AND v.price <= $${index++}
      )`;
      values.push(max_price);
    }

    if (color) {
      query += ` AND EXISTS (
        SELECT 1
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          AND GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) > 0
          AND lower(v.color) = lower($${index++})
      )`;
      values.push(color);
    }

    query += ` ORDER BY p.id DESC`;

    const result = await pool.query(query, values);

    res.json(result.rows);

  } catch (err) {
    console.error("FILTER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});
// ✅ IMPORTANT EXPORT
export default router;
