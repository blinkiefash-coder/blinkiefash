import express from "express";
import { pool } from "../db.js";
import { getFirebaseAdminAuth } from "../utils/firebaseAdmin.js";

const router = express.Router();

const normalizePhone = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith("091")) return digits.slice(3);
  return "";
};

const roleMatchesExpected = (actualRole = "", expectedRole = "") => {
  const role = String(actualRole).toLowerCase();
  const expected = String(expectedRole).toLowerCase();

  if (expected === "vendor") return role === "vendor";
  if (expected === "customer") return role !== "vendor";

  return role === expected;
};

router.post("/start", async (req, res) => {
  try {
    const { phone, expectedRole } = req.body;
    const normalizedPhone = normalizePhone(phone);

    if (!normalizedPhone || !expectedRole) {
      return res.json({
        success: false,
        message: "Phone and role are required"
      });
    }

    const userResult = await pool.query(
      `SELECT id, name, phone, role
       FROM users
       WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
       LIMIT 1`,
      [normalizedPhone]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        success: false,
        message: "Mobile number not found"
      });
    }

    const user = userResult.rows[0];
    if (!roleMatchesExpected(user.role, expectedRole)) {
      return res.json({
        success: false,
        message: `This number is registered as ${user.role}, not ${expectedRole}`
      });
    }

    res.json({
      success: true,
      message: "Role verified. Send OTP.",
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role,
      }
    });
  } catch (err) {
    console.error("Login start error:", err);
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { idToken, expectedRole } = req.body;
    if (!idToken || !expectedRole) {
      return res.json({
        success: false,
        message: "idToken and role are required"
      });
    }

    const firebaseAuth = getFirebaseAdminAuth();
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const normalizedPhone = normalizePhone(decoded.phone_number || "");

    if (!normalizedPhone) {
      return res.json({
        success: false,
        message: "Phone number missing in OTP token"
      });
    }

    const userResult = await pool.query(
      `SELECT id, name, phone, role
       FROM users
       WHERE regexp_replace(phone, '[^0-9]', '', 'g') = $1
       LIMIT 1`,
      [normalizedPhone]
    );

    if (userResult.rows.length === 0) {
      return res.json({
        success: false,
        message: "User not found in database"
      });
    }

    const user = userResult.rows[0];
    if (!roleMatchesExpected(user.role, expectedRole)) {
      return res.json({
        success: false,
        message: `This number is registered as ${user.role}, not ${expectedRole}`
      });
    }

    res.json({
      success: true,
      token: `session_${user.id}_${Date.now()}`,
      user: {
        id: user.id,
        name: user.name,
        phone: user.phone,
        role: user.role
      },
      message: "OTP verified. Login successful"
    });
  } catch (err) {
    console.error("Login verify error:", err);
    res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

export default router;
