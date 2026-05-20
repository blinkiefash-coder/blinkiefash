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

const app = express();

const allowedOrigins = (process.env.FRONTEND_URLS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean)
  .map((origin) => origin.replace(/\/$/, ""));

app.use(
  cors({
    origin(origin, callback) {
      if (!origin) {
        callback(null, true);
        return;
      }

      if (allowedOrigins.length === 0) {
        callback(null, true);
        return;
      }

      const normalizedOrigin = origin.replace(/\/$/, "");

      if (allowedOrigins.includes(normalizedOrigin)) {
        callback(null, true);
        return;
      }
      callback(new Error("Not allowed by CORS"));
    },
  })
);
app.use(express.json());

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
  await ensureDatabaseTables();
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
};

startServer().catch((err) => {
  console.error("❌ Failed to start backend:", err);
  process.exit(1);
});