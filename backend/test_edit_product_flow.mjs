/**
 * End-to-end API test: Add product → edit stock → add variant → remove variant
 * Run: node backend/test_edit_product_flow.mjs
 */

import fetch from "node_modules/node-fetch/src/index.js";

// ─── Config ──────────────────────────────────────────────────────────────────
const BASE = process.env.API_BASE || "https://blinkiefash.onrender.com/api";
const VENDOR_ID = process.env.VENDOR_ID || "";

if (!VENDOR_ID) {
  console.error("Set VENDOR_ID env var: VENDOR_ID=<your-vendor-id> node backend/test_edit_product_flow.mjs");
  process.exit(1);
}

let createdProductId = null;
let createdVariantId = null;
let secondVariantId  = null;

async function json(res) {
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { _raw: text }; }
}

function pass(label) { console.log(`  ✅  ${label}`); }
function fail(label, detail) { console.error(`  ❌  ${label}`, detail); process.exit(1); }

// ─── 1. Fetch vendor profile (confirm store is linked) ───────────────────────
console.log("\n[1] Fetch vendor profile");
{
  const res = await fetch(`${BASE}/vendor/${VENDOR_ID}`);
  const data = await json(res);
  if (!res.ok || !data.id) fail("fetch vendor profile", data);
  if (!data.dark_store_id) fail("vendor has no dark_store_id — link a store first", data);
  pass(`vendor "${data.store_name}", store_id=${data.dark_store_id}`);
}

// ─── 2. Add a test product ────────────────────────────────────────────────────
console.log("\n[2] Create test product");
{
  const res = await fetch(`${BASE}/products/create`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      product: {
        vendor_id: VENDOR_ID,
        name: `__TEST_PRODUCT_${Date.now()}`,
        category_id: null,   // may fail if category required — see output
        brand: "TestBrand",
        short_description: "automated test",
        full_description: "",
        is_try_enabled: false,
        store_id: null,       // intentionally null to test NULL fallback
      },
      variants: [
        { size: "M", color: "Red", price: 299, mrp: 399, quantity: 5, barcode: "TEST-001" },
      ],
    }),
  });
  const data = await json(res);
  if (!data.success) fail("create product", data);
  createdProductId = data.product_id;
  pass(`product_id=${createdProductId}`);
}

// ─── 3. Fetch products list — verify product appears ─────────────────────────
console.log("\n[3] Vendor products list includes new product");
{
  const res = await fetch(`${BASE}/vendor/${VENDOR_ID}/products`);
  const data = await json(res);
  if (!Array.isArray(data)) fail("get vendor products", data);
  const found = data.find((p) => p.id === createdProductId);
  if (!found) fail(`product ${createdProductId} not in list`, { total: data.length });
  createdVariantId = found.variants?.[0]?.id;
  if (!createdVariantId) fail("variant not returned with product", found);
  const qty = found.variants[0].quantity;
  pass(`product found, variant_id=${createdVariantId}, stock=${qty}`);
}

// ─── 4. Edit stock via PATCH ──────────────────────────────────────────────────
console.log("\n[4] PATCH variant stock → 42");
{
  const res = await fetch(`${BASE}/vendor/${VENDOR_ID}/variants/${createdVariantId}/stock`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ stock: 42, store_id: null }),
  });
  const data = await json(res);
  if (!data.success) fail("patch stock", data);
  pass("stock update accepted");
}

// ─── 5. Verify updated stock is reflected ────────────────────────────────────
console.log("\n[5] Verify stock is now 42");
{
  const res = await fetch(`${BASE}/vendor/${VENDOR_ID}/products`);
  const data = await json(res);
  const product = data.find((p) => p.id === createdProductId);
  const variant = product?.variants?.find((v) => v.id === createdVariantId);
  if (!variant) fail("variant not found after stock update");
  if (Number(variant.quantity) !== 42) fail(`expected 42, got ${variant.quantity}`);
  pass(`stock confirmed = ${variant.quantity}`);
}

// ─── 6. Add a second variant ─────────────────────────────────────────────────
console.log("\n[6] POST add variant (L / Blue)");
{
  const res = await fetch(`${BASE}/vendor/${VENDOR_ID}/products/${createdProductId}/variants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ size: "L", color: "Blue", price: 299, mrp: 399, quantity: 10, barcode: "TEST-002", store_id: null }),
  });
  const data = await json(res);
  if (!data.success) fail("add variant", data);
  secondVariantId = data.variant_id;
  pass(`new variant_id=${secondVariantId}`);
}

// ─── 7. Verify product now has 2 variants ────────────────────────────────────
console.log("\n[7] Product should have 2 variants");
{
  const res = await fetch(`${BASE}/vendor/${VENDOR_ID}/products`);
  const data = await json(res);
  const product = data.find((p) => p.id === createdProductId);
  if ((product?.variants?.length ?? 0) < 2) fail(`expected ≥2 variants, got ${product?.variants?.length}`, product?.variants);
  pass(`variant count = ${product.variants.length}`);
}

// ─── 8. Remove second variant ────────────────────────────────────────────────
console.log("\n[8] DELETE second variant");
{
  const res = await fetch(`${BASE}/vendor/${VENDOR_ID}/variants/${secondVariantId}`, { method: "DELETE" });
  const data = await json(res);
  if (!data.success) fail("delete variant", data);
  pass("variant removed (soft-deleted)");
}

// ─── 9. Verify only 1 active variant remains ─────────────────────────────────
console.log("\n[9] Product should now have 1 active variant");
{
  const res = await fetch(`${BASE}/vendor/${VENDOR_ID}/products`);
  const data = await json(res);
  const product = data.find((p) => p.id === createdProductId);
  if ((product?.variants?.length ?? 0) !== 1) fail(`expected 1 variant, got ${product?.variants?.length}`);
  pass(`variant count after remove = ${product.variants.length}`);
}

console.log("\n✅  All tests passed.\n");
