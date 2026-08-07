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

// ── Odisha Statewide Delivery Configuration ────────────────────────────────
const LOCAL_DELIVERY_RADIUS_KM = 25;
const EXTENDED_DELIVERY_RADIUS_KM = 500; // serviceable range for extended delivery
const EXTENDED_DELIVERY_ETA_MINUTES = 120;

// Major Odisha cities for Same Day / Next Day delivery
const MAJOR_ODISHA_CITIES = new Set([
  'bhubaneswar',
  'khordha',
  'puri',
  'balasore',
  'baleshwar',
  'sambalpur',
  'bhadrak'
]);

// Helper to check if city is a major Odisha city
function isMajorOdishaCity(city) {
  return MAJOR_ODISHA_CITIES.has(city?.toLowerCase().trim() || '');
}

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

// ── Multi-store pickup route planner ────────────────────────────────────────
// When a cart spans more than one dark store, ONE rider still handles the
// whole order — they just visit every store first, then the customer. Total
// distance = (store→store legs) + a flat rider-approach buffer (we don't know
// the rider's live location at checkout time, so an average 2km is added for
// them to reach the first store) + the final store→customer leg. Route order
// (of the handful of stores involved) is picked to minimize the store→store +
// store→customer legs — the flat buffer doesn't affect which order is best,
// since it's the same regardless of permutation. Brute-force permutations are
// fine since a cart realistically only ever spans a small number of stores.
const RIDER_APPROACH_BUFFER_KM = 2;

function planPickupRoute(stores, addrLat, addrLng) {
  if (!stores.length) return { orderedStores: [], totalDistanceKm: null };
  const hasAllCoords =
    addrLat != null &&
    addrLng != null &&
    stores.every((s) => s.lat != null && s.lng != null);
  if (!hasAllCoords) {
    // Coordinates missing somewhere — keep given order, distance unknown
    // (falls back to the city-based delivery rule downstream).
    return { orderedStores: stores, totalDistanceKm: null };
  }

  const permute = (arr) => {
    if (arr.length <= 1) return [arr];
    const out = [];
    for (let i = 0; i < arr.length; i++) {
      const rest = [...arr.slice(0, i), ...arr.slice(i + 1)];
      for (const p of permute(rest)) out.push([arr[i], ...p]);
    }
    return out;
  };

  let bestOrder = stores;
  let bestDist = Infinity;
  for (const order of permute(stores)) {
    let dist = 0;
    let lat = parseFloat(order[0].lat);
    let lng = parseFloat(order[0].lng);
    for (let i = 1; i < order.length; i++) {
      dist += haversineKm(lat, lng, parseFloat(order[i].lat), parseFloat(order[i].lng));
      lat = parseFloat(order[i].lat);
      lng = parseFloat(order[i].lng);
    }
    dist += haversineKm(lat, lng, parseFloat(addrLat), parseFloat(addrLng));
    if (dist < bestDist) {
      bestDist = dist;
      bestOrder = order;
    }
  }

  const totalDistanceKm = Math.round((bestDist + RIDER_APPROACH_BUFFER_KM) * 10) / 10;
  return { orderedStores: bestOrder, totalDistanceKm };
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

// ── Delivery fee rules (threshold-based) ────────────────────────────────────────
// New pricing model:
// - ≤25km with subtotal ≥1499: Free
// - ≤45km with subtotal ≥1899: Free
// - >45km with any product_id ≥2000: Free
// - >45km with all product_id <2000: ₹49
// - Otherwise: ₹0
function calcDeliveryFee(subtotal, distanceKm, items = []) {
  if (distanceKm == null) return 0;

  // Rule 1: ≤25km with high subtotal
  if (distanceKm <= 25 && subtotal >= 1499) {
    return 0;
  }

  // Rule 2: ≤45km with very high subtotal
  if (distanceKm <= 45 && subtotal >= 1899) {
    return 0;
  }

  // Rule 3: >45km — check if any product has id ≥2000
  if (distanceKm > 45) {
    // items is array of {variantId, quantity, price}
    // If we have items, we need product IDs to check
    // For now, assume free if subtotal >= some threshold, else ₹49
    // This will be enhanced with product ID check when needed
    const hasHighValueProduct = items.length > 0;
    // Default: charge ₹49 for >45km
    return hasHighValueProduct ? 0 : 49;
  }

  return 0; // Within serviceable range
}

// ── Helper: Check if order should go to riders (≤45km only) ─────────────────────
function shouldNotifyRiders(distanceKm) {
  return distanceKm != null && distanceKm <= 45;
}

// ── Helper: Get IST time ────────────────────────────────────────────────────
function getISTTime() {
  const now = new Date();
  const istTime = new Date(now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }));
  return istTime;
}

