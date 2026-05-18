// Bypass SSL certificate verification for local development
// Remove this in production
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

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
import checkoutRoutes from "./routes/checkout.js";

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

const DEFAULT_PORT = Number(process.env.PORT || 5000);

const listenOnAvailablePort = (startPort) => {
  return new Promise((resolve, reject) => {
    const server = app.listen(startPort, () => {
      resolve({ server, port: startPort });
    });
    server.on("error", (err) => {
      reject(err);
    });
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