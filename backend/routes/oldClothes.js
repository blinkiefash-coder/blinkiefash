import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// GET /api/old-clothes/:userId — list pickups + active clothing reward
router.get("/:userId", async (req, res) => {
  const { userId } = req.params;
  if (!userId) {
    return res.status(400).json({ success: false, message: "userId required" });
  }
  try {
    const { rows: pickups } = await pool.query(
      `SELECT p.id, p.item_count, p.pickup_slot, p.notes, p.status,
              p.created_at, p.collected_at,
              a.address_line, a.city, a.pincode
       FROM old_clothes_pickups p
       LEFT JOIN addresses a ON a.id = p.address_id
       WHERE p.user_id = $1
       ORDER BY p.created_at DESC`,
      [userId]
    );

    const { rows: rewardRows } = await pool.query(
      `SELECT COALESCE(SUM(value), 0)::int AS items
       FROM user_rewards
       WHERE user_id = $1 AND type = 'clothing_pct' AND status = 'available'`,
      [userId]
    );

    const items = rewardRows[0].items;
    const percent = Math.min(items, 50); // hard cap 50%

    res.json({
      success: true,
      pickups,
      availableItems: items,
      availablePercent: percent,
    });
  } catch (err) {
    console.error("GET old-clothes error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// POST /api/old-clothes — schedule a pickup
// Body: { userId, addressId, itemCount, pickupSlot?, notes? }
router.post("/", async (req, res) => {
  const { userId, addressId, itemCount, pickupSlot, notes } = req.body;
  const count = parseInt(itemCount, 10);
  if (!userId || !addressId || !count || count < 1) {
    return res
      .status(400)
      .json({ success: false, message: "userId, addressId and itemCount (>=1) required" });
  }
  try {
    const { rows } = await pool.query(
      `INSERT INTO old_clothes_pickups (user_id, address_id, item_count, pickup_slot, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, status, created_at`,
      [userId, addressId, count, pickupSlot || null, notes || null]
    );
    res.json({ success: true, pickup: rows[0] });
  } catch (err) {
    console.error("POST old-clothes error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// PATCH /api/old-clothes/:id/collect — mark pickup collected and credit reward.
// Body: { collectedCount? }  (defaults to original item_count)
router.patch("/:id/collect", async (req, res) => {
  const { id } = req.params;
  const override = parseInt(req.body?.collectedCount, 10);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const { rows } = await client.query(
      `SELECT id, user_id, item_count, status FROM old_clothes_pickups WHERE id = $1 FOR UPDATE`,
      [id]
    );
    if (!rows.length) {
      await client.query("ROLLBACK");
      return res.status(404).json({ success: false, message: "Pickup not found" });
    }
    const pickup = rows[0];
    if (pickup.status === "collected") {
      await client.query("ROLLBACK");
      return res.json({ success: true, message: "Already collected" });
    }

    const finalCount = Number.isFinite(override) && override > 0 ? override : pickup.item_count;

    await client.query(
      `UPDATE old_clothes_pickups
         SET status = 'collected', item_count = $1, collected_at = NOW()
       WHERE id = $2`,
      [finalCount, id]
    );

    await client.query(
      `INSERT INTO user_rewards (user_id, type, value, status, source_pickup_id)
       VALUES ($1, 'clothing_pct', $2, 'available', $3)`,
      [pickup.user_id, finalCount, pickup.id]
    );

    await client.query("COMMIT");
    res.json({ success: true, creditedItems: finalCount });
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("PATCH old-clothes collect error:", err);
    res.status(500).json({ success: false, message: "Server error" });
  } finally {
    client.release();
  }
});

export default router;
