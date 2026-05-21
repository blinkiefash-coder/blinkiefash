import express from "express";
import crypto from "crypto";
import { pool } from "../db.js";
import { getFirebaseAdminAuth } from "../utils/firebaseAdmin.js";

const router = express.Router();
const otpStore = new Map();

const hashPassword = (password, salt) =>
  crypto.scryptSync(password, salt, 64).toString("hex");

const verifyPassword = (password, salt, storedHash) =>
  crypto.timingSafeEqual(
    Buffer.from(hashPassword(password, salt), "hex"),
    Buffer.from(storedHash, "hex")
  );

const normalizePhone = (value = "") => {
  const digits = String(value).replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("91")) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith("091")) return digits.slice(3);
  return "";
};

const formatPhoneForStorage = (value = "") => {
  const normalized = normalizePhone(value);
  return normalized ? `+91${normalized}` : "";
};

const roleMatchesExpected = (actualRole = "", expectedRole = "") => {
  const role = String(actualRole).toLowerCase();
  const expected = String(expectedRole).toLowerCase();

  if (expected === "vendor") return role === "vendor";
  if (expected === "customer") return role !== "vendor";

  return role === expected;
};

const createOtp = () => String(Math.floor(100000 + Math.random() * 900000));
const canUseServerOtp =
  process.env.NODE_ENV !== "production" ||
  String(process.env.ALLOW_SERVER_OTP || "false").toLowerCase() === "true";

