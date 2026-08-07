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

  // Log product events for debugging
  if (e.product_id) {
    console.log(`[Analytics] Inserting ${event_type} for user ${user_id}, product ${e.product_id}`);
  }

  const result = await pool.query(
    `INSERT INTO user_activity_events
      (user_id, session_id, event_type, search_query, product_id, category_id, result_count, duration_ms, metadata)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
     RETURNING id`,
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

  return result.rows[0];
};

// POST /api/analytics/event — log a single search/click/view/dwell event.
// Best-effort only: analytics must never surface an error to the app.
router.post("/event", async (req, res) => {
  try {
    if (!req.body?.session_id || !req.body?.event_type) {
      console.warn("[Analytics] Missing session_id or event_type in request body:", req.body);
      return res.status(400).json({ error: "session_id and event_type are required" });
    }

    const { user_id, event_type, product_id } = req.body;
    if (product_id) {
      console.log(`[Analytics] POST /event: user=${user_id}, event=${event_type}, product=${product_id}`);
    }

    await insertEvent(req.body);
    res.status(204).end();
  } catch (err) {
    console.error("[Analytics] Failed to log activity event:", err.message);
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

// GET /api/analytics/recently-explored — fetch recently explored products for a user
// Returns products based on any product interaction (click, view, dwell, cart, wishlist)
// Only returns data if user has interacted with more than 3 products
// Returns: { products: [{id, name, price, discount, image, rating}], count: number }
router.get("/recently-explored", async (req, res) => {
  try {
    const userId = req.query.user_id;
    const limit = Math.min(parseInt(req.query.limit) || 10, 20);

    if (!userId) {
      console.log("[Recently-explored] No userId provided");
      return res.json({ products: [], count: 0 });
    }

    // 1. Count how many products user has interacted with (any event type)
    const countRes = await pool.query(
      `SELECT COUNT(DISTINCT product_id) as total
       FROM user_activity_events
       WHERE user_id = $1
       AND product_id IS NOT NULL
       AND event_type IN ('product_click', 'product_view', 'product_dwell', 'add_to_cart', 'wishlist_add')`,
      [userId]
    );

    let exploredCount = countRes.rows[0]?.total || 0;
    console.log(`[Recently-explored] userId=${userId} has ${exploredCount} distinct products`);

    // If no products found, try fallback: count ANY event with product_id
    if (exploredCount === 0) {
      const countFallbackRes = await pool.query(
        `SELECT COUNT(DISTINCT product_id) as total
         FROM user_activity_events
         WHERE user_id = $1
         AND product_id IS NOT NULL`,
        [userId]
      );
      exploredCount = countFallbackRes.rows[0]?.total || 0;
      console.log(`[Recently-explored] Fallback: found ${exploredCount} distinct products (any event type)`);
    }

    // Only return results if user explored more than 3 products
    if (exploredCount <= 3) {
      console.log(`[Recently-explored] Threshold not met (${exploredCount} <= 3)`);
      return res.json({ products: [], count: 0 });
    }

    // 2. Get recently explored products (ordered by most recent first)
    let productsRes = await pool.query(
      `SELECT p.id, p.name, p.price, p.discount, p.main_image as image, 
              COALESCE(p.rating, 0) as rating,
              MAX(e.created_at) as last_viewed
       FROM user_activity_events e
       JOIN products p ON e.product_id = p.id
       WHERE e.user_id = $1
       AND product_id IS NOT NULL
       AND e.event_type IN ('product_click', 'product_view', 'product_dwell', 'add_to_cart', 'wishlist_add')
       GROUP BY p.id, p.name, p.price, p.discount, p.main_image, p.rating
       ORDER BY last_viewed DESC
       LIMIT $2`,
      [userId, limit]
    );

    console.log(`[Recently-explored] Query found ${productsRes.rows.length} products from JOIN`);

    // If no products found with specific event types, fallback to any event with product_id
    if (productsRes.rows.length === 0) {
      console.log(`[Recently-explored] No products from specific events, trying fallback query...`);
      
      // First, check what product_ids exist in events but NOT in products table
      const eventProdsRes = await pool.query(
        `SELECT DISTINCT e.product_id FROM user_activity_events e
         WHERE e.user_id = $1 AND e.product_id IS NOT NULL
         AND NOT EXISTS (SELECT 1 FROM products p WHERE p.id = e.product_id)`,
        [userId]
      );
      
      if (eventProdsRes.rows.length > 0) {
        console.log(`[Recently-explored] Found ${eventProdsRes.rows.length} product_ids in events that don't exist in products table`);
        console.log(`[Recently-explored] Missing product_ids: ${eventProdsRes.rows.map(r => r.product_id).join(', ')}`);
      }

      productsRes = await pool.query(
        `SELECT p.id, p.name, p.price, p.discount, p.main_image as image, 
                COALESCE(p.rating, 0) as rating,
                MAX(e.created_at) as last_viewed
         FROM user_activity_events e
         JOIN products p ON e.product_id = p.id
         WHERE e.user_id = $1
         AND product_id IS NOT NULL
         GROUP BY p.id, p.name, p.price, p.discount, p.main_image, p.rating
         ORDER BY last_viewed DESC
         LIMIT $2`,
        [userId, limit]
      );
      
      console.log(`[Recently-explored] Fallback query found ${productsRes.rows.length} products`);
    }

    const products = productsRes.rows.map(p => ({
      id: p.id,
      name: p.name,
      price: parseFloat(p.price || 0),
      discount: parseInt(p.discount || 0),
      image: p.image,
      rating: parseFloat(p.rating || 0),
    }));

    console.log(`[Recently-explored] Returning ${products.length} products for userId=${userId}`);
    res.json({ products, count: exploredCount });
  } catch (err) {
    console.warn("Failed to fetch recently explored products:", err.message);
    res.status(500).json({
      error: "Failed to fetch recently explored products",
    });
  }
});

// DEBUG: GET /api/analytics/user-events — check what events exist for a user
// Returns raw event data for debugging purposes
router.get("/user-events", async (req, res) => {
  try {
    const userId = req.query.user_id;
    if (!userId) {
      return res.json({ error: "user_id required", events: [] });
    }

    // Get summary of events for this user
    const summary = await pool.query(
      `SELECT event_type, COUNT(*) as count, COUNT(DISTINCT product_id) as products
       FROM user_activity_events
       WHERE user_id = $1
       GROUP BY event_type
       ORDER BY count DESC`,
      [userId]
    );

    // Get recent product events
    const recent = await pool.query(
      `SELECT event_type, product_id, created_at
       FROM user_activity_events
       WHERE user_id = $1
       AND product_id IS NOT NULL
       ORDER BY created_at DESC
       LIMIT 20`,
      [userId]
    );

    // Get distinct product_ids in events
    const eventProductIds = await pool.query(
      `SELECT DISTINCT product_id FROM user_activity_events
       WHERE user_id = $1 AND product_id IS NOT NULL`,
      [userId]
    );

    // Check which of those product_ids exist in products table
    const eventProdIds = eventProductIds.rows.map(r => r.product_id);
    let existingProducts = [];
    if (eventProdIds.length > 0) {
      const existRes = await pool.query(
        `SELECT id FROM products WHERE id = ANY($1::text[])`,
        [eventProdIds]
      );
      existingProducts = existRes.rows.map(r => r.id);
    }

    const missingProducts = eventProdIds.filter(id => !existingProducts.includes(id));

    res.json({
      userId,
      eventSummary: summary.rows,
      recentProductEvents: recent.rows,
      totalUniqueProducts: eventProdIds.length,
      eventProductIds: eventProdIds,
      productsExistInDB: existingProducts,
      missingFromProductsTable: missingProducts,
      matchPercentage: eventProdIds.length > 0 ? 
        ((existingProducts.length / eventProdIds.length) * 100).toFixed(1) + '%' : 
        'N/A',
    });
  } catch (err) {
    console.warn("Failed to fetch user events:", err.message);
    res.status(500).json({ error: "Failed to fetch user events" });
  }
});

export default router;
