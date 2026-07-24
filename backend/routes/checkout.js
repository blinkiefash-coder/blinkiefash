import express from "express";
import { pool } from "../db.js";
import {
  notifyAvailableRiders,
  notifyCustomerOfStatus,
  notifyVendorOfNewOrder,
} from "../utils/firebaseAdmin.js";
import { sendOrderAlertEmail } from "../utils/orderAlertEmail.js";

const router = express.Router();

const PLATFORM_FEE_FLAT = 9;
const SPH_FEE_PER_PRODUCT = 9; // shipping + packaging + handling per unit
const FREE_DELIVERY_THRESHOLD = 1299;
const BASE_DELIVERY_FEE = 39;
const FREE_DELIVERY_DISTANCE_KM = 18;
const EXTRA_DELIVERY_PER_KM = 2;

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

// ── Haversine helper (km) ────────────────────────────────────────────────────
function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Bundle pricing rules ────────────────────────────────────────────────────
// Check bundle offers from database for cart items
// Returns discount amount (positive value to subtract from subtotal)
async function calculateBundleDiscount(items, subtotal, client = pool) {
  if (!Array.isArray(items) || items.length === 0 || subtotal <= 0) {
    return 0;
  }

  const totalQuantity = items.reduce((sum, item) => sum + (item.quantity || 0), 0);

  // Get all unique product IDs from items
  const productIds = [...new Set(items.map((item) => item.variantId))];
  if (productIds.length === 0) return 0;

  try {
    // Find applicable bundle offers
    const { rows: offers } = await client.query(
      `SELECT product_id, quantity_min, quantity_max, discount_value, discount_type
       FROM bundle_offers
       WHERE product_id = ANY($1::uuid[])
       AND is_active = true
       AND quantity_min <= $2
       AND (quantity_max IS NULL OR quantity_max >= $2)
       ORDER BY quantity_min DESC
       LIMIT 1`,
      [productIds, totalQuantity]
    );

    if (offers.length > 0) {
      const offer = offers[0];
      // For fixed_price offers, return the discount
      if (offer.discount_type === 'fixed_price' && subtotal > offer.discount_value) {
        return subtotal - offer.discount_value;
      }
      // For percentage offers (future use)
      if (offer.discount_type === 'percentage') {
        return (subtotal * offer.discount_value) / 100;
      }
    }

    return 0;
  } catch (err) {
    console.error("Bundle discount calculation error:", err);
    return 0;
  }
}

// ── Delivery fee rules (flat policy) ─────────────────────────────────────────
function calcDeliveryFee(subtotal, distanceKm) {
  const baseFee = subtotal >= FREE_DELIVERY_THRESHOLD ? 0 : BASE_DELIVERY_FEE;
  if (distanceKm == null || distanceKm <= FREE_DELIVERY_DISTANCE_KM) {
    return baseFee;
  }

  const extraKm = Math.ceil(distanceKm - FREE_DELIVERY_DISTANCE_KM);
  return baseFee + (extraKm * EXTRA_DELIVERY_PER_KM);
}

async function resolveOrderStore(client, items) {
  const variantIds = [...new Set(items.map((item) => item.variantId).filter(Boolean))];
  if (variantIds.length === 0) {
    return { storeId: null, storeRows: [] };
  }

  const { rows: storeRows } = await client.query(
    `SELECT pv.id AS variant_id,
            p.vendor_id,
            v.dark_store_id,
            v.is_operational,
            ds.name,
            ds.city,
            ds.lat,
            ds.lng
     FROM product_variants pv
     JOIN products p ON p.id = pv.product_id
     JOIN vendors v ON v.id = p.vendor_id
     LEFT JOIN dark_stores ds ON ds.id = v.dark_store_id
     WHERE pv.id = ANY($1::uuid[])`,
    [variantIds]
  );

  if (!storeRows.length) {
    return { storeId: null, storeRows: [] };
  }

  const hasOfflineVendor = storeRows.some((row) => row.is_operational === false);
  if (hasOfflineVendor) {
    return { storeId: null, storeRows, vendorOffline: true };
  }

  const storeIds = [...new Set(storeRows.map((row) => row.dark_store_id).filter(Boolean))];
  if (storeIds.length > 1) {
    return { storeId: null, storeRows, mixedStores: true };
  }

  return { storeId: storeIds[0] || null, storeRows };
}

