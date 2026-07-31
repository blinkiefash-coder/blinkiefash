import pkg from "pg";
const { Pool } = pkg;

const normalizeDatabaseUrl = (rawUrl = "") => {
  if (!rawUrl) return rawUrl;
  return rawUrl.replace(/sslmode=(prefer|require|verify-ca)/gi, "sslmode=disable");
};

const connectionString = normalizeDatabaseUrl(process.env.DATABASE_URL || "");

const useSsl = String(process.env.DB_USE_SSL || "false").toLowerCase() === "true";

export const pool = new Pool({
  connectionString,
  ...(useSsl
    ? {
        ssl: {
          rejectUnauthorized: false,
        },
      }
    : {
        ssl: false,
      }),
});

export const ensureDatabaseTables = async () => {
  try {
  // Data-driven mirrored category navigation (e.g., Men <-> Footwear)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS category_mirror_links (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      source_root_id UUID REFERENCES categories(id) ON DELETE CASCADE,
      target_root_id UUID REFERENCES categories(id) ON DELETE CASCADE,
      mirror_mode VARCHAR(32) NOT NULL DEFAULT 'shoe_like',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(source_root_id, target_root_id, mirror_mode)
    );
  `).catch(() => {});

  await pool.query(`
    DO $$
    DECLARE
      men_id UUID;
      footwear_id UUID;
    BEGIN
      SELECT id INTO men_id
      FROM categories
      WHERE parent_id IS NULL
        AND lower(name) IN ('men', 'mens', 'men''s')
      ORDER BY name
      LIMIT 1;

      SELECT id INTO footwear_id
      FROM categories
      WHERE parent_id IS NULL
        AND (
          lower(name) LIKE '%footwear%'
          OR lower(name) IN ('shoe', 'shoes')
        )
      ORDER BY name
      LIMIT 1;

      IF men_id IS NOT NULL AND footwear_id IS NOT NULL THEN
        INSERT INTO category_mirror_links (
          source_root_id,
          target_root_id,
          mirror_mode,
          is_active
        ) VALUES (men_id, footwear_id, 'shoe_like', true)
        ON CONFLICT (source_root_id, target_root_id, mirror_mode) DO NOTHING;

        INSERT INTO category_mirror_links (
          source_root_id,
          target_root_id,
          mirror_mode,
          is_active
        ) VALUES (footwear_id, men_id, 'shoe_like', true)
        ON CONFLICT (source_root_id, target_root_id, mirror_mode) DO NOTHING;
      END IF;
    END $$;
  `).catch(() => {});

  // Add google_uid to users if not already present (safe ALTER IF NOT EXISTS)
  await pool.query(`ALTER TABLE users ADD COLUMN IF NOT EXISTS google_uid VARCHAR(255)`).catch(() => {});
  await pool.query(`CREATE UNIQUE INDEX IF NOT EXISTS users_google_uid_idx ON users(google_uid) WHERE google_uid IS NOT NULL`).catch(() => {});

  // Ensure orders has confirmed_at column (used for 60-min delivery SLA timer)
  await pool.query(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ`).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS vendors (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID REFERENCES users(id) ON DELETE SET NULL,
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
      slug VARCHAR(255) UNIQUE,
      description TEXT,
      logo_url TEXT,
      vendor_img_url TEXT,
      address TEXT,
      city VARCHAR(100),
      state VARCHAR(100),
      pincode VARCHAR(10),
      lat DECIMAL(10, 8),
      lng DECIMAL(11, 8),
      service_radius_km DECIMAL(10, 2) DEFAULT 25,
      dark_store_id UUID,
      account_holder_name VARCHAR(255),
      account_number VARCHAR(50),
      ifsc_code VARCHAR(20),
      bank_name VARCHAR(255),
      pan_doc_url TEXT,
      gst_doc_url TEXT,
      bank_proof_url TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      is_verified BOOLEAN DEFAULT false,
      is_active BOOLEAN DEFAULT true,
      is_approved BOOLEAN DEFAULT false,
      is_operational BOOLEAN DEFAULT true,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await pool.query(`
    ALTER TABLE vendors
      ADD COLUMN IF NOT EXISTS business_name VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS owner_name VARCHAR(255) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS email VARCHAR(255) UNIQUE,
      ADD COLUMN IF NOT EXISTS phone VARCHAR(20) NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS business_type VARCHAR(50),
      ADD COLUMN IF NOT EXISTS category TEXT,
      ADD COLUMN IF NOT EXISTS gst_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS pan_number VARCHAR(20),
      ADD COLUMN IF NOT EXISTS years_in_business INT,
      ADD COLUMN IF NOT EXISTS store_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS description TEXT,
      ADD COLUMN IF NOT EXISTS logo_url TEXT,
      ADD COLUMN IF NOT EXISTS address TEXT,
      ADD COLUMN IF NOT EXISTS city VARCHAR(100),
      ADD COLUMN IF NOT EXISTS state VARCHAR(100),
      ADD COLUMN IF NOT EXISTS pincode VARCHAR(10),
      ADD COLUMN IF NOT EXISTS account_holder_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS account_number VARCHAR(50),
      ADD COLUMN IF NOT EXISTS ifsc_code VARCHAR(20),
      ADD COLUMN IF NOT EXISTS bank_name VARCHAR(255),
      ADD COLUMN IF NOT EXISTS pan_doc_url TEXT,
      ADD COLUMN IF NOT EXISTS gst_doc_url TEXT,
      ADD COLUMN IF NOT EXISTS bank_proof_url TEXT,
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
      ADD COLUMN IF NOT EXISTS vendor_img_url TEXT,
      ADD COLUMN IF NOT EXISTS lat DECIMAL(10, 8),
      ADD COLUMN IF NOT EXISTS lng DECIMAL(11, 8),
      ADD COLUMN IF NOT EXISTS service_radius_km DECIMAL(10, 2) DEFAULT 25,
      ADD COLUMN IF NOT EXISTS dark_store_id UUID,
      ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
      ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT false,
      ADD COLUMN IF NOT EXISTS is_operational BOOLEAN DEFAULT true;
  `).catch(() => {});

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'dark_stores'
      ) THEN
        IF NOT EXISTS (
          SELECT 1
          FROM information_schema.table_constraints
          WHERE table_schema = 'public'
            AND table_name = 'vendors'
            AND constraint_name = 'vendors_dark_store_id_fkey'
        ) THEN
          ALTER TABLE vendors
            ADD CONSTRAINT vendors_dark_store_id_fkey
            FOREIGN KEY (dark_store_id) REFERENCES dark_stores(id)
            ON DELETE SET NULL;
        END IF;
      END IF;
    END $$;
  `).catch(() => {});

  await pool.query(`
    CREATE UNIQUE INDEX IF NOT EXISTS vendors_slug_idx
    ON vendors(slug)
    WHERE slug IS NOT NULL;
  `).catch(() => {});

  await pool.query(`
    DO $$
    BEGIN
      IF EXISTS (
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'sellers'
      ) THEN
        INSERT INTO vendors (
          id,
          user_id,
          business_name,
          owner_name,
          email,
          phone,
          password_hash,
          business_type,
          category,
          gst_number,
          pan_number,
          years_in_business,
          store_name,
          slug,
          description,
          logo_url,
          vendor_img_url,
          address,
          city,
          state,
          pincode,
          lat,
          lng,
          service_radius_km,
          account_holder_name,
          account_number,
          ifsc_code,
          bank_name,
          pan_doc_url,
          gst_doc_url,
          bank_proof_url,
          status,
          is_verified,
          is_active,
          is_approved,
          is_operational,
          created_at,
          updated_at
        )
        SELECT
          id,
          user_id,
          business_name,
          owner_name,
          email,
          phone,
          password_hash,
          business_type,
          category,
          gst_number,
          pan_number,
          years_in_business,
          store_name,
          slug,
          description,
          logo_url,
          COALESCE(vendor_img_url, logo_url),
          address,
          city,
          state,
          pincode,
          lat,
          lng,
          COALESCE(service_radius_km, 25),
          account_holder_name,
          account_number,
          ifsc_code,
          bank_name,
          pan_doc_url,
          gst_doc_url,
          bank_proof_url,
          COALESCE(status, 'pending'),
          COALESCE(is_verified, false),
          COALESCE(is_active, true),
          COALESCE(is_approved, false),
          COALESCE(is_operational, true),
          created_at,
          updated_at
        FROM sellers
        ON CONFLICT (id) DO NOTHING;

        DROP TABLE sellers;
      END IF;
    END $$;
  `).catch((err) => {
    console.warn("vendors migration skipped:", err.message);
  });

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

  await pool.query(`
    UPDATE user_rewards
    SET type = 'referral_50', value = 50
    WHERE type LIKE 'referral_%' AND type <> 'referral_50';
  `);

  // ── Delivery config table ─────────────────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_config (
      key   VARCHAR(60) PRIMARY KEY,
      value TEXT NOT NULL
    )
  `).catch(() => {});
  // Seed defaults — ON CONFLICT DO NOTHING so manual changes are preserved
  await pool.query(`
    INSERT INTO delivery_config (key, value) VALUES
      ('is_free_delivery', 'true'),
      ('base_fee',         '49'),
      ('free_threshold',   '999')
    ON CONFLICT (key) DO NOTHING
  `).catch(() => {});

  // ── Order discount columns ──────────────────────────────────────────────
  await pool.query(`
    ALTER TABLE orders
      ADD COLUMN IF NOT EXISTS referral_discount DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS clothing_discount DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS bundle_discount DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS first_order_discount DECIMAL(12, 2) DEFAULT 0,
      ADD COLUMN IF NOT EXISTS cancel_reason VARCHAR(500)
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

  // ── Variant barcode support ───────────────────────────────────────────────
  await pool.query(`
    ALTER TABLE product_variants
      ADD COLUMN IF NOT EXISTS barcode VARCHAR(120)
  `).catch(() => {});

  await pool.query(`
    CREATE INDEX IF NOT EXISTS idx_product_variants_barcode
    ON product_variants(barcode)
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

  // ── Partner Applications ───────────────────────────────────────
  await pool.query(`
    CREATE TABLE IF NOT EXISTS store_partner_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      store_name VARCHAR(255) NOT NULL,
      owner_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      city VARCHAR(100),
      address TEXT,
      pincode VARCHAR(10),
      store_category VARCHAR(100),
      store_size VARCHAR(50),
      years_in_business INT DEFAULT 0,
      gst_number VARCHAR(50),
      message TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => {});

  await pool.query(`
    CREATE TABLE IF NOT EXISTS delivery_partner_applications (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      full_name VARCHAR(255) NOT NULL,
      email VARCHAR(255) NOT NULL,
      phone VARCHAR(20) NOT NULL,
      city VARCHAR(100),
      pincode VARCHAR(10),
      vehicle_type VARCHAR(50),
      driving_license VARCHAR(50),
      availability VARCHAR(50),
      experience_years INT DEFAULT 0,
      message TEXT,
      status VARCHAR(20) DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `).catch(() => {});
  } catch (error) {
    console.warn("[db] Database initialization skipped; continuing without DB-backed features.", error.message);
  }
};
