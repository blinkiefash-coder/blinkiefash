import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

export const getProductMediaShape = async (client) => {
  const result = await client.query(
    `SELECT column_name FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'product_media'`
  );
  const cols = new Set(result.rows.map((row) => row.column_name));
  const shape = {
    hasUrl: cols.has("url"),
    hasIsPrimary: cols.has("is_primary"),
    hasProductId: cols.has("product_id"),
    hasMediaType: cols.has("media_type"),
    hasVariantId: cols.has("variant_id"),
    hasSortOrder: cols.has("sort_order"),
  };
  console.log("[product_media] detected columns:", Array.from(cols));
  console.log("[product_media] resolved shape:", shape);
  return shape;
};

export const insertProductMediaRows = async ({
  client,
  productId,
  variantId,
  imageUrls,
  startOrder,
  mediaShape,
  primaryAssignedRef,
  resetPrimaryState = false,
}) => {
  let nextOrder = startOrder;

  if (resetPrimaryState && mediaShape?.hasIsPrimary && primaryAssignedRef) {
    primaryAssignedRef.value = false;
  }

  console.log(`[product_media] inserting ${imageUrls?.length || 0} images for variant ${variantId}, product ${productId}`);

  for (const rawUrl of imageUrls) {
    const url = String(rawUrl || "").trim();
    if (!url) continue;

    const columns = ["url"];
    const values = [url];

    if (mediaShape.hasIsPrimary) { columns.push("is_primary"); values.push(!primaryAssignedRef.value); }
    if (mediaShape.hasProductId) { columns.push("product_id"); values.push(productId); }
    if (mediaShape.hasMediaType) { columns.push("media_type"); values.push("image"); }
    if (mediaShape.hasVariantId) { columns.push("variant_id"); values.push(variantId || null); }
    if (mediaShape.hasSortOrder) { columns.push("sort_order"); values.push(nextOrder); }

    const placeholders = values.map((_, index) => `$${index + 1}`).join(",");
    try {
      await client.query(
        `INSERT INTO product_media (${columns.join(",")}) VALUES (${placeholders})`,
        values
      );
      console.log(`[product_media] inserted url=${url} variant=${variantId} primary=${!primaryAssignedRef.value}`);
    } catch (err) {
      console.error(`[product_media] INSERT FAILED:`, err.message, { columns, url });
      throw err;
    }

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
  const nestedBundleOffers = Array.isArray(body.bundleOffers) ? body.bundleOffers : [];

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
    barcode: (variant.barcode || "").trim() || null,
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
    bundleOffers: nestedBundleOffers,
  };
};