// ── GET /api/checkout/addresses?userId=xxx ──────────────────────────────────
router.get("/addresses", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: "userId required" });
  try {
    const { rows } = await pool.query(
      `SELECT id, address_line, city, pincode, is_default, lat, lng
       FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC`,
      [userId]
    );
    res.json({ success: true, addresses: rows });
  } catch (err) {
    console.error("GET addresses error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/delivery-fee?addressId=xxx&subtotal=nnn ────────────────
router.get("/delivery-fee", async (req, res) => {
  const { addressId, subtotal } = req.query;
  if (!addressId) return res.status(400).json({ success: false, message: "addressId required" });
  try {
    const { rows: addrRows } = await pool.query(
      `SELECT city, lat, lng FROM addresses WHERE id = $1`, [addressId]
    );
    if (!addrRows.length) return res.status(404).json({ success: false, message: "Address not found" });

    const { city, lat: addrLat, lng: addrLng } = addrRows[0];
    const sub = parseFloat(subtotal) || 0;
    let fee = 0;
    let distance = null;
    let withinRange = true;

    if (addrLat != null && addrLng != null) {
      // Find nearest active dark store by actual distance
      const { rows: storeRows } = await pool.query(
        `SELECT id, name, lat, lng FROM dark_stores WHERE is_active = true AND lat IS NOT NULL AND lng IS NOT NULL`,
        []
      );
      if (storeRows.length) {
        let nearest = storeRows[0];
        let minDist = haversineKm(parseFloat(addrLat), parseFloat(addrLng), parseFloat(nearest.lat), parseFloat(nearest.lng));
        for (const s of storeRows.slice(1)) {
          const d = haversineKm(parseFloat(addrLat), parseFloat(addrLng), parseFloat(s.lat), parseFloat(s.lng));
          if (d < minDist) { minDist = d; nearest = s; }
        }
        distance = Math.round(minDist * 10) / 10;
        fee = calcDeliveryFee(sub, distance);
      }
    } else {
      // No coordinates — city-based fallback, assume in range
      const { rows: storeRows } = await pool.query(
        `SELECT id FROM dark_stores WHERE is_active = true AND lower(city) = lower($1) LIMIT 1`, [city]
      );
      if (!storeRows.length) withinRange = false;
      fee = calcDeliveryFee(sub, null);
    }

    const distanceSurcharge = (distance != null && distance > FREE_DELIVERY_DISTANCE_KM)
      ? Math.ceil(distance - FREE_DELIVERY_DISTANCE_KM) * EXTRA_DELIVERY_PER_KM
      : 0;
    res.json({
      success: true,
      fee,
      distance,
      withinRange,
      freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD,
      baseDeliveryFee: BASE_DELIVERY_FEE,
      freeDistanceKm: FREE_DELIVERY_DISTANCE_KM,
      extraPerKm: EXTRA_DELIVERY_PER_KM,
      distanceSurcharge,
    });
  } catch (err) {
    console.error("delivery-fee error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/checkout/addresses ─────────────────────────────────────────────
router.post("/addresses", async (req, res) => {
  const { userId, address_line, city, pincode, lat, lng } = req.body;
  if (!userId || !address_line || !city || !pincode) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }
  try {
    // If this is the first address, make it default
    const { rows: existing } = await pool.query(
      `SELECT COUNT(*) AS cnt FROM addresses WHERE user_id = $1`, [userId]
    );
    const isDefault = parseInt(existing[0].cnt) === 0;

    const { rows } = await pool.query(
      `INSERT INTO addresses (user_id, address_line, city, pincode, is_default, lat, lng)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [userId, address_line.trim(), city.trim(), pincode.trim(), isDefault,
       lat ?? null, lng ?? null]
    );
    res.json({ success: true, address: rows[0] });
  } catch (err) {
    console.error("POST addresses error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── DELETE /api/checkout/addresses/:id ────────────────────────────────────────
router.delete("/addresses/:id", async (req, res) => {
  const { id } = req.params;
  if (!id) return res.status(400).json({ success: false, message: "Address ID required" });
  try {
    await pool.query(`DELETE FROM addresses WHERE id = $1`, [id]);
    res.json({ success: true });
  } catch (err) {
    console.error("DELETE address error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/rewards?userId=xxx ─────────────────────────────────────
// Returns the user's available reward credits.
router.get("/rewards", async (req, res) => {
  const { userId } = req.query;
  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }
  try {
    const { rows: refRows } = await pool.query(
      `SELECT COALESCE(SUM(value), 0)::float AS amount,
              COUNT(*)::int AS count
       FROM user_rewards
       WHERE user_id = $1 AND type = 'referral_50' AND status = 'available'`,
      [userId]
    );
    const { rows: clothRows } = await pool.query(
      `SELECT COALESCE(SUM(value), 0)::int AS items,
              COUNT(*)::int AS count
       FROM user_rewards
       WHERE user_id = $1 AND type = 'clothing_pct' AND status = 'available'`,
      [userId]
    );
    const items = clothRows[0].items;
    // Check if user is a first-time buyer (no successful orders yet)
    const { rows: orderRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled')`,
      [userId]
    );
    const isFirstOrder = orderRows[0].cnt === 0;
    res.json({
      success: true,
      referralAmount: refRows[0].amount,
      referralCount: refRows[0].count,
      clothingItems: items,
      clothingPercent: Math.min(items, 5),
      isFirstOrder,
    });
  } catch (err) {
    console.error("GET rewards error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/checkout/orders ─────────────────────────────────────────────────
// Body: { userId, addressId, items: [{variantId, quantity, price}], totalAmount, isTryOrder?, useReferralReward?, useClothingReward? }
router.post("/orders", async (req, res) => {
  const {
    userId,
    addressId,
    items,
    totalAmount,
    isTryOrder,
    useReferralReward,
    useClothingReward,
    useFirstOrderDiscount,
    manualOfferType,
    manualOfferDiscount,
  } = req.body;
  if (!userId || !addressId || !items?.length || !totalAmount) {
    return res.status(400).json({ success: false, message: "Missing required fields" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Find the address with city and coordinates
    const { rows: addrRows } = await client.query(
      `SELECT city, lat, lng FROM addresses WHERE id = $1 AND user_id = $2`, [addressId, userId]
    );
    if (!addrRows.length) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Address not found" });
    }
    const city = addrRows[0].city;

    // Get address lat/lng for fee calculation
    const addrLat = addrRows[0]?.lat;
    const addrLng = addrRows[0]?.lng;

    let { storeId: darkStoreId, storeRows, mixedStores, vendorOffline } = await resolveOrderStore(client, items);
    if (mixedStores) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Cart contains items from multiple stores. Please checkout one store at a time.",
      });
    }
    if (vendorOffline) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This store is currently OFF. Products are unavailable right now.",
      });
    }

    let distanceKm = null;
    const primaryStore = storeRows[0] || null;
    if (primaryStore?.lat != null && primaryStore?.lng != null && addrLat != null && addrLng != null) {
      distanceKm = Math.round(
        haversineKm(
          parseFloat(addrLat),
          parseFloat(addrLng),
          parseFloat(primaryStore.lat),
          parseFloat(primaryStore.lng)
        ) * 10
      ) / 10;
    } else if (!darkStoreId) {
      // Fallback: city match only if no vendor-linked store could be resolved.
      const { rows: cityStore } = await client.query(
        `SELECT id FROM dark_stores WHERE is_active = true AND lower(city) = lower($1) LIMIT 1`,
        [city]
      );
      darkStoreId = cityStore.length ? cityStore[0].id : null;
    }

    // Calculate delivery fee
    const itemsSubtotal = totalAmount; // client now sends subtotal (items only)
    const productUnits = items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
    const shippingPackagingHandlingFee = productUnits * SPH_FEE_PER_PRODUCT;
    const platformFee = PLATFORM_FEE_FLAT;
    
    // ── Calculate bundle discount ───
    const bundleDiscount = await calculateBundleDiscount(items, itemsSubtotal, client);
    const subtotalAfterBundle = itemsSubtotal - bundleDiscount;

    // ── First Order Discount: 50% off highest priced item ───
    let firstOrderDiscount = 0;
    if (useFirstOrderDiscount) {
      // Verify user truly has no prior non-cancelled orders
      const { rows: priorOrders } = await client.query(
        `SELECT COUNT(*)::int AS cnt FROM orders WHERE user_id = $1 AND status NOT IN ('cancelled')`,
        [userId]
      );
      if (priorOrders[0].cnt === 0 && items.length > 0) {
        const highestPrice = Math.max(...items.map(i => parseFloat(i.price) || 0));
        firstOrderDiscount = Math.round(highestPrice * 0.5 * 100) / 100;
      }
    }

    const deliveryFee = calcDeliveryFee(subtotalAfterBundle, distanceKm);

    // ── Allow only ONE offer per order ─────────────────────────────────────
    const hasManualOffer = !!manualOfferType;
    const selectedOfferCount = [
      useReferralReward,
      useClothingReward,
      useFirstOrderDiscount,
      hasManualOffer,
    ]
      .filter(Boolean).length;
    if (selectedOfferCount > 1) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Only one offer can be applied per order.",
      });
    }

    const allowedManualOfferTypes = new Set(['spin', 'quest', 'coupon', 'auto']);
    let externalOfferType = null;
    let externalOfferDiscount = 0;
    if (hasManualOffer) {
      if (!allowedManualOfferTypes.has(String(manualOfferType))) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: "Invalid manual offer type.",
        });
      }
      externalOfferType = String(manualOfferType);
      const requestedDiscount = parseFloat(manualOfferDiscount) || 0;
      externalOfferDiscount = Math.max(
        0,
        Math.min(requestedDiscount, subtotalAfterBundle)
      );
    }

    // ── Apply one reward only (referral OR clothing OR first-order) ───────
    let referralRewardId = null;
    let clothingRewardIds = [];
    let referralDiscount = 0;
    let clothingDiscount = 0;

    if (useReferralReward) {
      const { rows: refRewards } = await client.query(
        `SELECT id, value FROM user_rewards
         WHERE user_id = $1 AND type = 'referral_50' AND status = 'available'
         ORDER BY created_at ASC
         LIMIT 1
         FOR UPDATE`,
        [userId]
      );
      if (refRewards.length) {
        referralRewardId = refRewards[0].id;
        referralDiscount = Math.min(parseFloat(refRewards[0].value) || 0, subtotalAfterBundle);
      }
    } else if (useClothingReward) {
      const { rows: clothRewards } = await client.query(
        `SELECT id, value FROM user_rewards
         WHERE user_id = $1 AND type = 'clothing_pct' AND status = 'available'
         ORDER BY created_at ASC
         FOR UPDATE`,
        [userId]
      );
      if (clothRewards.length) {
        const totalItems = clothRewards.reduce(
          (s, r) => s + (parseFloat(r.value) || 0),
          0
        );
        const percent = Math.min(totalItems, 5);
        clothingDiscount = Math.round((subtotalAfterBundle * percent) / 100 * 100) / 100;
        clothingRewardIds = clothRewards.map((r) => r.id);
      }
    }

    const totalDiscount =
      referralDiscount +
      clothingDiscount +
      firstOrderDiscount +
      externalOfferDiscount;
    const discountedSubtotal = Math.max(subtotalAfterBundle - totalDiscount, 0);
    const finalAmount = discountedSubtotal + deliveryFee + platformFee + shippingPackagingHandlingFee;

    // Create order
    const { rows: orderRows } = await client.query(
      `INSERT INTO orders
         (user_id, address_id, status, total_amount, final_amount,
          payment_method, dark_store_id, is_try_order,
          referral_discount, clothing_discount, bundle_discount, first_order_discount)
       VALUES ($1, $2, 'placed', $3, $4, 'cod', $5, $6, $7, $8, $9, $10)
       RETURNING id, status, total_amount, final_amount, created_at`,
      [userId, addressId, itemsSubtotal, finalAmount, darkStoreId, isTryOrder === true,
       referralDiscount, clothingDiscount, bundleDiscount, firstOrderDiscount]
    );
    const order = orderRows[0];

    // Insert order items
    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, variant_id, quantity, price, item_status)
         VALUES ($1, $2, $3, $4, 'pending')`,
        [order.id, item.variantId, item.quantity, item.price]
      );
    }

    // Mark consumed reward credits as used.
    if (referralRewardId) {
      await client.query(
        `UPDATE user_rewards SET status = 'used', used_at = NOW(), order_id = $1
         WHERE id = $2`,
        [order.id, referralRewardId]
      );
    }
    if (clothingRewardIds.length) {
      await client.query(
        `UPDATE user_rewards SET status = 'used', used_at = NOW(), order_id = $1
         WHERE id = ANY($2::uuid[])`,
        [order.id, clothingRewardIds]
      );
    }

    // ── Track referral: if this user was referred, credit the referrer ₹50 on first order ──
    const { rows: userRows } = await client.query(
      `SELECT referred_by FROM users WHERE id = $1`, [userId]
    );
    if (userRows.length && userRows[0].referred_by) {
      // Check if this is the user's first order (excluding try orders)
      const { rows: orderCountRows } = await client.query(
        `SELECT COUNT(*) AS cnt FROM orders WHERE user_id = $1 AND is_try_order = false AND id != $2`,
        [userId, order.id]
      );
      if (parseInt(orderCountRows[0].cnt) === 0) {
        // This is the first order! Credit the referrer ₹50
        const referrerId = userRows[0].referred_by;
        
        // Create a referral tracking record
        await client.query(
          `INSERT INTO referrals (referrer_id, referred_user_id, order_id)
           VALUES ($1, $2, $3)
           ON CONFLICT (referrer_id, referred_user_id) DO UPDATE
           SET order_id = $3, created_at = NOW()`,
          [referrerId, userId, order.id]
        );
        
        // Credit ₹50 to the referrer
        await client.query(
          `INSERT INTO user_rewards (user_id, type, value, status, source_order_id)
           VALUES ($1, 'referral_50', 50, 'available', $2)`,
          [referrerId, order.id]
        );
      }
    }

    await client.query("COMMIT");
    // Push "order placed" to the customer (best-effort)
    notifyCustomerOfStatus(pool, order.id, 'placed').catch(() => {});
    notifyVendorOfNewOrder(pool, order.id).catch(() => {});
    sendOrderAlertEmail(pool, order.id).catch((err) => {
      console.error(`[mail] Order alert failed for ${order.id}:`, err.message);
    });
    res.json({
      success: true,
      orderId: order.id,
      status: order.status,
      totalAmount: order.total_amount,
      bundleDiscount: bundleDiscount,
      deliveryFee: deliveryFee,
      platformFee,
      shippingPackagingHandlingFee,
      referralDiscount,
      clothingDiscount,
      manualOfferType: externalOfferType,
      manualOfferDiscount: externalOfferDiscount,
      finalAmount: order.final_amount,
      distanceKm: distanceKm,
      createdAt: order.created_at,
      darkStoreAssigned: !!darkStoreId,
    });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("POST orders error:", err.message, err.detail ?? '');
    res.status(500).json({ success: false, message: err.detail ?? err.message ?? "Server error" });
  } finally {
    client.release();
  }
});

// ── GET /api/checkout/orders?userId=xxx ──────────────────────────────────────
router.get("/orders", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: "userId required" });
  try {
    const hasCancelReason = await hasOrdersColumn('cancel_reason');
    const cancelReasonSelect = hasCancelReason
      ? 'o.cancel_reason,'
      : 'NULL::text AS cancel_reason,';

    const { rows } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.total_amount,
         o.final_amount,
         o.payment_method,
         o.is_try_order,
         o.created_at,
         ${cancelReasonSelect}
         a.address_line,
         a.city,
         a.pincode,
         json_agg(json_build_object(
           'variant_id',  oi.variant_id,
           'quantity',    oi.quantity,
           'price',       oi.price,
           'item_status', oi.item_status,
           'product_name',p.name,
           'size',        v.size,
           'color',       v.color,
           'image',       (SELECT url FROM product_media WHERE variant_id = v.id AND is_primary = true LIMIT 1)
         ) ORDER BY oi.id) AS items
       FROM orders o
       LEFT JOIN addresses a ON a.id = o.address_id
       JOIN order_items oi ON oi.order_id = o.id
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE o.user_id = $1
       GROUP BY o.id, a.address_line, a.city, a.pincode
       ORDER BY o.created_at DESC`,
      [userId]
    );
    res.json({ success: true, orders: rows });
  } catch (err) {
    console.error("GET user orders error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/checkout/orders/:orderId ─────────────────────────────────────────
router.get("/orders/:orderId", async (req, res) => {
  const { orderId } = req.params;
  try {
    const hasCancelReason = await hasOrdersColumn('cancel_reason');
    const cancelReasonSelect = hasCancelReason
      ? 'o.cancel_reason,'
      : 'NULL::text AS cancel_reason,';

    const { rows: orderRows } = await pool.query(
      `SELECT
         o.id,
         o.status,
         o.total_amount,
         o.final_amount,
         o.payment_method,
         o.is_try_order,
         o.created_at,
         o.confirmed_at,
         ${cancelReasonSelect}
         u.name   AS customer_name,
         u.phone  AS customer_phone,
         a.address_line,
         a.city,
         a.pincode,
         a.lat    AS address_lat,
         a.lng    AS address_lng,
         COALESCE(ds.name, (SELECT name FROM dark_stores WHERE is_active=true AND lower(city)=lower(a.city) LIMIT 1)) AS dark_store_name,
         COALESCE(ds.lat,  (SELECT lat  FROM dark_stores WHERE is_active=true AND lower(city)=lower(a.city) LIMIT 1)) AS dark_store_lat,
         COALESCE(ds.lng,  (SELECT lng  FROM dark_stores WHERE is_active=true AND lower(city)=lower(a.city) LIMIT 1)) AS dark_store_lng
       FROM orders o
       LEFT JOIN users u ON u.id = o.user_id
       LEFT JOIN addresses a ON a.id = o.address_id
       LEFT JOIN dark_stores ds ON ds.id = o.dark_store_id
       WHERE o.id = $1`,
      [orderId]
    );
    if (!orderRows.length) return res.status(404).json({ success: false, message: "Order not found" });

    const { rows: itemRows } = await pool.query(
      `SELECT
         oi.variant_id,
         oi.quantity,
         oi.price,
         oi.item_status,
         p.name  AS product_name,
         v.size,
         v.color,
         (SELECT url FROM product_media WHERE variant_id = v.id AND is_primary = true LIMIT 1) AS image
       FROM order_items oi
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    res.json({ success: true, order: { ...orderRows[0], items: itemRows } });
  } catch (err) {
    console.error("GET order detail error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/checkout/orders/darkstore/:storeId ───────────────────────────────
router.get("/orders/darkstore/:storeId", async (req, res) => {
  const { storeId } = req.params;
  const { status } = req.query; // optional filter: pending, confirmed, etc.
  try {
    let query = `
      SELECT
        o.id,
        o.status,
        o.total_amount,
        o.payment_method,
        o.created_at,
        u.name   AS customer_name,
        u.phone  AS customer_phone,
        a.address_line,
        a.city,
        a.pincode,
        CASE WHEN d.id IS NOT NULL THEN json_build_object(
          'name', ru.name, 'phone', ru.phone,
          'vehicle_type', r.vehicle_type, 'vehicle_number', r.vehicle_number
        ) END AS rider,
        d.store_pickup_otp,
        d.store_pickup_verified_at,
        json_agg(json_build_object(
          'variant_id', oi.variant_id,
          'quantity',   oi.quantity,
          'price',      oi.price,
          'item_status',oi.item_status,
          'product_name', p.name,
          'size',       v.size,
          'color',      v.color
        ) ORDER BY oi.id) AS items
      FROM orders o
      JOIN users u ON u.id = o.user_id
      JOIN addresses a ON a.id = o.address_id
      JOIN order_items oi ON oi.order_id = o.id
      JOIN product_variants v ON v.id = oi.variant_id
      JOIN products p ON p.id = v.product_id
      LEFT JOIN deliveries d  ON d.order_id = o.id AND d.is_active = TRUE
      LEFT JOIN "Riders" r     ON r.id = d.rider_id
      LEFT JOIN users ru      ON ru.id = r.user_id
      WHERE o.dark_store_id = $1
    `;
    const values = [storeId];
    if (status) {
      query += ` AND o.status = $2`;
      values.push(status);
    }
    query += ` GROUP BY o.id, u.name, u.phone, a.address_line, a.city, a.pincode, d.id, d.store_pickup_otp, d.store_pickup_verified_at, ru.name, ru.phone, r.vehicle_type, r.vehicle_number ORDER BY o.created_at DESC`;

    const { rows } = await pool.query(query, values);
    res.json({ success: true, orders: rows });
  } catch (err) {
    console.error("GET darkstore orders error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/orders/:orderId/invoice ─────────────────────────────────
router.get("/orders/:orderId/invoice", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows: orderRows } = await pool.query(
      `SELECT o.id, o.created_at, o.total_amount, o.final_amount,
              o.referral_discount, o.clothing_discount, o.bundle_discount,
              o.first_order_discount, o.status, o.payment_method,
              u.name AS customer_name, u.phone AS customer_phone,
              a.address_line, a.city, a.pincode
       FROM orders o
       JOIN users u ON u.id = o.user_id
       JOIN addresses a ON a.id = o.address_id
       WHERE o.id = $1`,
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
  thead th:nth-child(2),thead th:nth-child(3),thead th:nth-child(4){text-align:center;text-align:right}
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
      <strong>TAX INVOICE</strong>
      Order #${shortId}<br/>${date}<br/>
      <span style="font-size:11px;color:#6b7280">GSTIN: 21AAOCB8427B1ZY</span><br/>
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
    GSTIN: 21AAOCB8427B1ZY &nbsp;|&nbsp;
    Payment: ${order.payment_method?.toUpperCase() || "COD"} &nbsp;|&nbsp;
    Thank you for shopping with BlinkieFash!<br/>
    Questions? hello@blinkiefash.in
  </div>
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (err) {
    console.error("Invoice error:", err);
    res.status(500).send("Could not generate invoice");
  }
});

// ── PATCH /api/checkout/orders/:orderId/status ────────────────────────────────
router.patch("/orders/:orderId/status", async (req, res) => {
  const { orderId } = req.params;
  const { status, cancelReason } = req.body;
  const validStatuses = ["placed", "confirmed", "packed", "picked", "out_for_delivery", "delivered", "trial_started", "trial_completed", "completed", "cancelled"];
  if (!validStatuses.includes(status)) {
    return res.status(400).json({ success: false, message: "Invalid status" });
  }
  try {
    const [hasConfirmedAt, hasCancelReason] = await Promise.all([
      hasOrdersColumn('confirmed_at'),
      hasOrdersColumn('cancel_reason'),
    ]);

    const canSetConfirmedAt = status === 'confirmed' && hasConfirmedAt;
    const canSetCancelReason = status === 'cancelled' && hasCancelReason && !!cancelReason;

    const confirmClause = canSetConfirmedAt
      ? ', confirmed_at = COALESCE(confirmed_at, NOW())'
      : '';
    const cancelClause = canSetCancelReason ? ', cancel_reason = $3' : '';
    const params = canSetCancelReason
      ? [status, orderId, cancelReason.substring(0, 500)]
      : [status, orderId];
    const { rows } = await pool.query(
      `UPDATE orders SET status = $1${confirmClause}${cancelClause} WHERE id = $2 RETURNING id, status`,
      params
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Order not found" });
    // Notify available riders when order becomes confirmed
    if (status === 'confirmed') {
      notifyAvailableRiders(pool, rows[0].id).catch(() => {});
    }
    // Push the status update to the customer's device
    notifyCustomerOfStatus(pool, rows[0].id, status).catch(() => {});
    res.json({ success: true, order: rows[0] });
  } catch (err) {
    console.error("PATCH order status error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/darkstores ──────────────────────────────────────────────
router.get("/darkstores", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, name, city, address FROM dark_stores WHERE is_active = true ORDER BY name`
    );
    res.json({ success: true, stores: rows });
  } catch {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/darkstore/:id/products ──────────────────────────────────
// Get all products available in a specific dark store with inventory
router.get("/darkstore/:storeId/products", async (req, res) => {
  try {
    const { storeId } = req.params;

    // Get all products with variants that have inventory in this dark store
    const result = await pool.query(
      `SELECT DISTINCT
         p.id, p.name, p.vendor_id, p.category_id, p.brand_id,
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
       JOIN product_variants pv ON pv.product_id = p.id
       JOIN inventory i ON i.variant_id = pv.id
       WHERE p.is_active = true AND i.store_id = $1 AND i.stock > 0`,
      [storeId]
    );

    const products = result.rows;

    // For each product, fetch its variants with inventory in this store
    const productsWithVariants = await Promise.all(
      products.map(async (product) => {
        const variantsResult = await pool.query(
          `SELECT pv.id, pv.product_id, pv.size, pv.color, pv.barcode, pv.price, pv.mrp, pv.is_active,
                  COALESCE(i.stock, 0) as quantity,
                  i.store_id
           FROM product_variants pv
           LEFT JOIN inventory i ON i.variant_id = pv.id AND i.store_id = $1
           WHERE pv.product_id = $2 AND pv.is_active = true`,
          [storeId, product.id]
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

// ── GET /api/checkout/orders/:orderId/rider ───────────────────────────────────
router.get("/orders/:orderId/rider", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT
         u.name        AS name,
         u.phone       AS phone,
         r.vehicle_type,
         r.vehicle_number,
         r.current_lat AS lat,
         r.current_lng AS lng,
         d.id          AS delivery_id,
         d.status      AS delivery_status
       FROM deliveries d
       JOIN "Riders" r ON r.id = d.rider_id
       JOIN users  u ON u.id = r.user_id
       WHERE d.order_id = $1 AND d.is_active = TRUE
       LIMIT 1`,
      [orderId]
    );
    if (!rows.length) return res.json({ success: false, message: "No rider assigned" });
    res.json({ success: true, rider: rows[0] });
  } catch (err) {
    console.error("GET rider error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/checkout/orders/:orderId/location ────────────────────────────────
router.get("/orders/:orderId/location", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT dt.lat, dt.lng, dt.recorded_at
       FROM delivery_tracking dt
       JOIN deliveries d ON d.id = dt.delivery_id
       WHERE d.order_id = $1 AND d.is_active = TRUE
       ORDER BY dt.recorded_at DESC
       LIMIT 1`,
      [orderId]
    );
    if (!rows.length) return res.json({ success: false, message: "No location yet" });
    res.json({ success: true, location: rows[0] });
  } catch (err) {
    console.error("GET location error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── GET /api/checkout/orders/:orderId/delivery-status ────────────────────────
// Customer polls this to get OTP + try-buy status
router.get("/orders/:orderId/delivery-status", async (req, res) => {
  const { orderId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT o.delivery_otp,
              o.otp_verified_at,
              o.is_try_order,
              o.try_buy_mode,
              o.try_buy_started_at,
              o.try_buy_deadline,
              o.try_buy_decision,
              o.status AS order_status,
              d.status AS delivery_status
       FROM orders o
       LEFT JOIN deliveries d ON d.order_id = o.id AND d.is_active = TRUE
       WHERE o.id = $1`,
      [orderId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Order not found" });
    res.json({ success: true, data: rows[0] });
  } catch (err) {
    console.error("GET delivery-status error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
