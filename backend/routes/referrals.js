import express from "express";
import crypto from "crypto";
import { pool } from "../db.js";

const router = express.Router();

// Generate a short, unique-ish referral code based on user id + name.
const generateCode = (name = "") => {
  const prefix = String(name)
    .replace(/[^a-zA-Z]/g, "")
    .slice(0, 4)
    .toUpperCase()
    .padEnd(4, "X");
  const rand = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `${prefix}${rand}`;
};

const ensureReferralCode = async (userId) => {
  const { rows } = await pool.query(
    `SELECT id, name, referral_code FROM users WHERE id = $1`,
    [userId]
  );
  if (!rows.length) return null;
  if (rows[0].referral_code) return rows[0].referral_code;

  // Try a few times to avoid unique-index collisions.
  for (let i = 0; i < 5; i += 1) {
    const code = generateCode(rows[0].name);
    try {
      await pool.query(
        `UPDATE users SET referral_code = $1, updated_at = NOW() WHERE id = $2`,
        [code, userId]
      );
      return code;
    } catch (err) {
      if (i === 4) throw err;
    }
  }
  return null;
};

// GET /api/referrals/:userId  → code, stats, available reward
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }
  try {
    const code = await ensureReferralCode(userId);
    if (!code) {
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { rows: countRows } = await pool.query(
      `SELECT COUNT(*)::int AS total FROM referrals WHERE referrer_id = $1`,
      [userId]
    );

    const { rows: rewardRows } = await pool.query(
      `SELECT COALESCE(SUM(value), 0)::float AS available
       FROM user_rewards
       WHERE user_id = $1 AND type IN ('referral_50', 'referral_100') AND status = 'available'`,
      [userId]
    );

    res.json({
      success: true,
      code,
      totalReferrals: countRows[0].total,
      availableReward: rewardRows[0].available,
      perReferralReward: 100,
    });
  } catch (err) {
    console.error("GET referrals error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// GET /api/referrals/validate/:code  → { valid, referrerId? }
router.get("/validate/:code", async (req, res) => {
  const code = String(req.params.code || "").trim().toUpperCase();
  if (!code) return res.json({ valid: false });
  try {
    const { rows } = await pool.query(
      `SELECT id, name FROM users WHERE referral_code = $1 LIMIT 1`,
      [code]
    );
    if (!rows.length) return res.json({ valid: false });
    res.json({ valid: true, referrerId: rows[0].id, referrerName: rows[0].name });
  } catch (err) {
    console.error("Validate referral error:", err);
    res.status(500).json({ valid: false, message: "Server error" });
  }
});

export { ensureReferralCode };
export default router;
