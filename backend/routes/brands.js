import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// Admin email from environment or default
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "superadminsatyam@blinkiefash.in";

// Simple guard — checks the request carries the admin email header
function adminGuard(req, res, next) {
  const adminEmail = req.headers["x-admin-email"] || req.query.admin_email || "";
  if (String(adminEmail).toLowerCase() !== ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ success: false, message: "Admin access required" });
  }
  next();
}

router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, logo_url, banner, banner_url, is_active
       FROM brands
       WHERE is_active = true
       ORDER BY name ASC`
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Create brand
router.post("/", adminGuard, async (req, res) => {
  try {
    const { name, logo_url = '', banner = '', banner_url = '' } = req.body;
    
    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Brand name is required" });
    }

    // Check if brand already exists
    const existingBrand = await pool.query(
      "SELECT id FROM brands WHERE lower(name) = lower($1)",
      [name.trim()]
    );

    if (existingBrand.rows.length > 0) {
      return res.status(409).json({ error: "Brand already exists" });
    }

    const result = await pool.query(
      `INSERT INTO brands (name, logo_url, banner, banner_url, is_active)
       VALUES ($1, $2, $3, $4, true)
       RETURNING id, name, logo_url, banner, banner_url`,
      [name.trim(), logo_url || '', banner || '', banner_url || '']
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Update brand
router.put("/:id", adminGuard, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, logo_url = '', banner = '', banner_url = '' } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ error: "Brand name is required" });
    }

    // Check if another brand with this name exists
    const existingBrand = await pool.query(
      "SELECT id FROM brands WHERE lower(name) = lower($1) AND id != $2",
      [name.trim(), id]
    );

    if (existingBrand.rows.length > 0) {
      return res.status(409).json({ error: "A brand with this name already exists" });
    }

    const result = await pool.query(
      `UPDATE brands 
       SET name = $1, logo_url = $2, banner = $3, banner_url = $4, updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING id, name, logo_url, banner, banner_url`,
      [name.trim(), logo_url || '', banner || '', banner_url || '', id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Brand not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin: Delete brand
router.delete("/:id", adminGuard, async (req, res) => {
  try {
    const { id } = req.params;

    // Check if brand has products before deleting
    const productsCheck = await pool.query(
      "SELECT COUNT(*) FROM products WHERE brand_id = $1",
      [id]
    );

    if (parseInt(productsCheck.rows[0].count) > 0) {
      return res.status(400).json({ 
        error: "Cannot delete brand. It has associated products. Set is_active to false instead." 
      });
    }

    const result = await pool.query(
      "DELETE FROM brands WHERE id = $1 RETURNING id",
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Brand not found" });
    }

    res.json({ success: true, message: "Brand deleted successfully" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;