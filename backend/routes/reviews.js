import express from "express";
import { pool } from "../db.js";

const router = express.Router();

const isUuid = (value = "") =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value)
  );

// GET /api/reviews/product/:productId – list reviews + aggregate
router.get("/product/:productId", async (req, res) => {
  try {
    const { productId } = req.params;
    if (!isUuid(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }

    const result = await pool.query(
      `SELECT id, product_id, user_id, rating,
              comment, image, created_at
         FROM reviews
        WHERE product_id = $1
        ORDER BY created_at DESC`,
      [productId]
    );

    const reviews = result.rows.map((r) => ({
      id: r.id,
      product_id: r.product_id,
      user_id: r.user_id,
      rating: r.rating,
      reviewer_name: 'Anonymous',
      review_text: r.comment,
      image_url: r.image,
      created_at: r.created_at,
    }));
    const count = reviews.length;
    const avg = count
      ? reviews.reduce((sum, r) => sum + Number(r.rating || 0), 0) / count
      : 0;

    res.json({
      success: true,
      count,
      average_rating: Number(avg.toFixed(2)),
      reviews,
    });
  } catch (err) {
    console.error("REVIEWS LIST ERROR:", err);
    res.status(500).json({ error: "Failed to load reviews" });
  }
});

// POST /api/reviews – submit a new review
router.post("/", async (req, res) => {
  try {
    const {
      productId,
      userId,
      reviewerName,
      rating,
      reviewText,
      imageUrl,
    } = req.body || {};

    console.log("[REVIEW SUBMIT] Received:", { productId, rating, reviewText, imageUrl });

    if (!isUuid(productId)) {
      return res.status(400).json({ error: "Invalid product id" });
    }
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return res.status(400).json({ error: "Rating must be between 1 and 5" });
    }
    const text = String(reviewText || "").trim();
    if (!text) {
      return res.status(400).json({ error: "Review text is required" });
    }

    const userIdValue = isUuid(userId) ? userId : null;
    const image = imageUrl ? String(imageUrl) : null;

    const inserted = await pool.query(
      `INSERT INTO reviews
         (product_id, user_id, rating, comment, image)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, product_id, user_id, rating, comment, image, created_at`,
      [productId, userIdValue, ratingNum, text, image]
    );

    const row = inserted.rows[0];
    const review = {
      id: row.id,
      product_id: row.product_id,
      user_id: row.user_id,
      rating: row.rating,
      reviewer_name: 'Anonymous',
      review_text: row.comment,
      image_url: row.image,
      created_at: row.created_at,
    };

    console.log("[REVIEW SUBMIT] Success:", review);
    res.status(201).json({ success: true, review });
  } catch (err) {
    console.error("[REVIEW SUBMIT ERROR]:", err);
    res.status(500).json({ error: "Failed to submit review", details: err.message });
  }
});

export default router;
