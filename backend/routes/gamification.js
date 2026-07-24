import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ── Segment config — must mirror the Flutter app exactly ─────────────────────
const SPIN_WEIGHTS = [30, 12, 8, 19, 10, 5, 9, 3, 2, 0];
const SPIN_PRIZES = [
  { label: "Sorry", pct: 0, isSorry: true },    // 0
  { label: "1% Off", pct: 1, isSorry: false },  // 1
  { label: "5% Off", pct: 5, isSorry: false },  // 2
  { label: "Sorry", pct: 0, isSorry: true },    // 3
  { label: "2% Off", pct: 2, isSorry: false },  // 4
  { label: "10% Off", pct: 10, isSorry: false }, // 5
  { label: "Sorry", pct: 0, isSorry: true },    // 6
  { label: "Free", pct: 5, isSorry: false },    // 7
  { label: "Free", pct: 5, isSorry: false },    // 8
  { label: "Car", pct: 20, isSorry: false },    // 9
];

function pickSegment(carUnlocked) {
  const weights = [...SPIN_WEIGHTS];
  if (carUnlocked) weights[9] = 1;
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.floor(Math.random() * total);
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 0;
}

// ── Ensure tables exist ───────────────────────────────────────────────────────
export async function ensureGamificationTables() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamification_spins (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL,
      spin_date DATE NOT NULL DEFAULT CURRENT_DATE,
      spin_index INT NOT NULL,
      prize_label VARCHAR(100),
      reward_pct DECIMAL(5, 2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_gamification_spins_user_date
    ON gamification_spins(user_id, spin_date)
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS gamification_quest (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL UNIQUE,
      level INT DEFAULT 0,
      today_date DATE DEFAULT CURRENT_DATE,
      today_count INT DEFAULT 0,
      half_pct INT DEFAULT 0,
      total_reward_pct DECIMAL(5, 2) DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW()
    )
  `).catch(() => {});

  // Migration: add today columns if missing
  await pool.query(`
    ALTER TABLE gamification_quest
      ADD COLUMN IF NOT EXISTS today_date DATE DEFAULT CURRENT_DATE,
      ADD COLUMN IF NOT EXISTS today_count INT DEFAULT 0,
      ADD COLUMN IF NOT EXISTS half_pct INT DEFAULT 0
  `).catch(() => {});
}

// ── GET /api/gamification/state?userId=xxx ────────────────────────────────────
router.get("/state", async (req, res) => {
  const { userId } = req.query;
  if (!userId)
    return res.status(400).json({ success: false, message: "userId required" });

  try {
    const [spinRow, orderRow, spinRewardRow, questRewardRow, questRow] =
      await Promise.all([
        pool.query(
          `SELECT spin_index FROM gamification_spins
           WHERE user_id = $1 AND spin_date = CURRENT_DATE LIMIT 1`,
          [userId]
        ),
        pool.query(
          `SELECT COUNT(*)::int AS cnt FROM orders
           WHERE user_id = $1 AND status NOT IN ('cancelled')`,
          [userId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(value), 0)::float AS pct
           FROM user_rewards
           WHERE user_id = $1 AND type = 'spin_discount' AND status = 'available'`,
          [userId]
        ),
        pool.query(
          `SELECT COALESCE(SUM(value), 0)::float AS pct
           FROM user_rewards
           WHERE user_id = $1 AND type = 'quest_discount' AND status = 'available'`,
          [userId]
        ),
        pool.query(
          `SELECT level, half_pct,
                  CASE WHEN today_date = CURRENT_DATE THEN today_count ELSE 0 END AS today_count
           FROM gamification_quest WHERE user_id = $1 LIMIT 1`,
          [userId]
        ),
      ]);

    const hasSpunToday = spinRow.rows.length > 0;
    const successfulOrderCount = orderRow.rows[0]?.cnt ?? 0;
    const spinRewardPct = spinRewardRow.rows[0]?.pct ?? 0;
    const questRewardPct = questRewardRow.rows[0]?.pct ?? 0;
    const quest = questRow.rows[0] ?? { level: 0, half_pct: 0, today_count: 0 };

    return res.json({
      success: true,
      hasSpunToday,
      successfulOrderCount,
      spinRewardPct,
      questRewardPct,
      questLevel: quest.level,
      questHalfPct: quest.half_pct,
      questTodayCount: quest.today_count,
    });
  } catch (err) {
    console.error("[gamification/state] error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/gamification/spin  Body: { userId } ────────────────────────────
router.post("/spin", async (req, res) => {
  const { userId } = req.body || {};
  if (!userId)
    return res.status(400).json({ success: false, message: "userId required" });

  try {
    // Already spun today?
    const { rows: existing } = await pool.query(
      `SELECT spin_index FROM gamification_spins
       WHERE user_id = $1 AND spin_date = CURRENT_DATE LIMIT 1`,
      [userId]
    );
    if (existing.length > 0) {
      return res.json({
        success: false,
        hasSpunToday: true,
        message: "You have already spun today. Come back tomorrow!",
      });
    }

    // Order count for car unlock
    const { rows: orderRows } = await pool.query(
      `SELECT COUNT(*)::int AS cnt FROM orders
       WHERE user_id = $1 AND status NOT IN ('cancelled')`,
      [userId]
    );
    const carUnlocked = (orderRows[0]?.cnt ?? 0) >= 100000;

    const spinIndex = pickSegment(carUnlocked);
    const prize = SPIN_PRIZES[spinIndex];

    // Record spin (ON CONFLICT handles race conditions)
    await pool.query(
      `INSERT INTO gamification_spins
         (user_id, spin_date, spin_index, prize_label, reward_pct)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       ON CONFLICT (user_id, spin_date) DO NOTHING`,
      [userId, spinIndex, prize.label, prize.pct]
    );

    // Credit reward if won something
    if (!prize.isSorry && prize.pct > 0) {
      await pool.query(
        `INSERT INTO user_rewards (user_id, type, value, status)
         VALUES ($1, 'spin_discount', $2, 'available')`,
        [userId, prize.pct]
      );
    }

    return res.json({
      success: true,
      spinIndex,
      prizeLabel: prize.label,
      rewardPct: prize.pct,
      isSorry: prize.isSorry,
    });
  } catch (err) {
    console.error("[gamification/spin] error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── POST /api/gamification/quest/complete-level  Body: { userId } ────────────
// Called every time the player clears one in-game level.
// Rules: 10 levels per day, 1000 total, reward every 100 levels (0.5% per batch).
router.post("/quest/complete-level", async (req, res) => {
  const { userId } = req.body || {};
  if (!userId)
    return res.status(400).json({ success: false, message: "userId required" });

  const DAILY_LIMIT = 10;
  const MAX_LEVEL = 1000;
  const REWARD_EVERY = 100; // levels
  const REWARD_PER_BATCH = 0.5; // percent

  try {
    // Upsert quest row
    const { rows } = await pool.query(
      `INSERT INTO gamification_quest
         (user_id, level, today_date, today_count, half_pct, total_reward_pct)
       VALUES ($1, 1, CURRENT_DATE, 1, 0, 0)
       ON CONFLICT (user_id) DO UPDATE
         SET level = LEAST(gamification_quest.level + 1, $2),
             today_count = CASE
               WHEN gamification_quest.today_date = CURRENT_DATE
               THEN LEAST(gamification_quest.today_count + 1, $3)
               ELSE 1
             END,
             today_date = CURRENT_DATE,
             updated_at = NOW()
       RETURNING level, today_count, half_pct, total_reward_pct`,
      [userId, MAX_LEVEL, DAILY_LIMIT]
    );

    const q = rows[0];
    const level = q.level;
    const todayCount = q.today_count;

    // Check if daily limit was exceeded before this increment
    if (todayCount > DAILY_LIMIT) {
      return res.json({
        success: false,
        message: "Daily level limit reached. Come back tomorrow!",
        questLevel: level,
        questTodayCount: DAILY_LIMIT,
        questHalfPct: q.half_pct,
      });
    }

    // Check if a reward milestone is hit
    let halfPct = parseInt(q.half_pct) || 0;
    let rewardEarned = false;
    if (level % REWARD_EVERY === 0) {
      halfPct = Math.min(halfPct + 1, 10); // up to 10 × 0.5% = 5%
      rewardEarned = true;
      await Promise.all([
        pool.query(
          `INSERT INTO user_rewards (user_id, type, value, status)
           VALUES ($1, 'quest_discount', $2, 'available')`,
          [userId, REWARD_PER_BATCH]
        ),
        pool.query(
          `UPDATE gamification_quest
           SET half_pct = $2, total_reward_pct = total_reward_pct + $3
           WHERE user_id = $1`,
          [userId, halfPct, REWARD_PER_BATCH]
        ),
      ]);
    }

    return res.json({
      success: true,
      questLevel: level,
      questTodayCount: todayCount,
      questHalfPct: halfPct,
      rewardEarned,
      rewardPct: rewardEarned ? REWARD_PER_BATCH : 0,
    });
  } catch (err) {
    console.error("[gamification/quest] error:", err.message);
    return res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
