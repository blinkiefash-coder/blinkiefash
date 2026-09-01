import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ── GET /api/users/:userId ─────────────────────────────────────────────────
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  try {
    const { rows } = await pool.query(
      `SELECT id, name, phone, email, gender, referred_by FROM users WHERE id = $1`,
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
  const { name, email, gender } = req.body;
  const validGenders = new Set(["female", "male", "non_binary", "prefer_not_to_say"]);
  if (!name && !email && !gender) {
    return res.status(400).json({ success: false, message: "Nothing to update" });
  }
  if (gender && !validGenders.has(gender)) {
    return res.status(400).json({ success: false, message: "Invalid gender" });
  }
  try {
    const sets = [];
    const vals = [];
    let idx = 1;
    if (name) { sets.push(`name = $${idx++}`); vals.push(name.trim()); }
    if (email) { sets.push(`email = $${idx++}`); vals.push(email.trim().toLowerCase()); }
    if (gender) { sets.push(`gender = $${idx++}`); vals.push(gender); }
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

// ── POST /api/users/fcm-token ──────────────────────────────────────────────
// Body: { userId, token }
router.post("/fcm-token", async (req, res) => {
  const { userId, token } = req.body;
  if (!userId || !token) {
    return res.status(400).json({ success: false, message: "userId and token required" });
  }
  try {
    await pool.query(
      `UPDATE users SET fcm_token = $1, updated_at = NOW() WHERE id = $2`,
      [token, userId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error("POST fcm-token error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

// ── POST /api/users/:userId/apply-referral-code ────────────────────────────
// Body: { referralCode }
// Apply a referral code to user after signup (can only be done once)
router.post("/:userId/apply-referral-code", async (req, res) => {
  const { userId } = req.params;
  const { referralCode } = req.body;

  if (!userId || !referralCode) {
    return res.status(400).json({ success: false, message: "userId and referralCode required" });
  }

  const trimmedCode = String(referralCode || "").trim().toUpperCase();

  try {
    // Check if user already has a referral code applied
    const { rows: userRows } = await pool.query(
      `SELECT referred_by FROM users WHERE id = $1`,
      [userId]
    );

    if (!userRows.length) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    if (userRows[0].referred_by) {
      return res.json({
        success: false,
        message: "You have already used a referral code. Each user can only apply one referral code."
      });
    }

    // Validate the referral code exists and belongs to a different user
    const { rows: refRows } = await pool.query(
      `SELECT id FROM users WHERE referral_code = $1 AND id <> $2 LIMIT 1`,
      [trimmedCode, userId]
    );

    if (!refRows.length) {
      return res.json({
        success: false,
        message: "Invalid referral code"
      });
    }

    const referrerId = refRows[0].id;

    // Update the user to mark them as referred
    await pool.query(
      `UPDATE users SET referred_by = $1, updated_at = NOW() WHERE id = $2`,
      [referrerId, userId]
    );

    // Create a referral tracking record
    const { rows: referralRows } = await pool.query(
      `INSERT INTO referrals (referrer_id, referee_id, code, status)
       VALUES ($1, $2, $3, 'completed')
       ON CONFLICT (referee_id) DO NOTHING
       RETURNING id`,
      [referrerId, userId, trimmedCode]
    );

    if (referralRows.length) {
      const referralId = referralRows[0].id;
      // Credit ₹50 to both the new user (referee) and the referrer
      await pool.query(
        `INSERT INTO user_rewards (user_id, type, value, status, source_referral_id)
         VALUES ($1, 'referral_50', 50, 'available', $2),
                ($3, 'referral_50', 50, 'available', $2)`,
        [userId, referralId, referrerId]
      );
    }

    res.json({
      success: true,
      message: "Referral code applied successfully! You and your referrer both earned ₹50."
    });
  } catch (err) {
    console.error("Apply referral code error:", err.message);
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
