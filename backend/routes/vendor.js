import express from "express";
import multer from "multer";
import crypto from "crypto";
import { pool } from "../db.js";
import cloudinary from "../utils/cloudinary.js";
import {
  notifyAvailableRiders,
  notifyCustomerOfStatus,
} from "../utils/firebaseAdmin.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const hasOrdersColumn = async (columnName) => {
  try {
    const { rows } = await pool.query(
      `SELECT 1
       FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'orders'
         AND column_name = $1
       LIMIT 1`,
      [columnName]
    );
    return rows.length > 0;
  } catch {
    return false;
  }
};

const createPasswordHash = (password = "") => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
};

const verifyPasswordHash = (password = "", storedHash = "") => {
  const [salt, expectedHash] = String(storedHash).split(":");

  if (!salt || !expectedHash) {
    return false;
  }

  const derived = crypto.scryptSync(password, salt, 64).toString("hex");

  return crypto.timingSafeEqual(
    Buffer.from(derived, "hex"),
    Buffer.from(expectedHash, "hex")
  );
};

const buildSlug = (value = "") => {
  const base = String(value)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return base || `vendor-${Date.now()}`;
};

const uploadFileToCloudinary = async (file, folder) => {
  if (!file) return null;

  const uploadResult = await cloudinary.uploader.upload(
    `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
    {
      folder,
      resource_type: "auto"
    }
  );

  return uploadResult.secure_url;
};

// GET all active vendors (for Explore Shops page)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, store_name, slug, description, address, city, pincode,
              lat, lng, service_radius_km, is_verified, is_active,
              vendor_img_url, created_at
       FROM vendors
       WHERE is_active = true
       ORDER BY is_verified DESC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET a single vendor by id or slug
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;

    const result = await pool.query(
      `SELECT id, store_name, slug, description, address, city, pincode,
              lat, lng, service_radius_km, dark_store_id, user_id,
              (SELECT ds.name FROM dark_stores ds WHERE ds.id = vendors.dark_store_id LIMIT 1) AS linked_store_name,
              (SELECT ds.city FROM dark_stores ds WHERE ds.id = vendors.dark_store_id LIMIT 1) AS linked_store_city,
              is_verified, is_active, is_operational,
              vendor_img_url, created_at
       FROM vendors
       WHERE id::text = $1 OR slug = $1
       LIMIT 1`,
      [identifier]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Toggle vendor operational status (ON/OFF for product availability)
router.patch("/:id/operational-status", async (req, res) => {
  try {
    const { id } = req.params;
    const isOperational = req.body?.is_operational;

    if (typeof isOperational !== "boolean") {
      return res.status(400).json({
        success: false,
        error: "is_operational boolean is required",
      });
    }

    const result = await pool.query(
      `UPDATE vendors
       SET is_operational = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, store_name, is_operational`,
      [isOperational, id]
    );

    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }

    return res.json({
      success: true,
      vendor: result.rows[0],
      message: isOperational
        ? "Store turned ON. Products are available."
        : "Store turned OFF. Products are unavailable.",
    });
  } catch (err) {
    console.error("Vendor operational status update error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// DEBUG: GET all products (for debugging)
router.get("/debug/all-products", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, vendor_id, is_active, created_at FROM products ORDER BY created_at DESC`
    );
    res.json({ 
      total: result.rows.length, 
      products: result.rows 
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET single vendor with their products
router.get("/:id/products", async (req, res) => {
  try {
    const { id } = req.params;

    const vendorStore = await pool.query(
      `SELECT dark_store_id, user_id FROM vendors WHERE id = $1 LIMIT 1`,
      [id]
    );
    const linkedStoreId = vendorStore.rows[0]?.dark_store_id || null;
    const vendorUserId = vendorStore.rows[0]?.user_id || null;
    const ownerIds = [id, vendorUserId].filter(Boolean).map(String);

    if (!linkedStoreId) {
      return res.json([]);
    }
    
    // First, get all products for this vendor
    const productsResult = await pool.query(
      `SELECT p.id, p.name, p.vendor_id, p.category_id, p.brand_id,
              b.name AS brand_name,
              c.name AS category_name,
              (SELECT pm.url FROM product_media pm
               JOIN product_variants pv2 ON pv2.id = pm.variant_id
               WHERE pv2.product_id = p.id
               ORDER BY pm.is_primary DESC, pm.id ASC LIMIT 1) AS image_url,
              (SELECT v.price FROM product_variants v
               WHERE v.product_id = p.id AND v.is_active = true
               ORDER BY v.price ASC LIMIT 1) AS price
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       WHERE p.vendor_id::text = ANY($1::text[])
         AND p.is_active = true
       ORDER BY p.created_at DESC`,
      [ownerIds]
    );

    const products = productsResult.rows;

    // For each product, fetch its variants with inventory
    const productsWithVariants = await Promise.all(
      products.map(async (product) => {
        const variantsResult = await pool.query(
          `SELECT pv.id, pv.product_id, pv.size, pv.color, pv.barcode, pv.price, pv.mrp, pv.is_active,
                      COALESCE(i.stock, 0) as quantity,
                  i.store_id
           FROM product_variants pv
           LEFT JOIN (
             SELECT DISTINCT ON (variant_id) variant_id, stock, store_id
             FROM inventory
             ORDER BY variant_id, CASE WHEN store_id IS NOT NULL THEN 0 ELSE 1 END
           ) i ON i.variant_id = pv.id
           WHERE pv.product_id = $1 AND pv.is_active = true
           ORDER BY pv.id ASC`,
                   [product.id]
        );

        return {
          ...product,
          variants: variantsResult.rows || []
        };
      })
    );

    res.json(productsWithVariants);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// Get the vendor's linked dark store details
router.get("/:id/store", async (req, res) => {
  try {
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT v.dark_store_id,
              ds.name,
              ds.city,
              ds.address
       FROM vendors v
       LEFT JOIN dark_stores ds ON ds.id = v.dark_store_id
       WHERE v.id = $1
       LIMIT 1`,
      [id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }

    const row = rows[0];
    return res.json({
      success: true,
      store: row.dark_store_id
        ? {
            id: row.dark_store_id,
            name: row.name,
            city: row.city,
            address: row.address,
          }
        : null,
    });
  } catch (err) {
    console.error("Vendor linked store fetch error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// GET vendor orders (for analytics)
router.get("/:id/orders", async (req, res) => {
  try {
    const { id } = req.params;

    const vendorStore = await pool.query(
      `SELECT dark_store_id, user_id FROM vendors WHERE id = $1 LIMIT 1`,
      [id]
    );
    const linkedStoreId = vendorStore.rows[0]?.dark_store_id || null;
    const vendorUserId = vendorStore.rows[0]?.user_id || null;
    const ownerIds = [id, vendorUserId].filter(Boolean).map(String);
    if (!linkedStoreId) {
      return res.json([]);
    }
    
    const result = await pool.query(
      `SELECT 
         o.id,
         o.status,
         o.total_amount,
         o.final_amount,
         o.delivery_otp,
         o.otp_verified_at,
         o.created_at,
         u.name AS customer_name,
         u.phone AS customer_phone,
         json_agg(json_build_object(
           'product_id', p.id,
           'variant_id', oi.variant_id,
           'quantity', oi.quantity,
           'price', oi.price,
           'item_status', oi.item_status,
           'product_name', p.name,
           'image_url', COALESCE(
             (SELECT pm.url
              FROM product_media pm
              WHERE pm.variant_id = v.id AND pm.is_primary = true
              LIMIT 1),
             (SELECT pm.url
              FROM product_media pm
              WHERE pm.variant_id = v.id
              LIMIT 1),
             (SELECT pm.url
              FROM product_media pm
              JOIN product_variants pv2 ON pv2.id = pm.variant_id
              WHERE pv2.product_id = p.id AND pm.is_primary = true
              LIMIT 1),
             (SELECT pm.url
              FROM product_media pm
              JOIN product_variants pv2 ON pv2.id = pm.variant_id
              WHERE pv2.product_id = p.id
              LIMIT 1)
           ),
           'size', v.size,
           'color', v.color,
           'barcode', v.barcode
         )) AS items
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       LEFT JOIN users u ON u.id = o.user_id
       WHERE p.vendor_id::text = ANY($1::text[])
         AND o.dark_store_id = $2
       GROUP BY o.id, u.name, u.phone
       ORDER BY o.created_at DESC`,
      [ownerIds, linkedStoreId]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

router.patch("/:id/orders/:orderId/status", async (req, res) => {
  try {
    const { id: vendorId, orderId } = req.params;
    const { status, cancelReason } = req.body || {};

    const validStatuses = new Set([
      "confirmed",
      "packed",
      "picked",
      "out_for_delivery",
      "delivered",
      "cancelled",
    ]);
    const normalizedStatus = String(status || "").trim();
    if (!validStatuses.has(normalizedStatus)) {
      return res.status(400).json({ success: false, error: "Invalid status" });
    }

    const vendorStore = await pool.query(
      `SELECT dark_store_id, user_id FROM vendors WHERE id = $1 LIMIT 1`,
      [vendorId]
    );
    const linkedStoreId = vendorStore.rows[0]?.dark_store_id || null;
    const vendorUserId = vendorStore.rows[0]?.user_id || null;
    const ownerIds = [vendorId, vendorUserId].filter(Boolean).map(String);
    if (!linkedStoreId) {
      return res.status(400).json({
        success: false,
        error: "Vendor is not linked to a store",
      });
    }

    const ownershipCheck = await pool.query(
      `SELECT o.id
       FROM orders o
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants pv ON pv.id = oi.variant_id
       JOIN products p ON p.id = pv.product_id
       WHERE o.id = $1
         AND p.vendor_id::text = ANY($2::text[])
         AND o.dark_store_id = $3
       LIMIT 1`,
      [orderId, ownerIds, linkedStoreId]
    );

    if (!ownershipCheck.rows.length) {
      return res.status(404).json({
        success: false,
        error: "Order not found for this vendor store",
      });
    }

    const [hasConfirmedAt, hasCancelReason] = await Promise.all([
      hasOrdersColumn("confirmed_at"),
      hasOrdersColumn("cancel_reason"),
    ]);

    const canSetConfirmedAt = normalizedStatus === "confirmed" && hasConfirmedAt;
    const canSetCancelReason = normalizedStatus === "cancelled" && hasCancelReason;

    const confirmClause = canSetConfirmedAt
      ? ", confirmed_at = COALESCE(confirmed_at, NOW())"
      : "";
    const cancelClause = canSetCancelReason ? ", cancel_reason = $3" : "";
    const params = canSetCancelReason
      ? [
          normalizedStatus,
          orderId,
          String(cancelReason || "Rejected by store").slice(0, 500),
        ]
      : [normalizedStatus, orderId];

    const updated = await pool.query(
      `UPDATE orders
       SET status = $1${confirmClause}${cancelClause}
       WHERE id = $2
       RETURNING id, status`,
      params
    );

    await pool.query(
      `UPDATE order_items oi
       SET item_status = $1
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE oi.order_id = $2
         AND oi.variant_id = pv.id
         AND p.vendor_id::text = ANY($3::text[])
      `,
      [normalizedStatus, orderId, ownerIds]
    ).catch(() => {});

    if (normalizedStatus === "confirmed") {
      notifyAvailableRiders(pool, orderId).catch(() => {});
    }
    notifyCustomerOfStatus(pool, orderId, normalizedStatus).catch(() => {});

    return res.json({ success: true, order: updated.rows[0] });
  } catch (err) {
    console.error("Vendor order status update error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// Update variant stock for a vendor in a selected dark store
router.post("/:id/stock", async (req, res) => {
  try {
    const { id: vendorId } = req.params;
    const { variantId, quantity } = req.body || {};

    const safeQty = Number(quantity);
    if (!variantId || Number.isNaN(safeQty) || safeQty < 0) {
      return res.status(400).json({
        success: false,
        error: "variantId and non-negative quantity are required"
      });
    }

    const vendorStore = await pool.query(
      `SELECT dark_store_id, user_id FROM vendors WHERE id = $1 LIMIT 1`,
      [vendorId]
    );
    const storeId = vendorStore.rows[0]?.dark_store_id || null;
    const vendorUserId = vendorStore.rows[0]?.user_id || null;
    const ownerIds = [vendorId, vendorUserId].filter(Boolean).map(String);
    if (!storeId) {
      return res.status(400).json({
        success: false,
        error: "Vendor is not linked to a store"
      });
    }

    const variantCheck = await pool.query(
      `SELECT pv.id
       FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       WHERE pv.id = $1 AND p.vendor_id::text = ANY($2::text[])
       LIMIT 1`,
      [variantId, ownerIds]
    );

    if (variantCheck.rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: "Variant not found for this vendor"
      });
    }

    const storeCheck = await pool.query(
      `SELECT id FROM dark_stores WHERE id = $1 LIMIT 1`,
      [storeId]
    );

    if (storeCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Dark store not found"
      });
    }

    const existingInv = await pool.query(
      `SELECT id
       FROM inventory
       WHERE variant_id = $1 AND store_id = $2
       LIMIT 1`,
      [variantId, storeId]
    );

    if (existingInv.rows.length > 0) {
      await pool.query(
        `UPDATE inventory
         SET stock = $1
         WHERE id = $2`,
        [Math.trunc(safeQty), existingInv.rows[0].id]
      );
    } else {
      await pool.query(
        `INSERT INTO inventory (variant_id, stock, store_id)
         VALUES ($1, $2, $3)`,
        [variantId, Math.trunc(safeQty), storeId]
      );
    }

    return res.json({
      success: true,
      message: "Stock updated",
      variantId,
      storeId,
      quantity: Math.trunc(safeQty)
    });
  } catch (err) {
    console.error("Vendor stock update error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// Link/unlink vendor to a specific dark store
router.patch("/:id/store", async (req, res) => {
  try {
    const { id: vendorId } = req.params;
    const { dark_store_id } = req.body || {};

    if (dark_store_id) {
      const storeCheck = await pool.query(
        `SELECT id FROM dark_stores WHERE id = $1 LIMIT 1`,
        [dark_store_id]
      );
      if (storeCheck.rows.length === 0) {
        return res.status(404).json({
          success: false,
          error: "Dark store not found"
        });
      }
    }

    const { rows } = await pool.query(
      `UPDATE vendors
       SET dark_store_id = $1,
           updated_at = NOW()
       WHERE id = $2
       RETURNING id, dark_store_id`,
      [dark_store_id || null, vendorId]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }

    return res.json({ success: true, vendor: rows[0] });
  } catch (err) {
    console.error("Vendor store link update error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { email } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    let userResult = await pool.query(
      "SELECT * FROM users WHERE lower(email) = $1 LIMIT 1",
      [normalizedEmail]
    );

    if (userResult.rows.length === 0) {
      const vendorLookup = await pool.query(
        `SELECT id, owner_name, phone, email, user_id
         FROM vendors
         WHERE lower(email) = $1
         LIMIT 1`,
        [normalizedEmail]
      );

      if (vendorLookup.rows.length > 0) {
        const vendor = vendorLookup.rows[0];
        const linkedUser = await pool.query(
          `INSERT INTO users (name, phone, email, role, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, 'vendor', false, NOW(), NOW())
           ON CONFLICT (email) DO UPDATE
             SET role = 'vendor',
                 updated_at = NOW()
           RETURNING *`,
          [vendor.owner_name || vendor.email, vendor.phone || null, vendor.email]
        );

        const user = linkedUser.rows[0];
        await pool.query(
          `UPDATE vendors SET user_id = $1, updated_at = NOW() WHERE id = $2`,
          [user.id, vendor.id]
        ).catch(() => {});

        userResult = { rows: [user] };
      }
    }

    if (userResult.rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const user = userResult.rows[0];

    if (user.role !== "vendor") {
      return res.json({
        success: false,
        message: "Not a vendor"
      });
    }

    const vendorResult = await pool.query(
      "SELECT id FROM vendors WHERE user_id = $1 OR lower(email) = $2 LIMIT 1",
      [user.id, normalizedEmail]
    );

    if (vendorResult.rows.length === 0) {
      return res.json({
        success: false,
        message: "Vendor profile not found"
      });
    }

    const vendor_id = vendorResult.rows[0].id;

    res.json({
      success: true,
      vendor_id
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

router.post("/login-password", async (req, res) => {
  try {
    const { email, password } = req.body;
    const normalizedEmail = String(email || "").trim().toLowerCase();

    if (!normalizedEmail || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required"
      });
    }

    const vendorResult = await pool.query(
      `SELECT id, user_id, email, password_hash, store_name, slug, dark_store_id
       FROM vendors
       WHERE lower(email) = $1
       LIMIT 1`,
      [normalizedEmail]
    );

    if (vendorResult.rows.length === 0) {
      return res.json({
        success: false,
        message: "Vendor not found"
      });
    }

    const vendor = vendorResult.rows[0];
    let resolvedUserId = vendor.user_id;

    if (!vendor.password_hash || !verifyPasswordHash(String(password), vendor.password_hash)) {
      return res.json({
        success: false,
        message: "Incorrect password"
      });
    }

    if (!vendor.user_id) {
      const userResult = await pool.query(
        `INSERT INTO users (name, email, role, is_active, created_at, updated_at)
         VALUES ($1, $2, 'vendor', true, NOW(), NOW())
         ON CONFLICT (email) DO UPDATE
           SET role = 'vendor',
               updated_at = NOW()
         RETURNING id`,
        [vendor.store_name || vendor.email, vendor.email]
      );

      resolvedUserId = userResult.rows[0].id;

      await pool.query(
        `UPDATE vendors SET user_id = $1, updated_at = NOW() WHERE id = $2`,
        [resolvedUserId, vendor.id]
      ).catch(() => {});
    }

    return res.json({
      success: true,
      vendor_id: vendor.id,
      user_id: resolvedUserId,
      dark_store_id: vendor.dark_store_id,
      store_name: vendor.store_name,
      owner_name: vendor.owner_name,
      message: "Login successful"
    });
  } catch (err) {
    console.error("Vendor password login error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to login vendor"
    });
  }
});

router.post(
  "/register",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "panDoc", maxCount: 1 },
    { name: "gstDoc", maxCount: 1 },
    { name: "bankProof", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        business_name,
        owner_name,
        email,
        phone,
        password,
        business_type,
        category,
        gst_number,
        pan_number,
        years_in_business,
        store_name,
        dark_store_id,
        description,
        address,
        city,
        state,
        pincode,
        lat,
        lng,
        account_holder_name,
        account_number,
        ifsc_code,
        bank_name
      } = req.body;

      if (!business_name || !owner_name || !email || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: "Missing required basic vendor fields"
        });
      }

      if (!store_name || !address || !city || !state || !pincode) {
        return res.status(400).json({
          success: false,
          message: "Store address details are required"
        });
      }

      const latitude = Number(lat);
      const longitude = Number(lng);
      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        return res.status(400).json({
          success: false,
          message: "Store latitude and longitude are required"
        });
      }
      if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
        return res.status(400).json({
          success: false,
          message: "Invalid latitude/longitude range"
        });
      }

      if (!account_holder_name || !account_number || !ifsc_code || !bank_name) {
        return res.status(400).json({
          success: false,
          message: "Bank details are required"
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const client = await pool.connect();

      try {
        await client.query("BEGIN");

        const existingVendor = await client.query(
          "SELECT id, user_id FROM vendors WHERE lower(email) = $1 LIMIT 1",
          [normalizedEmail]
        );

        if (existingVendor.rows.length > 0) {
          await client.query("ROLLBACK");
          return res.status(409).json({
            success: false,
            message: "Vendor with this email already exists"
          });
        }

        const existingUser = await client.query(
          `SELECT id, role
           FROM users
           WHERE lower(COALESCE(email, '')) = $1
           ORDER BY created_at ASC NULLS LAST, id ASC
           LIMIT 1`,
          [normalizedEmail]
        );

        let linkedUserId = null;
        if (existingUser.rows.length > 0) {
          const user = existingUser.rows[0];
          const role = String(user.role || "").toLowerCase();
          if (role && role !== "vendor") {
            await client.query("ROLLBACK");
            return res.status(409).json({
              success: false,
              message: "Email is already used by a non-vendor account"
            });
          }

          linkedUserId = user.id;
          await client.query(
            `UPDATE users
             SET role = 'vendor',
                 is_active = false,
                 name = COALESCE(NULLIF(name, ''), $2),
                 phone = COALESCE(NULLIF(phone, ''), $3),
                 updated_at = NOW()
             WHERE id = $1`,
            [linkedUserId, owner_name, phone]
          );
        } else {
          const createUserResult = await client.query(
            `INSERT INTO users (name, phone, email, role, is_active, created_at, updated_at)
             VALUES ($1, $2, $3, 'vendor', false, NOW(), NOW())
             RETURNING id`,
            [owner_name, phone, normalizedEmail]
          );
          linkedUserId = createUserResult.rows[0].id;
        }

        const slug = buildSlug(store_name || business_name);

        let linkedDarkStoreId = null;
        if (dark_store_id) {
          const storeLookup = await client.query(
            `SELECT id FROM dark_stores WHERE id = $1 LIMIT 1`,
            [dark_store_id]
          );
          if (!storeLookup.rows.length) {
            await client.query("ROLLBACK");
            return res.status(400).json({
              success: false,
              message: "Invalid dark_store_id"
            });
          }
          linkedDarkStoreId = dark_store_id;
        }

        const logoFile = req.files?.logo?.[0];
        const panDocFile = req.files?.panDoc?.[0];
        const gstDocFile = req.files?.gstDoc?.[0];
        const bankProofFile = req.files?.bankProof?.[0];

        let logoUrl = null;
        let panDocUrl = null;
        let gstDocUrl = null;
        let bankProofUrl = null;
        let uploadWarning = "";

        try {
          [logoUrl, panDocUrl, gstDocUrl, bankProofUrl] = await Promise.all([
            uploadFileToCloudinary(logoFile, "blinkiefash/vendors/logo"),
            uploadFileToCloudinary(panDocFile, "blinkiefash/vendors/pan"),
            uploadFileToCloudinary(gstDocFile, "blinkiefash/vendors/gst"),
            uploadFileToCloudinary(bankProofFile, "blinkiefash/vendors/bank-proof")
          ]);
        } catch (uploadErr) {
          console.error("Vendor document upload failed:", uploadErr);

          if (process.env.NODE_ENV === "production") {
            await client.query("ROLLBACK");
            return res.status(502).json({
              success: false,
              message: "Vendor documents upload failed"
            });
          }

          uploadWarning =
            "Vendor registered, but document upload was skipped in local environment.";
        }

        const passwordHash = createPasswordHash(password);

        const insertResult = await client.query(
          `INSERT INTO vendors (
            user_id,
            business_name,
            owner_name,
            email,
            phone,
            password_hash,
            business_type,
            category,
            gst_number,
            pan_number,
            years_in_business,
            store_name,
            dark_store_id,
            slug,
            description,
            logo_url,
            vendor_img_url,
            address,
            city,
            state,
            pincode,
            lat,
            lng,
            account_holder_name,
            account_number,
            ifsc_code,
            bank_name,
            pan_doc_url,
            gst_doc_url,
            bank_proof_url,
            status,
            is_verified,
            is_active,
            is_approved,
            is_operational,
            created_at,
            updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15,
            $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25,
            $26, $27, $28, $29, $30, 'pending', false, false, false, true, NOW(), NOW()
          )
          RETURNING id, user_id, email, store_name, slug, status, created_at`,
          [
            linkedUserId,
            business_name,
            owner_name,
            normalizedEmail,
            phone,
            passwordHash,
            business_type || null,
            category || null,
            gst_number || null,
            pan_number || null,
            years_in_business ? Number(years_in_business) : null,
            store_name,
            linkedDarkStoreId,
            slug,
            description || null,
            logoUrl,
            logoUrl,
            address,
            city,
            state,
            pincode,
            latitude,
            longitude,
            account_holder_name,
            account_number,
            ifsc_code,
            bank_name,
            panDocUrl,
            gstDocUrl,
            bankProofUrl
          ]
        );

        await client.query("COMMIT");

        return res.status(201).json({
          success: true,
          message: "Vendor registration submitted for review",
          warning: uploadWarning || undefined,
          vendor: insertResult.rows[0]
        });
      } catch (innerErr) {
        await client.query("ROLLBACK");
        throw innerErr;
      } finally {
        client.release();
      }
    } catch (err) {
      console.error("Vendor register error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to register vendor"
      });
    }
  }
);

// PATCH /vendor/:vendorId/variants/:variantId/stock
router.patch("/:vendorId/variants/:variantId/stock", async (req, res) => {
  try {
    const { vendorId, variantId } = req.params;
    const { stock, store_id } = req.body || {};
    if (stock === undefined || stock === null) return res.status(400).json({ success: false, message: "stock is required" });

    // Verify the variant belongs to this vendor
    const check = await pool.query(
      `SELECT pv.id FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       JOIN vendors v ON v.id::text = p.vendor_id::text
       WHERE pv.id = $1 AND v.id::text = $2 LIMIT 1`,
      [variantId, vendorId]
    );
    if (!check.rows.length) return res.status(403).json({ success: false, message: "Not authorised" });

    await pool.query(
      `UPDATE inventory SET stock = $2 WHERE variant_id = $1`,
      [variantId, Number(stock)]
    );
    // Insert only if no inventory row exists yet
    await pool.query(
      `INSERT INTO inventory (variant_id, stock, store_id)
       SELECT $1, $2, $3 WHERE NOT EXISTS (SELECT 1 FROM inventory WHERE variant_id = $1)`,
      [variantId, Number(stock), store_id || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("[patch stock]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// POST /vendor/:vendorId/products/:productId/variants
router.post("/:vendorId/products/:productId/variants", async (req, res) => {
  const client = await pool.connect();
  try {
    const { vendorId, productId } = req.params;
    const { size, color, price, mrp, barcode, quantity, store_id } = req.body || {};
    if (!size || !color) return res.status(400).json({ success: false, message: "size and color are required" });

    const check = await pool.query(
      `SELECT p.id FROM products p JOIN vendors v ON v.id::text = p.vendor_id::text
       WHERE p.id = $1 AND v.id::text = $2 LIMIT 1`,
      [productId, vendorId]
    );
    if (!check.rows.length) return res.status(403).json({ success: false, message: "Not authorised" });

    await client.query("BEGIN");
    const sku = `${productId}-${color}-${size}`.replace(/\s+/g, "-").toUpperCase();
    const variantRes = await client.query(
      `INSERT INTO product_variants (product_id, sku, size, color, barcode, price, mrp)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [productId, sku, size, color, barcode || null, Number(price || 0), Number(mrp || price || 0)]
    );
    await client.query(
      `INSERT INTO inventory (variant_id, stock, store_id) VALUES ($1, $2, $3)`,
      [variantRes.rows[0].id, Number(quantity || 0), store_id || null]
    );
    await client.query("COMMIT");
    res.json({ success: true, variant_id: variantRes.rows[0].id });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[add variant]", err.message);
    res.status(500).json({ success: false, message: err.message });
  } finally {
    client.release();
  }
});

// DELETE /vendor/:vendorId/variants/:variantId
router.delete("/:vendorId/variants/:variantId", async (req, res) => {
  try {
    const { vendorId, variantId } = req.params;
    const check = await pool.query(
      `SELECT pv.id FROM product_variants pv
       JOIN products p ON p.id = pv.product_id
       JOIN vendors v ON v.id::text = p.vendor_id::text
       WHERE pv.id = $1 AND v.id::text = $2 LIMIT 1`,
      [variantId, vendorId]
    );
    if (!check.rows.length) return res.status(403).json({ success: false, message: "Not authorised" });
    await pool.query(`UPDATE product_variants SET is_active = false WHERE id = $1`, [variantId]);
    res.json({ success: true });
  } catch (err) {
    console.error("[delete variant]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;