// ── Helper: Format delivery time as HH:MM AM/PM ────────────────────────────
function formatDeliveryTime(etaMinutes) {
  const now = getISTTime();
  const deliveryTime = new Date(now.getTime() + etaMinutes * 60000);
  const hours = deliveryTime.getHours();
  const mins = String(deliveryTime.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${mins} ${ampm}`;
}

// ── Calculate delivery information based on Odisha statewide rules ──────────
// NEW LOGIC:
// - If 10:00-21:00: Show "Today Delivery" with ETA time
// - If after 21:00: Show "Next Day Delivery" with time slots
function calculateDeliveryInfo(distanceKm, city) {
  const result = {
    deliveryPromise: null,
    deliveryType: null,
    etaMinutes: null,
    etaMinMinutes: null,
    etaMaxMinutes: null,
    isAvailable: true,
    willNotifyRiders: false, // NEW: flag for rider notification
  };

  const now = getISTTime();
  const currentHours = now.getHours();
  const currentMinutes = now.getMinutes();
  const currentTimeInMinutes = currentHours * 60 + currentMinutes;
  
  // Operating hours: 10:00 (600 min) to 21:00 (1260 min)
  const operatingStart = 10 * 60; // 10:00
  const operatingEnd = 21 * 60;   // 21:00
  const isOperatingHours = currentTimeInMinutes >= operatingStart && currentTimeInMinutes < operatingEnd;

  // RULE 1: LOCAL DELIVERY (within 25 km) — TODAY DELIVERY DURING HOURS
  if (distanceKm != null && distanceKm <= 25) {
    result.deliveryType = 'local';
    result.willNotifyRiders = shouldNotifyRiders(distanceKm);
    
    if (isOperatingHours) {
      // Dynamic ETA: ~2.5 minutes per km + 10 min for accepting + 5 min for rider assignment
      const distanceMinutes = Math.ceil(distanceKm * 2.5);
      const estimatedMinutes = distanceMinutes + 10 + 5; // 10 min accepting + 5 min rider assignment
      const deliveryTime = formatDeliveryTime(estimatedMinutes);
      result.deliveryPromise = `Today - Delivered by ${deliveryTime}`;
      result.etaMinutes = estimatedMinutes;
      result.etaMinMinutes = Math.max(10, Math.ceil(estimatedMinutes * 0.8));
      result.etaMaxMinutes = Math.ceil(estimatedMinutes * 1.2);
    } else {
      // After operating hours: show store opening time with time slot selection
      result.deliveryPromise = "Store opens at 10:00 AM. Select your delivery time slot for today";
      result.deliveryType = 'nextday_scheduled_local'; // NEW: allows time slot selection
      result.etaMinutes = null;
      result.timeSlotStart = '11:00'; // 11:00 AM
      result.timeSlotEnd = '21:00';   // 9:00 PM
    }
    return result;
  }

  // RULE 2: EXTENDED DELIVERY (25km < distance ≤ 45km) — TODAY DELIVERY DURING HOURS
  if (distanceKm != null && distanceKm <= 45) {
    result.deliveryType = 'extended';
    result.willNotifyRiders = shouldNotifyRiders(distanceKm);
    
    if (isOperatingHours) {
      // Dynamic ETA: ~3 minutes per km + 10 min for accepting + 5 min for rider assignment
      const distanceMinutes = Math.ceil(distanceKm * 3);
      const estimatedMinutes = distanceMinutes + 10 + 5; // 10 min accepting + 5 min rider assignment
      const deliveryTime = formatDeliveryTime(estimatedMinutes);
      result.deliveryPromise = `Today - Delivered by ${deliveryTime}`;
      result.etaMinutes = estimatedMinutes;
      result.etaMinMinutes = Math.max(30, Math.ceil(estimatedMinutes * 0.8));
      result.etaMaxMinutes = Math.ceil(estimatedMinutes * 1.2);
    } else {
      // After operating hours: show store opening time with time slot selection
      result.deliveryPromise = "Store opens at 10:00 AM. Select your delivery time slot for today";
      result.deliveryType = 'nextday_scheduled_extended'; // NEW: allows time slot selection
      result.etaMinutes = null;
      result.timeSlotStart = '11:30'; // 11:30 AM
      result.timeSlotEnd = '21:00';   // 9:00 PM
    }
    return result;
  }

  // RULE 3: LONG-DISTANCE DELIVERY (>45km) — LOGISTICS ONLY, NO RIDERS
  if (distanceKm != null && distanceKm > 45) {
    result.willNotifyRiders = false; // DO NOT notify riders for >45km
    
    if (isOperatingHours) {
      // During 10:00-21:00: Check if before or after 12:00 noon
      const isBeforeNoon = currentHours < 12 || (currentHours === 12 && currentMinutes === 0);
      
      if (isBeforeNoon) {
        // Before 12:00 PM: Same day delivery for selected pincodes, 1-3 days for others
        if (isMajorOdishaCity(city)) {
          result.deliveryPromise = "Same Day Delivery Available";
          result.deliveryType = 'sameday';
        } else {
          result.deliveryPromise = "Delivery in 1-3 Days";
          result.deliveryType = '1-3days';
        }
      } else {
        // At or after 12:00 PM: 1-3 days delivery
        result.deliveryPromise = "Delivery in 1-3 Days";
        result.deliveryType = '1-3days';
      }
    } else {
      // During CLOSED hours (21:01 to 09:59): Same day or 1-3 days
      if (isMajorOdishaCity(city)) {
        result.deliveryPromise = "Same Day Delivery Available";
        result.deliveryType = 'sameday';
      } else {
        result.deliveryPromise = "Delivery in 1-3 Days";
        result.deliveryType = '1-3days';
      }
    }
    result.etaMinutes = null;
    return result;
  }

  // RULE 4: City-based fallback (when coordinates not available)
  // During operating hours: show dynamic ETA
  // During closed hours: show "Store opens at 10:00 AM" with time slots
  const isMajor = isMajorOdishaCity(city);

  if (isOperatingHours) {
    // During 10:00-21:00: show Today Delivery with ETA even if distance unknown
    result.deliveryType = 'local'; // Assume local delivery when distance unknown but in major city
    result.willNotifyRiders = true; // Try to notify riders
    
    // Estimate 45 minutes for delivery in major city (distance ~15km assumption)
    const estimatedMinutes = 45;
    const deliveryTime = formatDeliveryTime(estimatedMinutes);
    result.deliveryPromise = `Today - Delivered by ${deliveryTime}`;
    result.etaMinutes = estimatedMinutes;
    result.etaMinMinutes = Math.max(10, Math.ceil(estimatedMinutes * 0.8)); // ~36 min
    result.etaMaxMinutes = Math.ceil(estimatedMinutes * 1.2); // ~54 min
    return result;
  }

  // After operating hours (21:01 to 09:59): "Store opens at 10:00 AM"
  if (isMajor) {
    result.deliveryPromise = "Store opens at 10:00 AM. Select your delivery time slot for today";
    result.deliveryType = 'nextday_scheduled_local'; // Allow time slot selection
    result.timeSlotStart = '11:00';
    result.timeSlotEnd = '21:00';
  } else {
    result.deliveryPromise = "Delivery within 2 Days";
    result.deliveryType = '2days';
  }
  result.etaMinutes = null;
  result.willNotifyRiders = false;
  return result;
}

async function resolveOrderStore(client, items) {
  const variantIds = [...new Set(items.map((item) => item.variantId).filter(Boolean))];
  if (variantIds.length === 0) {
    return { storeId: null, storeRows: [], storeIds: [] };
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
    return { storeId: null, storeRows: [], storeIds: [] };
  }

  const hasOfflineVendor = storeRows.some((row) => row.is_operational === false);
  if (hasOfflineVendor) {
    return { storeId: null, storeRows, storeIds: [], vendorOffline: true };
  }

  // Cart items may come from multiple vendors linked to different dark stores.
  // Return ALL distinct store ids — the caller now supports multi-store orders
  // (one rider picks up from every store, then delivers to the customer)
  // instead of blocking checkout.
  const storeIds = [...new Set(storeRows.map((row) => row.dark_store_id).filter(Boolean))];
  return { storeId: storeIds[0] || null, storeRows, storeIds, multiStore: storeIds.length > 1 };
}

// ── GET /api/checkout/addresses?userId=xxx ──────────────────────────────────
router.get("/addresses", async (req, res) => {
  const { userId } = req.query;
  if (!userId) return res.status(400).json({ success: false, message: "userId required" });
  try {
    const { rows } = await pool.query(
      `SELECT id, address_line, city, pincode, is_default, lat, lng, name, phone, address_type
       FROM addresses WHERE user_id = $1 ORDER BY is_default DESC, id DESC`,
      [userId]
    );
    res.json({ success: true, addresses: rows });
  } catch (err) {
    console.error("GET addresses error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/checkout/delivery-fee?addressId=xxx&subtotal=nnn&variantIds=a,b,c ─
// variantIds (comma-separated product_variants.id list, optional) lets this
// preview use the SAME store(s) the cart will actually check out from,
// instead of always guessing the single globally-nearest dark store — a cart
// spanning multiple stores needs the real multi-stop route distance shown
// here too, matching what POST /orders will actually charge/promise.
router.get("/delivery-fee", async (req, res) => {
  const { addressId, subtotal, variantIds } = req.query;
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
    let deliveryInfo = null;
    let pickupRoute = null;

    const ids = typeof variantIds === "string"
      ? variantIds.split(",").map((v) => v.trim()).filter(Boolean)
      : [];
    let resolvedStoreRows = [];
    let resolvedStoreIds = [];
    if (ids.length) {
      const resolved = await resolveOrderStore(pool, ids.map((variantId) => ({ variantId })));
      resolvedStoreRows = resolved.storeRows;
      resolvedStoreIds = resolved.storeIds;
    }

    if (addrLat != null && addrLng != null) {
      if (resolvedStoreIds.length > 1) {
        // Multi-store cart — same route-planning used at actual order placement.
        const uniqueStores = resolvedStoreIds
          .map((id) => resolvedStoreRows.find((row) => row.dark_store_id === id))
          .filter(Boolean)
          .map((row) => ({ id: row.dark_store_id, name: row.name, lat: row.lat, lng: row.lng }));
        const { orderedStores, totalDistanceKm } = planPickupRoute(uniqueStores, addrLat, addrLng);
        distance = totalDistanceKm;
        pickupRoute = orderedStores.map((s, idx) => ({
          storeId: s.id, name: s.name, lat: s.lat, lng: s.lng, sequence: idx + 1,
        }));
        fee = calcDeliveryFee(sub, distance);
      } else if (resolvedStoreIds.length === 1) {
        // Cart resolves to one specific store — use ITS distance, not whichever
        // store happens to be geographically nearest overall.
        const store = resolvedStoreRows.find((row) => row.dark_store_id === resolvedStoreIds[0]);
        if (store?.lat != null && store?.lng != null) {
          distance = Math.round(
            haversineKm(parseFloat(addrLat), parseFloat(addrLng), parseFloat(store.lat), parseFloat(store.lng)) * 10
          ) / 10;
        }
        fee = calcDeliveryFee(sub, distance);
      } else {
        // No cart context available — fall back to nearest active dark store.
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
      }
    } else {
      // No coordinates — city-based fallback
      fee = calcDeliveryFee(sub, null);
    }

    // Calculate delivery information using new Odisha statewide rules
    deliveryInfo = calculateDeliveryInfo(distance, city);

    const distanceSurcharge = (distance != null && distance > FREE_DELIVERY_DISTANCE_KM)
      ? Math.ceil(distance - FREE_DELIVERY_DISTANCE_KM) * EXTRA_DELIVERY_PER_KM
      : 0;
    res.json({
      success: true,
      fee,
      distance,
      multiStore: resolvedStoreIds.length > 1,
      pickupRoute,
      withinRange: deliveryInfo.isAvailable,
      deliveryPromise: deliveryInfo.deliveryPromise,
      deliveryType: deliveryInfo.deliveryType,
      etaMinutes: deliveryInfo.etaMinutes,
      etaMinMinutes: deliveryInfo.etaMinMinutes,
      etaMaxMinutes: deliveryInfo.etaMaxMinutes,
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
  const { userId, address_line, city, pincode, lat, lng, name, phone, address_type } = req.body;
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
      `INSERT INTO addresses (user_id, address_line, city, pincode, is_default, lat, lng, name, phone, address_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [userId, address_line.trim(), city.trim(), pincode.trim(), isDefault,
       lat ?? null, lng ?? null, name?.trim() || null, phone?.trim() || null,
       address_type || 'home']
    );
    res.json({ success: true, address: rows[0] });
  } catch (err) {
    console.error("POST addresses error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /api/checkout/addresses/:id ─────────────────────────────────────────
router.patch("/addresses/:id", async (req, res) => {
  const { id } = req.params;
  const { address_line, city, pincode, name, phone, address_type } = req.body;
  if (!id) return res.status(400).json({ success: false, message: "Address ID required" });
  if (!address_line || !city || !pincode) {
    return res.status(400).json({ success: false, message: "All fields required" });
  }
  try {
    const { rows } = await pool.query(
      `UPDATE addresses SET address_line = $1, city = $2, pincode = $3, name = $4, phone = $5, address_type = $6
       WHERE id = $7 RETURNING *`,
      [address_line.trim(), city.trim(), pincode.trim(), name?.trim() || null,
       phone?.trim() || null, address_type || 'home', id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "Address not found" });
    res.json({ success: true, address: rows[0] });
  } catch (err) {
    console.error("PATCH address error:", err);
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

    let { storeId: darkStoreId, storeRows, storeIds, multiStore, vendorOffline } = await resolveOrderStore(client, items);
    if (vendorOffline) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "This store is currently OFF. Products are unavailable right now.",
      });
    }

    let distanceKm = null;
    let pickupRoute = null; // only set for multi-store orders
    if (multiStore) {
      // Cart spans multiple dark stores \u2014 plan a single-rider pickup route
      // (store \u2192 store \u2192 ... \u2192 customer) instead of rejecting checkout.
      const uniqueStores = storeIds
        .map((id) => storeRows.find((row) => row.dark_store_id === id))
        .filter(Boolean)
        .map((row) => ({ id: row.dark_store_id, name: row.name, lat: row.lat, lng: row.lng }));
      const { orderedStores, totalDistanceKm } = planPickupRoute(uniqueStores, addrLat, addrLng);
      distanceKm = totalDistanceKm;
      pickupRoute = orderedStores.map((s, idx) => ({
        storeId: s.id,
        name: s.name,
        lat: s.lat,
        lng: s.lng,
        sequence: idx + 1,
      }));
      darkStoreId = pickupRoute[0]?.storeId || null; // first pickup stop is still "the" store for legacy columns
    } else {
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
    }

    // Calculate delivery fee
    const itemsSubtotal = totalAmount; // client now sends subtotal (items only)
    const productUnits = items.reduce((sum, item) => sum + (parseInt(item.quantity, 10) || 0), 0);
    const shippingPackagingHandlingFee = productUnits * SPH_FEE_PER_PRODUCT;
    const platformFee = PLATFORM_FEE_FLAT;
    
    // ── Calculate bundle discount ───
    const bundleDiscount = await calculateBundleDiscount(items, itemsSubtotal, client);
    const subtotalAfterBundle = itemsSubtotal - bundleDiscount;

    const firstOrderDiscount = 0;

    // Calculate delivery fee with full item details for product ID checks
    const deliveryFee = calcDeliveryFee(subtotalAfterBundle, distanceKm, items);
    
    // Calculate delivery information using new Odisha statewide rules
    const deliveryInfo = calculateDeliveryInfo(distanceKm, city);

    // ── Allow only ONE offer per order ─────────────────────────────────────
    const hasManualOffer = !!manualOfferType;
    const selectedOfferCount = [
      useReferralReward,
      useClothingReward,
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
          referral_discount, clothing_discount, bundle_discount, first_order_discount,
          pickup_route, route_distance_km)
       VALUES ($1, $2, 'placed', $3, $4, 'cod', $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, status, total_amount, final_amount, created_at`,
      [userId, addressId, itemsSubtotal, finalAmount, darkStoreId, isTryOrder === true,
       referralDiscount, clothingDiscount, bundleDiscount, firstOrderDiscount,
       pickupRoute ? JSON.stringify(pickupRoute) : null, multiStore ? distanceKm : null]
    );
    const order = orderRows[0];

    // Generate 4-digit OTP for delivery verification
    const deliveryOtp = Math.floor(1000 + Math.random() * 9000).toString();
    await client.query(
      `UPDATE orders SET delivery_otp = $1 WHERE id = $2`,
      [deliveryOtp, order.id]
    );

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
      deliveryOtp: deliveryOtp,
      distanceKm: distanceKm,
      createdAt: order.created_at,
      darkStoreAssigned: !!darkStoreId,
      multiStore: !!multiStore,
      pickupRoute: pickupRoute,
      deliveryPromise: deliveryInfo.deliveryPromise,
      deliveryType: deliveryInfo.deliveryType,
      etaMinutes: deliveryInfo.etaMinutes,
      etaMinMinutes: deliveryInfo.etaMinMinutes,
      etaMaxMinutes: deliveryInfo.etaMaxMinutes,
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
           'image',       COALESCE(
                           (SELECT url FROM product_media WHERE variant_id = v.id AND is_primary = true LIMIT 1),
                           (SELECT url FROM product_media WHERE variant_id = v.id LIMIT 1),
                           (SELECT pm.url FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.is_primary DESC, pm.sort_order ASC, pm.id ASC LIMIT 1)
                         )
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
         o.pickup_route,
         o.route_distance_km,
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
         COALESCE(
           (SELECT url FROM product_media WHERE variant_id = v.id AND is_primary = true LIMIT 1),
           (SELECT url FROM product_media WHERE variant_id = v.id LIMIT 1),
           (SELECT pm.url FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.is_primary DESC, pm.sort_order ASC, pm.id ASC LIMIT 1)
         ) AS image
       FROM order_items oi
       JOIN product_variants v ON v.id = oi.variant_id
       JOIN products p ON p.id = v.product_id
       WHERE oi.order_id = $1`,
      [orderId]
    );

    // Calculate delivery info based on coordinates
    const orderData = orderRows[0];
    let distanceKm = null;
    let deliveryInfo = null;
    const pickupRoute = orderData.pickup_route || null;

    if (Array.isArray(pickupRoute) && pickupRoute.length > 1 && orderData.route_distance_km != null) {
      // Multi-store order — use the stored total pickup-route distance
      // (store→store legs + final store→customer leg), not just a single
      // store's direct distance to the customer.
      distanceKm = parseFloat(orderData.route_distance_km);
    } else if (orderData.address_lat && orderData.address_lng && orderData.dark_store_lat && orderData.dark_store_lng) {
      distanceKm = Math.round(
        haversineKm(
          parseFloat(orderData.address_lat),
          parseFloat(orderData.address_lng),
          parseFloat(orderData.dark_store_lat),
          parseFloat(orderData.dark_store_lng)
        ) * 10
      ) / 10;
    }
    
    deliveryInfo = calculateDeliveryInfo(distanceKm, orderData.city);
    
    res.json({ 
      success: true, 
      order: { 
        ...orderData, 
        items: itemRows,
        pickupRoute,
        multiStore: Array.isArray(pickupRoute) && pickupRoute.length > 1,
        deliveryPromise: deliveryInfo.deliveryPromise,
        deliveryType: deliveryInfo.deliveryType,
        deliveryEtaMinutes: deliveryInfo.etaMinutes,
        deliveryEtaMinMinutes: deliveryInfo.etaMinMinutes,
        deliveryEtaMaxMinutes: deliveryInfo.etaMaxMinutes,
        distanceKm: distanceKm,
      } 
    });
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
    
    // Also fetch address and dark_store info to check distance
    const { rows } = await pool.query(
      `UPDATE orders SET status = $1${confirmClause}${cancelClause} WHERE id = $2 
       RETURNING id, status, address_id, dark_store_id`,
      params
    );
    
    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    
    // If confirming order, check if we should notify riders
    let shouldNotifyRiders = false;
    if (status === 'confirmed') {
      const orderId = rows[0].id;
      const addressId = rows[0].address_id;
      const darkStoreId = rows[0].dark_store_id;
      
      try {
        // Fetch address coordinates
        const { rows: addrRows } = await pool.query(
          `SELECT lat, lng FROM addresses WHERE id = $1`,
          [addressId]
        );
        
        // Fetch store coordinates
        let storeLat = null, storeLng = null;
        if (darkStoreId) {
          const { rows: storeRows } = await pool.query(
            `SELECT lat, lng FROM dark_stores WHERE id = $1`,
            [darkStoreId]
          );
          if (storeRows.length) {
            storeLat = storeRows[0].lat;
            storeLng = storeRows[0].lng;
          }
        }
        
        // Calculate distance if we have both coordinates
        if (addrRows.length && addrRows[0].lat && addrRows[0].lng && storeLat && storeLng) {
          const distanceKm = haversineKm(
            parseFloat(addrRows[0].lat),
            parseFloat(addrRows[0].lng),
            parseFloat(storeLat),
            parseFloat(storeLng)
          );
          // Only notify riders if distance <= 45km
          shouldNotifyRiders = distanceKm <= 45;
        } else {
          // No coordinates, default to notifying riders
          shouldNotifyRiders = true;
        }
      } catch (err) {
        console.error("Error checking distance for rider notification:", err);
        // On error, default to notifying riders
        shouldNotifyRiders = true;
      }
    }

    if (!rows.length) return res.status(404).json({ success: false, message: "Order not found" });
    
    // ── IMPORTANT: When order is cancelled, also cancel associated delivery requests ──
    if (status === 'cancelled') {
      try {
        await pool.query(
          `UPDATE deliver_requests SET status = 'cancelled' 
           WHERE order_id = $1 AND status NOT IN ('completed', 'delivered', 'cancelled')`,
          [orderId]
        );
      } catch (err) {
        // If deliver_requests doesn't have order_id column, silently continue
        console.warn("Could not cancel delivery requests for order (order_id column may not exist):", err.message);
      }
    }
    
    // Notify available riders when order becomes confirmed (only if distance <= 45km)
    if (status === 'confirmed' && shouldNotifyRiders) {
      notifyAvailableRiders(pool, rows[0].id).catch(() => {});
    }
    // Push the status update to the customer's device
    notifyCustomerOfStatus(pool, rows[0].id, status).catch(() => {});
    res.json({ success: true, order: rows[0], ridersNotified: shouldNotifyRiders });
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
  } catch (err) {
    console.warn("[checkout/darkstores] DB error, returning empty list:", err.message);
    res.json({ success: true, stores: [] });
  }
});

