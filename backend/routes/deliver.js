import express from "express";
import { pool } from "../db.js";
import { notifyRidersOfNewParcel } from "../utils/firebaseAdmin.js";

const router = express.Router();

const CITY_ZONE = {
  cuttack: {
    label: "Cuttack",
    centerLat: 20.4625,
    centerLng: 85.883,
    radiusKm: 30,
    baseFare: 20,
    perKm: 8,
    minFare: 35,
  },
  bhubaneswar: {
    label: "Bhubaneswar",
    centerLat: 20.2961,
    centerLng: 85.8245,
    radiusKm: 30,
    baseFare: 20,
    perKm: 8,
    minFare: 35,
  },
};

const toNumber = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
};

const haversineKm = (lat1, lng1, lat2, lng2) => {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const fetchGoogleRouteMetrics = async ({ pickupLat, pickupLng, dropLat, dropLng }) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;

  const url = new URL("https://maps.googleapis.com/maps/api/directions/json");
  url.searchParams.set("origin", `${pickupLat},${pickupLng}`);
  url.searchParams.set("destination", `${dropLat},${dropLng}`);
  url.searchParams.set("mode", "driving");
  url.searchParams.set("key", key);

  const res = await fetch(url);
  if (!res.ok) return null;
  const data = await res.json();
  if (data?.status !== "OK") return null;

  const leg = data?.routes?.[0]?.legs?.[0];
  const distanceM = Number(leg?.distance?.value);
  const durationS = Number(leg?.duration?.value);
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;

  return {
    distanceKm: Number((distanceM / 1000).toFixed(2)),
    durationMins: Number.isFinite(durationS)
      ? Math.max(1, Math.round(durationS / 60))
      : null,
    source: "google-directions",
  };
};

