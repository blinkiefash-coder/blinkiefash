import { pool } from "./db.js";

const diagnoseVendorImages = async () => {
  try {
    // Get vendor ID for cuttackpuma@blinkiefash.in
    const vendorRes = await pool.query(
      `SELECT id, email, name FROM vendors WHERE email ILIKE '%cuttackpuma%' LIMIT 1`
    );

    if (vendorRes.rows.length === 0) {
      console.log('No vendor found with email containing "cuttackpuma"');
      process.exit(0);
    }

    const vendor = vendorRes.rows[0];
    console.log('\n📦 Vendor:', { id: vendor.id, name: vendor.name, email: vendor.email });

    // Get products for this vendor
    const productsRes = await pool.query(
      `SELECT id, name, vendor_id 
       FROM products 
       WHERE vendor_id = $1 
       LIMIT 10`,
      [vendor.id]
    );

    console.log(`\n📋 Products for vendor (showing first ${productsRes.rows.length}):`);
    
    for (const product of productsRes.rows) {
      console.log(`\n  Product: ${product.name} (${product.id})`);

      // Check variants
      const variantsRes = await pool.query(
        `SELECT id, color, size, price, mrp
         FROM product_variants 
         WHERE product_id = $1 AND is_active = true
         ORDER BY color, size`,
        [product.id]
      );

      console.log(`    Variants: ${variantsRes.rows.length}`);

      // Check images for each variant
      for (const variant of variantsRes.rows) {
        const imagesRes = await pool.query(
          `SELECT id, url, is_primary, sort_order
           FROM product_media 
           WHERE variant_id = $1
           ORDER BY is_primary DESC, sort_order ASC`,
          [variant.id]
        );

        console.log(`      ${variant.color}/${variant.size} (variant ${variant.id}): ${imagesRes.rows.length} images`);
        imagesRes.rows.forEach((img, idx) => {
          console.log(`        [${idx + 1}] primary=${img.is_primary} url=${img.url ? '✓' : '✗ NULL'}`);
        });
      }

      // Check product-level images
      const productImagesRes = await pool.query(
        `SELECT id, url, is_primary, sort_order
         FROM product_media 
         WHERE product_id = $1 AND variant_id IS NULL
         ORDER BY is_primary DESC, sort_order ASC`,
        [product.id]
      );

      if (productImagesRes.rows.length > 0) {
        console.log(`    Product-level images: ${productImagesRes.rows.length}`);
        productImagesRes.rows.forEach((img, idx) => {
          console.log(`      [${idx + 1}] primary=${img.is_primary} url=${img.url ? '✓' : '✗ NULL'}`);
        });
      }

      // Check inventory
      const inventoryRes = await pool.query(
        `SELECT inv.id, inv.stock, inv.reserved_stock, pv.color, pv.size, ds.name AS store_name
         FROM inventory inv
         JOIN product_variants pv ON pv.id = inv.variant_id
         LEFT JOIN dark_stores ds ON ds.id = inv.store_id
         WHERE pv.product_id = $1
         ORDER BY pv.color, pv.size, COALESCE(ds.name, 'no-store')`,
        [product.id]
      );

      console.log(`    Inventory records: ${inventoryRes.rows.length}`);
      inventoryRes.rows.forEach((inv) => {
        const available = Math.max(0, (inv.stock || 0) - (inv.reserved_stock || 0));
        const storeName = inv.store_name || 'no-store';
        console.log(`      ${inv.color}/${inv.size} @ ${storeName}: stock=${inv.stock} reserved=${inv.reserved_stock} available=${available}`);
      });
    }

    console.log('\n✅ Diagnosis complete\n');
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
};

diagnoseVendorImages();