const createProductSimple = async (req, res) => {
  const client = await pool.connect();

  try {
    console.log("[create_product] incoming payload:", JSON.stringify(req.body, null, 2));
    const payload = prepareCreatePayload(req.body);
    const {
      vendor_id, category_id,
      name, description, short_description,
      brand_name, brand_id: explicitBrandId,
      is_try_enabled, store_id,
      variants, topLevelImages,
      bundleOffers,
    } = payload;
    console.log("[create_product] prepared variants:", variants.map(v => ({ size: v.size, color: v.color, imagesCount: v.images?.length || 0 })));

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
      // Validate barcode is provided
      if (!variant.barcode) {
        await client.query("ROLLBACK");
        return res.status(400).json({ success: false, message: "Barcode is required for all variants" });
      }
      
      // SKU format: barcode_size_color (e.g., 30823504_UK_11_WHITE)
      const sku = `${variant.barcode}_${variant.color}_${variant.size}`
        .replace(/\s+/g, "_")
        .toUpperCase();

      const variantRes = await client.query(
        `INSERT INTO product_variants (product_id, sku, size, color, barcode, price, mrp)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [
          productId,
          sku,
          variant.size,
          variant.color,
          variant.barcode,
          variant.price,
          variant.mrp,
        ]
      );

      await client.query(
        `INSERT INTO inventory (variant_id, stock, store_id) VALUES ($1, $2, $3)`,
        [variantRes.rows[0].id, variant.stock, inventoryStoreId]
      );

      const variantImageUrls = Array.isArray(variant.images) ? variant.images : [];
      console.log(`[create_product] variant ${variantRes.rows[0].id} has ${variantImageUrls.length} images:`, variantImageUrls);
      insertedImageCount += variantImageUrls.length;
      imageOrder = await insertProductMediaRows({
        client, productId,
        variantId: variantRes.rows[0].id,
        imageUrls: variantImageUrls,
        startOrder: imageOrder,
        mediaShape, primaryAssignedRef,
        resetPrimaryState: true,
      });
    }

    if (insertedImageCount === 0 && topLevelImages.length > 0) {
      await insertProductMediaRows({
        client, productId, variantId: null,
        imageUrls: topLevelImages,
        startOrder: imageOrder,
        mediaShape, primaryAssignedRef,
        resetPrimaryState: true,
      });
    }

    // ── Create bundle offers ──────────────────────────────────────────────────
    if (Array.isArray(bundleOffers) && bundleOffers.length > 0) {
      for (const offer of bundleOffers) {
        await client.query(
          `INSERT INTO bundle_offers (product_id, vendor_id, quantity_min, quantity_max, discount_value, discount_type, is_active)
           VALUES ($1, $2, $3, $4, $5, 'fixed_price', true)`,
          [productId, vendor_id, offer.quantity_min, offer.quantity_max, offer.discount_value]
        );
      }
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
    const store_id = req.query.store_id || null;
    const store_ids = String(req.query.store_ids || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    const values = [];
    let index = 1;

    let storeCondition = '';
    const effectiveStoreIds = store_ids.length
      ? store_ids
      : (store_id ? [String(store_id)] : []);

    if (effectiveStoreIds.length) {
      values.push(effectiveStoreIds);
      storeCondition = `AND EXISTS (
        SELECT 1 FROM product_variants sv
        JOIN inventory si ON si.variant_id = sv.id
        WHERE sv.product_id = p.id AND sv.is_active = true
          AND si.store_id = ANY($${index++}::uuid[])
      )`;
    }

    values.push(limit);
    const result = await pool.query(
      `SELECT
         p.id, p.name,
         COALESCE(b.name, '') AS brand,
         COALESCE(c.name, '') AS category_name,
         MIN(COALESCE(v.mrp, v.price))        AS price,
         MIN(v.price)                         AS discount_price,
         COALESCE(
           (
             SELECT pm.url FROM product_media pm
             JOIN product_variants pv ON pv.id = pm.variant_id
             WHERE pv.product_id = p.id AND pm.is_primary = true
             LIMIT 1
           ),
           (
             SELECT pm.url FROM product_media pm
             JOIN product_variants pv ON pv.id = pm.variant_id
             WHERE pv.product_id = p.id
             LIMIT 1
           )
         )                                    AS image,
         p.buy_2, p.buy_3, p.buy_4,
         (p.is_try_enabled OR p.is_try_and_buy) AS is_try_and_buy,
         p.is_bestseller
       FROM products p
       LEFT JOIN brands b       ON b.id = p.brand_id
       LEFT JOIN categories c   ON c.id = p.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
       WHERE p.bestseller = true
         ${storeCondition}
       GROUP BY p.id, b.name, c.name, p.buy_2, p.buy_3, p.buy_4, p.is_try_enabled, p.is_try_and_buy, p.is_bestseller
       ORDER BY p.id
       LIMIT $${index}`,
      values
    );
    res.json({ bestsellers: result.rows });
  } catch (err) {
    console.error("BESTSELLERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /price-range ────────────────────────────────────────────────────────
// Get products filtered by price range and store inventory
// Query params: min_price, max_price, limit, store_id (optional)
router.get("/price-range", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 40);
    const minPrice = parseFloat(req.query.min_price) || 0;
    const maxPrice = parseFloat(req.query.max_price) || 99999;
    const storeId = req.query.store_id ? req.query.store_id.toString() : null;
    const storeIds = String(req.query.store_ids || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    const effectiveStoreIds = storeIds.length
      ? storeIds
      : (storeId ? [storeId] : []);

    let query = `
      SELECT
         p.id, p.name,
         COALESCE(b.name, '') AS brand,
         COALESCE(c.name, '') AS category_name,
         MIN(COALESCE(v.mrp, v.price))        AS price,
         MIN(v.price)                         AS discount_price,
         COALESCE(
           (
             SELECT pm.url FROM product_media pm
             JOIN product_variants pv ON pv.id = pm.variant_id
             WHERE pv.product_id = p.id AND pm.is_primary = true
             LIMIT 1
           ),
           (
             SELECT pm.url FROM product_media pm
             JOIN product_variants pv ON pv.id = pm.variant_id
             WHERE pv.product_id = p.id
             LIMIT 1
           )
         )                                    AS image,
         p.buy_2, p.buy_3, p.buy_4,
         (p.is_try_enabled OR p.is_try_and_buy) AS is_try_and_buy,
         p.is_bestseller
       FROM products p
       LEFT JOIN brands b       ON b.id = p.brand_id
       LEFT JOIN categories c   ON c.id = p.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
    `;

    // Add store inventory filtering if store_id provided
    if (effectiveStoreIds.length) {
      query += `
       LEFT JOIN inventory inv ON inv.variant_id = v.id AND (inv.store_id = ANY($4::uuid[]) OR inv.store_id IS NULL)
       WHERE p.id IS NOT NULL
       GROUP BY p.id, b.name, c.name, p.buy_2, p.buy_3, p.buy_4, p.is_try_enabled, p.is_try_and_buy, p.is_bestseller
       HAVING MIN(v.price) >= $1 AND MIN(v.price) <= $2
       ORDER BY MIN(v.price) ASC, p.id
       LIMIT $3
      `;
      const result = await pool.query(query, [minPrice, maxPrice, limit, effectiveStoreIds]);
      return res.json({ products: result.rows });
    } else {
      query += `
       WHERE p.id IS NOT NULL
       GROUP BY p.id, b.name, c.name, p.buy_2, p.buy_3, p.buy_4, p.is_try_enabled, p.is_try_and_buy, p.is_bestseller
       HAVING MIN(v.price) >= $1 AND MIN(v.price) <= $2
       ORDER BY MIN(v.price) ASC, p.id
       LIMIT $3
      `;
      const result = await pool.query(query, [minPrice, maxPrice, limit]);
      return res.json({ products: result.rows });
    }
  } catch (err) {
    console.error("PRICE-RANGE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /bulk-offers ────────────────────────────────────────────────────────
// Get products with active bulk offers filtered by store inventory
// Query params: limit, store_id (optional)
router.get("/bulk-offers", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 40);
    const storeId = req.query.store_id ? req.query.store_id.toString() : null;

    let query = `
      SELECT
         p.id, p.name,
         COALESCE(b.name, '') AS brand,
         COALESCE(c.name, '') AS category_name,
         MIN(v.price)                         AS price,
         MIN(COALESCE(v.mrp, v.price))        AS original_price,
         COALESCE(
           (
             SELECT pm.url FROM product_media pm
             JOIN product_variants pv ON pv.id = pm.variant_id
             WHERE pv.product_id = p.id AND pm.is_primary = true
             LIMIT 1
           ),
           (
             SELECT pm.url FROM product_media pm
             JOIN product_variants pv ON pv.id = pm.variant_id
             WHERE pv.product_id = p.id
             LIMIT 1
           )
         )                                    AS image,
         (
           SELECT json_agg(json_build_object('offer_type', bo.offer_type, 'quantity', bo.quantity, 'offer_price', bo.offer_price))
           FROM bulk_offers bo
           WHERE bo.product_id = p.id AND bo.is_active = true
         )                                    AS bulk_offers
       FROM products p
       LEFT JOIN brands b       ON b.id = p.brand_id
       LEFT JOIN categories c   ON c.id = p.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
    `;

    // Add store inventory filtering if store_id provided
    if (storeId) {
      query += `
       LEFT JOIN inventory inv ON inv.variant_id = v.id AND (inv.store_id = $1 OR inv.store_id IS NULL)
       WHERE EXISTS (
         SELECT 1 FROM bulk_offers bo
         WHERE bo.product_id = p.id AND bo.is_active = true
       )
       GROUP BY p.id, b.name, c.name
       ORDER BY p.id
       LIMIT $2
      `;
      const result = await pool.query(query, [storeId, limit]);
      return res.json({ products: result.rows });
    } else {
      query += `
       WHERE EXISTS (
         SELECT 1 FROM bulk_offers bo
         WHERE bo.product_id = p.id AND bo.is_active = true
       )
       GROUP BY p.id, b.name, c.name
       ORDER BY p.id
       LIMIT $1
      `;
      const result = await pool.query(query, [limit]);
      return res.json({ products: result.rows });
    }
  } catch (err) {
    console.error("BULK-OFFERS ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// POST /variants/availability
// Body: { variantIds: string[], storeIds?: string[], storeId?: string, store_id?: string }
router.post("/variants/availability", async (req, res) => {
  try {
    const { variantIds, storeId, store_id, storeIds, store_ids } = req.body || {};
    const ids = Array.isArray(variantIds)
      ? variantIds.map((v) => String(v || "").trim()).filter(Boolean)
      : [];

    if (!ids.length) {
      return res.status(400).json({
        success: false,
        message: "variantIds is required",
      });
    }

    // Accept either a single store id or a list (e.g. all nearby dark stores),
    // matching the same nearby-stores logic used by the products listing endpoint.
    const rawStoreIds = [
      ...(Array.isArray(storeIds) ? storeIds : []),
      ...(Array.isArray(store_ids) ? store_ids : []),
      storeId,
      store_id,
    ]
      .map((v) => String(v || "").trim())
      .filter(Boolean);
    const effectiveStoreIds = rawStoreIds.length ? [...new Set(rawStoreIds)] : null;

    const { rows } = await pool.query(
      `SELECT
         pv.id AS variant_id,
         GREATEST(
           COALESCE(
             SUM(
               CASE
                 WHEN vd.is_operational = true
                  AND ($2::uuid[] IS NULL OR inv.store_id = ANY($2::uuid[]) OR inv.store_id IS NULL)
                   THEN COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0)
                 ELSE 0
               END
             ),
             0
           ),
           0
         )::int AS available_stock
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       JOIN vendors vd ON vd.id = p.vendor_id
       LEFT JOIN inventory inv ON inv.variant_id = pv.id
       WHERE pv.id = ANY($1::uuid[])
         AND pv.is_active = true
       GROUP BY pv.id`,
      [ids, effectiveStoreIds]
    );

    const byId = new Map(rows.map((r) => [String(r.variant_id), Number(r.available_stock) || 0]));
    const availability = ids.map((id) => {
      const availableStock = byId.get(id) ?? 0;
      return {
        variantId: id,
        isAvailable: availableStock > 0,
        availableStock,
      };
    });

    return res.json({ success: true, availability });
  } catch (err) {
    console.error("VARIANT AVAILABILITY ERROR:", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // ✅ PRODUCT
    const productRes = await pool.query(
      `SELECT p.*, b.name AS brand, c.name AS category_name
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.id = $1`,
      [id]
    );

    if (productRes.rows.length === 0) {
      return res.status(404).json({ error: "Product not found" });
    }

    const vendorStateRes = await pool.query(
      `SELECT is_operational FROM vendors WHERE id = $1 LIMIT 1`,
      [productRes.rows[0].vendor_id]
    );
    const isVendorOperational = vendorStateRes.rows[0]?.is_operational !== false;

    // ✅ IMAGES (with variant_id for filtering)
    // Include both variant-specific images AND top-level images (variant_id IS NULL)
    const imageRes = await pool.query(
      `SELECT pm.url, pm.variant_id, pm.is_primary FROM product_media pm
       WHERE pm.variant_id IS NULL 
          OR pm.variant_id IN (
            SELECT v.id FROM product_variants v WHERE v.product_id = $1
          )
       ORDER BY pm.sort_order ASC, pm.id ASC`,
      [id]
    );

    // ✅ VARIANTS
    const variantRes = await pool.query(
      `SELECT
         v.id,
         v.sku,
         v.variant_code,
         v.size,
         v.color,
         v.barcode,
         v.mrp        AS price,
         v.price      AS discount_price,
         GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) AS available_stock
       FROM product_variants v
       LEFT JOIN inventory inv ON inv.variant_id = v.id
       WHERE v.product_id = $1
         AND v.is_active = true
       ORDER BY v.price ASC, v.id ASC`,
      [id]
    );

    const variants = variantRes.rows.map((v) => ({
      ...v,
      available_stock: isVendorOperational
          ? Number(v.available_stock || 0)
          : 0,
    }));

    res.json({
      product: productRes.rows[0],
      images: imageRes.rows,
      variants,
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
      store_id,   // explicit store override from frontend
      store_ids,
    } = req.query;

    // Find nearest dark store when coordinates are provided
    let nearestStoreName = null;
    let nearestStoreCity = null;
    let nearestStoreDist = null;
    let nearestStoreId = null;
    if (lat && lng) {
      const { rows: storeRows } = await pool.query(
        `SELECT id, name, city,
           6371 * acos(
             cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) +
             sin(radians($1)) * sin(radians(lat))
           ) AS dist
         FROM dark_stores WHERE is_active = true AND lat IS NOT NULL AND lng IS NOT NULL
         ORDER BY dist ASC LIMIT 1`,
        [parseFloat(lat), parseFloat(lng)]
      );
      if (storeRows.length) {
        nearestStoreId = storeRows[0].id;
        nearestStoreName = storeRows[0].name;
        nearestStoreCity = storeRows[0].city;
        nearestStoreDist = parseFloat(storeRows[0].dist);
      }
    }

    const explicitStoreIds = String(store_ids || "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    let nearbyStores = [];
    if (!store_id && !explicitStoreIds.length && lat && lng) {
      // Use extended radius (500 km) for Odisha, standard radius (150 km) for others
      // to match the delivery policies configured in checkout
      const radiusKm = 150; // Default extended radius
      
      const { rows } = await pool.query(
        `SELECT id, name, city,
           6371 * acos(
             cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) +
             sin(radians($1)) * sin(radians(lat))
           ) AS dist
         FROM dark_stores
         WHERE is_active = true
           AND lat IS NOT NULL
           AND lng IS NOT NULL
           AND 6371 * acos(
             cos(radians($1)) * cos(radians(lat)) * cos(radians(lng) - radians($2)) +
             sin(radians($1)) * sin(radians(lat))
           ) <= $3
         ORDER BY dist ASC`,
        [parseFloat(lat), parseFloat(lng), radiusKm]
      );
      nearbyStores = rows.map((r) => ({
        id: r.id,
        name: r.name,
        city: r.city,
        dist: parseFloat(r.dist),
      }));
    }

    // Effective stores: explicit store(s) first, then nearby stores, then nearest store fallback.
    const effectiveStoreIds = explicitStoreIds.length
      ? explicitStoreIds
      : store_id
        ? [String(store_id)]
        : nearbyStores.length
          ? nearbyStores.map((s) => s.id)
          : (nearestStoreId ? [nearestStoreId] : []);

    // Build parameter list — store_id is ALWAYS $1 when present so LATERAL
    // can reference it by position before other dynamic conditions are added.
    const values = [];
    let index = 1;

    let storeInvCondition = '';
    if (effectiveStoreIds.length) {
      values.push(effectiveStoreIds);
      storeInvCondition = `AND (inv.store_id = ANY($${index++}::uuid[]) OR inv.store_id IS NULL)`;
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
        pv.color,
        pv.mrp        AS price,
        pv.sell_price AS discount_price,
        p.is_bestseller,
        (p.is_try_enabled OR p.is_try_and_buy) AS is_try_and_buy,
        p.buy_2,
        p.buy_3,
        p.buy_4
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN LATERAL (
        SELECT
          DISTINCT ON (lower(COALESCE(v.color, '')))
          v.id AS variant_id,
          v.size,
          v.color,
          v.mrp,
          v.price AS sell_price,
          GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) AS available_stock,
          COALESCE(

            -- 1. Current variant primary image
            (
                SELECT pm.url
                FROM product_media pm
                WHERE pm.variant_id = v.id
                  AND pm.is_primary = true
                ORDER BY pm.sort_order, pm.id
                LIMIT 1
            ),

            -- 2. Current variant any image
            (
                SELECT pm.url
                FROM product_media pm
                WHERE pm.variant_id = v.id
                ORDER BY pm.is_primary DESC, pm.sort_order, pm.id
                LIMIT 1
            ),

            -- 3. Same color variant primary image
            (
                SELECT pm.url
                FROM product_media pm
                JOIN product_variants pv
                    ON pv.id = pm.variant_id
                WHERE pv.product_id = v.product_id
                  AND LOWER(TRIM(pv.color)) = LOWER(TRIM(v.color))
                  AND pm.is_primary = true
                ORDER BY pm.sort_order, pm.id
                LIMIT 1
            ),

            -- 4. Same color variant any image
            (
                SELECT pm.url
                FROM product_media pm
                JOIN product_variants pv
                    ON pv.id = pm.variant_id
                WHERE pv.product_id = v.product_id
                  AND LOWER(TRIM(pv.color)) = LOWER(TRIM(v.color))
                ORDER BY pm.is_primary DESC, pm.sort_order, pm.id
                LIMIT 1
            ),

            -- 5. Any variant image of the product
            (
                SELECT pm.url
                FROM product_media pm
                JOIN product_variants pv
                    ON pv.id = pm.variant_id
                WHERE pv.product_id = v.product_id
                ORDER BY pm.is_primary DESC, pm.sort_order, pm.id
                LIMIT 1
            ),

            -- 6. Product-level primary image
            (
                SELECT pm.url
                FROM product_media pm
                WHERE pm.product_id = p.id
                  AND pm.variant_id IS NULL
                  AND pm.is_primary = true
                ORDER BY pm.sort_order, pm.id
                LIMIT 1
            ),

            -- 7. Product-level any image
            (
                SELECT pm.url
                FROM product_media pm
                WHERE pm.product_id = p.id
                  AND pm.variant_id IS NULL
                ORDER BY pm.is_primary DESC, pm.sort_order, pm.id
                LIMIT 1
            )

          ) AS image
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          ${storeInvCondition}
        ORDER BY lower(COALESCE(v.color, '')), (EXISTS(SELECT 1 FROM product_media WHERE variant_id = v.id)) DESC, v.price ASC, v.id ASC
      ) pv ON true
      WHERE 1=1
        AND pv.variant_id IS NOT NULL
    `;

    if (brand_id) {
      query += ` AND p.brand_id = $${index++}`;
      values.push(brand_id);
    }

    if (category_id) {
      // Always include selected root tree. If selected root is Footwear-like,
      // also include Men/Women footwear subcategory trees.
      const linkedFootwearRootIds = [];
      const footwearPattern = '(footwear|shoe|shoes|sneaker|loafer|sandal|slipper|flip|heel|boot|mule|clog)';

      try {
        const selectedRootRes = await pool.query(
          `SELECT lower(name) AS name FROM categories WHERE id = $1 LIMIT 1`,
          [category_id]
        );

        const selectedRootName = selectedRootRes.rows[0]?.name || '';
        const isFootwearRoot = new RegExp(footwearPattern).test(selectedRootName);

        if (isFootwearRoot) {
          const linkedRootsRes = await pool.query(
            `SELECT c.id
             FROM categories c
             JOIN categories parent ON parent.id = c.parent_id
             WHERE lower(parent.name) IN ('men', 'women')
               AND lower(c.name) ~ $1`,
            [footwearPattern]
          );

          for (const row of linkedRootsRes.rows) {
            const id = row?.id?.toString();
            if (id && !linkedFootwearRootIds.includes(id)) {
              linkedFootwearRootIds.push(id);
            }
          }
        }
      } catch (e) {
        // If category lookup fails, continue with selected root only.
        console.warn('Footwear linked category lookup skipped:', e?.message || e);
      }

      // selected root: full tree (root + children + grandchildren)
      // linkedFootwearRootIds: Men/Women footwear roots + their descendants
      query += ` AND p.category_id IN (
        SELECT id FROM categories WHERE id = $${index}
        UNION
        SELECT id FROM categories WHERE parent_id = $${index}
        UNION
        SELECT c2.id FROM categories c2
          JOIN categories c1 ON c2.parent_id = c1.id
          WHERE c1.parent_id = $${index}

        UNION
        SELECT id FROM categories
          WHERE id = ANY($${index + 1}::uuid[])

        UNION
        SELECT id FROM categories
          WHERE parent_id = ANY($${index + 1}::uuid[])

        UNION
        SELECT c2.id FROM categories c2
          JOIN categories c1 ON c2.parent_id = c1.id
          WHERE c1.parent_id = ANY($${index + 1}::uuid[])
      )`;
      values.push(category_id, linkedFootwearRootIds);
      index += 2;
    }

    if (min_price) {
      query += ` AND EXISTS (
        SELECT 1
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          ${storeInvCondition}
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
          ${storeInvCondition}
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
          ${storeInvCondition}
          AND GREATEST(COALESCE(inv.stock, 0) - COALESCE(inv.reserved_stock, 0), 0) > 0
          AND lower(v.color) = lower($${index++})
      )`;
      values.push(color);
    }

    if (search) {
      query += ` AND (lower(p.name) LIKE lower($${index++}) OR lower(b.name) LIKE lower($${index++}) OR lower(c.name) LIKE lower($${index++}) OR lower(p.description) LIKE lower($${index++}))`;
      const term = `%${search}%`;
      values.push(term, term, term, term);
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

    console.log('[GET /products] Result summary:', {
      rowCount: result.rowCount,
      firstRow: result.rows.length > 0 ? result.rows[0] : null,
      sampleRows: result.rows.slice(0, 3).map(r => ({ id: r.id, name: r.name, image: r.image, variant_id: r.variant_id, color: r.color }))
    });

    res.json({
      products: result.rows,
      total: result.rowCount,
      nearestStore: nearestStoreName
        ? { id: nearestStoreId, name: nearestStoreName, city: nearestStoreCity, dist: nearestStoreDist }
        : null,
      nearbyStores,
      nearbyStoreIds: effectiveStoreIds,
      locationProvided: !!(lat && lng),
    });

  } catch (err) {
    console.error("FILTER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ IMPORTANT EXPORT
export default router;

