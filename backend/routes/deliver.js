import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const CITY_ZONE = {
  cuttack: {
    label: "Cuttack",
    centerLat: 20.4625,
    centerLng: 85.883,
    radiusKm: 30,
    baseFare: 40,
    perKm: 12,
    minFare: 60,
  },
  bhubaneswar: {
    label: "Bhubaneswar",
    centerLat: 20.2961,
    centerLng: 85.8245,
    radiusKm: 30,
    baseFare: 45,
    perKm: 13,
    minFare: 70,
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

const computeEstimate = ({ pickupLat, pickupLng, dropLat, dropLng, city }) => {
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

  const distanceKm = haversineKm(pickupLat, pickupLng, dropLat, dropLng);
  const roundedDistance = Math.max(Number(distanceKm.toFixed(2)), 0.5);
  const rawFare = zone.baseFare + roundedDistance * zone.perKm;
  const fare = Math.max(zone.minFare, Math.round(rawFare));

  return {
    ok: true,
    cityZone: zone.label,
    distanceKm: roundedDistance,
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
};

router.get("/estimate", async (req, res) => {
  try {
    const pickupLat = toNumber(req.query.pickupLat);
    const pickupLng = toNumber(req.query.pickupLng);
    const dropLat = toNumber(req.query.dropLat);
    const dropLng = toNumber(req.query.dropLng);
    const city = req.query.city;

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

    const estimate = computeEstimate({
      pickupLat,
      pickupLng,
      dropLat,
      dropLng,
      city,
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

    const estimate = computeEstimate({
      pickupLat: Number(pickupLat),
      pickupLng: Number(pickupLng),
      dropLat: Number(dropLat),
      dropLng: Number(dropLng),
      city,
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
        status
      ) VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'pending'
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

    return res.json({ success: true, request: insert.rows[0] });
  } catch (err) {
    console.error("deliver request error", err);
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

export default router;
