-- idempotent seed for Unisex category and subcategories (3-level)
-- Usage: psql $DATABASE_URL -f backend/sql/seed_unisex_categories.sql

DO $$
DECLARE
  unisex_id UUID;
  sport_id UUID;
  casual_id UUID;
  socks_id UUID;
BEGIN
  -- Create Unisex root category if missing
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Unisex' AND parent_id IS NULL) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Unisex', NULL, 'unisex', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  SELECT id INTO unisex_id FROM categories WHERE name = 'Unisex' AND parent_id IS NULL LIMIT 1;

  -- Sport Shoes subcategory
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Sport Shoes' AND parent_id = unisex_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Sport Shoes', unisex_id, 'sport-shoes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
  SELECT id INTO sport_id FROM categories WHERE name = 'Sport Shoes' AND parent_id = unisex_id LIMIT 1;

  -- Casual Shoes subcategory
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Casual Shoes' AND parent_id = unisex_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Casual Shoes', unisex_id, 'casual-shoes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
  SELECT id INTO casual_id FROM categories WHERE name = 'Casual Shoes' AND parent_id = unisex_id LIMIT 1;

  -- Socks subcategory
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Socks' AND parent_id = unisex_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Socks', unisex_id, 'socks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
  SELECT id INTO socks_id FROM categories WHERE name = 'Socks' AND parent_id = unisex_id LIMIT 1;

  -- Sub-subcategories for Sport Shoes
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Running Shoes' AND parent_id = sport_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Running Shoes', sport_id, 'running-shoes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Training Shoes' AND parent_id = sport_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Training Shoes', sport_id, 'training-shoes', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  -- Sub-subcategories for Casual Shoes
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Sneakers' AND parent_id = casual_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Sneakers', casual_id, 'sneakers', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Loafers' AND parent_id = casual_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Loafers', casual_id, 'loafers', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;

  -- Sub-subcategories for Socks
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Ankle Socks' AND parent_id = socks_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Ankle Socks', socks_id, 'ankle-socks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM categories WHERE name = 'Crew Socks' AND parent_id = socks_id) THEN
    INSERT INTO categories (id, name, parent_id, category_url, is_active, created_at, updated_at)
    VALUES (gen_random_uuid(), 'Crew Socks', socks_id, 'crew-socks', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
  END IF;
END $$;
