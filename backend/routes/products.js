import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const getProductMediaShape = async (client) => {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'product_media'`
  );
  const cols = new Set(result.rows.map((row) => row.column_name));
  return {
    hasProductId: cols.has("product_id"),
    hasMediaType: cols.has("media_type"),
    hasVariantId: cols.has("variant_id"),
    hasSortOrder: cols.has("sort_order"),
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

    const columns = ["url", "is_primary"];
    const values = [url, !primaryAssignedRef.value];

    if (mediaShape.hasProductId) { columns.push("product_id"); values.push(productId); }
    if (mediaShape.hasMediaType) { columns.push("media_type"); values.push("image"); }
    if (mediaShape.hasVariantId) { columns.push("variant_id"); values.push(variantId || null); }
    if (mediaShape.hasSortOrder) { columns.push("sort_order"); values.push(nextOrder); }

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
  const description = (nestedProduct.full_description || body.description || "").trim();
  const short_description = (nestedProduct.short_description || "").trim();
  const brand_name = (nestedProduct.brand || body.brand || "").trim();
  const brand_id = nestedProduct.brand_id || body.brand_id || null;
  const is_try_enabled = nestedProduct.is_try_enabled !== false;
  const store_id = nestedProduct.store_id || body.store_id || null;

  const variants = nestedVariants.map((variant) => ({
    size: (variant.size || "").trim() || "M",
    color: (variant.color || "").trim() || "Black",
    mrp: toNumber(variant.mrp, 0),
    price: toNumber(variant.price, 0),
    stock: toNumber(variant.quantity ?? variant.stock, 0),
    images: Array.isArray(variant.images) ? variant.images.filter(Boolean) : [],
  }));

  const topLevelImages = Array.isArray(body.images) ? body.images.filter(Boolean) : [];

  return {
    vendor_id, category_id,
    name, description, short_description,
    brand_name, brand_id,
    is_try_enabled, store_id,
    variants, topLevelImages,
  };
};

const createProductSimple = async (req, res) => {
  const client = await pool.connect();

  try {
    const payload = prepareCreatePayload(req.body);
    const {
      vendor_id, category_id,
      name, description, short_description,
      brand_name, brand_id: explicitBrandId,
      is_try_enabled, store_id,
      variants, topLevelImages,
    } = payload;

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

    // store_id is provided by the vendor from the dropdown (null = no store selected)
    const inventoryStoreId = store_id || null;

    // ── Resolve brand_id from name if not provided ──────────────────────────
    let brand_id = explicitBrandId || null;
    if (!brand_id && brand_name) {
      const existing = await client.query(
        `SELECT id FROM brands WHERE lower(name) = lower($1) LIMIT 1`,
        [brand_name]
      );
      if (existing.rows.length) {
        brand_id = existing.rows[0].id;
      } else {
        const newBrand = await client.query(
          `INSERT INTO brands (name) VALUES ($1) RETURNING id`,
          [brand_name]
        );
        brand_id = newBrand.rows[0].id;
      }
    }

    const mediaShape = await getProductMediaShape(client);

    // ── Insert product ───────────────────────────────────────────────────────
    const productRes = await client.query(
      `INSERT INTO products (vendor_id, brand_id, category_id, name, description, short_description, is_try_enabled)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [vendor_id, brand_id, category_id, name, description || null, short_description || null, is_try_enabled]
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
        `INSERT INTO product_variants (product_id, sku, size, color, price, mrp)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
        [productId, sku, variant.size, variant.color, variant.price, variant.mrp]
      );

      await client.query(
        `INSERT INTO inventory (variant_id, stock, store_id) VALUES ($1, $2, $3)`,
        [variantRes.rows[0].id, variant.stock, inventoryStoreId]
      );

      const variantImageUrls = Array.isArray(variant.images) ? variant.images : [];
      insertedImageCount += variantImageUrls.length;
      imageOrder = await insertProductMediaRows({
        client, productId,
        variantId: variantRes.rows[0].id,
        imageUrls: variantImageUrls,
        startOrder: imageOrder,
        mediaShape, primaryAssignedRef,
      });
    }

    if (insertedImageCount === 0 && topLevelImages.length > 0) {
      await insertProductMediaRows({
        client, productId, variantId: null,
        imageUrls: topLevelImages,
        startOrder: imageOrder,
        mediaShape, primaryAssignedRef,
      });
    }

    await client.query("COMMIT");

    res.json({ success: true, product_id: productId, message: "Product created successfully" });
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

// ── GET /bestsellers ────────────────────────────────────────────────────────
router.get("/bestsellers", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);
    const result = await pool.query(
      `SELECT
         p.id, p.name,
         COALESCE(b.name, '') AS brand,
         COALESCE(c.name, '') AS category_name,
         MIN(v.price)                         AS price,
         MIN(COALESCE(v.mrp, v.price))        AS original_price,
         (
           SELECT pm.url FROM product_media pm
           JOIN product_variants pv ON pv.id = pm.variant_id
           WHERE pv.product_id = p.id AND pm.is_primary = true
           LIMIT 1
         )                                    AS image
       FROM products p
       LEFT JOIN brands b       ON b.id = p.brand_id
       LEFT JOIN categories c   ON c.id = p.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
       WHERE p.bestseller = true
       GROUP BY p.id, b.name, c.name
       ORDER BY p.id
       LIMIT $1`,
      [limit]
    );
    res.json({ bestsellers: result.rows });
  } catch (err) {
    console.error("BESTSELLERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
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
      color,
      search,
      sort,
      limit,
      offset,
      lat,
      lng,
    } = req.query;

    // Find nearest dark store when coordinates are provided
    let nearestStoreName = null;
    let nearestStoreCity = null;
    if (lat && lng) {
      const { rows: storeRows } = await pool.query(
        `SELECT name, city,
           6371 * acos(
             cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) +
             sin(radians($1)) * sin(radians(lat))
           ) AS dist
         FROM dark_stores WHERE is_active = true AND lat IS NOT NULL AND lng IS NOT NULL
         ORDER BY dist ASC LIMIT 1`,
        [parseFloat(lat), parseFloat(lng)]
      );
      if (storeRows.length) {
        nearestStoreName = storeRows[0].name;
        nearestStoreCity = storeRows[0].city;
      }
    }

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
      // match the category itself + children + grandchildren (3 levels)
      query += ` AND p.category_id IN (
        SELECT id FROM categories WHERE id = $${index}
        UNION
        SELECT id FROM categories WHERE parent_id = $${index}
        UNION
        SELECT c2.id FROM categories c2
          JOIN categories c1 ON c2.parent_id = c1.id
          WHERE c1.parent_id = $${index}
      )`;
      values.push(category_id);
      index++;
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

    if (search) {
      query += ` AND (lower(p.name) LIKE lower($${index++}) OR lower(b.name) LIKE lower($${index++}))`;
      const term = `%${search}%`;
      values.push(term, term);
    }

    const sortMap = {
      price_asc: 'pv.sell_price ASC NULLS LAST',
      price_desc: 'pv.sell_price DESC NULLS LAST',
      newest: 'p.id DESC',
      name_asc: 'p.name ASC',
    };
    query += ` ORDER BY ${sortMap[sort] || 'p.id DESC'}`;

    const pageLimit = Math.min(parseInt(limit) || 40, 100);
    const pageOffset = parseInt(offset) || 0;
    query += ` LIMIT $${index++} OFFSET $${index++}`;
    values.push(pageLimit, pageOffset);

    const result = await pool.query(query, values);

    res.json({
      products: result.rows,
      total: result.rowCount,
      nearestStore: nearestStoreName
        ? { name: nearestStoreName, city: nearestStoreCity }
        : null,
    });

  } catch (err) {
    console.error("FILTER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ IMPORTANT EXPORT
export default router;

