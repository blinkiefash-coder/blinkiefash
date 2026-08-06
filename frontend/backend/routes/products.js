import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const toNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

// Common gender/age word variants shoppers mix up (man/men, kid/kids, etc.)
const SEARCH_SYNONYMS = {
  men: ["man", "mens", "men's"],
  man: ["men", "mens", "men's"],
  women: ["woman", "womens", "women's"],
  woman: ["women", "womens", "women's"],
  boys: ["boy"],
  boy: ["boys"],
  girls: ["girl"],
  girl: ["girls"],
  kids: ["kid", "child", "children"],
  kid: ["kids", "child", "children"],
  child: ["kids", "kid", "children"],
  children: ["kids", "kid", "child"],
};

const singularizeWord = (word) => {
  if (word.endsWith("ies") && word.length > 3) return `${word.slice(0, -3)}y`;
  if (/(sses|shes|ches|xes)$/.test(word)) return word.slice(0, -2);
  if (word.endsWith("s") && !word.endsWith("ss") && word.length > 3) return word.slice(0, -1);
  return null;
};

const pluralizeWord = (word) => {
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  if (/(s|x|ch|sh)$/.test(word)) return `${word}es`;
  return `${word}s`;
};

// Strips everything but letters/digits so "tshirt" can match "T-Shirt"/"T Shirt".
const normalizeForSearch = (value) => value.toLowerCase().replace(/[^a-z0-9]/g, "");

// Every word in `search` must appear somewhere (name/brand/category/barcode),
// tolerating singular/plural forms and men<->man style synonyms so a typo-ish
// or differently-worded query ("man trouser") still finds "Men's Trousers".
// NOTE: product `description` is intentionally excluded — descriptions often
// contain unrelated styling-tip text (e.g. "pair this kurti with jeans") which
// caused searches like "jeans" to wrongly surface kurtis.
const buildSearchClause = (search, values, startIndex) => {
  const tokens = search.trim().toLowerCase().split(/\s+/).filter(Boolean);
  let index = startIndex;
  const clauses = [];
  for (const token of tokens) {
    const variants = new Set([token]);
    const singular = singularizeWord(token);
    if (singular) variants.add(singular);
    variants.add(pluralizeWord(singular || token));
    const base = singular || token;
    for (const syn of SEARCH_SYNONYMS[token] || []) variants.add(syn);
    for (const syn of SEARCH_SYNONYMS[base] || []) variants.add(syn);
    const patterns = Array.from(variants).map((v) => `%${v}%`);
    const normalizedPatterns = Array.from(
      new Set(Array.from(variants).map((v) => normalizeForSearch(v)).filter(Boolean))
    ).map((v) => `%${v}%`);
    clauses.push(`(
      lower(p.name) LIKE ANY($${index}::text[]) OR
      lower(b.name) LIKE ANY($${index}::text[]) OR
      lower(c.name) LIKE ANY($${index}::text[]) OR
      lower(c_parent.name) LIKE ANY($${index}::text[]) OR
      lower(c_root.name) LIKE ANY($${index}::text[]) OR
      regexp_replace(lower(p.name), '[^a-z0-9]', '', 'g') LIKE ANY($${index + 1}::text[]) OR
      regexp_replace(lower(c.name), '[^a-z0-9]', '', 'g') LIKE ANY($${index + 1}::text[]) OR
      regexp_replace(lower(c_parent.name), '[^a-z0-9]', '', 'g') LIKE ANY($${index + 1}::text[]) OR
      regexp_replace(lower(c_root.name), '[^a-z0-9]', '', 'g') LIKE ANY($${index + 1}::text[]) OR
      EXISTS (
        SELECT 1 FROM product_variants sv
        WHERE sv.product_id = p.id AND lower(sv.barcode) LIKE ANY($${index}::text[])
      )
    )`);
    values.push(patterns, normalizedPatterns);
    index += 2;
  }
  return { clause: clauses.length ? clauses.join(" AND ") : null, nextIndex: index };
};

