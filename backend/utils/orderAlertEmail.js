import nodemailer from "nodemailer";

let cachedTransporter = null;

function htmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getMailConfig() {
  const enabled = String(process.env.ORDER_ALERT_ENABLED ?? "true").toLowerCase();
  if (enabled === "false") {
    return { enabled: false, reason: "ORDER_ALERT_ENABLED=false" };
  }

  const service = process.env.ORDER_ALERT_SMTP_SERVICE?.trim();
  const host = process.env.ORDER_ALERT_SMTP_HOST?.trim();
  const port = Number(process.env.ORDER_ALERT_SMTP_PORT || 587);
  const secure = String(process.env.ORDER_ALERT_SMTP_SECURE || "false").toLowerCase() === "true";
  const user = process.env.ORDER_ALERT_SMTP_USER?.trim();
  const pass = process.env.ORDER_ALERT_SMTP_PASS?.trim();

  if (!user || !pass) {
    return { enabled: false, reason: "Missing ORDER_ALERT_SMTP_USER/ORDER_ALERT_SMTP_PASS" };
  }

  if (!service && !host) {
    return { enabled: false, reason: "Missing ORDER_ALERT_SMTP_SERVICE or ORDER_ALERT_SMTP_HOST" };
  }

  return {
    enabled: true,
    service,
    host,
    port,
    secure,
    user,
    pass,
    to: process.env.ORDER_ALERT_TO?.trim() || "blinkiefash@gmail.com",
    from: process.env.ORDER_ALERT_FROM?.trim() || user,
  };
}

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  const cfg = getMailConfig();
  if (!cfg.enabled) return null;

  const base = cfg.service
    ? {
        service: cfg.service,
        auth: { user: cfg.user, pass: cfg.pass },
      }
    : {
        host: cfg.host,
        port: cfg.port,
        secure: cfg.secure,
        auth: { user: cfg.user, pass: cfg.pass },
      };

  cachedTransporter = nodemailer.createTransport(base);
  return cachedTransporter;
}

