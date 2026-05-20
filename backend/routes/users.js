import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ── GET /api/users/:userId ─────────────────────────────────────────────────
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, phone, email FROM users WHERE id = $1`,
      [userId]
    );
    if (!rows.length) return res.status(404).json({ success: false, message: "User not found" });
    res.json({ success: true, user: rows[0] });
  } catch (err) {
    console.error("GET user error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── PATCH /api/users/:userId ───────────────────────────────────────────────
router.patch("/:userId", async (req, res) => {
  const { userId } = req.params;
  const { name, email } = req.body;
  if (!name && !email) {
    return res.status(400).json({ success: false, message: "Nothing to update" });
  }
  try {
    const sets = [];
    const vals = [];
    let idx = 1;
    if (name) { sets.push(`name = $${idx++}`); vals.push(name.trim()); }
    if (email) { sets.push(`email = $${idx++}`); vals.push(email.trim().toLowerCase()); }
    vals.push(userId);
    await pool.query(
      `UPDATE users SET ${sets.join(", ")} WHERE id = $${idx}`,
      vals
    );
    res.json({ success: true, message: "Profile updated" });
  } catch (err) {
    console.error("PATCH user error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
