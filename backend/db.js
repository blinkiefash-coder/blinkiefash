import pkg from "pg";
const { Pool } = pkg;

const normalizeDatabaseUrl = (rawUrl = "") => {
  if (!rawUrl) return rawUrl;
  // pg ≥8 treats prefer/require/verify-ca as verify-full; be explicit to silence the warning.
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
  // Add google_uid to users if not already present (safe ALTER IF NOT EXISTS)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_uid VARCHAR(255)`).catch(() => {});
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_google_uid_idx ON users(google_uid) WHERE google_uid IS NOT NULL`).catch(() => {});

  // Ensure orders has confirmed_at column (used for 60-min delivery SLA timer)
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`).catch(() => {});

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

  // Add password columns to users if not already present
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS password_hash TEXT,
      ADD COLUMN IF NOT EXISTS password_salt TEXT;
  `);

  // FCM token for push notifications to the customer device
  await pool.query(`
    ALTER TABLE users ADD COLUMN IF NOT EXISTS fcm_token TEXT
  `).catch(() => {});

  // Create riders table for storing rider-specific information
  await pool.query(`
    CREATE TABLE IF NOT EXISTS "Riders" (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_type VARCHAR(50) DEFAULT 'Bike',
      is_available BOOLEAN DEFAULT false,
      current_lat DECIMAL(10, 8),
      current_lng DECIMAL(11, 8),
      last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      vehicle_number VARCHAR(50),
      is_verified BOOLEAN DEFAULT false,
      earnings_balance DECIMAL(12, 2) DEFAULT 0,
      createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      fcm_token TEXT
    );
  `);

  await pool.query(`
    ALTER TABLE "Riders"
      ADD COLUMN IF NOT EXISTS fcm_token TEXT;
  `).catch(() => {});

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_Riders_user_id_unique ON "Riders"(user_id);
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rider (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      vehicle_type VARCHAR(50) DEFAULT 'Bike',
      vehicle_number VARCHAR(50),
      license_number VARCHAR(50),
      is_available BOOLEAN DEFAULT false,
      is_verified BOOLEAN DEFAULT false,
      current_lat DECIMAL(10, 8),
      current_lng DECIMAL(11, 8),
      last_active TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      earnings_balance DECIMAL(12, 2) DEFAULT 0,
      fcm_token TEXT,
      approval_status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS rider_documents (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      rider_id UUID REFERENCES "Riders"(id) ON DELETE CASCADE,
      doc_type VARCHAR(100),
      doc_number VARCHAR(255),
      doc_url TEXT,
      verification_status VARCHAR(20) DEFAULT 'pending'
    );
  `);

  await pool.query(`
    ALTER TABLE rider_documents
      ADD COLUMN IF NOT EXISTS doc_type VARCHAR(100),
      ADD COLUMN IF NOT EXISTS doc_number VARCHAR(255),
      ADD COLUMN IF NOT EXISTS doc_url TEXT,
      ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending';
  `).catch(() => {});

  await pool.query(`
    ALTER TABLE rider_documents
      DROP CONSTRAINT IF EXISTS fk_rider_docs_rider,
      DROP CONSTRAINT IF EXISTS rider_documents_rider_id_fkey,
      ADD CONSTRAINT rider_documents_rider_id_fkey FOREIGN KEY (rider_id) REFERENCES "Riders"(id) ON DELETE CASCADE;
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_riders_user ON "Riders"(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rider_user ON rider(user_id);
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_rider_documents_rider ON rider_documents(rider_id);
  `);

  // ── Refer & Earn ─────────────────────────────────────────────────────────
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS referral_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS referred_by UUID
  `).catch(() => {});

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS idx_users_referral_code
    ON users(referral_code) WHERE referral_code IS NOT NULL
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS referrals (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      referrer_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      referee_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      code VARCHAR(20) NOT NULL,
      status VARCHAR(20) DEFAULT 'completed',
      created_at TIMESTAMP DEFAULT now(),
      UNIQUE(referee_id)
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
  `);

  // ── Old Clothes Pickup ───────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS old_clothes_pickups (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      address_id UUID REFERENCES addresses(id) ON DELETE SET NULL,
      item_count INT NOT NULL CHECK (item_count > 0),
      pickup_slot VARCHAR(100),
      notes TEXT,
      status VARCHAR(20) DEFAULT 'requested',
      created_at TIMESTAMP DEFAULT now(),
      collected_at TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_old_clothes_user ON old_clothes_pickups(user_id);
  `);

  // ── Unified user rewards (credits) ──────────────────────────────────────
  // type: 'referral_50' (₹50 flat off) or 'clothing_pct' (value = item count, 1% per item)
  // status: 'available' | 'used' | 'expired'
  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_rewards (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      type VARCHAR(30) NOT NULL,
      value DECIMAL(12, 2) NOT NULL DEFAULT 0,
      status VARCHAR(20) DEFAULT 'available',
      source_referral_id UUID,
      source_pickup_id UUID,
      order_id UUID,
      created_at TIMESTAMP DEFAULT now(),
      used_at TIMESTAMP
    );
  `);

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_user_rewards_user_status
    ON user_rewards(user_id, status);
  `);

  // ── Order discount columns ──────────────────────────────────────────────
  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS referral_discount DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS clothing_discount DECIMAL(12, 2) DEFAULT 0
  `).catch(() => {});
};
