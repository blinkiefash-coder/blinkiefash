import express from "express";
import { pool } from "../db.js";

const router = express.Router();

// ── Store Partner Application ────────────────────────────────────
router.post("/store", async (req, res) => {
  try {
    const {
      store_name, owner_name, email, phone,
      city, address, pincode,
      store_category, store_size, years_in_business,
      gst_number, message,
    } = req.body;

    if (!store_name || !owner_name || !email || !phone) {
      return res.status(400).json({ error: "store_name, owner_name, email and phone are required." });
    }

    const { rows } = await pool.query(
      `INSERT INTO store_partner_applications
         (store_name, owner_name, email, phone, city, address, pincode,
          store_category, store_size, years_in_business, gst_number, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING id, status, created_at`,
      [store_name, owner_name, email, phone, city, address, pincode,
       store_category, store_size, years_in_business || 0, gst_number, message]
    );

    res.status(201).json({ success: true, application: rows[0] });
  } catch (err) {
    console.error("store partner apply error:", err);
    res.status(500).json({ error: "Failed to submit application. Please try again." });
  }
});

// ── Delivery Partner Application ─────────────────────────────────
router.post("/delivery", async (req, res) => {
  try {
    const {
      full_name, email, phone, city, pincode,
      vehicle_type, driving_license, availability,
      experience_years, message,
    } = req.body;

    if (!full_name || !email || !phone) {
      return res.status(400).json({ error: "full_name, email and phone are required." });
    }

    const { rows } = await pool.query(
      `INSERT INTO delivery_partner_applications
         (full_name, email, phone, city, pincode,
          vehicle_type, driving_license, availability, experience_years, message)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING id, status, created_at`,
      [full_name, email, phone, city, pincode,
       vehicle_type, driving_license, availability, experience_years || 0, message]
    );

    res.status(201).json({ success: true, application: rows[0] });
  } catch (err) {
    console.error("delivery partner apply error:", err);
    res.status(500).json({ error: "Failed to submit application. Please try again." });
  }
});

// ── Get application status ────────────────────────────────────────
router.get("/store/status/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, store_name, status, created_at FROM store_partner_applications WHERE id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Application not found." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

router.get("/delivery/status/:id", async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, full_name, status, created_at FROM delivery_partner_applications WHERE id=$1`,
      [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: "Application not found." });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: "Server error." });
  }
});

export default router;
