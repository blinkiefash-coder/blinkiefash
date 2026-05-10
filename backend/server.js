import express from "express";
import cors from "cors";
import "dotenv/config";
import { ensureDatabaseTables } from "./db.js";

import authRoutes from "./routes/auth.js";
import vendorRoutes from "./routes/vendor.js";
import productRoutes from "./routes/products.js";
import brandRoutes from "./routes/brands.js";
import categoryRoutes from "./routes/categories.js";
import uploadRoutes from "./routes/upload.js";
import wishlistRoutes from "./routes/wishlist.js";
import cartRoutes from "./routes/cart.js";

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

const DEFAULT_PORT = Number(process.env.PORT || 5000);
const MAX_PORT_ATTEMPTS = 15;

const listenOnAvailablePort = (startPort, maxAttempts = MAX_PORT_ATTEMPTS) => {
  return new Promise((resolve, reject) => {
    let attempts = 0;

    const tryListen = (port) => {
      const server = app.listen(port, () => {
        resolve({ server, port });
      });

      server.on("error", (err) => {
        if (err.code === "EADDRINUSE" && attempts < maxAttempts - 1) {
          attempts += 1;
          const nextPort = port + 1;
          console.warn(`⚠️ Port ${port} is in use. Trying ${nextPort}...`);
          tryListen(nextPort);
          return;
        }

        reject(err);
      });
    };

    tryListen(startPort);
  });
};

const startServer = async () => {
  await ensureDatabaseTables();
  const { port } = await listenOnAvailablePort(DEFAULT_PORT);
  console.log(`✅ Backend running on port ${port}`);
};

startServer().catch((err) => {
  console.error("❌ Failed to start backend:", err);
  process.exit(1);
});