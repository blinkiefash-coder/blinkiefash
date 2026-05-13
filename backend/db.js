import pkg from "pg";
const { Pool } = pkg;

const normalizeDatabaseUrl = (rawUrl = "") => {
  if (!rawUrl) return rawUrl;

  // pg warns for prefer/require/verify-ca unless explicitly opting into compatibility.
  // Keep current behavior explicit by forcing sslmode=verify-full.
  return rawUrl.replace(/sslmode=(prefer|require|verify-ca)/gi, "sslmode=verify-full");
};

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL || "");

export const pool = new Pool({
  connectionString,

  ssl: {
    rejectUnauthorized: false,   // ✅ REQUIRED for Neon
  },
});

export const ensureDatabaseTables = async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sellers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      business_name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      phone VARCHAR(20) NOT NULL,
      password_hash TEXT NOT NULL,
      business_type VARCHAR(50),
      category TEXT,
      gst_number VARCHAR(50),
      pan_number VARCHAR(20),
      years_in_business INT,
      store_name VARCHAR(255),
      description TEXT,
      logo_url TEXT,
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      pincode VARCHAR(10),
      account_holder_name VARCHAR(255),
      account_number VARCHAR(50),
      ifsc_code VARCHAR(20),
      bank_name VARCHAR(255),
      pan_doc_url TEXT,
      gst_doc_url TEXT,
      bank_proof_url TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS carts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE REFERENCES users(id) ON DELETE CASCADE,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS cart_items (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      cart_id UUID REFERENCES carts(id) ON DELETE CASCADE,
      variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
      quantity INT DEFAULT 1 CHECK (quantity > 0),
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now(),
      UNIQUE(cart_id, variant_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_carts_user ON carts(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_cart_items_cart ON cart_items(cart_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_cart_items_variant ON cart_items(variant_id);
  `);
};