export async function sendOrderAlertEmail(pool, orderId) {
  const cfg = getMailConfig();
  if (!cfg.enabled) {
    console.warn(`[mail] Order alert skipped for ${orderId}: ${cfg.reason}`);
    return { skipped: true };
  }

  const transporter = getTransporter();
  if (!transporter) {
    console.warn(`[mail] Order alert skipped for ${orderId}: transporter unavailable`);
    return { skipped: true };
  }

  const { rows: orderRows } = await pool.query(
    `SELECT o.id,
            o.created_at,
            o.status,
            o.total_amount,
            o.final_amount,
            o.payment_method,
            u.id AS customer_id,
            u.name AS customer_name,
            u.phone AS customer_phone,
            u.email AS customer_email,
            a.address_line,
            a.city,
            a.pincode,
            ds.name AS dark_store_name,
            ds.city AS dark_store_city
     FROM orders o
     LEFT JOIN users u ON u.id = o.user_id
     LEFT JOIN addresses a ON a.id = o.address_id
     LEFT JOIN dark_stores ds ON ds.id = o.dark_store_id
     WHERE o.id = $1
     LIMIT 1`,
    [orderId]
  );

  if (!orderRows.length) {
    console.warn(`[mail] Order alert skipped: order ${orderId} not found`);
    return { skipped: true };
  }

  const order = orderRows[0];

  const { rows: itemRows } = await pool.query(
    `SELECT oi.quantity,
            oi.price,
            p.name AS product_name,
            v.size,
            v.color,
            ven.id AS vendor_id,
            ven.store_name AS vendor_store_name,
            ven.owner_name AS vendor_owner_name,
            ven.phone AS vendor_phone,
            ven.email AS vendor_email
     FROM order_items oi
     JOIN product_variants v ON v.id = oi.variant_id
     JOIN products p ON p.id = v.product_id
     LEFT JOIN vendors ven ON ven.id = p.vendor_id
     WHERE oi.order_id = $1
     ORDER BY oi.id ASC`,
    [orderId]
  );

  const vendors = [];
  const seenVendor = new Set();
  for (const row of itemRows) {
    const id = row.vendor_id ? String(row.vendor_id) : `unknown-${row.vendor_email || row.vendor_store_name || "x"}`;
    if (seenVendor.has(id)) continue;
    seenVendor.add(id);
    vendors.push({
      storeName: row.vendor_store_name || "Unknown Store",
      ownerName: row.vendor_owner_name || "",
      phone: row.vendor_phone || "",
      email: row.vendor_email || "",
    });
  }

  const shortOrderId = String(order.id).slice(-8).toUpperCase();
  const createdAt = new Date(order.created_at).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const itemTextLines = itemRows.map((it, idx) => {
    const qty = Number(it.quantity || 0);
    const unitPrice = Number(it.price || 0);
    const total = qty * unitPrice;
    const attrs = [it.size ? `size ${it.size}` : "", it.color ? `color ${it.color}` : ""]
      .filter(Boolean)
      .join(", ");
    return `${idx + 1}. ${it.product_name}${attrs ? ` (${attrs})` : ""} | Qty: ${qty} | Unit: Rs ${unitPrice.toFixed(2)} | Line: Rs ${total.toFixed(2)}`;
  });

  const vendorTextLines = vendors.map((v, idx) => {
    const parts = [v.storeName, v.ownerName ? `Owner: ${v.ownerName}` : "", v.phone ? `Phone: ${v.phone}` : "", v.email ? `Email: ${v.email}` : ""]
      .filter(Boolean)
      .join(" | ");
    return `${idx + 1}. ${parts}`;
  });

  const text = [
    `New order received: #${shortOrderId}`,
    "",
    "Order Summary",
    `Order ID: ${order.id}`,
    `Created: ${createdAt}`,
    `Status: ${order.status}`,
    `Payment: ${(order.payment_method || "").toUpperCase()}`,
    `Subtotal: Rs ${Number(order.total_amount || 0).toFixed(2)}`,
    `Final Amount: Rs ${Number(order.final_amount || 0).toFixed(2)}`,
    "",
    "Customer",
    `ID: ${order.customer_id || ""}`,
    `Name: ${order.customer_name || ""}`,
    `Phone: ${order.customer_phone || ""}`,
    `Email: ${order.customer_email || ""}`,
    `Address: ${order.address_line || ""}, ${order.city || ""} ${order.pincode || ""}`,
    "",
    "Assigned Store",
    `${order.dark_store_name || "N/A"}${order.dark_store_city ? ` (${order.dark_store_city})` : ""}`,
    "",
    "Vendors",
    ...(vendorTextLines.length ? vendorTextLines : ["No vendor mapped"]),
    "",
    "Items",
    ...(itemTextLines.length ? itemTextLines : ["No items found"]),
  ].join("\n");

  const vendorHtml = vendors.length
    ? vendors
        .map(
          (v, idx) => `<li>${idx + 1}. <strong>${htmlEscape(v.storeName)}</strong>${
            v.ownerName ? ` | Owner: ${htmlEscape(v.ownerName)}` : ""
          }${v.phone ? ` | Phone: ${htmlEscape(v.phone)}` : ""}${
            v.email ? ` | Email: ${htmlEscape(v.email)}` : ""
          }</li>`
        )
        .join("")
    : "<li>No vendor mapped</li>";

  const itemsHtml = itemRows.length
    ? itemRows
        .map((it, idx) => {
          const qty = Number(it.quantity || 0);
          const unitPrice = Number(it.price || 0);
          const total = qty * unitPrice;
          const attrs = [it.size ? `size ${it.size}` : "", it.color ? `color ${it.color}` : ""]
            .filter(Boolean)
            .join(", ");
          return `<li>${idx + 1}. ${htmlEscape(it.product_name)}${
            attrs ? ` (${htmlEscape(attrs)})` : ""
          } | Qty: ${qty} | Unit: Rs ${unitPrice.toFixed(2)} | Line: Rs ${total.toFixed(2)}</li>`;
        })
        .join("")
    : "<li>No items found</li>";

  const html = `
    <div style="font-family: Arial, sans-serif; color: #0f172a; line-height: 1.5;">
      <h2 style="margin-bottom: 6px;">New Order Received: #${htmlEscape(shortOrderId)}</h2>
      <p style="margin-top: 0; color: #475569;">Order ID: ${htmlEscape(order.id)}</p>
      <h3>Order Summary</h3>
      <ul>
        <li><strong>Created:</strong> ${htmlEscape(createdAt)}</li>
        <li><strong>Status:</strong> ${htmlEscape(order.status)}</li>
        <li><strong>Payment:</strong> ${htmlEscape((order.payment_method || "").toUpperCase())}</li>
        <li><strong>Subtotal:</strong> Rs ${Number(order.total_amount || 0).toFixed(2)}</li>
        <li><strong>Final Amount:</strong> Rs ${Number(order.final_amount || 0).toFixed(2)}</li>
      </ul>

      <h3>Customer</h3>
      <ul>
        <li><strong>ID:</strong> ${htmlEscape(order.customer_id)}</li>
        <li><strong>Name:</strong> ${htmlEscape(order.customer_name)}</li>
        <li><strong>Phone:</strong> ${htmlEscape(order.customer_phone)}</li>
        <li><strong>Email:</strong> ${htmlEscape(order.customer_email)}</li>
        <li><strong>Address:</strong> ${htmlEscape(`${order.address_line || ""}, ${order.city || ""} ${order.pincode || ""}`)}</li>
      </ul>

      <h3>Assigned Store</h3>
      <p>${htmlEscape(order.dark_store_name || "N/A")}${
        order.dark_store_city ? ` (${htmlEscape(order.dark_store_city)})` : ""
      }</p>

      <h3>Vendor(s)</h3>
      <ol>${vendorHtml}</ol>

      <h3>Items</h3>
      <ol>${itemsHtml}</ol>
    </div>
  `;

  await transporter.sendMail({
    from: cfg.from,
    to: cfg.to,
    subject: `New BlinkieFash Order #${shortOrderId}`,
    text,
    html,
  });

  console.log(`[mail] Order alert sent for ${orderId} -> ${cfg.to}`);
  return { success: true };
}
