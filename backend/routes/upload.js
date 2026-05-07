import express from "express";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import "dotenv/config";

const router = express.Router();

const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post("/", upload.single("image"), async (req, res) => {
  try {
    const result = await cloudinary.uploader.upload(
      `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`
    );

    res.json({
      success: true,
      image_url: result.secure_url
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Upload failed" });
  }
});

export default router;