router.post("/register", async (req, res) => {
  try {
    const { name, phone, email, role } = req.body;
    const normalizedPhone = normalizePhone(phone);
    const formattedPhone = formatPhoneForStorage(phone);
    const trimmedName = String(name || "").trim();
    const trimmedEmail = String(email || "").trim().toLowerCase();
    const userRole = String(role || "customer").toLowerCase();

    if (!trimmedName || !normalizedPhone) {
      return res.json({
        success: false,
        message: "Name and valid mobile number are required"
      });
    }

    const existingPhone = await pool.query(
      `SELECT id
       FROM users
       WHERE RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $1
       LIMIT 1`,
      [normalizedPhone]
    );

    if (existingPhone.rows.length > 0) {
      return res.json({
        success: false,
        message: "Mobile number already exists"
      });
    }

    if (trimmedEmail) {
      const existingEmail = await pool.query(
        `SELECT id FROM users WHERE lower(email) = $1 LIMIT 1`,
        [trimmedEmail]
      );

      if (existingEmail.rows.length > 0) {
        return res.json({
          success: false,
          message: "Email already exists"
        });
      }
    }

    const insertResult = await pool.query(
      `INSERT INTO users (name, phone, email, role, is_active, created_at, updated_at)
       VALUES ($1, $2, $3, $4, true, NOW(), NOW())
       RETURNING id, name, phone, email, role, is_active`,
      [trimmedName, formattedPhone, trimmedEmail || null, userRole]
    );

    const userId = insertResult.rows[0].id;

    // If rider role, create rider profile
    if (userRole === 'rider') {
      const { vehicleType, vehicleNumber } = req.body;
      try {
        // Simple insert with just the core fields
        const result = await pool.query(
          `INSERT INTO Riders (user_id, vehicle_type, vehicle_number, is_available, is_verified)
           VALUES ($1, $2, $3, false, false)
           RETURNING id, user_id, vehicle_type, vehicle_number`,
          [userId, vehicleType || 'Bike', vehicleNumber || null]
        );
        console.log("✅ Rider profile created successfully:", result.rows[0]);
      } catch (riderErr) {
        console.error("❌ Failed to create rider profile:", {
          code: riderErr.code,
          message: riderErr.message,
          detail: riderErr.detail,
          userId,
          vehicleType,
          vehicleNumber
        });
      }
    }

    return res.json({
      success: true,
      message: "Account created successfully",
      user: insertResult.rows[0]
    });
  } catch (err) {
    console.error("Register error:", err);
    return res.status(500).json({
      success: false,
      error: "Server error"
    });
  }
});

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
       WHERE RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $1
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

    const otp = createOtp();
    otpStore.set(normalizedPhone, {
      otp,
      expectedRole: String(expectedRole).toLowerCase(),
      expiresAt: Date.now() + 5 * 60 * 1000,
      attempts: 0,
    });

    res.json({
      success: true,
      message: "Role verified. Send OTP.",
      fallbackOtpMode: canUseServerOtp,
      debugOtp: canUseServerOtp ? otp : undefined,
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
    const { idToken, expectedRole, phone, otp } = req.body;
    if (!expectedRole) {
      return res.json({
        success: false,
        message: "role is required"
      });
    }

    let normalizedPhone = "";

    if (idToken) {
      const firebaseAuth = getFirebaseAdminAuth();
      const decoded = await firebaseAuth.verifyIdToken(idToken);
      normalizedPhone = normalizePhone(decoded.phone_number || "");
    } else if (canUseServerOtp && phone && otp) {
      normalizedPhone = normalizePhone(phone);
      const session = otpStore.get(normalizedPhone);

      if (!session) {
        return res.json({
          success: false,
          message: "OTP expired. Please request OTP again"
        });
      }

      if (Date.now() > session.expiresAt) {
        otpStore.delete(normalizedPhone);
        return res.json({
          success: false,
          message: "OTP expired. Please request OTP again"
        });
      }

      session.attempts += 1;
      if (session.attempts > 5) {
        otpStore.delete(normalizedPhone);
        return res.json({
          success: false,
          message: "Too many attempts. Request OTP again"
        });
      }

      if (String(session.expectedRole) !== String(expectedRole).toLowerCase()) {
        return res.json({
          success: false,
          message: "Role mismatch for OTP session"
        });
      }

      if (String(session.otp) !== String(otp)) {
        return res.json({
          success: false,
          message: "Invalid OTP"
        });
      }

      otpStore.delete(normalizedPhone);
    } else {
      return res.json({
        success: false,
        message: "idToken is required"
      });
    }

    if (!normalizedPhone) {
      return res.json({
        success: false,
        message: "Phone number missing in OTP token"
      });
    }

    const userResult = await pool.query(
      `SELECT id, name, phone, role
       FROM users
       WHERE RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $1
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

// POST /auth/set-password  — create or update password for a user
router.post("/set-password", async (req, res) => {
  try {
    const { phone, password } = req.body;
    if (!phone || !password || String(password).length < 6) {
      return res.json({
        success: false,
        message: "Phone and a password of at least 6 characters are required"
      });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.json({ success: false, message: "Invalid phone number" });
    }

    const userResult = await pool.query(
      `SELECT id, name, phone, role FROM users
       WHERE RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $1 LIMIT 1`,
      [normalizedPhone]
    );

    if (userResult.rows.length === 0) {
      return res.json({ success: false, message: "Phone number not found. Please register first." });
    }

    const user = userResult.rows[0];
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = hashPassword(String(password), salt);

    await pool.query(
      `UPDATE users SET password_hash = $1, password_salt = $2, updated_at = NOW()
       WHERE RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $3`,
      [hash, salt, normalizedPhone]
    );

    return res.json({ 
      success: true, 
      message: "Password set successfully",
      token: `session_${user.id}_${Date.now()}`,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role }
    });
  } catch (err) {
    console.error("Set password error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST /auth/login-password  — login with phone + password
router.post("/login-password", async (req, res) => {
  try {
    const { phone, password, expectedRole = "customer" } = req.body;
    if (!phone || !password) {
      return res.json({ success: false, message: "Phone and password are required" });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.json({ success: false, message: "Invalid phone number" });
    }

    const userResult = await pool.query(
      `SELECT id, name, phone, role, password_hash, password_salt
       FROM users
       WHERE RIGHT(regexp_replace(phone, '[^0-9]', '', 'g'), 10) = $1 LIMIT 1`,
      [normalizedPhone]
    );

    if (userResult.rows.length === 0) {
      return res.json({ success: false, message: "Phone number not found" });
    }

    const user = userResult.rows[0];

    if (!user.password_hash || !user.password_salt) {
      return res.json({
        success: false,
        message: "No password set for this account. Please set a password first."
      });
    }

    if (!roleMatchesExpected(user.role, expectedRole)) {
      return res.json({
        success: false,
        message: `This number is registered as ${user.role}, not ${expectedRole}`
      });
    }

    const isValid = verifyPassword(String(password), user.password_salt, user.password_hash);
    if (!isValid) {
      return res.json({ success: false, message: "Incorrect password" });
    }

    return res.json({
      success: true,
      token: `session_${user.id}_${Date.now()}`,
      user: { id: user.id, name: user.name, phone: user.phone, role: user.role },
      message: "Login successful"
    });
  } catch (err) {
    console.error("Password login error:", err);
    return res.status(500).json({ success: false, error: "Server error" });
  }
});

// POST /login/google — sign in / auto-register via Firebase Google auth
router.post("/google", async (req, res) => {
  try {
    const { idToken } = req.body;
    if (!idToken) return res.json({ success: false, message: "Firebase ID token required" });

    const firebaseAuth = getFirebaseAdminAuth();
    const decoded = await firebaseAuth.verifyIdToken(idToken);
    const googleUid = decoded.uid;
    const email = (decoded.email || "").trim().toLowerCase();
    const name = (decoded.name || decoded.display_name || "User").trim();

    // Find by google_uid first, then fall back to email
    let userResult = await pool.query(
      `SELECT id, name, phone, email, role FROM users WHERE google_uid = $1 LIMIT 1`,
      [googleUid]
    );

    if (userResult.rows.length === 0 && email) {
      userResult = await pool.query(
        `SELECT id, name, phone, email, role FROM users WHERE lower(email) = $1 LIMIT 1`,
        [email]
      );
      if (userResult.rows.length > 0) {
        await pool.query(
          `UPDATE users SET google_uid = $1, updated_at = NOW() WHERE id = $2`,
          [googleUid, userResult.rows[0].id]
        ).catch(() => {});
      }
    }

    let user;
    if (userResult.rows.length > 0) {
      user = userResult.rows[0];
    } else {
      const result = await pool.query(
        `INSERT INTO users (name, email, google_uid, role, is_active, created_at, updated_at)
         VALUES ($1, $2, $3, 'customer', true, NOW(), NOW())
         RETURNING id, name, phone, email, role`,
        [name || "User", email || null, googleUid]
      );
      user = result.rows[0];
    }

    return res.json({
      success: true,
      token: `session_${user.id}_${Date.now()}`,
      user: { id: user.id, name: user.name, phone: user.phone, email: user.email, role: user.role },
      isNewUser: !user.phone,
      message: "Google sign-in successful",
    });
  } catch (err) {
    console.error("Google auth error:", err);
    return res.status(500).json({ success: false, error: err.message || "Server error" });
  }
});

export default router;
