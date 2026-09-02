import { pool } from "../db.js";

// Returns a vendor's own sequential invoice number for an order (e.g.
// INV-0001), assigning one lazily on first call and reusing it afterwards.
// Shared by vendor.js (vendor-facing invoice) and admin.js (platform P&L
// invoice) so both always show the exact same invoice number for an order.
export const getOrCreateInvoiceNumber = async (vendorId, orderId) => {
  const existing = await pool.query(
    `SELECT invoice_number FROM vendor_order_invoices WHERE vendor_id = $1 AND order_id = $2`,
    [vendorId, orderId]
  );
  if (existing.rows.length) return existing.rows[0].invoice_number;

  const counter = await pool.query(
    `INSERT INTO vendor_invoice_counters (vendor_id, last_number)
     VALUES ($1, 1)
     ON CONFLICT (vendor_id) DO UPDATE SET last_number = vendor_invoice_counters.last_number + 1
     RETURNING last_number`,
    [vendorId]
  );
  const invoiceNumber = `INV-${String(counter.rows[0].last_number).padStart(4, "0")}`;

  const inserted = await pool.query(
    `INSERT INTO vendor_order_invoices (vendor_id, order_id, invoice_number)
     VALUES ($1, $2, $3)
     ON CONFLICT (vendor_id, order_id) DO NOTHING
     RETURNING invoice_number`,
    [vendorId, orderId, invoiceNumber]
  );
  if (inserted.rows.length) return inserted.rows[0].invoice_number;

  // Lost a race to a concurrent request — use the number it already assigned.
  const race = await pool.query(
    `SELECT invoice_number FROM vendor_order_invoices WHERE vendor_id = $1 AND order_id = $2`,
    [vendorId, orderId]
  );
  return race.rows[0].invoice_number;
};

// Same brand-based discount rule vendor.js uses to derive what the platform
// pays the vendor for an item (i.e. the vendor's cost/payout price).
export const calculateVendorPrice = (price, brandName, productName) => {
  const name = (brandName || productName || "").toLowerCase();
  if (name.includes("crimsoune")) return price * 0.9;
  if (name.includes("puma")) return price * 0.93;
  return price;
};
