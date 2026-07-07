import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// POST /api/support/tickets  — create a new support ticket
router.post("/tickets", async (req, res) => {
  try {
    const { user_id, order_id, category, message } = req.body;

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ error: "Message is required" });
    }

    const { rows } = await pool.query(
      `INSERT INTO support_tickets (user_id, order_id, category, message)
       VALUES ($1, $2, $3, $4)
       RETURNING id, category, status, created_at`,
      [
        user_id || null,
        order_id || null,
        category || "Other",
        message.trim(),
      ]
    );

    res.json({ success: true, ticket: rows[0] });
  } catch (err) {
    console.error("SUPPORT TICKET ERROR:", err);
    res.status(500).json({ error: err.message || "Failed to create ticket" });
  }
});

// GET /api/support/tickets?user_id=...  — list tickets for a user
router.get("/tickets", async (req, res) => {
  try {
    const { user_id } = req.query;
    if (!user_id) return res.status(400).json({ error: "user_id required" });

    const { rows } = await pool.query(
      `SELECT t.id, t.category, t.message, t.status, t.created_at,
              o.id AS order_ref
       FROM support_tickets t
       LEFT JOIN orders o ON o.id = t.order_id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [user_id]
    );

    res.json({ tickets: rows });
  } catch (err) {
    console.error("SUPPORT TICKETS LIST ERROR:", err);
    res.status(500).json({ error: err.message });
  }
});

export default router;
