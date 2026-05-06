import express from "express";
import { pool } from "../db.js";

const router = express.Router();

router.post("/verify", async (req, res) => {
  try {
    const { email } = req.body;

    const userResult = await pool.query(
      "SELECT * FROM users WHERE email = $1",
      [email]
    );

    if (userResult.rows.length === 0) {
      return res.json({ success: false, message: "User not found" });
    }

    const user = userResult.rows[0];

    if (user.role !== "vendor") {
      return res.json({
        success: false,
        message: "Not a vendor"
      });
    }

    const vendorResult = await pool.query(
      "SELECT id FROM vendors WHERE user_id = $1",
      [user.id]
    );

    if (vendorResult.rows.length === 0) {
      return res.json({
        success: false,
        message: "Vendor profile not found"
      });
    }

    const vendor_id = vendorResult.rows[0].id;

    res.json({
      success: true,
      vendor_id
    });

  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
