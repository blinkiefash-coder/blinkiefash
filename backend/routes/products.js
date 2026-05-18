import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getProductMediaShape = async (client) => {
  const result = await client.query(
    `SELECT column_name
     FROM information_schema.columns
     WHERE table_schema = 'public'
       AND table_name = 'product_media'`
  );

  const columnNames = new Set(result.rows.map((row) => row.column_name));
  return {
    hasVariantId: columnNames.has("variant_id"),
    hasSortOrder: columnNames.has("sort_order"),
  };
};

const insertProductMediaRows = async ({
  client,
  productId,
  variantId,
  imageUrls,
  startOrder,
  mediaShape,
  primaryAssignedRef,
}) => {
  let nextOrder = startOrder;

  for (const rawUrl of imageUrls) {
    const url = String(rawUrl || "").trim();
    if (!url) continue;

    const columns = ["product_id", "media_type", "url", "is_primary"];
    const values = [productId, "image", url, !primaryAssignedRef.value];

    if (mediaShape.hasVariantId) {
      columns.push("variant_id");
      values.push(variantId || null);
    }

    if (mediaShape.hasSortOrder) {
      columns.push("sort_order");
      values.push(nextOrder);
    }

    const placeholders = values.map((_, index) => `$${index + 1}`).join(",");
    await client.query(
      `INSERT INTO product_media (${columns.join(",")}) VALUES (${placeholders})`,
      values
    );

    if (!primaryAssignedRef.value) {
      primaryAssignedRef.value = true;
    }

    nextOrder += 1;
  }

  return nextOrder;
};

const prepareCreatePayload = (body = {}) => {
  const nestedProduct = body.product || {};
  const nestedVariants = Array.isArray(body.variants) ? body.variants : [];

  const vendor_id = nestedProduct.vendor_id || body.vendor_id;
  const category_id = nestedProduct.category_id || body.category_id;
  const name = (nestedProduct.name || body.name || "").trim();
  const description =
    (nestedProduct.full_description || nestedProduct.short_description || body.description || "").trim();
  const gender = nestedProduct.main_category || body.gender || null;
  const material = nestedProduct.fabric || body.material || null;
  const brand_id = body.brand_id || null;

  const variants = nestedVariants.map((variant) => ({
    size: (variant.size || "").trim() || "M",
    color: (variant.color || "").trim() || "Black",
    price: toNumber(variant.price, 0),
    discount_price:
      variant.discount_price === "" || variant.discount_price === null || typeof variant.discount_price === "undefined"
        ? null
        : toNumber(variant.discount_price, 0),
    stock: toNumber(variant.stock, toNumber(variant.low_stock_alert, 0)),
    images: Array.isArray(variant.images) ? variant.images.filter(Boolean) : [],
  }));

  const topLevelImages = Array.isArray(body.images) ? body.images.filter(Boolean) : [];

  return {
    vendor_id,
    category_id,
    name,
    description,
    gender,
    material,
    brand_id,
    variants,
    topLevelImages,
  };
};

const createProductSimple = async (req, res) => {
  const client = await pool.connect();

  try {
    const payload = prepareCreatePayload(req.body);
    const { vendor_id, category_id, name, description, gender, material, brand_id, variants, topLevelImages } = payload;

    if (!vendor_id || !name || !category_id) {
      return res.status(400).json({
        success: false,
        message: "vendor_id, category_id and name are required",
      });
    }

    if (!variants.length) {
      return res.status(400).json({
        success: false,
        message: "At least one variant is required",
      });
    }

    await client.query("BEGIN");
    const mediaShape = await getProductMediaShape(client);

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
      [vendor_id, brand_id, category_id, name, description || null, gender, material]
    );

    const productId = productRes.rows[0].id;

    const primaryAssignedRef = { value: false };
    let imageOrder = 0;
    let insertedImageCount = 0;

    for (const variant of variants) {
      const sku = `${name}-${variant.color}-${variant.size}`
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
          variant.size,
          variant.color,
          toNumber(variant.price, 0),
          variant.discount_price,
        ]
      );

      await client.query(
        `INSERT INTO inventory (variant_id, stock)
         VALUES ($1,$2)`,
        [variantRes.rows[0].id, toNumber(variant.stock, 0)]
      );

      const variantImageUrls = Array.isArray(variant.images) ? variant.images : [];
      insertedImageCount += variantImageUrls.length;
      imageOrder = await insertProductMediaRows({
        client,
        productId,
        variantId: variantRes.rows[0].id,
        imageUrls: variantImageUrls,
        startOrder: imageOrder,
        mediaShape,
        primaryAssignedRef,
      });
    }

    if (insertedImageCount === 0 && topLevelImages.length > 0) {
      await insertProductMediaRows({
        client,
        productId,
        variantId: null,
        imageUrls: topLevelImages,
        startOrder: imageOrder,
        mediaShape,
        primaryAssignedRef,
      });
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      product_id: productId,
      message: "Product created successfully",
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("CREATE PRODUCT ERROR:", err);
    res.status(500).json({ success: false, message: err.message || "Server error" });
  } finally {
    client.release();
  }
};

router.post("/create-full", createProductSimple);

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
router.post("/create", createProductSimple);
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
      `SELECT DISTINCT pm.url FROM product_media pm
       JOIN product_variants v ON v.id = pm.variant_id
       WHERE v.product_id = $1`,
      [id]
    );

    // ✅ VARIANTS
    const variantRes = await pool.query(
      `SELECT
         v.id,
         v.size,
         v.color,
         v.mrp        AS price,
         v.price      AS discount_price,
         GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) AS available_stock
       FROM product_variants v
       LEFT JOIN inventory inv ON inv.variant_id = v.id
       WHERE v.product_id = $1
         AND v.is_active = true
         AND GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) > 0
       ORDER BY v.price ASC, v.id ASC`,
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
        p.category_id,
        b.name AS brand,
        c.name AS category_name,
        pv.image,
        pv.variant_id,
        pv.mrp        AS price,
        pv.sell_price AS discount_price
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT
          v.id AS variant_id,
          v.size,
          v.color,
          v.mrp,
          v.price AS sell_price,
          GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) AS available_stock,
          (SELECT url FROM product_media WHERE variant_id = v.id AND is_primary = true LIMIT 1) AS image
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          AND GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) > 0
        ORDER BY v.price ASC, v.id ASC
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