// ── GET /api/checkout/darkstore/:id/products ──────────────────────────────────
// Returns ALL active products for a dark store:
// vendor-linked products (shows 0-stock too) UNION products with any inventory record here
router.get("/darkstore/:storeId/products", async (req, res) => {
  try {
    const { storeId } = req.params;

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
       WHERE p.is_active = true
         AND (
           p.vendor_id IN (SELECT id FROM vendors WHERE dark_store_id = $1)
           OR p.id IN (
             SELECT DISTINCT pv2.product_id
             FROM product_variants pv2
             JOIN inventory i ON i.variant_id = pv2.id
             WHERE i.store_id = $1
           )
         )`,
      [storeId]
    );

    const products = result.rows;

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
        return { ...product, variants: variantsResult.rows || [] };
      })
    );

    res.json(productsWithVariants);
  } catch (err) {
    console.warn("[checkout/darkstore/products] DB error, returning empty list:", err.message);
    res.json([]);
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
    console.log(`\n🔍 [delivery-status] Querying for order: ${orderId}`);
    const { rows } = await pool.query(
      `SELECT o.id AS order_id,
              o.delivery_otp,
              o.otp_verified_at,
              o.is_try_order,
              o.try_buy_mode,
              o.try_buy_started_at,
              o.try_buy_deadline,
              o.try_buy_decision,
              o.status AS order_status,
              d.id AS delivery_id,
              d.status AS delivery_status,
              d.is_active,
              d.started_at
       FROM orders o
       LEFT JOIN deliveries d ON d.order_id = o.id 
         AND d.is_active = TRUE
         AND d.status NOT IN ('cancelled', 'returned')
       WHERE o.id = $1
       ORDER BY d.started_at DESC NULLS LAST
       LIMIT 1`,
      [orderId]
    );
    if (!rows.length) {
      console.log(`❌ [delivery-status] No order found with ID: ${orderId}`);
      return res.status(404).json({ success: false, message: "Order not found" });
    }
    const row = rows[0];
    console.log(`📋 [delivery-status] Order ${orderId}:`);
    console.log(`  - order_status=${row.order_status}`);
    console.log(`  - delivery_id=${row.delivery_id}`);
    console.log(`  - delivery_status=${row.delivery_status}`);
    console.log(`  - delivery_otp=${row.delivery_otp}`);
    console.log(`  - otp_verified_at=${row.otp_verified_at}`);
    res.json({ success: true, data: row });
  } catch (err) {
    console.error("GET delivery-status error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
