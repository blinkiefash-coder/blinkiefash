import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.get("/mirrors", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT source_root_id, target_root_id, mirror_mode
       FROM category_mirror_links
       WHERE is_active = true`
    );
    res.json(result.rows);
  } catch (err) {
    if (err?.code === "42P01") {
      // Table may not exist yet during first boot before migrations run.
      return res.json([]);
    }
    res.status(500).json({ error: err.message });
  }
});

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, parent_id, category_url
       FROM categories
       WHERE is_active = true
       ORDER BY
         CASE WHEN parent_id IS NULL THEN 0 ELSE 1 END,
         name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;