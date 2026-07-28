import { pool } from "./db.js";

const testProductListQuery = async () => {
  try {
    // Get vendor ID for cuttackpuma@blinkiefash.in
    const vendorRes = await pool.query(
      `SELECT id FROM vendors WHERE email ILIKE '%cuttackpuma%' LIMIT 1`
    );

    if (vendorRes.rows.length === 0) {
      console.log('No vendor found');
      process.exit(0);
    }

    const vendorId = vendorRes.rows[0].id;

    // Run the product-list query that shows in product cards
    const result = await pool.query(`
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
            (
              SELECT pm.url
              FROM product_media pm
              WHERE pm.variant_id = v.id AND pm.is_primary = true
              ORDER BY pm.sort_order ASC, pm.id ASC
              LIMIT 1
            ),
            (
              SELECT pm.url
              FROM product_media pm
              WHERE pm.variant_id = v.id
              ORDER BY pm.is_primary DESC, pm.sort_order ASC, pm.id ASC
              LIMIT 1
            ),
            (
              SELECT pm.url
              FROM product_media pm
              WHERE pm.product_id = p.id AND pm.variant_id IS NULL AND pm.is_primary = true
              ORDER BY pm.sort_order ASC, pm.id ASC
              LIMIT 1
            ),
            (
              SELECT pm.url
              FROM product_media pm
              WHERE pm.product_id = p.id AND pm.variant_id IS NULL
              ORDER BY pm.is_primary DESC, pm.sort_order ASC, pm.id ASC
              LIMIT 1
            )
          ) AS image
        FROM product_variants v
        LEFT JOIN inventory inv ON inv.variant_id = v.id
        WHERE v.product_id = p.id AND v.is_active = true
        ORDER BY lower(COALESCE(v.color, '')), v.price ASC, v.id ASC
      ) pv ON true
      WHERE p.vendor_id = $1 AND pv.variant_id IS NOT NULL
      LIMIT 20
    `, [vendorId]);

    console.log(`\n📊 Product List Query Results (${result.rows.length} products):\n`);
    
    result.rows.forEach((product, idx) => {
      const hasImage = product.image ? '✓' : '✗ NULL';
      console.log(`${idx + 1}. ${product.name}`);
      console.log(`   ID: ${product.id}`);
      console.log(`   Variant: ${product.color}/${product.variant_id}`);
      console.log(`   Price: ₹${product.price} → ₹${product.discount_price}`);
      console.log(`   Image: ${hasImage} ${product.image ? `(${product.image.substring(0, 50)}...)` : ''}`);
      console.log();
    });

    console.log(`✅ Query test complete\n`);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
};

testProductListQuery();
