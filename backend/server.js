import express from "express";
import cors from "cors";
import "dotenv/config";

import vendorRoutes from "./routes/vendor.js";
import productRoutes from "./routes/products.js";
import brandRoutes from "./routes/brands.js";
import categoryRoutes from "./routes/categories.js";

const app = express();

app.use(cors({
  origin: [
    "http://localhost:5173",
    "https://blinkiefash.in"
  ],
  methods: ["GET", "POST", "PUT", "DELETE"],
  credentials: true
}));
app.use(express.json());

app.use("/api/products", productRoutes);
app.use("/api/vendor", vendorRoutes);
app.use("/api/brands", brandRoutes);
app.use("/api/categories", categoryRoutes);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`✅ Backend running on port ${PORT}`);
});
