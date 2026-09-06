import { pool } from "../db.js";

// Returns a global sequential invoice number for an order (e.g. INV-0001).
// Platform-wide numbering — all vendors share the same counter.
// Assigning once (lazily, on first call) and reusing it afterwards.
export const getOrCreateInvoiceNumber = async (vendorId, orderId) => {
  const existing = await pool.query(
    `SELECT invoice_number FROM order_invoices WHERE order_id = $1`,
    [orderId]
  );
  if (existing.rows.length) return existing.rows[0].invoice_number;

  // Global counter — not per-vendor
  const counter = await pool.query(
    `INSERT INTO invoice_counter (id, last_number)
     VALUES ('global', 1)
     ON CONFLICT (id) DO UPDATE SET last_number = invoice_counter.last_number + 1
     RETURNING last_number`
  );
  const invoiceNumber = `INV-${String(counter.rows[0].last_number).padStart(4, "0")}`;

  const inserted = await pool.query(
    `INSERT INTO order_invoices (order_id, invoice_number, assigned_by_vendor_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (order_id) DO NOTHING
     RETURNING invoice_number`,
    [orderId, invoiceNumber, vendorId]
  );
  if (inserted.rows.length) return inserted.rows[0].invoice_number;

  // Lost a race to a concurrent request — use the number it already assigned.
  const race = await pool.query(
    `SELECT invoice_number FROM order_invoices WHERE order_id = $1`,
    [orderId]
  );
  return race.rows[0].invoice_number;
};

// Same brand-based discount rule vendor.js uses to derive what the platform
// pays the vendor for an item (i.e. the vendor's cost/payout price).
// If MRP is available, use 50% of MRP for Crimsoune; otherwise fall back to price-based calculation.
export const calculateVendorPrice = (price, brandName, productName, mrp = null) => {
  const name = (brandName || productName || "").toLowerCase();
  if (name.includes("crimsoune")) {
    // For Crimsoune: vendor gets 50% of MRP if available, otherwise 90% of price
    if (mrp != null) {
      return mrp * 0.5;
    }
    return price * 0.9;
  }
  if (name.includes("puma")) return price * 0.93;
  return price;
};
