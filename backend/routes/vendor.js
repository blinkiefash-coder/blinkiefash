import express from "express";
import multer from "multer";
import crypto from "crypto";
import * as XLSX from "xlsx";
import { pool } from "../db.js";
import cloudinary from "../utils/cloudinary.js";
import { insertProductMediaRows, getProductMediaShape } from "./products.js";
import {
  notifyAvailableRiders,
  notifyCustomerOfStatus,
  notifyVendorOfNewOrder,
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

    // Note: We don't require dark_store_id to exist — products can exist without it
    // dark_store_id is only used for inventory-specific features
    
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
    // Also pull sibling vendor IDs (same user_id) so orders from linked stores are visible.
    const siblingVendors = vendorUserId
      ? await pool.query(`SELECT id FROM vendors WHERE user_id = $1`, [vendorUserId])
      : { rows: [] };
    const ownerIds = [
      id,
      vendorUserId,
      ...siblingVendors.rows.map((r) => String(r.id)),
    ].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i);
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
         d.store_pickup_otp,
         d.store_pickup_verified_at,
         o.created_at,
         u.name AS customer_name,
         u.phone AS customer_phone,
         json_agg(json_build_object(
           'product_id', p.id,
           'variant_id', oi.variant_id,
           'quantity', oi.quantity,
           'price', CASE 
             WHEN LOWER(COALESCE(b.name, p.name)) LIKE '%crimsoune%' THEN (oi.price * 0.9)::DECIMAL
             WHEN LOWER(COALESCE(b.name, p.name)) LIKE '%puma%' THEN (oi.price * 0.93)::DECIMAL
             ELSE oi.price
           END,
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
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN deliveries d ON d.order_id = o.id
       WHERE p.vendor_id::text = ANY($1::text[])
       GROUP BY o.id, u.name, u.phone, d.store_pickup_otp, d.store_pickup_verified_at
       ORDER BY o.created_at DESC`,
      [ownerIds]
    );
    
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET vendor invoice/packing-slip for a single order — vendor's own items only,
// no delivery/platform/handling fees (those aren't the vendor's revenue).
router.get("/:id/orders/:orderId/invoice", async (req, res) => {
  try {
    const { id: vendorId, orderId } = req.params;

    const vendorStore = await pool.query(
      `SELECT dark_store_id, user_id, store_name FROM vendors WHERE id = $1 LIMIT 1`,
      [vendorId]
    );
    const linkedStoreId = vendorStore.rows[0]?.dark_store_id || null;
    const vendorUserId = vendorStore.rows[0]?.user_id || null;
    const storeName = vendorStore.rows[0]?.store_name || "Store";
    const ownerIds = [vendorId, vendorUserId].filter(Boolean).map(String);
    if (!linkedStoreId) return res.status(404).send("Vendor is not linked to a store");

    const { rows: orderRows } = await pool.query(
      `SELECT o.id, o.created_at, o.status,
              u.name AS customer_name, u.phone AS customer_phone,
              a.address_line, a.city, a.pincode
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN addresses a ON a.id = o.address_id
       WHERE o.id = $1
       LIMIT 1`,
      [orderId]
    );
    if (!orderRows.length) return res.status(404).send("Order not found");
    const order = orderRows[0];

    const { rows: items } = await pool.query(
      `SELECT oi.quantity, oi.price, p.name AS product_name, v.size, v.color, v.barcode, b.name AS brand_name
       FROM order_items oi
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       LEFT JOIN brands b ON b.id = p.brand_id
       WHERE oi.order_id = $1 AND p.vendor_id::text = ANY($2::text[])`,
      [orderId, ownerIds]
    );
    if (!items.length) return res.status(404).send("No items found for this vendor on this order");

    // Calculate vendor price based on brand discount
    const calculateVendorPrice = (price, brandName, productName) => {
      const name = (brandName || productName || "").toLowerCase();
      if (name.includes("crimsoune")) return price * 0.9;
      if (name.includes("puma")) return price * 0.93;
      return price;
    };

    const shortId = orderId.toString().slice(-8).toUpperCase();
    const date = new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });
    
    let subtotal = 0;
    const itemRows = items.map(it => {
      const vendorPrice = calculateVendorPrice(parseFloat(it.price), it.brand_name, it.product_name);
      const lineTotal = vendorPrice * it.quantity;
      subtotal += lineTotal;
      return `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0">${it.product_name}
          ${it.size ? `<br/><span style="color:#6b7280;font-size:12px">Size: ${it.size}</span>` : ""}
          ${it.color ? `<span style="color:#6b7280;font-size:12px"> | Color: ${it.color}</span>` : ""}
        </td>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:center;font-family:monospace">${it.barcode || "—"}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:center">${it.quantity}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right">₹${vendorPrice.toFixed(0)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right">₹${lineTotal.toFixed(0)}</td>
      </tr>`;
    }).join("");

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Invoice #${shortId}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:20px;background:#f8fafc;color:#0f172a}
  .invoice{max-width:680px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #16a34a;padding-bottom:20px;margin-bottom:24px}
  .brand{color:#16a34a;font-size:28px;font-weight:900;letter-spacing:-1px}
  .brand span{color:#0f172a}
  .invoice-meta{text-align:right;font-size:13px;color:#6b7280}
  .invoice-meta strong{display:block;font-size:16px;color:#0f172a;margin-bottom:4px}
  .info-grid{display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:24px}
  .info-box h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.8px;color:#9ca3af}
  .info-box p{margin:3px 0;font-size:14px}
  table{width:100%;border-collapse:collapse;font-size:14px;margin-bottom:20px}
  thead{background:#f0fdf4}
  thead th{padding:10px 6px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#16a34a}
  .totals{margin-left:auto;width:260px;font-size:14px}
  .totals tr td{padding:5px 6px}
  .totals tr td:last-child{text-align:right}
  .totals .grand{font-size:16px;font-weight:800;border-top:2px solid #0f172a;padding-top:8px!important}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#dcfce7;color:#16a34a}
  .footer{margin-top:24px;padding-top:16px;border-top:1px solid #f0f0f0;font-size:12px;color:#9ca3af;text-align:center}
  @media print{body{background:#fff}.invoice{box-shadow:none}}
</style></head><body>
<div class="invoice">
  <div class="header">
    <div>
      <div class="brand">Blinkie<span>Fash</span></div>
      <div style="font-size:13px;color:#6b7280;margin-top:2px;font-weight:600">${storeName}</div>
    </div>
    <div class="invoice-meta">
      <strong>PACKING SLIP / INVOICE</strong>
      Order #${shortId}<br/>${date}<br/>
      <span class="badge">${(order.status || "").toUpperCase()}</span>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <h4>Deliver To</h4>
      <p><strong>${order.customer_name || "Customer"}</strong></p>
      <p>${order.customer_phone || ""}</p>
      <p>${order.address_line || ""}</p>
      <p>${order.city || ""}${order.pincode ? " - " + order.pincode : ""}</p>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Item</th><th style="text-align:center">Barcode</th>
      <th style="text-align:center">Qty</th>
      <th style="text-align:right">Unit Price</th>
      <th style="text-align:right">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table class="totals">
    <tr class="grand"><td>Your Items Subtotal</td><td>₹${subtotal.toFixed(0)}</td></tr>
  </table>
  <div class="footer">
    This is your product subtotal only — delivery, platform and handling fees are not included.<br/>
    Powered by BlinkieFash
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Vendor invoice error:", err);
    res.status(500).send("Could not generate invoice");
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
    const siblingVendors = vendorUserId
      ? await pool.query(`SELECT id FROM vendors WHERE user_id = $1`, [vendorUserId])
      : { rows: [] };
    const ownerIds = [
      vendorId,
      vendorUserId,
      ...siblingVendors.rows.map((r) => String(r.id)),
    ].filter(Boolean).map(String).filter((v, i, a) => a.indexOf(v) === i);
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

    const offerResult = await pool.query(
      `SELECT id, status
       FROM order_vendor_offers
       WHERE order_id = $1 AND vendor_id = $2
       LIMIT 1`,
      [orderId, vendorId]
    ).catch(() => ({ rows: [] }));
    const activeOffer = offerResult.rows[0];
    if (activeOffer && activeOffer.status !== "offered") {
      return res.status(409).json({
        success: false,
        error: "This order is no longer awaiting a response from this vendor",
      });
    }

    if (normalizedStatus === "cancelled" && activeOffer) {
      await pool.query(
        `UPDATE order_vendor_offers
         SET status = 'rejected', responded_at = NOW()
         WHERE id = $1 AND status = 'offered'`,
        [activeOffer.id]
      );
      const nextOffer = await pool.query(
        `UPDATE order_vendor_offers
         SET status = 'offered', offered_at = NOW()
         WHERE id = (
           SELECT id FROM order_vendor_offers
           WHERE order_id = $1 AND status = 'queued'
           ORDER BY distance_km NULLS LAST, created_at ASC
           LIMIT 1
         )
         RETURNING vendor_id`,
        [orderId]
      );
      if (nextOffer.rows.length) {
        await pool.query(
          `UPDATE orders
           SET status = 'placed', assigned_vendor_id = $1,
               vendor_confirmation_deadline = NOW() + INTERVAL '5 minutes'
           WHERE id = $2`,
          [nextOffer.rows[0].vendor_id, orderId]
        );
        notifyVendorOfNewOrder(pool, orderId).catch(() => {});
        notifyCustomerOfStatus(pool, orderId, 'placed').catch(() => {});
        return res.json({
          success: true,
          order: { id: orderId, status: 'placed' },
          nextVendorId: nextOffer.rows[0].vendor_id,
        });
      }
    }

    if (normalizedStatus === "confirmed" && activeOffer) {
      await pool.query(
        `UPDATE order_vendor_offers
         SET status = 'accepted', responded_at = NOW()
         WHERE id = $1 AND status = 'offered'`,
        [activeOffer.id]
      );
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
      `SELECT id, user_id, email, password_hash, store_name, owner_name, slug, dark_store_id
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
    const { stock, store_id, price, mrp, size, color, barcode } = req.body || {};
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

    if (price !== undefined && price !== null) {
      const nextPrice = Number(price);
      if (!Number.isFinite(nextPrice) || nextPrice < 0) return res.status(400).json({ success: false, message: "price must be a non-negative number" });
      await pool.query(`UPDATE product_variants SET price = $2 WHERE id = $1`, [variantId, nextPrice]);
    }

    if (mrp !== undefined && mrp !== null) {
      const nextMrp = Number(mrp);
      if (!Number.isFinite(nextMrp) || nextMrp < 0) return res.status(400).json({ success: false, message: "mrp must be a non-negative number" });
      await pool.query(`UPDATE product_variants SET mrp = $2 WHERE id = $1`, [variantId, nextMrp]);
    }

    // Update size, color, barcode + regenerate SKU atomically to avoid unique constraint violation
    if ((size && String(size).trim()) || (color && String(color).trim()) || barcode !== undefined) {
      const pv = await pool.query(`SELECT product_id, size, color, barcode FROM product_variants WHERE id = $1`, [variantId]);
      if (pv.rows.length) {
        const { product_id, size: curSize, color: curColor, barcode: curBarcode } = pv.rows[0];
        const newSize = (size && String(size).trim()) ? String(size).trim() : curSize;
        const newColor = (color && String(color).trim()) ? String(color).trim() : curColor;
        const newBarcode = barcode !== undefined ? (barcode ? String(barcode).trim() : null) : curBarcode;
        
        if (!newBarcode) {
          return res.status(400).json({ success: false, message: "Barcode is required for the variant" });
        }
        
        // SKU format: barcode_size_color (e.g., 30823504_UK_11_WHITE)
        const newSku = `${newBarcode}_${newSize}_${newColor}`.replace(/\s+/g, "_").toUpperCase();
        
        // Check if the new SKU already exists (for a different variant)
        const existingSKU = await pool.query(
          `SELECT id FROM product_variants WHERE product_id = $1 AND sku = $2 AND id != $3 LIMIT 1`,
          [product_id, newSku, variantId]
        );
        if (existingSKU.rows.length > 0) {
          return res.status(400).json({ success: false, message: `Variant with barcode '${newBarcode}' already exists.` });
        }
        
        const sets = ['size = $2', 'color = $3', 'sku = $4', 'barcode = $5'];
        const vals = [variantId, newSize, newColor, newSku, newBarcode];
        await pool.query(`UPDATE product_variants SET ${sets.join(', ')} WHERE id = $1`, vals);
      }
    }

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
    const { size, color, price, mrp, barcode, quantity, store_id, images } = req.body || {};
    console.log("[POST variant] Request:", { vendorId, productId, size, color, price, mrp, barcode, quantity, store_id });
    if (!size || !color) return res.status(400).json({ success: false, message: "size and color are required" });

    const check = await pool.query(
      `SELECT p.id FROM products p JOIN vendors v ON v.id::text = p.vendor_id::text
       WHERE p.id = $1 AND v.id::text = $2 LIMIT 1`,
      [productId, vendorId]
    );
    if (!check.rows.length) return res.status(403).json({ success: false, message: "Not authorised" });

    await client.query("BEGIN");
    // SKU format: barcode_size_color (e.g., 30823504_UK_11_WHITE)
    const trimmedBarcode = barcode ? String(barcode).trim() : "";
    const trimmedSize = size ? String(size).trim() : "";
    const trimmedColor = color ? String(color).trim() : "";
    
    if (!trimmedBarcode) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Barcode is required to create a variant" });
    }
    if (!trimmedSize || !trimmedColor) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Size and Color are required" });
    }
    
    const sku = `${trimmedBarcode}_${trimmedSize}_${trimmedColor}`.replace(/\s+/g, "_").toUpperCase();
    console.log(`[POST variant] SKU generated: ${sku} (barcode: ${trimmedBarcode}, size: ${trimmedSize}, color: ${trimmedColor})`);
    
    // Check if this barcode+size+color combination already exists
    const existingSKU = await client.query(
      `SELECT id FROM product_variants WHERE product_id = $1 AND sku = $2 LIMIT 1`,
      [productId, sku]
    );
    if (existingSKU.rows.length > 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: `This variant (Barcode: ${trimmedBarcode}, Size: ${trimmedSize}, Color: ${trimmedColor}) already exists. Use a different barcode.` });
    }
    
    const variantRes = await client.query(
      `INSERT INTO product_variants (product_id, sku, size, color, barcode, price, mrp)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [productId, sku, trimmedSize, trimmedColor, trimmedBarcode, Number(price || 0), Number(mrp || price || 0)]
    );
    const newVariantId = variantRes.rows[0].id;
    await client.query(
      `INSERT INTO inventory (variant_id, stock, store_id) VALUES ($1, $2, $3)`,
      [newVariantId, Number(quantity || 0), store_id || null]
    );
    const imageUrls = Array.isArray(images) ? images.filter(Boolean) : [];
    if (imageUrls.length > 0) {
      const mediaShape = await getProductMediaShape(client);
      const primaryRef = { value: false };
      await insertProductMediaRows({
        client, productId, variantId: newVariantId,
        imageUrls, startOrder: 0, mediaShape,
        primaryAssignedRef: primaryRef, resetPrimaryState: true,
      });
    }
    await client.query("COMMIT");
    res.json({ success: true, variant_id: newVariantId });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("[add variant] Error:", err.message, "Code:", err.code);
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

// DOWNLOAD inventory as Excel
// GET /vendor/:id/inventory/download
router.get("/:id/inventory/download", async (req, res) => {
  try {
    const { id: vendorId } = req.params;

    // Get vendor and store info
    const vendorResult = await pool.query(
      `SELECT id, store_name, dark_store_id FROM vendors WHERE id::text = $1 LIMIT 1`,
      [String(vendorId)]
    );

    if (vendorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }

    const vendor = vendorResult.rows[0];
    const storeId = vendor.dark_store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: "Vendor not linked to a store" });
    }

    // Get all products and variants for this vendor
    const productsResult = await pool.query(
      `SELECT 
        p.id as product_id,
        p.name as product_name,
        p.sku,
        p.price,
        b.name as brand_name,
        c.name as category_name,
        pv.id as variant_id,
        pv.size,
        pv.color,
        pv.barcode,
        COALESCE(i.stock, 0) as quantity
      FROM products p
      LEFT JOIN brands b ON p.brand_id = b.id
      LEFT JOIN categories c ON p.category_id = c.id
      LEFT JOIN product_variants pv ON p.id = pv.product_id AND pv.is_active = true
      LEFT JOIN inventory i ON pv.id = i.variant_id AND i.store_id = $1
      WHERE p.vendor_id::text = $2 AND p.is_active = true
      ORDER BY p.id, pv.id`,
      [storeId, String(vendorId)]
    );

    // Format data for Excel
    const rows = [
      ["Variant ID", "Product ID", "Product Name", "SKU", "Brand", "Category", "Price (₹)", "Size", "Color", "Barcode", "Current Quantity"],
    ];

    const seenProducts = new Set();
    productsResult.rows.forEach((row) => {
      rows.push([
        row.variant_id || "", // Variant ID - PRIMARY IDENTIFIER
        row.product_id || "", // Product ID - SECONDARY IDENTIFIER
        row.product_name || "",
        row.sku || "",
        row.brand_name || "",
        row.category_name || "",
        row.price || "",
        row.size || "",
        row.color || "",
        row.barcode || "",
        row.quantity || 0,
      ]);
    });

    // Create Excel workbook
    const ws = XLSX.utils.aoa_to_sheet(rows);
    
    // Format header row
    const range = XLSX.utils.decode_range(ws["!ref"]);
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) cell.s = { font: { bold: true, color: { rgb: "FFFFFF" } }, fill: { fgColor: { rgb: "366092" } } };
    }

    // Set column widths - Variant ID and Product ID prominent at start
    ws["!cols"] = [
      { wch: 14 }, // Variant ID (PRIMARY)
      { wch: 12 }, // Product ID (SECONDARY)
      { wch: 30 }, // Product Name
      { wch: 15 }, // SKU
      { wch: 15 }, // Brand
      { wch: 15 }, // Category
      { wch: 12 }, // Price
      { wch: 10 }, // Size
      { wch: 12 }, // Color
      { wch: 16 }, // Barcode
      { wch: 16 }, // Current Quantity
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Inventory");

    // Generate Excel file
    const buffer = XLSX.write(wb, { bookType: "xlsx", type: "buffer" });

    res.setHeader("Content-Disposition", `attachment; filename=inventory_${vendor.store_name.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 10)}.xlsx`);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.send(buffer);
  } catch (err) {
    console.error("Inventory download error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

// UPLOAD inventory Excel and update stock
// POST /vendor/:id/inventory/upload
router.post("/:id/inventory/upload", upload.single("file"), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id: vendorId } = req.params;

    if (!req.file) {
      return res.status(400).json({ success: false, error: "No file uploaded" });
    }

    // Verify vendor exists
    const vendorResult = await pool.query(
      `SELECT id, store_name, dark_store_id FROM vendors WHERE id::text = $1 LIMIT 1`,
      [String(vendorId)]
    );

    if (vendorResult.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Vendor not found" });
    }

    const vendor = vendorResult.rows[0];
    const storeId = vendor.dark_store_id;

    if (!storeId) {
      return res.status(400).json({ success: false, error: "Vendor not linked to a store" });
    }

    // Parse Excel file
    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

    if (!data || data.length < 2) {
      return res.status(400).json({ success: false, error: "Excel file is empty or invalid" });
    }

    // Parse header row (skip first row which is headers)
    const updates = [];
    let errors = [];

    await client.query("BEGIN");

    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length === 0) continue;

      // Column order: Variant ID | Product ID | Product Name | SKU | Brand | Category | Price | Size | Color | Barcode | Current Quantity
      const variantId = row[0] || "";
      const productId = row[1] || "";
      const productName = row[2] || "";
      const sku = row[3] || "";
      const barcode = row[9] || "";
      const newQuantity = Number(row[10]) || 0;

      // REQUIRE Variant ID as primary identifier (avoids duplicate barcode issues)
      if (!variantId || variantId === "") {
        errors.push(`Row ${i + 1}: Missing Variant ID (required for uniquely identifying product variant)`);
        continue;
      }

      try {
        // Use Variant ID as PRIMARY identifier (unique, no duplicates)
        const variantQuery = `
          SELECT pv.id FROM product_variants pv
          JOIN products p ON p.id = pv.product_id
          WHERE pv.id = $1 AND p.vendor_id::text = $2 AND p.is_active = true
          LIMIT 1
        `;
        const variantParams = [variantId, String(vendorId)];

        const variantResult = await client.query(variantQuery, variantParams);

        if (variantResult.rows.length === 0) {
          errors.push(`Row ${i + 1}: Variant ID ${variantId} not found for this vendor`);
          continue;
        }

        const foundVariantId = variantResult.rows[0].id;

        // Check if inventory record exists
        const invQuery = await client.query(
          `SELECT id FROM inventory WHERE variant_id = $1 AND store_id = $2 LIMIT 1`,
          [foundVariantId, storeId]
        );

        if (invQuery.rows.length > 0) {
          // Update existing
          await client.query(
            `UPDATE inventory SET stock = $1 WHERE variant_id = $2 AND store_id = $3`,
            [Math.trunc(newQuantity), foundVariantId, storeId]
          );
        } else {
          // Insert new
          await client.query(
            `INSERT INTO inventory (variant_id, stock, store_id) VALUES ($1, $2, $3)`,
            [foundVariantId, Math.trunc(newQuantity), storeId]
          );
        }

        updates.push({
          product: productName,
          barcode: barcode || sku,
          quantity: Math.trunc(newQuantity),
        });
      } catch (err) {
        errors.push(`Row ${i + 1}: Database error - ${err.message}`);
        console.error(`Row ${i + 1} error:`, err);
      }
    }

    await client.query("COMMIT");

    res.json({
      success: true,
      message: `Updated ${updates.length} variants`,
      updated: updates,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Inventory upload error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  } finally {
    client.release();
  }
});

export default router;