// Recognizes natural-language price phrases inside a free-text search query
// ("trouser under 500", "shoes above 1000", "kurti between 300 and 600",
// "jacket 500 to 800") so shoppers can type a budget without needing separate
// min/max price filter inputs. Returns the bounds found plus the search text
// with the price phrase stripped out (so words like "under" don't pollute
// name/category matching).
const PRICE_CURRENCY = "(?:\u20b9|rs\\.?|inr|rupees?)";
const PRICE_NUM = `(?:${PRICE_CURRENCY}\\s*)?(\\d+(?:,\\d{3})*(?:\\.\\d+)?)\\s*(k)?(?:\\s*${PRICE_CURRENCY})?`;
const PRICE_BETWEEN_RE = new RegExp(`\\bbetween\\s+${PRICE_NUM}\\s*(?:and|to)\\s*${PRICE_NUM}\\b`, "i");
const PRICE_RANGE_RE = new RegExp(`\\b${PRICE_NUM}\\s*to\\s*${PRICE_NUM}\\b`, "i");
const PRICE_UNDER_RE = new RegExp(`\\b(?:under|below|less\\s+than|cheaper\\s+than|up\\s*to)\\s*${PRICE_NUM}`, "i");
const PRICE_OVER_RE = new RegExp(`\\b(?:over|above|more\\s+than|greater\\s+than|starting\\s+from)\\s*${PRICE_NUM}`, "i");

const parsePriceNumber = (value, kFlag) => {
  const num = parseFloat(String(value).replace(/,/g, ""));
  if (!Number.isFinite(num)) return null;
  return kFlag ? num * 1000 : num;
};

const extractPriceConstraint = (text) => {
  let remaining = text;
  let minPrice = null;
  let maxPrice = null;

  const rangeMatch = remaining.match(PRICE_BETWEEN_RE) || remaining.match(PRICE_RANGE_RE);
  if (rangeMatch) {
    const a = parsePriceNumber(rangeMatch[1], rangeMatch[2]);
    const b = parsePriceNumber(rangeMatch[3], rangeMatch[4]);
    if (a != null && b != null) {
      minPrice = Math.min(a, b);
      maxPrice = Math.max(a, b);
      remaining = remaining.replace(rangeMatch[0], " ");
    }
  } else {
    const underMatch = remaining.match(PRICE_UNDER_RE);
    if (underMatch) {
      const val = parsePriceNumber(underMatch[1], underMatch[2]);
      if (val != null) {
        maxPrice = val;
        remaining = remaining.replace(underMatch[0], " ");
      }
    }
    const overMatch = remaining.match(PRICE_OVER_RE);
    if (overMatch) {
      const val = parsePriceNumber(overMatch[1], overMatch[2]);
      if (val != null) {
        minPrice = val;
        remaining = remaining.replace(overMatch[0], " ");
      }
    }
  }

  return { minPrice, maxPrice, remainingText: remaining.replace(/\s+/g, " ").trim() };
};

