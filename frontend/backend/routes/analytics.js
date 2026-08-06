import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const ALLOWED_EVENT_TYPES = new Set([
  "search",
  "product_click",
  "product_view",
  "product_dwell",
  "category_view",
  "add_to_cart",
  "wishlist_add",
]);

const toInt = (value) => {
  const num = Number(value);
  return Number.isFinite(num) ? Math.round(num) : null;
};

const insertEvent = async (e) => {
  const { user_id, session_id, event_type } = e || {};
  if (!session_id || !event_type || !ALLOWED_EVENT_TYPES.has(event_type)) return;

  await pool.query(
    `INSERT INTO user_activity_events
      (user_id, session_id, event_type, search_query, product_id, category_id, result_count, duration_ms, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      user_id || null,
      session_id,
      event_type,
      e.search_query || null,
      e.product_id || null,
      e.category_id || null,
      toInt(e.result_count),
      toInt(e.duration_ms),
      e.metadata ? JSON.stringify(e.metadata) : null,
    ]
  );
};

// POST /api/analytics/event — log a single search/click/view/dwell event.
// Best-effort only: analytics must never surface an error to the app.
router.post("/event", async (req, res) => {
  try {
    if (!req.body?.session_id || !req.body?.event_type) {
      return res.status(400).json({ error: "session_id and event_type are required" });
    }
    await insertEvent(req.body);
    res.status(204).end();
  } catch (err) {
    console.warn("Failed to log activity event:", err.message);
    res.status(204).end();
  }
});

// POST /api/analytics/events — batch insert (e.g. events queued while offline)
router.post("/events", async (req, res) => {
  try {
    const events = Array.isArray(req.body?.events) ? req.body.events : [];
    for (const e of events) {
      await insertEvent(e).catch((err) => {
        console.warn("Failed to log batch activity event:", err.message);
      });
    }
    res.status(204).end();
  } catch (err) {
    console.warn("Failed to log batch activity events:", err.message);
    res.status(204).end();
  }
});

export default router;
