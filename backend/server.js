import express from "express";
import cors from "cors";
import "dotenv/config";
import { pool, ensureDatabaseTables } from "./db.js";
import { notifyAvailableRiders } from "./utils/firebaseAdmin.js";

import authRoutes from "./routes/auth.js";
import vendorRoutes from "./routes/vendor.js";
import productRoutes from "./routes/products.js";
import brandRoutes from "./routes/brands.js";
import categoryRoutes from "./routes/categories.js";
import uploadRoutes from "./routes/upload.js";
import wishlistRoutes from "./routes/wishlist.js";
import cartRoutes from "./routes/cart.js";
import checkoutRoutes from "./routes/checkout.js";
import usersRoutes from "./routes/users.js";
import referralRoutes from "./routes/referrals.js";
import oldClothesRoutes from "./routes/oldClothes.js";
import reviewsRoutes from "./routes/reviews.js";
import supportRoutes from "./routes/support.js";
import partnerRoutes from "./routes/partners.js";
import deliverRoutes from "./routes/deliver.js";
import gamificationRoutes, { ensureGamificationTables } from "./routes/gamification.js";
import adminRoutes from "./routes/admin.js";
import analyticsRoutes from "./routes/analytics.js";

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:5173",
  "http://localhost:5174",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "https://blinkiefash.vercel.app",
  "https://www.blinkiefash.in",
  "https://blinkiefash.in",
  "https://www.blinkiefash.com",
  "https://blinkiefash.com",
  ...(process.env.FRONTEND_URLS
    ? process.env.FRONTEND_URLS.split(",").map((origin) =>
        origin.trim().replace(/\/$/, "")
      )
    : []),
];

const localhostOriginPattern = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i;
const secureWebOriginPattern = /^https:\/\/[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i;

const isAllowedOrigin = (origin) => {
  if (!origin) return true;

  const normalizedOrigin = origin.replace(/\/$/, "");

  return (
    allowedOrigins.includes(normalizedOrigin) ||
    localhostOriginPattern.test(normalizedOrigin) ||
    secureWebOriginPattern.test(normalizedOrigin)
  );
};

const corsOptions = {
  origin(origin, callback) {
    if (isAllowedOrigin(origin)) {
      callback(null, true);
      return;
    }

    console.warn(`CORS rejected: ${origin}`);
    callback(new Error("Not allowed by CORS"));
  },
  methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "X-Admin-Email"],
  optionsSuccessStatus: 204,
};

app.use(
  cors(corsOptions)
);
app.options(/.*/, cors(corsOptions));
app.use(express.json());

// Health check endpoint
app.get("/health", (req, res) => {
  res.json({ status: "ok", message: "BlinkieFash backend is running" });
});

app.get("/", (req, res) => {
  res.json({ status: "ok", message: "BlinkieFash backend is running" });
});

app.use("/login", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/wishlist", wishlistRoutes);
app.use("/api/cart", cartRoutes);
app.use("/api/checkout", checkoutRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/referrals", referralRoutes);
app.use("/api/old-clothes", oldClothesRoutes);
app.use("/api/reviews", reviewsRoutes);
app.use("/api/support", supportRoutes);
app.use("/api/partners", partnerRoutes);
app.use("/api/deliver", deliverRoutes);
app.use("/api/gamification", gamificationRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/analytics", analyticsRoutes);
// Force redeploy: 2026-06-06 11:20:53 UTC

const DEFAULT_PORT = Number(process.env.PORT || 5000);

const listenOnAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const tryPort = (port) => {
      const server = app.listen(port, () => resolve({ server, port }));
      server.on("error", (err) => {
        if (err.code === "EADDRINUSE") {
          console.warn(`Port ${port} in use, trying ${port + 1}…`);
          tryPort(port + 1);
        } else {
          reject(err);
        }
      });
    };
    tryPort(startPort);
  });
};

const startServer = async () => {
  try {
    await ensureDatabaseTables();
  } catch (error) {
    console.warn("[server] continuing without DB initialization:", error.message);
  }

  try {
    await ensureGamificationTables();
  } catch (error) {
    console.warn("[server] continuing without gamification init:", error.message);
  }

  const { port } = await listenOnAvailablePort(DEFAULT_PORT);
  console.log(`✅ Backend running on port ${port}`);

  // ── Re-notify unassigned confirmed orders every 2 minutes ──────────────
  const lastNotifiedAt = new Map(); // orderId → timestamp
  setInterval(async () => {
    try {
      const { rows } = await pool.query(`
        SELECT o.id
        FROM orders o
        WHERE o.status = 'confirmed'
          AND NOT EXISTS (
            SELECT 1 FROM deliveries d
            WHERE d.order_id = o.id AND d.is_active = TRUE
          )
          AND o.created_at < NOW() - INTERVAL '2 minutes'
      `);
      const now = Date.now();
      for (const row of rows) {
        const lastTime = lastNotifiedAt.get(row.id) || 0;
        if (now - lastTime >= 2 * 60 * 1000) {
          lastNotifiedAt.set(row.id, now);
          notifyAvailableRiders(pool, row.id).catch(() => {});
          console.log(`[scheduler] Re-notified riders for order ${row.id}`);
        }
      }
      // Clean up stale entries (orders no longer unassigned)
      const activeIds = new Set(rows.map((r) => r.id));
      for (const id of lastNotifiedAt.keys()) {
        if (!activeIds.has(id)) lastNotifiedAt.delete(id);
      }
    } catch (err) {
      console.error('[scheduler] re-notify error:', err.message);
    }
  }, 2 * 60 * 1000);

  // ── Self-ping every 14 minutes to prevent Render free-tier cold starts ──
  const selfUrl = process.env.RENDER_EXTERNAL_URL;
  if (selfUrl) {
    setInterval(() => {
      import('node:http').then(({ default: http }) => {
        http.get(`${selfUrl}/health`, (res) => {
          res.resume(); // drain response
        }).on('error', () => {}); // ignore errors silently
      }).catch(() => {});
    }, 14 * 60 * 1000);
    console.log('⏰ Self-ping scheduler active (every 14 min) →', selfUrl);
  }
};

startServer().catch((err) => {
  console.error("❌ Failed to start backend:", err);
  process.exit(1);
});