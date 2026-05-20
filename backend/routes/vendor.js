import express from "express";
import multer from "multer";
import crypto from "crypto";
import { pool } from "../db.js";
import cloudinary from "../utils/cloudinary.js";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

const createPasswordHash = (password = "") => {
  const salt = crypto.randomBytes(16).toString("hex");
  const derived = crypto.scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${derived}`;
};

const uploadFileToCloudinary = async (file, folder) => {
  if (!file) return null;

  const uploadResult = await cloudinary.uploader.upload(
    `data:${file.mimetype};base64,${file.buffer.toString("base64")}`,
    {
      folder,
      resource_type: "auto"
    }
  );

  return uploadResult.secure_url;
};

// GET all active vendors (for Explore Shops page)
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, store_name, slug, description, address, city, pincode,
              lat, lng, service_radius_km, is_verified, is_active,
              vendor_img_url, created_at
       FROM vendors
       WHERE is_active = true
       ORDER BY is_verified DESC, created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET a single vendor by id or slug
router.get("/:identifier", async (req, res) => {
  try {
    const { identifier } = req.params;
    const numericId = Number(identifier);

    const result = await pool.query(
      `SELECT id, store_name, slug, description, address, city, pincode,
              lat, lng, service_radius_km, is_verified, is_active,
              vendor_img_url, created_at
       FROM vendors
       WHERE id = $1 OR slug = $2
       LIMIT 1`,
      [Number.isNaN(numericId) ? null : numericId, identifier]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Vendor not found" });
    }

    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// GET single vendor with their products
router.get("/:id/products", async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
            `SELECT p.id, p.name,
              p.category_id,
              b.name AS brand_name,
              c.name AS category_name,
              (SELECT pm.url FROM product_media pm
               JOIN product_variants pv2 ON pv2.id = pm.variant_id
               WHERE pv2.product_id = p.id
               ORDER BY pm.is_primary DESC, pm.id ASC LIMIT 1) AS image_url,
              pv.price, NULL AS discount_price
       FROM products p
       LEFT JOIN brands b ON b.id = p.brand_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT v.price
         FROM product_variants v
         WHERE v.product_id = p.id AND v.is_active = true
         ORDER BY v.price ASC
         LIMIT 1
       ) pv ON true
       WHERE p.vendor_id = $1 AND p.is_active = true
       ORDER BY p.created_at DESC
       LIMIT 4`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

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

router.post(
  "/register",
  upload.fields([
    { name: "logo", maxCount: 1 },
    { name: "panDoc", maxCount: 1 },
    { name: "gstDoc", maxCount: 1 },
    { name: "bankProof", maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const {
        business_name,
        owner_name,
        email,
        phone,
        password,
        business_type,
        category,
        gst_number,
        pan_number,
        years_in_business,
        store_name,
        description,
        address,
        city,
        state,
        pincode,
        account_holder_name,
        account_number,
        ifsc_code,
        bank_name
      } = req.body;

      if (!business_name || !owner_name || !email || !phone || !password) {
        return res.status(400).json({
          success: false,
          message: "Missing required basic seller fields"
        });
      }

      if (!store_name || !address || !city || !state || !pincode) {
        return res.status(400).json({
          success: false,
          message: "Store address details are required"
        });
      }

      if (!account_holder_name || !account_number || !ifsc_code || !bank_name) {
        return res.status(400).json({
          success: false,
          message: "Bank details are required"
        });
      }

      const normalizedEmail = String(email).trim().toLowerCase();
      const existingSeller = await pool.query(
        "SELECT id FROM sellers WHERE lower(email) = $1 LIMIT 1",
        [normalizedEmail]
      );

      if (existingSeller.rows.length > 0) {
        return res.status(409).json({
          success: false,
          message: "Seller with this email already exists"
        });
      }

      const logoFile = req.files?.logo?.[0];
      const panDocFile = req.files?.panDoc?.[0];
      const gstDocFile = req.files?.gstDoc?.[0];
      const bankProofFile = req.files?.bankProof?.[0];

      let logoUrl = null;
      let panDocUrl = null;
      let gstDocUrl = null;
      let bankProofUrl = null;
      let uploadWarning = "";

      try {
        [logoUrl, panDocUrl, gstDocUrl, bankProofUrl] = await Promise.all([
          uploadFileToCloudinary(logoFile, "blinkiefash/sellers/logo"),
          uploadFileToCloudinary(panDocFile, "blinkiefash/sellers/pan"),
          uploadFileToCloudinary(gstDocFile, "blinkiefash/sellers/gst"),
          uploadFileToCloudinary(bankProofFile, "blinkiefash/sellers/bank-proof")
        ]);
      } catch (uploadErr) {
        console.error("Seller document upload failed:", uploadErr);

        if (process.env.NODE_ENV === "production") {
          return res.status(502).json({
            success: false,
            message: "Seller documents upload failed"
          });
        }

        uploadWarning =
          "Seller registered, but document upload was skipped in local environment.";
      }

      const passwordHash = createPasswordHash(password);

      const insertResult = await pool.query(
        `INSERT INTO sellers (
          business_name,
          owner_name,
          email,
          phone,
          password_hash,
          business_type,
          category,
          gst_number,
          pan_number,
          years_in_business,
          store_name,
          description,
          logo_url,
          address,
          city,
          state,
          pincode,
          account_holder_name,
          account_number,
          ifsc_code,
          bank_name,
          pan_doc_url,
          gst_doc_url,
          bank_proof_url,
          status,
          created_at,
          updated_at
        ) VALUES (
          $1, $2, $3, $4, $5,
          $6, $7, $8, $9, $10,
          $11, $12, $13, $14, $15,
          $16, $17, $18, $19, $20,
          $21, $22, $23, $24, 'pending', NOW(), NOW()
        )
        RETURNING id, email, store_name, status, created_at`,
        [
          business_name,
          owner_name,
          normalizedEmail,
          phone,
          passwordHash,
          business_type || null,
          category || null,
          gst_number || null,
          pan_number || null,
          years_in_business ? Number(years_in_business) : null,
          store_name,
          description || null,
          logoUrl,
          address,
          city,
          state,
          pincode,
          account_holder_name,
          account_number,
          ifsc_code,
          bank_name,
          panDocUrl,
          gstDocUrl,
          bankProofUrl
        ]
      );

      return res.status(201).json({
        success: true,
        message: "Seller registration submitted for review",
        warning: uploadWarning || undefined,
        seller: insertResult.rows[0]
      });
    } catch (err) {
      console.error("Seller register error:", err);
      return res.status(500).json({
        success: false,
        message: "Failed to register seller"
      });
    }
  }
);

export default router;