export const getProductMediaShape = async (client) => {
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

export const insertProductMediaRows = async ({
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
    const payload = prepareCreatePayload(req.body);
    const {
      vendor_id, category_id,
      name, description, short_description,
      brand_name, brand_id: explicitBrandId,
      is_try_enabled, store_id,
      variants, topLevelImages,
      bundleOffers,
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
        [productId, sku, variant.size, variant.color, variant.barcode, variant.price, variant.mrp]
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

    const values = [];
    let index = 1;

    let storeCondition = '';
    if (store_id) {
      values.push(store_id);
      storeCondition = `AND EXISTS (
        SELECT 1 FROM product_variants sv
        JOIN inventory si ON si.variant_id = sv.id
        WHERE sv.product_id = p.id AND sv.is_active = true
          AND si.store_id = $${index++}
      )`;
    }

    values.push(limit);
    const result = await pool.query(
      `SELECT
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
         )                                    AS image
       FROM products p
       LEFT JOIN brands b       ON b.id = p.brand_id
       LEFT JOIN categories c   ON c.id = p.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
       WHERE p.bestseller = true
         ${storeCondition}
       GROUP BY p.id, b.name, c.name
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
// Get products filtered by price range
// Query params: min_price, max_price, limit
router.get("/price-range", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 40);
    const minPrice = parseFloat(req.query.min_price) || 0;
    const maxPrice = parseFloat(req.query.max_price) || 99999;

    const result = await pool.query(
      `SELECT
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
         (p.is_try_enabled OR p.is_try_and_buy) AS is_try_and_buy,
         p.is_bestseller
       FROM products p
       LEFT JOIN brands b       ON b.id = p.brand_id
       LEFT JOIN categories c   ON c.id = p.category_id
       LEFT JOIN product_variants v ON v.product_id = p.id AND v.is_active = true
       WHERE p.id IS NOT NULL
       GROUP BY p.id, b.name, c.name, p.is_try_enabled, p.is_try_and_buy, p.is_bestseller
       HAVING MIN(v.price) >= $1 AND MIN(v.price) <= $2
       ORDER BY MIN(v.price) ASC, p.id
       LIMIT $3`,
      [minPrice, maxPrice, limit]
    );
    res.json({ products: result.rows });
  } catch (err) {
    console.error("PRICE-RANGE ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ── GET /bulk-offers ────────────────────────────────────────────────────────
// Get products with active bulk offers (Buy 2, Buy 3, etc.)
// Query params: limit
router.get("/bulk-offers", async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 10, 40);

    const result = await pool.query(
      `SELECT
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
       WHERE EXISTS (
         SELECT 1 FROM bulk_offers bo
         WHERE bo.product_id = p.id AND bo.is_active = true
       )
       GROUP BY p.id, b.name, c.name
       ORDER BY p.id
       LIMIT $1`,
      [limit]
    );
    res.json({ products: result.rows });
  } catch (err) {
    console.error("BULK-OFFERS ERROR:", err);
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
         v.sku,
         v.variant_code,
         v.size,
         v.color,
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
      min_discount,
      no_discount,
      color,
      search,
      sort,
      limit,
      offset,
      lat,
      lng,
      store_id,   // explicit store override from frontend
    } = req.query;

    // Let a free-text budget phrase ("under 500") drive price filtering when
    // explicit min_price/max_price filters weren't already supplied.
    let effectiveMinPrice = min_price;
    let effectiveMaxPrice = max_price;
    let effectiveSearch = search;
    if (search && typeof search === "string") {
      const priceInfo = extractPriceConstraint(search);
      if (priceInfo.minPrice != null && !effectiveMinPrice) effectiveMinPrice = priceInfo.minPrice;
      if (priceInfo.maxPrice != null && !effectiveMaxPrice) effectiveMaxPrice = priceInfo.maxPrice;
      effectiveSearch = priceInfo.remainingText;
    }

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

    // Effective store: explicit param first, then nearest from lat/lng
    const effectiveStoreId = store_id || nearestStoreId || null;

    // Build parameter list — store_id is ALWAYS $1 when present so LATERAL
    // can reference it by position before other dynamic conditions are added.
    const values = [];
    let index = 1;

    let storeInvCondition = '';
    if (effectiveStoreId) {
      values.push(effectiveStoreId);
      storeInvCondition = `AND inv.store_id = $${index++}`;
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
        p.is_try_and_buy
      FROM products p
      LEFT JOIN brands b ON b.id = p.brand_id
      LEFT JOIN categories c ON c.id = p.category_id
      LEFT JOIN categories c_parent ON c_parent.id = c.parent_id
      LEFT JOIN categories c_root ON c_root.id = c_parent.parent_id
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

    if (effectiveMinPrice) {
      query += ` AND EXISTS (
        SELECT 1
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          ${storeInvCondition}
          AND v.price >= $${index++}
      )`;
      values.push(effectiveMinPrice);
    }

    if (effectiveMaxPrice) {
      query += ` AND EXISTS (
        SELECT 1
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          ${storeInvCondition}
          AND v.price <= $${index++}
      )`;
      values.push(effectiveMaxPrice);
    }

    if (min_discount) {
      query += ` AND EXISTS (
        SELECT 1
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          ${storeInvCondition}
          AND v.mrp > 0 AND v.mrp > v.price
          AND ((v.mrp - v.price) / v.mrp * 100) >= $${index++}
      )`;
      values.push(min_discount);
    }

    if (no_discount === "true" || no_discount === true) {
      query += ` AND NOT EXISTS (
        SELECT 1
        FROM product_variants v
        WHERE v.product_id = p.id
          AND v.is_active = true
          AND v.mrp > 0 AND v.mrp > v.price
      )`;
    }

    if (color) {
      query += ` AND EXISTS (
        SELECT 1
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id
          AND v.is_active = true
          ${storeInvCondition}
          AND lower(v.color) = lower($${index++})
      )`;
      values.push(color);
    }

    if (effectiveSearch) {
      const { clause, nextIndex } = buildSearchClause(effectiveSearch, values, index);
      if (clause) {
        query += ` AND (${clause})`;
        index = nextIndex;
      }
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
        ? { id: nearestStoreId, name: nearestStoreName, city: nearestStoreCity, dist: nearestStoreDist }
        : null,
      locationProvided: !!(lat && lng),
    });

  } catch (err) {
    console.error("FILTER ERROR:", err);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ IMPORTANT EXPORT
export default router;

