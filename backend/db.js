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
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS stock_deducted_at TIMESTAMPTZ`).catch(() => {});

  await pool.query(`CREATE SEQUENCE IF NOT EXISTS product_variant_code_seq START WITH 1 INCREMENT BY 1`).catch(() => {});
  await pool.query(`
    CREATE OR REPLACE FUNCTION assign_product_variant_code()
    RETURNS TRIGGER AS $$
    BEGIN
      IF NEW.variant_code IS NULL OR NEW.variant_code = '' THEN
        NEW.variant_code := LPAD(nextval('product_variant_code_seq')::text, 8, '0');
      END IF;
      RETURN NEW;
    END;
    $$ LANGUAGE plpgsql;
  `).catch(() => {});

  await pool.query(`
    DO $$
    DECLARE
      max_code bigint;
      next_start bigint;
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'product_variants'
      ) THEN
        EXECUTE 'ALTER TABLE product_variants ADD COLUMN IF NOT EXISTS variant_code VARCHAR(8)';

        SELECT COALESCE(MAX(variant_code::bigint), 0)
          INTO max_code
        FROM product_variants
        WHERE variant_code ~ '^[0-9]{8}$';

        next_start := COALESCE(max_code, 0) + 1;
        PERFORM setval('product_variant_code_seq', next_start, false);

        UPDATE product_variants
          SET variant_code = LPAD(nextval('product_variant_code_seq')::text, 8, '0')
          WHERE variant_code IS NULL OR variant_code = '';

        EXECUTE 'DROP TRIGGER IF EXISTS trg_assign_product_variant_code ON product_variants';
        EXECUTE '
          CREATE TRIGGER trg_assign_product_variant_code
          BEFORE INSERT ON product_variants
          FOR EACH ROW
          EXECUTE FUNCTION assign_product_variant_code()
        ';

        EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_product_variants_variant_code ON product_variants(variant_code) WHERE variant_code IS NOT NULL';
      END IF;
    END $$;
  `).catch(() => {});

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
      ADD COLUMN IF NOT EXISTS clothing_discount DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bundle_discount DECIMAL(12, 2) DEFAULT 0
  `).catch(() => {});

  // ── Product feature flags ─────────────────────────────────────────────────
  await pool.query(`
    ALTER TABLE products
      ADD COLUMN IF NOT EXISTS is_bestseller BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_try_and_buy BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS buy_2 BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS buy_3 BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS buy_4 BOOLEAN DEFAULT false
  `).catch(() => {});

  // ── Bulk offer/deal support ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bulk_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      offer_type VARCHAR(100) NOT NULL,
      quantity INT NOT NULL,
      offer_price DECIMAL(12, 2) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bulk_offers_product_active
    ON bulk_offers(product_id, is_active);
  `).catch(() => {});

  // ── Bundle pricing offers ─────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bundle_offers (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      vendor_id UUID NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      quantity_min INT NOT NULL DEFAULT 1,
      quantity_max INT,
      discount_type VARCHAR(20) DEFAULT 'fixed_price',
      discount_value DECIMAL(12, 2) NOT NULL,
      is_active BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT now(),
      updated_at TIMESTAMP DEFAULT now()
    );
  `);

  // Migration: fix bundle_offers.vendor_id to reference vendors instead of sellers
  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1 FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu
          ON rc.constraint_name = kcu.constraint_name
        JOIN information_schema.constraint_column_usage ccu
          ON rc.unique_constraint_name = ccu.constraint_name
        WHERE kcu.table_name = 'bundle_offers'
          AND kcu.column_name = 'vendor_id'
          AND ccu.table_name = 'sellers'
      ) THEN
        ALTER TABLE bundle_offers DROP CONSTRAINT bundle_offers_vendor_id_fkey;
        ALTER TABLE bundle_offers
          ADD CONSTRAINT bundle_offers_vendor_id_fkey
          FOREIGN KEY (vendor_id) REFERENCES vendors(id) ON DELETE CASCADE;
      END IF;
    END $$;
  `).catch((err) => {
    console.warn("bundle_offers FK migration skipped:", err.message);
  });

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_bundle_offers_product
    ON bundle_offers(product_id, is_active);
  `).catch(() => {});

  // ── Product media (images/videos) ─────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_media (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID REFERENCES products(id) ON DELETE CASCADE,
      variant_id UUID REFERENCES product_variants(id) ON DELETE CASCADE,
      url TEXT NOT NULL,
      media_type VARCHAR(20) DEFAULT 'image',
      is_primary BOOLEAN DEFAULT false,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT now()
    );
  `).catch((err) => {
    console.warn("product_media table create skipped:", err.message);
  });

  // Ensure product_media has all expected columns (for legacy tables)
  await pool.query(`
    ALTER TABLE product_media ADD COLUMN IF NOT EXISTS product_id UUID;
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE product_media ADD COLUMN IF NOT EXISTS variant_id UUID;
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE product_media ADD COLUMN IF NOT EXISTS url TEXT;
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE product_media ADD COLUMN IF NOT EXISTS media_type VARCHAR(20) DEFAULT 'image';
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE product_media ADD COLUMN IF NOT EXISTS is_primary BOOLEAN DEFAULT false;
  `).catch(() => {});
  await pool.query(`
    ALTER TABLE product_media ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_product_media_product
    ON product_media(product_id);
  `).catch(() => {});
  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_product_media_variant
    ON product_media(variant_id);
  `).catch(() => {});

  // ── Product reviews ───────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS product_reviews (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      product_id UUID NOT NULL REFERENCES products(id) ON DELETE CASCADE,
      user_id UUID,
      reviewer_name VARCHAR(255),
      rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
      review_text TEXT NOT NULL,
      image_url TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    );
  `).catch((err) => {
    console.warn("product_reviews table create skipped:", err.message);
  });

  // Backfill columns for legacy tables that may already exist.
  await pool.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS user_id UUID`).catch(() => {});
  await pool.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS reviewer_name VARCHAR(255)`).catch(() => {});
  await pool.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS image_url TEXT`).catch(() => {});
  await pool.query(`ALTER TABLE product_reviews ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now()`).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_product_reviews_product
    ON product_reviews(product_id, created_at DESC);
  `).catch(() => {});
};
