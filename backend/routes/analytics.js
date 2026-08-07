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

// GET /api/analytics/suggestions — fetch search suggestions based on user activity
// Returns: { recentSearches: [...], trendingSearches: [...], suggestedProducts: [...] }
router.get("/suggestions", async (req, res) => {
  try {
    const userId = req.query.user_id;
    const limit = Math.min(parseInt(req.query.limit) || 5, 20);

    const suggestions = {
      recentSearches: [],
      trendingSearches: [],
      suggestedProducts: [],
    };

    // 1. Get recent searches by this user (last 7 days, unique, limit 5)
    if (userId) {
      const recentSearchRes = await pool.query(
        `SELECT DISTINCT search_query 
         FROM user_activity_events 
         WHERE user_id = $1 
         AND event_type = 'search' 
         AND search_query IS NOT NULL 
         AND search_query != '' 
         AND created_at > now() - interval '7 days'
         ORDER BY created_at DESC 
         LIMIT $2`,
        [userId, limit]
      );
      suggestions.recentSearches = recentSearchRes.rows.map(r => r.search_query);
    }

    // 2. Get trending searches (most common in last 7 days, across all users)
    const trendingRes = await pool.query(
      `SELECT search_query, COUNT(*) as count 
       FROM user_activity_events 
       WHERE event_type = 'search' 
       AND search_query IS NOT NULL 
       AND search_query != '' 
       AND created_at > now() - interval '7 days'
       GROUP BY search_query 
       ORDER BY count DESC 
       LIMIT $1`,
      [limit]
    );
    suggestions.trendingSearches = trendingRes.rows.map(r => r.search_query);

    // 3. Get most clicked/viewed products (top products from clicks, last 30 days)
    const topProductsRes = await pool.query(
      `SELECT p.id, p.name, COUNT(*) as interactions
       FROM user_activity_events e
       JOIN products p ON e.product_id = p.id
       WHERE e.event_type IN ('product_click', 'product_view')
       AND e.created_at > now() - interval '30 days'
       AND p.id IS NOT NULL
       GROUP BY p.id, p.name
       ORDER BY interactions DESC
       LIMIT $1`,
      [limit]
    );
    suggestions.suggestedProducts = topProductsRes.rows.map(r => ({
      id: r.id,
      name: r.name,
      clicks: r.interactions,
    }));

    res.json(suggestions);
  } catch (err) {
    console.warn("Failed to fetch search suggestions:", err.message);
    res.status(500).json({
      error: "Failed to fetch suggestions",
    });
  }
});

export default router;
