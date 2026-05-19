import express from "express";
import multer from "multer";
import cloudinary from "../utils/cloudinary.js";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    files: 20,
    fileSize: 10 * 1024 * 1024,
  },
});

// ✅ MULTIPLE IMAGE SUPPORT
router.post("/", upload.array("image", 20), async (req, res) => {
  console.log("[UPLOAD ROUTE] /api/upload hit");
  try {
    // Debug: Log environment variables
    console.log("Cloudinary ENV:", {
      CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME,
      CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY,
      CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET ? "[HIDDEN]" : undefined,
    });

    // Debug: Log file info
    if (!req.files || req.files.length === 0) {
      console.log("[UPLOAD ROUTE] No files received");
      return res.status(400).json({ error: "No files uploaded" });
    }
    console.log("[UPLOAD ROUTE] Files received:", req.files.map(f => ({
      originalname: f.originalname,
      mimetype: f.mimetype,
      size: f.size
    })));

    let imageUrls = [];

    for (let file of req.files) {
      try {
        const result = await cloudinary.uploader.upload(
          `data:${file.mimetype};base64,${file.buffer.toString("base64")}`
        );
        console.log("[UPLOAD ROUTE] Cloudinary result for", file.originalname, result);
        if (result && result.secure_url) {
          imageUrls.push(result.secure_url);
        } else {
          console.error("[UPLOAD ROUTE] No secure_url in Cloudinary response:", result);
        }
      } catch (uploadErr) {
        const errMsg = uploadErr?.message || uploadErr?.error?.message || uploadErr?.error?.code || JSON.stringify(uploadErr);
        console.error("Cloudinary upload error for file", file.originalname, uploadErr);
        return res.status(500).json({ error: `Cloudinary upload failed for ${file.originalname}: ${errMsg}` });
      }
    }

    console.log("[UPLOAD ROUTE] Upload success, returning image_urls:", imageUrls);
    res.json({
      success: true,
      image_urls: imageUrls
    });

  } catch (err) {
    console.error("UPLOAD ERROR:", err);
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "Each file must be 10MB or smaller" });
      }
      return res.status(400).json({ error: err.message || "Upload validation failed" });
    }
    res.status(500).json({ error: err.message || "Upload failed" });
  }
});

export default router;
