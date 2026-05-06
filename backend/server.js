import express from "express";
import cors from "cors";
import "dotenv/config";

// ✅ Routes
import vendorRoutes from "./routes/vendor.js";
import productRoutes from "./routes/products.js";
import brandRoutes from "./routes/brands.js";
import categoryRoutes from "./routes/categories.js";

const app = express();

/* ================= MIDDLEWARES ================= */

// ✅ JSON parser
app.use(express.json());

// ✅ ✅ CORS (FIXED – THIS SOLVES YOUR ISSUE)
app.use(cors({
  origin: "*",   // ✅ allow all origins (works immediately)
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));

// ✅ OPTIONAL (extra safety for headers)
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Headers", "*");
  next();
});

/* ================= ROUTES ================= */

app.use("/api/vendor", vendorRoutes);
app.use("/api/products", productRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/categories", categoryRoutes);

// ✅ Health check (useful)
app.get("/", (req, res) => {
  res.send("✅ Blinkiefash Backend Running");
});

/* ================= SERVER ================= */

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Server running on port ${PORT}`);
});
