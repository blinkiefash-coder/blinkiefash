import express from "express";
import { pool } from "../db.js";
import {
  notifyAvailableRiders,
  notifyCustomerOfStatus,
} from "../utils/firebaseAdmin.js";
import { getOrCreateInvoiceNumber, calculateVendorPrice } from "../utils/invoiceNumbers.js";

const router = express.Router();

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

// ── Super-admin credentials (override via env vars) ───────────────────────
const ADMIN_EMAIL   = process.env.ADMIN_EMAIL    || "superadminsatyam@blinkiefash.in";
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "Satyam";

// ── POST /api/admin/login  Body: { email, password } ─────────────────────────
router.post("/login", async (req, res) => {
  const { email = "", password = "" } = req.body || {};
  const normalizedEmail = String(email).trim().toLowerCase();
  const normalizedPassword = String(password);

  if (
    normalizedEmail === ADMIN_EMAIL.toLowerCase() &&
    normalizedPassword === ADMIN_PASSWORD
  ) {
    try {
      const existingUser = await pool.query(
        `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
        [normalizedEmail]
      );

      let userId = existingUser.rows[0]?.id;

      if (!userId) {
        const insertedUser = await pool.query(
          `INSERT INTO users (name, phone, email, role, is_active, created_at, updated_at)
           VALUES ($1, $2, $3, $4, true, NOW(), NOW())
           RETURNING id`,
          ["SatyXAlka Admin", "0000000000", normalizedEmail, "admin"]
        );
        userId = insertedUser.rows[0]?.id;
      } else {
        await pool.query(
          `UPDATE users
           SET name = COALESCE(name, $1), role = $2, is_active = true, updated_at = NOW()
           WHERE id = $3`,
          ["SatyXAlka Admin", "admin", userId]
        );
      }

      return res.json({
        success: true,
        is_admin: true,
        admin_name: "SatyXAlka Admin",
        admin_email: ADMIN_EMAIL,
        user_id: userId,
      });
    } catch (error) {
      console.error("[admin/login] error:", error.message);
      return res.status(500).json({
        success: false,
        message: "Unable to create admin user session",
      });
    }
  }

  return res.status(401).json({ success: false, message: "Invalid admin credentials" });
});

// Simple guard — checks the request carries the admin email header set by the frontend
// (or a query param, for plain-link opens like window.open() that can't set headers).
// This is a lightweight guard for internal dashboards only.
function adminGuard(req, res, next) {
  const adminEmail = req.headers["x-admin-email"] || req.query.admin_email || "";
  if (String(adminEmail).toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

// ── GET /api/admin/orders ─────────────────────────────────────────────────────
// All orders across all vendors, with optional ?status=placed&limit=100
router.get("/orders", adminGuard, async (req, res) => {
  try {
    const { status, limit = 200, from, to } = req.query;
    const values = [];
    let idx = 1;
    let whereClause = "WHERE 1=1";

    if (status) {
      whereClause += ` AND o.status = $${idx++}`;
      values.push(status);
    }
    if (from) {
      whereClause += ` AND o.created_at >= $${idx++}`;
      values.push(from);
    }
    if (to) {
      whereClause += ` AND o.created_at <= ($${idx++}::date + interval '1 day')`;
      values.push(to);
    }

    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.total_amount,
         o.final_amount,
         o.otp_verified_at,
         o.created_at,
         u.name AS customer_name,
         u.phone AS customer_phone,
         a.city,
         a.address_line,
         COALESCE(ds.name, a.city) AS store_name,
         json_agg(DISTINCT jsonb_build_object(
           'product_name', p.name,
           'variant_id',   oi.variant_id,
           'quantity',     oi.quantity,
           'price',        oi.price,
           'item_status',  oi.item_status,
           'vendor_name',  v.store_name,
           'size',         pv.size,
           'color',        pv.color,
           'barcode',      pv.barcode
         )) AS items
       FROM orders o
       LEFT JOIN users u ON u.id::text = o.user_id
       LEFT JOIN addresses a ON a.id = o.address_id
       LEFT JOIN dark_stores ds ON ds.id = o.dark_store_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants pv ON pv.id = oi.variant_id
       JOIN products p ON p.id = pv.product_id
       JOIN vendors v ON v.id::text = p.vendor_id::text
       ${whereClause}
       GROUP BY o.id, u.name, u.phone, a.city, a.address_line, ds.name
       ORDER BY o.created_at DESC
       LIMIT $${idx++}`,
      [...values, parseInt(limit) || 200]
    );

    res.json({ success: true, orders: rows, total: rows.length });
  } catch (err) {
    console.error("[admin/orders] error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /api/admin/orders/:orderId/status ───────────────────────────────────
// Superadmin override — updates any order's status regardless of vendor ownership.
router.patch("/orders/:orderId/status", adminGuard, async (req, res) => {
  try {
    const { orderId } = req.params;
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

    const orderCheck = await pool.query(
      `SELECT id FROM orders WHERE id = $1 LIMIT 1`,
      [orderId]
    );
    if (!orderCheck.rows.length) {
      return res.status(404).json({ success: false, error: "Order not found" });
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
          String(cancelReason || "Rejected by admin").slice(0, 500),
        ]
      : [normalizedStatus, orderId];

    const updated = await pool.query(
      `UPDATE orders
       SET status = $1${confirmClause}${cancelClause}
       WHERE id = $2
       RETURNING id, status`,
      params
    );

    // Keep per-item status in sync with the order (all items, no vendor filter).
    await pool.query(
      `UPDATE order_items SET item_status = $1 WHERE order_id = $2`,
      [normalizedStatus, orderId]
    ).catch(() => {});

    if (normalizedStatus === "confirmed") {
      notifyAvailableRiders(pool, orderId).catch(() => {});
    }
    notifyCustomerOfStatus(pool, orderId, normalizedStatus).catch(() => {});

    return res.json({ success: true, order: updated.rows[0] });
  } catch (err) {
    console.error("[admin/orders/status] error:", err.message);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// ── GET /api/admin/orders/:orderId/invoice ────────────────────────────────────
// Super-admin-only platform P&L invoice: full breakdown of product margin,
// delivery margin, and total platform profit for an order — using the same
// invoice number(s) already assigned to the vendor(s) on this order.
router.get("/orders/:orderId/invoice", adminGuard, async (req, res) => {
  try {
    const { orderId } = req.params;

    const { rows: orderRows } = await pool.query(
      `SELECT o.id, o.created_at, o.status, o.total_amount, o.final_amount,
              o.referral_discount, o.clothing_discount, o.bundle_discount,
              o.first_order_discount, o.payment_method,
              u.name AS customer_name, u.phone AS customer_phone
       FROM orders o
       LEFT JOIN users u ON u.id::text = o.user_id
       WHERE o.id = $1::UUID`,
      [orderId]
    );
    if (!orderRows.length) return res.status(404).send("Order not found");
    const order = orderRows[0];

    const { rows: items } = await pool.query(
      `SELECT oi.quantity, oi.price, p.name AS product_name,
              b.name AS brand_name, p.vendor_id, v.store_name AS vendor_store_name, pv.mrp
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN vendors v ON v.id::text = p.vendor_id::text
       WHERE oi.order_id = $1`,
      [orderId]
    );
    if (!items.length) return res.status(404).send("No items found for this order");

    // Rider payout — the actual cost the platform paid out for this delivery.
    const { rows: deliveryRows } = await pool.query(
      `SELECT delivery_fee FROM deliveries WHERE order_id = $1 ORDER BY started_at DESC LIMIT 1`,
      [orderId]
    ).catch(() => ({ rows: [] }));
    const riderPayout = parseFloat(deliveryRows[0]?.delivery_fee) || 0;

    // Group items by vendor so each vendor's own invoice number can be shown.
    const vendorGroups = new Map();
    for (const it of items) {
      const vId = String(it.vendor_id || "unknown");
      if (!vendorGroups.has(vId)) {
        vendorGroups.set(vId, {
          vendorId: it.vendor_id,
          storeName: it.vendor_store_name || "Unknown Vendor",
          items: [],
        });
      }
      vendorGroups.get(vId).items.push(it);
    }

    let productSale = 0;
    let vendorPayout = 0;
    const vendorSections = [];
    for (const group of vendorGroups.values()) {
      const invoiceNumber = group.vendorId
        ? await getOrCreateInvoiceNumber(group.vendorId, orderId)
        : "—";
      let groupSale = 0;
      let groupPayout = 0;
      const rows = group.items.map((it) => {
        const salePrice = parseFloat(it.price) || 0;
        const payoutPrice = calculateVendorPrice(
          salePrice, 
          it.brand_name, 
          it.product_name,
          it.mrp ? parseFloat(it.mrp) : null
        );
        const saleAmount = salePrice * it.quantity;
        const payoutAmount = payoutPrice * it.quantity;
        groupSale += saleAmount;
        groupPayout += payoutAmount;
        return `
        <tr>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0">${it.product_name}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:center">${it.quantity}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right">₹${saleAmount.toFixed(0)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right">₹${payoutAmount.toFixed(0)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right;color:#16a34a;font-weight:600">₹${(saleAmount - payoutAmount).toFixed(0)}</td>
        </tr>`;
      }).join("");
      productSale += groupSale;
      vendorPayout += groupPayout;
      vendorSections.push(`
      <div class="vendor-block">
        <div class="vendor-block-head">🏪 ${group.storeName} &nbsp;·&nbsp; Invoice #${invoiceNumber}</div>
        <table>
          <thead><tr>
            <th>Item</th><th style="text-align:center">Qty</th>
            <th style="text-align:right">Customer Paid</th>
            <th style="text-align:right">Vendor Payout</th>
            <th style="text-align:right">Margin</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`);
    }

    const subtotal = parseFloat(order.total_amount) || 0;
    const finalAmt = parseFloat(order.final_amount) || 0;
    const discounts = (parseFloat(order.referral_discount) || 0) +
      (parseFloat(order.clothing_discount) || 0) + (parseFloat(order.bundle_discount) || 0) +
      (parseFloat(order.first_order_discount) || 0);
    // Delivery + platform + handling fees collected from the customer, combined
    // (orders don't store these as separate columns — this mirrors the same
    // formula used by the customer-facing invoice).
    const deliveryCollected = finalAmt - subtotal + discounts;
    const productMargin = productSale - vendorPayout;
    const deliveryMargin = deliveryCollected - riderPayout;
    const totalProfit = productMargin + deliveryMargin;

    const date = new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });
    const shortId = orderId.toString().slice(-8).toUpperCase();

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Platform Invoice #${shortId}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:20px;background:#f8fafc;color:#0f172a}
  .invoice{max-width:760px;margin:0 auto;background:#fff;border-radius:16px;padding:32px;box-shadow:0 4px 24px rgba(0,0,0,.08)}
  .header{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:2px solid #0f172a;padding-bottom:20px;margin-bottom:24px}
  .brand{color:#16a34a;font-size:28px;font-weight:900;letter-spacing:-1px}
  .brand span{color:#0f172a}
  .invoice-meta{text-align:right;font-size:13px;color:#6b7280}
  .invoice-meta strong{display:block;font-size:16px;color:#0f172a;margin-bottom:4px}
  .info-box p{margin:3px 0;font-size:14px}
  .vendor-block{margin-bottom:20px}
  .vendor-block-head{font-size:13px;font-weight:700;color:#0f172a;background:#f0fdf4;padding:8px 10px;border-radius:8px 8px 0 0}
  table{width:100%;border-collapse:collapse;font-size:14px}
  thead{background:#f8fafc}
  thead th{padding:10px 6px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280}
  .totals{margin-left:auto;width:340px;font-size:14px;margin-top:12px}
  .totals tr td{padding:6px}
  .totals tr td:last-child{text-align:right}
  .totals .section-label{color:#9ca3af;font-size:11px;text-transform:uppercase;letter-spacing:.6px;padding-top:14px!important}
  .totals .profit{color:#16a34a;font-weight:600}
  .totals .grand{font-size:17px;font-weight:800;border-top:2px solid #0f172a;padding-top:10px!important;color:#16a34a}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#dcfce7;color:#16a34a}
  .footer{margin-top:24px;padding-top:16px;border-top:1px solid #f0f0f0;font-size:12px;color:#9ca3af;text-align:center}
  @media print{body{background:#fff}.invoice{box-shadow:none}}
</style></head><body>
<div class="invoice">
  <div class="header">
    <div class="brand"><span>BLINKIE</span>FASH</div>
    <div class="invoice-meta">
      <strong>PLATFORM P&amp;L INVOICE</strong>
      Order #${shortId}<br/>${date}<br/>
      <span class="badge">${(order.status || "").toUpperCase()}</span>
    </div>
  </div>
  <div class="info-box" style="margin-bottom:20px">
    <p><strong>${order.customer_name || "Customer"}</strong> &nbsp;${order.customer_phone || ""}</p>
  </div>
  ${vendorSections.join("")}
  <table class="totals">
    <tr class="section-label"><td colspan="2">Product Sales</td></tr>
    <tr><td>Customer Paid (Products)</td><td>₹${productSale.toFixed(0)}</td></tr>
    <tr><td>Vendor Payout</td><td>-₹${vendorPayout.toFixed(0)}</td></tr>
    <tr><td class="profit">Product Margin</td><td class="profit">₹${productMargin.toFixed(0)}</td></tr>
    <tr class="section-label"><td colspan="2">Delivery</td></tr>
    <tr><td>Delivery/Platform/Handling Collected</td><td>₹${deliveryCollected.toFixed(0)}</td></tr>
    <tr><td>Rider Payout</td><td>-₹${riderPayout.toFixed(0)}</td></tr>
    <tr><td class="profit">Delivery Margin</td><td class="profit">₹${deliveryMargin.toFixed(0)}</td></tr>
    <tr class="section-label"><td colspan="2">Taxes</td></tr>
    <tr><td>GST / Taxes</td><td>Included in item price</td></tr>
    <tr class="grand"><td>Total Platform Profit</td><td>₹${totalProfit.toFixed(0)}</td></tr>
  </table>
  <div class="footer">
    Internal document — not for distribution to customers or vendors.<br/>
    Powered by BlinkieFash
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[admin/orders/invoice] error:", err.message);
    res.status(500).send("Could not generate invoice");
  }
});

// ── GET /api/admin/orders/:orderId/customer-bill ──────────────────────────────
// Customer-facing bill/invoice for admin access (via checkout API data)
router.get("/orders/:orderId/customer-bill", adminGuard, async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows: orderRows } = await pool.query(
      `SELECT o.id, o.created_at, o.total_amount, o.final_amount,
              o.referral_discount, o.clothing_discount, o.bundle_discount,
              o.first_order_discount, o.status, o.payment_method,
              u.name AS customer_name, u.phone AS customer_phone,
              a.address_line, a.city, a.pincode
       FROM orders o
       JOIN users u ON u.id::text = o.user_id
       JOIN addresses a ON a.id = o.address_id
       WHERE o.id = $1::UUID`,
      [orderId]
    );
    if (!orderRows.length) return res.status(404).send("Order not found");
    const order = orderRows[0];

    const { rows: items } = await pool.query(
      `SELECT oi.quantity, oi.price,
              p.name AS product_name,
              v.size, v.color
       FROM order_items oi
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    const shortId = orderId.toString().slice(-8).toUpperCase();
    const date = new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });
    const subtotal = parseFloat(order.total_amount) || 0;
    const finalAmt = parseFloat(order.final_amount) || 0;
    const delivery = finalAmt - subtotal + (parseFloat(order.referral_discount) || 0) +
      (parseFloat(order.clothing_discount) || 0) + (parseFloat(order.bundle_discount) || 0) +
      (parseFloat(order.first_order_discount) || 0);

    const itemRows = items.map(it => `
      <tr>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0">${it.product_name}
          ${it.size ? `<br/><span style="color:#6b7280;font-size:12px">Size: ${it.size}</span>` : ""}
          ${it.color ? `<span style="color:#6b7280;font-size:12px"> | Color: ${it.color}</span>` : ""}
        </td>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:center">${it.quantity}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right">₹${parseFloat(it.price).toFixed(0)}</td>
        <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right">₹${(parseFloat(it.price)*it.quantity).toFixed(0)}</td>
      </tr>`).join("");

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Customer Invoice #${shortId}</title>
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
  thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4){text-align:right}
  .totals{margin-left:auto;width:260px;font-size:14px}
  .totals tr td{padding:5px 6px}
  .totals tr td:last-child{text-align:right}
  .totals .discount{color:#16a34a}
  .totals .grand{font-size:16px;font-weight:800;border-top:2px solid #0f172a;padding-top:8px!important}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#dcfce7;color:#16a34a}
  .footer{margin-top:24px;padding-top:16px;border-top:1px solid #f0f0f0;font-size:12px;color:#9ca3af;text-align:center}
  @media print{body{background:#fff}.invoice{box-shadow:none}}
</style></head><body>
<div class="invoice">
  <div class="header">
    <div class="brand"><span>BLINKIE</span>FASH</div>
    <div class="invoice-meta">
      <strong>CUSTOMER BILL</strong>
      Order #${shortId}<br/>${date}<br/>
      <span class="badge">${order.status.toUpperCase()}</span>
    </div>
  </div>
  <div class="info-grid">
    <div class="info-box">
      <h4>Bill To</h4>
      <p><strong>${order.customer_name || "Customer"}</strong></p>
      <p>${order.customer_phone || ""}</p>
    </div>
    <div class="info-box">
      <h4>Deliver To</h4>
      <p>${order.address_line || ""}</p>
      <p>${order.city || ""}${order.pincode ? " - " + order.pincode : ""}</p>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>Item</th><th style="text-align:center">Qty</th>
      <th style="text-align:right">Unit Price</th>
      <th style="text-align:right">Amount</th>
    </tr></thead>
    <tbody>${itemRows}</tbody>
  </table>
  <table class="totals">
    <tr><td>Subtotal</td><td>₹${subtotal.toFixed(0)}</td></tr>
    <tr><td>Delivery</td><td>${delivery <= 0 ? "FREE" : "₹" + delivery.toFixed(0)}</td></tr>
    ${parseFloat(order.referral_discount) > 0 ? `<tr class="discount"><td>Referral Discount</td><td>- ₹${parseFloat(order.referral_discount).toFixed(0)}</td></tr>` : ""}
    ${parseFloat(order.clothing_discount) > 0 ? `<tr class="discount"><td>Donation Discount</td><td>- ₹${parseFloat(order.clothing_discount).toFixed(0)}</td></tr>` : ""}
    ${parseFloat(order.first_order_discount) > 0 ? `<tr class="discount"><td>First Order Discount</td><td>- ₹${parseFloat(order.first_order_discount).toFixed(0)}</td></tr>` : ""}
    <tr class="grand"><td>Total Paid</td><td>₹${finalAmt.toFixed(0)}</td></tr>
  </table>
  <div class="footer">
    Thank you for shopping with BlinkieFash!<br/>
    Questions? hello@blinkiefash.in
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[admin/customer-bill] error:", err.message);
    res.status(500).send("Could not generate customer bill");
  }
});

// ── GET /api/admin/orders/:orderId/vendor-bills ────────────────────────────────
// All vendor packing slips/invoices for an order (grouped by vendor)
router.get("/orders/:orderId/vendor-bills", adminGuard, async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows: items } = await pool.query(
      `SELECT oi.id, oi.quantity, oi.price, p.name AS product_name,
              b.name AS brand_name, p.vendor_id, v.store_name AS vendor_store_name, v.owner_name,
              pv.size, pv.color
       FROM order_items oi
       JOIN product_variants pv ON pv.id = oi.variant_id
       JOIN products p ON p.id = pv.product_id
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN vendors v ON v.id::text = p.vendor_id::text
       WHERE oi.order_id = $1`,
      [orderId]
    );
    if (!items.length) return res.status(404).send("No items found for this order");

    const { rows: orderRows } = await pool.query(
      `SELECT o.id, o.created_at, o.status FROM orders o WHERE o.id = $1::UUID`,
      [orderId]
    );
    const order = orderRows[0];

    // Group items by vendor
    const vendorGroups = new Map();
    for (const it of items) {
      const vId = String(it.vendor_id || "unknown");
      if (!vendorGroups.has(vId)) {
        vendorGroups.set(vId, {
          vendorId: it.vendor_id,
          storeName: it.vendor_store_name || "Unknown Vendor",
          ownerName: it.owner_name || "",
          items: [],
        });
      }
      vendorGroups.get(vId).items.push(it);
    }

    const shortId = orderId.toString().slice(-8).toUpperCase();
    const date = new Date(order.created_at).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric"
    });

    // Get the single global invoice number for this order
    const globalInvoiceNumber = await getOrCreateInvoiceNumber(null, orderId);

    // Generate a packing slip for each vendor
    const vendorSections = [];
    for (const group of vendorGroups.values()) {
      const itemRows = group.items.map(it => `
        <tr>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0">${it.product_name}
            ${it.size ? `<br/><span style="color:#6b7280;font-size:12px">Size: ${it.size}</span>` : ""}
            ${it.color ? `<span style="color:#6b7280;font-size:12px"> | Color: ${it.color}</span>` : ""}
          </td>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:center">${it.quantity}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right">₹${parseFloat(it.price).toFixed(0)}</td>
          <td style="padding:8px 6px;border-bottom:1px solid #f0f0f0;text-align:right">₹${(parseFloat(it.price)*it.quantity).toFixed(0)}</td>
        </tr>`).join("");

      const totalAmount = group.items.reduce((sum, it) => sum + parseFloat(it.price) * it.quantity, 0);

      vendorSections.push(`
      <div style="page-break-before:always;margin-bottom:40px;padding-bottom:40px;border-bottom:2px dashed #e2e8f0">
        <div style="background:#f0fdf4;padding:16px;border-radius:8px;margin-bottom:20px">
          <div style="font-size:13px;font-weight:700;color:#0f172a;margin-bottom:6px">🏪 ${group.storeName}</div>
          <div style="font-size:12px;color:#6b7280">Invoice #${globalInvoiceNumber} | Order #${shortId} | ${date}</div>
          ${group.ownerName ? `<div style="font-size:12px;color:#6b7280">Vendor: ${group.ownerName}</div>` : ""}
        </div>
        <table style="width:100%;border-collapse:collapse;font-size:14px;margin-bottom:16px">
          <thead style="background:#f8fafc">
            <tr>
              <th style="padding:10px 6px;text-align:left;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">Product</th>
              <th style="padding:10px 6px;text-align:center;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">Qty</th>
              <th style="padding:10px 6px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">Price</th>
              <th style="padding:10px 6px;text-align:right;font-size:12px;text-transform:uppercase;letter-spacing:.5px;color:#6b7280">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>
        <div style="text-align:right;padding-right:6px;font-weight:700;border-top:1px solid #e2e8f0;padding-top:8px">
          Total: ₹${totalAmount.toFixed(0)}
        </div>
      </div>`);
    }

    const html = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/>
<title>Vendor Bills #${shortId}</title>
<style>
  body{font-family:'Segoe UI',sans-serif;margin:0;padding:20px;background:#f8fafc;color:#0f172a}
  .container{max-width:760px;margin:0 auto}
  .header{display:flex;justify-content:space-between;align-items:center;margin-bottom:32px;border-bottom:2px solid #0f172a;padding-bottom:20px}
  .brand{color:#16a34a;font-size:28px;font-weight:900;letter-spacing:-1px}
  .brand span{color:#0f172a}
  .badge{display:inline-block;padding:4px 12px;border-radius:20px;font-size:12px;font-weight:700;background:#dcfce7;color:#16a34a}
  @media print{body{background:#fff}}
</style></head><body>
<div class="container">
  <div class="header">
    <div class="brand"><span>BLINKIE</span>FASH</div>
    <div style="text-align:right">
      <div style="font-size:14px;font-weight:700">VENDOR PACKING SLIPS</div>
      <div style="font-size:13px;color:#6b7280">Order #${shortId} | ${date}</div>
      <span class="badge">${order.status.toUpperCase()}</span>
    </div>
  </div>
  ${vendorSections.join("")}
  <div style="margin-top:32px;padding-top:20px;border-top:2px solid #0f172a;text-align:center;font-size:12px;color:#9ca3af">
    Internal document for warehouse packing<br/>
    Questions? hello@blinkiefash.in
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("[admin/vendor-bills] error:", err.message);
    res.status(500).send("Could not generate vendor bills");
  }
});

// ── GET /api/admin/insights ───────────────────────────────────────────────────
// Aggregate metrics across all vendors
router.get("/insights", adminGuard, async (req, res) => {
  try {
    const [orderStats, vendorStats, topProducts, revenueByDay] = await Promise.all([
      // Total orders / revenue
      pool.query(`
        SELECT
          COUNT(*)::int                                           AS total_orders,
          COUNT(*) FILTER (WHERE status = 'placed')::int         AS new_orders,
          COUNT(*) FILTER (WHERE status = 'confirmed')::int      AS confirmed_orders,
          COUNT(*) FILTER (WHERE status = 'delivered')::int      AS delivered_orders,
          COUNT(*) FILTER (WHERE status = 'cancelled')::int      AS cancelled_orders,
          COALESCE(SUM(final_amount), 0)::float                  AS total_revenue,
          COALESCE(SUM(final_amount) FILTER (
            WHERE created_at >= NOW() - interval '30 days'
          ), 0)::float AS revenue_last_30d,
          COALESCE(SUM(final_amount) FILTER (
            WHERE created_at >= CURRENT_DATE
          ), 0)::float AS revenue_today
        FROM orders
        WHERE status NOT IN ('cancelled')
      `),
      // Per-vendor breakdown
      pool.query(`
        SELECT
          v.id,
          v.store_name,
          v.owner_name,
          COUNT(DISTINCT o.id)::int   AS order_count,
          COALESCE(SUM(o.final_amount), 0)::float AS revenue,
          COUNT(DISTINCT p.id)::int   AS product_count,
          v.is_operational
        FROM vendors v
        LEFT JOIN products p ON p.vendor_id::text = v.id::text
        LEFT JOIN order_items oi ON oi.variant_id IN (
          SELECT id FROM product_variants WHERE product_id = p.id
        )
        LEFT JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
        GROUP BY v.id, v.store_name, v.owner_name, v.is_operational
        ORDER BY revenue DESC
        LIMIT 50
      `),
      // Top products by order count
      pool.query(`
        SELECT
          p.name,
          v.store_name AS vendor_name,
          SUM(oi.quantity)::int  AS units_sold,
          SUM(oi.price * oi.quantity)::float AS revenue
        FROM order_items oi
        JOIN product_variants pv ON pv.id = oi.variant_id
        JOIN products p ON p.id = pv.product_id
        JOIN vendors v ON v.id::text = p.vendor_id::text
        JOIN orders o ON o.id = oi.order_id AND o.status NOT IN ('cancelled')
        GROUP BY p.id, p.name, v.store_name
        ORDER BY units_sold DESC
        LIMIT 10
      `),
      // Revenue by day (last 14 days)
      pool.query(`
        SELECT
          DATE(created_at)::text AS date,
          COUNT(*)::int          AS orders,
          COALESCE(SUM(final_amount), 0)::float AS revenue
        FROM orders
        WHERE created_at >= NOW() - interval '14 days'
          AND status NOT IN ('cancelled')
        GROUP BY DATE(created_at)
        ORDER BY date ASC
      `),
    ]);

    res.json({
      success: true,
      summary: orderStats.rows[0],
      vendors: vendorStats.rows,
      topProducts: topProducts.rows,
      revenueByDay: revenueByDay.rows,
    });
  } catch (err) {
    console.error("[admin/insights] error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/admin/vendors ────────────────────────────────────────────────────
router.get("/vendors", adminGuard, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        v.id, v.store_name, v.owner_name, v.email, v.phone,
        v.city, v.is_operational, v.is_approved, v.is_active,
        v.created_at,
        COUNT(DISTINCT p.id)::int AS product_count
      FROM vendors v
      LEFT JOIN products p ON p.vendor_id::text = v.id::text AND p.is_active = true
      GROUP BY v.id
      ORDER BY v.created_at DESC
    `);
    res.json({ success: true, vendors: rows });
  } catch (err) {
    console.error("[admin/vendors] error:", err.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/admin/fix-inventory-store-ids  — one-time migration for null store_id records
router.post("/fix-inventory-store-ids", adminGuard, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE inventory i
      SET store_id = v.dark_store_id
      FROM product_variants pv
      JOIN products p ON p.id = pv.product_id
      JOIN vendors v ON v.id::text = p.vendor_id::text
      WHERE i.variant_id = pv.id
        AND i.store_id IS NULL
        AND v.dark_store_id IS NOT NULL
      RETURNING i.variant_id
    `);
    res.json({ success: true, fixed: result.rowCount });
  } catch (err) {
    console.error("[fix-inventory-store-ids]", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;