const fetchOsrmRouteMetrics = async ({ pickupLat, pickupLng, dropLat, dropLng }) => {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${pickupLng.toFixed(6)},${pickupLat.toFixed(6)};` +
    `${dropLng.toFixed(6)},${dropLat.toFixed(6)}?overview=false`;

  const res = await fetch(url, {
    headers: { "User-Agent": "BlinkieFashBackend/1.0" },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const route = data?.routes?.[0];
  const distanceM = Number(route?.distance);
  const durationS = Number(route?.duration);
  if (!Number.isFinite(distanceM) || distanceM <= 0) return null;

  return {
    distanceKm: Number((distanceM / 1000).toFixed(2)),
    durationMins: Number.isFinite(durationS)
      ? Math.max(1, Math.round(durationS / 60))
      : null,
    source: "osrm",
  };
};

const normalizeDistanceProvider = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (v === "google") return "google";
  if (v === "auto") return "auto";
  return "auto"; // default to auto so OSRM/haversine fallback always works
};

const getRouteMetrics = async ({
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  distanceProvider = "google",
}) => {
  const provider = normalizeDistanceProvider(distanceProvider);

  try {
    const google = await fetchGoogleRouteMetrics({
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
    });
    if (google) return google;
  } catch {}

  if (provider === "google") {
    return null;
  }

  try {
    const osrm = await fetchOsrmRouteMetrics({
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
    });
    if (osrm) return osrm;
  } catch {}

  const airKm = haversineKm(pickupLat, pickupLng, dropLat, dropLng);
  const distanceKm = Number(Math.max(airKm * 1.25, 0.5).toFixed(2));
  return {
    distanceKm,
    durationMins: Math.max(1, Math.round((distanceKm / 24) * 60)),
    source: "haversine-fallback",
  };
};

const resolveZone = (city, lat, lng) => {
  const cityKey = String(city || "").trim().toLowerCase();
  if (CITY_ZONE[cityKey]) {
    return CITY_ZONE[cityKey];
  }

  if (lat == null || lng == null) return null;

  let nearest = null;
  let best = Number.POSITIVE_INFINITY;
  for (const zone of Object.values(CITY_ZONE)) {
    const dist = haversineKm(lat, lng, zone.centerLat, zone.centerLng);
    if (dist < best) {
      best = dist;
      nearest = zone;
    }
  }
  return nearest;
};

const computeEstimate = async ({
  pickupLat,
  pickupLng,
  dropLat,
  dropLng,
  city,
  distanceProvider = "google",
}) => {
  const zone = resolveZone(city, pickupLat, pickupLng);
  if (!zone) {
    return {
      ok: false,
      message: "Service available in Cuttack and Bhubaneswar only",
    };
  }

  const fromCenter = haversineKm(
    pickupLat,
    pickupLng,
    zone.centerLat,
    zone.centerLng
  );

  if (fromCenter > zone.radiusKm) {
    return {
      ok: false,
      message: `Pickup location is outside ${zone.label} service range`,
    };
  }

  const metrics = await getRouteMetrics({
    pickupLat,
    pickupLng,
    dropLat,
    dropLng,
    distanceProvider,
  });
  if (!metrics) {
    return {
      ok: false,
      message: "Google distance is unavailable. Please verify GOOGLE_MAPS_API_KEY and Directions API.",
    };
  }
  const roundedDistance = Math.max(Number(metrics.distanceKm.toFixed(2)), 0.5);
  const rawFare = zone.baseFare + roundedDistance * zone.perKm;
  const fare = Math.max(zone.minFare, Math.round(rawFare));

  return {
    ok: true,
    cityZone: zone.label,
    distanceKm: roundedDistance,
    etaMinutes: metrics.durationMins,
    routeSource: metrics.source,
    estimatedFare: fare,
    fareBreakup: {
      baseFare: zone.baseFare,
      perKm: zone.perKm,
      minimumFare: zone.minFare,
    },
  };
};

const ensureTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS deliver_requests (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID,
      vendor_id UUID,
      pickup_text TEXT NOT NULL,
      drop_text TEXT NOT NULL,
      pickup_lat DECIMAL(10, 7),
      pickup_lng DECIMAL(10, 7),
      drop_lat DECIMAL(10, 7),
      drop_lng DECIMAL(10, 7),
      distance_km DECIMAL(10, 2) NOT NULL,
      estimated_fare DECIMAL(12, 2) NOT NULL,
      city_zone VARCHAR(40) NOT NULL,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMPTZ DEFAULT now(),
      accepted_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ
    )
  `);
  // Add tracking columns if they don't exist yet
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS rider_id UUID`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS rider_name TEXT`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS rider_phone TEXT`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS rider_lat DECIMAL(10,7)`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS rider_lng DECIMAL(10,7)`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS receiver_name TEXT`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS receiver_phone TEXT`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS note TEXT`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS who_pays VARCHAR(20) DEFAULT 'sender'`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6)`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS otp_verified BOOLEAN DEFAULT FALSE`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS otp_generated_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS otp_verified_at TIMESTAMPTZ`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS delivery_photo_url TEXT`);
  await pool.query(`ALTER TABLE deliver_requests ADD COLUMN IF NOT EXISTS last_broadcast_at TIMESTAMPTZ`);
};

// Re-notify available riders for any parcel still pending/unassigned 2+ minutes
// after it was created or last broadcast, so it keeps reaching online riders.
const REBROADCAST_INTERVAL_MS = 60 * 1000;
const REBROADCAST_AFTER_SQL = "INTERVAL '2 minutes'";

async function rebroadcastStaleParcels() {
  try {
    await ensureTables();
    const { rows } = await pool.query(
      `SELECT id, pickup_lat, pickup_lng
       FROM deliver_requests
       WHERE status = 'pending'
         AND rider_id IS NULL
         AND created_at <= NOW() - ${REBROADCAST_AFTER_SQL}
         AND (last_broadcast_at IS NULL OR last_broadcast_at <= NOW() - ${REBROADCAST_AFTER_SQL})`
    );
    for (const r of rows) {
      await notifyRidersOfNewParcel(pool, r.id, r.pickup_lat, r.pickup_lng);
      await pool.query(
        `UPDATE deliver_requests SET last_broadcast_at = NOW() WHERE id = $1`,
        [r.id]
      );
    }
  } catch (err) {
    console.error("rebroadcastStaleParcels error", err.message);
  }
}

setInterval(rebroadcastStaleParcels, REBROADCAST_INTERVAL_MS);

router.get("/estimate", async (req, res) => {
  try {
    const pickupLat = toNumber(req.query.pickupLat);
    const pickupLng = toNumber(req.query.pickupLng);
    const dropLat = toNumber(req.query.dropLat);
    const dropLng = toNumber(req.query.dropLng);
    const city = req.query.city;
    const distanceProvider = normalizeDistanceProvider(
      req.query.distanceProvider
    );

    if (
      pickupLat == null ||
      pickupLng == null ||
      dropLat == null ||
      dropLng == null
    ) {
      return res.status(400).json({
        success: false,
        message: "pickupLat, pickupLng, dropLat, dropLng are required",
      });
    }

    const estimate = await computeEstimate({
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      city,
      distanceProvider,
    });

    if (!estimate.ok) {
      return res.status(400).json({
        success: false,
        message: estimate.message,
      });
    }

    return res.json({
      success: true,
      cityZone: estimate.cityZone,
      distanceKm: estimate.distanceKm,
      etaMinutes: estimate.etaMinutes,
      routeSource: estimate.routeSource,
      estimatedFare: estimate.estimatedFare,
      fareBreakup: estimate.fareBreakup,
    });
  } catch (err) {
    console.error("deliver estimate error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/request", async (req, res) => {
  try {
    await ensureTables();

    const {
      userId,
      pickupText,
      dropText,
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      city,
      distanceProvider,
    } = req.body || {};

    if (
      !pickupText ||
      !dropText ||
      pickupLat == null ||
      pickupLng == null ||
      dropLat == null ||
      dropLng == null
    ) {
      return res.status(400).json({
        success: false,
        message: "pickup/drop details with coordinates are required",
      });
    }

    const estimate = await computeEstimate({
      pickupLat: Number(pickupLat),
      pickupLng: Number(pickupLng),
      dropLat: Number(dropLat),
      dropLng: Number(dropLng),
      city,
      distanceProvider,
    });
    if (!estimate.ok) {
      return res.status(400).json({
        success: false,
        message: estimate.message || "Unable to estimate delivery",
      });
    }

    const insert = await pool.query(
      `INSERT INTO deliver_requests (
        user_id,
        pickup_text,
        drop_text,
        pickup_lat,
        pickup_lng,
        drop_lat,
        drop_lng,
        distance_km,
        estimated_fare,
        city_zone,
        status,
        last_broadcast_at
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending',NOW()
      ) RETURNING id, status, distance_km, estimated_fare, city_zone, created_at`,
      [
        userId || null,
        String(pickupText),
        String(dropText),
        Number(pickupLat),
        Number(pickupLng),
        Number(dropLat),
        Number(dropLng),
        Number(estimate.distanceKm),
        Number(estimate.estimatedFare),
        String(estimate.cityZone),
      ]
    );

    const created = insert.rows[0];
    notifyRidersOfNewParcel(
      pool,
      created.id,
      Number(pickupLat),
      Number(pickupLng)
    ).catch((err) =>
      console.error("notifyRidersOfNewParcel error", err)
    );

    return res.json({ success: true, request: created });
  } catch (err) {
    console.error("deliver request error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/deliver/available — rider polls for nearby unassigned parcels ────
router.get("/available", async (req, res) => {
  try {
    await ensureTables();

    const riderLat = toNumber(req.query.riderLat);
    const riderLng = toNumber(req.query.riderLng);
    const radiusKm = toNumber(req.query.radiusKm) ?? 10;

    const { rows } = await pool.query(
      `SELECT id, pickup_text, drop_text, pickup_lat, pickup_lng, drop_lat, drop_lng,
              distance_km, estimated_fare, city_zone, status, created_at,
              receiver_name, receiver_phone, note, who_pays
       FROM deliver_requests
       WHERE status = 'pending' AND rider_id IS NULL
       ORDER BY created_at DESC
       LIMIT 100`
    );

    let requests = rows;
    if (riderLat != null && riderLng != null) {
      requests = rows
        .map((r) => {
          const pLat = r.pickup_lat != null ? Number(r.pickup_lat) : null;
          const pLng = r.pickup_lng != null ? Number(r.pickup_lng) : null;
          const distanceFromRider =
            pLat != null && pLng != null
              ? haversineKm(riderLat, riderLng, pLat, pLng)
              : null;
          return { ...r, distance_from_rider_km: distanceFromRider };
        })
        .filter((r) => r.distance_from_rider_km == null || r.distance_from_rider_km <= radiusKm)
        .sort((a, b) => (a.distance_from_rider_km ?? 0) - (b.distance_from_rider_km ?? 0));
    }

    return res.json({ success: true, requests });
  } catch (err) {
    console.error("deliver available error", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/vendor/:vendorId/requests", async (req, res) => {
  try {
    const { vendorId } = req.params;
    const status = String(req.query.status || "pending").toLowerCase();
    const validStatus = new Set(["pending", "accepted", "completed", "cancelled"]);
    const filter = validStatus.has(status) ? status : "pending";

    const { rows } = await pool.query(
      `SELECT id, pickup_text, drop_text, distance_km, estimated_fare,
              city_zone, status, created_at, accepted_at, completed_at
       FROM deliver_requests
       WHERE status = $1
       ORDER BY created_at DESC
       LIMIT 100`,
      [filter]
    );

    return res.json({ success: true, vendorId, requests: rows });
  } catch (err) {
    console.error("deliver vendor requests error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/vendor/:vendorId/requests/:id", async (req, res) => {
  try {
    const { vendorId, id } = req.params;
    const status = String(req.body?.status || "").toLowerCase();
    const allowed = new Set(["accepted", "completed", "cancelled"]);
    if (!allowed.has(status)) {
      return res.status(400).json({ success: false, message: "Invalid status" });
    }

    const { rows } = await pool.query(
      `UPDATE deliver_requests
       SET vendor_id = CASE WHEN $1::text <> '' THEN $1::uuid ELSE vendor_id END,
           status = $2,
           accepted_at = CASE WHEN $2 = 'accepted' THEN NOW() ELSE accepted_at END,
           completed_at = CASE WHEN $2 = 'completed' THEN NOW() ELSE completed_at END
       WHERE id = $3
       RETURNING id, status, vendor_id, accepted_at, completed_at`,
      [vendorId, status, id]
    );

    if (!rows.length) {
      return res.status(404).json({ success: false, message: "Request not found" });
    }

    return res.json({ success: true, request: rows[0] });
  } catch (err) {
    console.error("deliver vendor update error", err);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/deliver/request/:id — customer polls for tracking status / rider gets details ──────────
router.get("/request/:id", async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, user_id, pickup_text, drop_text, pickup_lat, pickup_lng, 
              drop_lat, drop_lng, distance_km, estimated_fare, city_zone, status, 
              created_at, accepted_at, completed_at, rider_id, receiver_name, 
              receiver_phone, note, who_pays, rider_lat, rider_lng, otp_code, 
              otp_verified, delivery_photo_url
       FROM deliver_requests
       WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Parcel not found" });
    }
    const parcel = rows[0];
    
    // If rider is assigned, get rider details
    let rider = null;
    if (parcel.rider_id) {
      try {
        const { rows: riderRows } = await pool.query(
          `SELECT id, name, phone FROM users WHERE id = $1`,
          [parcel.rider_id]
        );
        if (riderRows.length > 0) {
          rider = riderRows[0];
          parcel.rider_name = rider.name;
          parcel.rider_phone = rider.phone;
        }
      } catch (_) {}
    }
    
    return res.json({ success: true, parcel });
  } catch (err) {
    console.error("deliver request detail error", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /api/deliver/request/:id/accept — rider accepts a parcel request ─────
router.patch("/request/:id/accept", async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { riderId, riderName, riderPhone, riderLat, riderLng } = req.body || {};

    const otp = String(Math.floor(1000 + Math.random() * 9000));

    const { rows } = await pool.query(
      `UPDATE deliver_requests
       SET status = 'accepted',
           rider_id = $2,
           rider_name = $3,
           rider_phone = $4,
           rider_lat = $5,
           rider_lng = $6,
           otp_code = $7,
           accepted_at = NOW()
       WHERE id = $1 AND status = 'pending' AND rider_id IS NULL
       RETURNING id, status, pickup_text, drop_text, distance_km, estimated_fare,
                 city_zone, rider_id, rider_name, rider_phone, accepted_at, otp_code`,
      [
        id,
        riderId || null,
        riderName || null,
        riderPhone || null,
        riderLat != null ? Number(riderLat) : null,
        riderLng != null ? Number(riderLng) : null,
        otp,
      ]
    );

    if (!rows.length) {
      return res.status(409).json({
        success: false,
        message: "Parcel already accepted by another rider or no longer available",
      });
    }

    return res.json({ success: true, request: rows[0] });
  } catch (err) {
    console.error("deliver accept error", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── PATCH /api/deliver/request/:id/rider-location — rider updates their GPS ────
router.patch("/request/:id/rider-location", async (req, res) => {
  try {
    const { id } = req.params;
    const { lat, lng, rider_name, rider_phone, rider_id } = req.body || {};
    if (lat == null || lng == null) return res.status(400).json({ success: false, message: "lat and lng required" });
    await pool.query(
      `UPDATE deliver_requests SET rider_lat = $2, rider_lng = $3
       ${rider_name ? ", rider_name = $4" : ""}
       ${rider_phone ? ", rider_phone = $5" : ""}
       ${rider_id ? ", rider_id = $6" : ""}
       WHERE id = $1`,
      [id, Number(lat), Number(lng),
        ...(rider_name ? [String(rider_name)] : []),
        ...(rider_phone ? [String(rider_phone)] : []),
        ...(rider_id ? [String(rider_id)] : []),
      ]
    );
    return res.json({ success: true });
  } catch (err) {
    console.error("deliver rider-location error", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

router.patch("/request/:id/cancel", async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { rows } = await pool.query(
      `UPDATE deliver_requests SET status = 'cancelled' WHERE id = $1 AND status NOT IN ('completed', 'delivered') RETURNING id, status`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(400).json({ success: false, message: "Cannot cancel completed or delivered parcel" });
    }
    return res.json({ success: true, request: rows[0] });
  } catch (err) {
    console.error("deliver cancel error", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET /api/deliver/request/:id ─── Get detailed parcel information ──────────
router.get("/request/:id", async (req, res) => {
  try {
    await ensureTables();
    const { id } = req.params;
    const { rows } = await pool.query(
      `SELECT id, user_id, pickup_text, drop_text, pickup_lat, pickup_lng, 
              drop_lat, drop_lng, distance_km, estimated_fare, city_zone, status, 
              created_at, accepted_at, completed_at, rider_id, receiver_name, 
              receiver_phone, note, who_pays, rider_lat, rider_lng, otp_code, 
              otp_verified, delivery_photo_url
       FROM deliver_requests
       WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: "Parcel not found" });
    }
    const parcel = rows[0];
    
    // If rider is assigned, get rider details
    let rider = null;
    if (parcel.rider_id) {
      try {
        const { rows: riderRows } = await pool.query(
          `SELECT id, name, phone FROM users WHERE id = $1`,
          [parcel.rider_id]
        );
        if (riderRows.length > 0) {
          rider = riderRows[0];
          parcel.rider_name = rider.name;
          parcel.rider_phone = rider.phone;
        }
      } catch (_) {}
    }
    
    return res.json({ success: true, parcel });
  } catch (err) {
    console.error("deliver request detail error", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/deliver/request/:id/upload-photo ─ Upload proof of delivery photo
router.post('/request/:id/upload-photo', async (req, res) => {
  const { id } = req.params;
  const { photo_url } = req.body || {};
  try {
    if (!photo_url || typeof photo_url !== 'string') {
      return res.status(400).json({ success: false, message: 'Photo URL required' });
    }
    const { rows } = await pool.query(
      `UPDATE deliver_requests SET delivery_photo_url = $1 WHERE id = $2 AND status IN ('pending', 'accepted') RETURNING id, status`,
      [photo_url, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Parcel not found' });
    res.json({ success: true, parcel: rows[0] });
  } catch (err) {
    console.error('upload photo error', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/deliver/request/:id/arrived ─ Rider arrived, generate customer OTP
router.patch('/request/:id/arrived', async (req, res) => {
  const { id } = req.params;
  try {
    const otp = Math.floor(1000 + Math.random() * 9000).toString();
    const { rows } = await pool.query(
      `UPDATE deliver_requests SET otp_code = $1, otp_generated_at = NOW(), status = 'arrived' WHERE id = $2 AND status IN ('pending', 'accepted') RETURNING id, status, otp_code`,
      [otp, id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Parcel not found' });
    res.json({ success: true, otp: rows[0].otp_code });
  } catch (err) {
    console.error('mark arrived error', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/deliver/request/:id/verify-otp ─ Verify customer OTP for parcel delivery
router.post('/request/:id/verify-otp', async (req, res) => {
  const { id } = req.params;
  const { otp } = req.body || {};
  try {
    if (!otp || String(otp).length !== 4) {
      return res.status(400).json({ success: false, message: 'Enter 4-digit OTP' });
    }
    const { rows } = await pool.query(
      `SELECT id, otp_code, otp_generated_at FROM deliver_requests WHERE id = $1`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: 'Parcel not found' });
    const parcel = rows[0];
    if (String(parcel.otp_code) !== String(otp)) {
      return res.status(400).json({ success: false, message: 'Incorrect OTP' });
    }
    const { rows: verifyRows } = await pool.query(
      `UPDATE deliver_requests SET otp_verified = TRUE, otp_verified_at = NOW() WHERE id = $1 RETURNING id`,
      [id]
    );
    res.json({ success: true, verified: true });
  } catch (err) {
    console.error('verify otp error', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/deliver/request/:id/complete ─ Mark parcel delivery complete
router.patch('/request/:id/complete', async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE deliver_requests SET status = 'completed', completed_at = NOW() WHERE id = $1 AND otp_verified = TRUE RETURNING id, status, rider_id, estimated_fare`,
      [id]
    );
    if (!rows.length) return res.status(400).json({ success: false, message: 'Parcel not found or OTP not verified' });
    const parcel = rows[0];
    if (parcel.rider_id) {
      try {
        await pool.query(
          `UPDATE "Riders" SET balance = balance + $1 WHERE id = $2`,
          [parcel.estimated_fare, parcel.rider_id]
        );
      } catch (_) {}
    }
    res.json({ success: true, completed: true });
  } catch (err) {
    console.error('complete delivery error', err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
