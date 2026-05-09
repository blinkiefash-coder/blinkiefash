import express from "express";
import cors from "cors";
import "dotenv/config";

import authRoutes from "./routes/auth.js";
import vendorRoutes from "./routes/vendor.js";
import productRoutes from "./routes/products.js";
import brandRoutes from "./routes/brands.js";
import categoryRoutes from "./routes/categories.js";
import uploadRoutes from "./routes/upload.js";

const app = express();

app.use(cors());
app.use(express.json());

app.use("/login", authRoutes);
app.use("/api/products", productRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/categories", categoryRoutes);
app.use("/api/upload", uploadRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});