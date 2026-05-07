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

    await client.query("BEGIN");

    // ✅ INSERT PRODUCT
    const productRes = await client.query(
      `INSERT INTO products (
        vendor_id, brand_id, category_id,
        name, description, gender, material
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

    // ✅ INSERT VARIANTS
    for (const v of variants) {

      const variantRes = await client.query(
        `INSERT INTO product_variants (
          product_id, sku, size, color, price, discount_price
        )
        VALUES ($1,$2,$3,$4,$5,$6)
        RETURNING id`,
        [
          productId,
          `${name}-${v.size}-${v.color}`,
          v.size,
          v.color,
          v.price,
          v.discount_price
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

    // ✅ 🔥 INSERT MULTIPLE IMAGES
    for (let i = 0; i < images.length; i++) {
      await client.query(
        `INSERT INTO product_media (
          product_id, media_type, url, is_primary
        )
        VALUES ($1,'image',$2,$3)`,
        [
          productId,
          images[i],
          i === 0   // first image = primary ✅
        ]
      );
    }

    await client.query("COMMIT");

    res.json({ success: true });

  } catch (err) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ success: false });
  } finally {
    client.release();
  }
});
