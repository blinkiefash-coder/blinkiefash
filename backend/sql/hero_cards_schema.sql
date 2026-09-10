-- Hero Cards Table
-- Stores dynamic hero card slides for home page
-- Admin can manage from super admin panel
-- Referenced in mobile (Flutter) and web (React) home screens

CREATE TABLE IF NOT EXISTS hero_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  image_url TEXT NOT NULL,
  mobile_image_url TEXT, -- optional narrow-viewport crop; falls back to image_url
  reference_type VARCHAR(50) NOT NULL, -- 'brand', 'category', 'search', 'link'
  reference_value TEXT,  -- Brand name, category name, search query, or URL
  position INT NOT NULL DEFAULT 0, -- Display order
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  UNIQUE(position)
);

-- Applied separately for databases created before this column existed
ALTER TABLE hero_cards ADD COLUMN IF NOT EXISTS mobile_image_url TEXT;

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS hero_cards_active_position_idx ON hero_cards(is_active, position);
CREATE INDEX IF NOT EXISTS hero_cards_reference_type_idx ON hero_cards(reference_type);

-- Add trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_hero_cards_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS hero_cards_update_timestamp ON hero_cards;
CREATE TRIGGER hero_cards_update_timestamp
BEFORE UPDATE ON hero_cards
FOR EACH ROW
EXECUTE FUNCTION update_hero_cards_timestamp();

-- Seed default hero cards (optional)
INSERT INTO hero_cards (title, image_url, reference_type, reference_value, position, is_active)
VALUES
  ('Men & Women', 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099594/file_00000000445081fab93f08877e2a7788_irgiib.png', 'search', 'men women', 0, true),
  ('Puma Collection', 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099594/file_00000000445081fab93f08877e2a7788_irgiib.png', 'brand', 'Puma', 1, true),
  ('Xinso Collection', 'https://res.cloudinary.com/vu2qpoeq/image/upload/v1787574337/file_00000000ba04820ba8d817a1a5912ca2.png', 'brand', 'Xinso', 2, true),
  ('MK Collection', 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099594/file_00000000445081fab93f08877e2a7788_irgiib.png', 'brand', 'MK', 3, true),
  ('Crimsoune', 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099594/file_00000000445081fab93f08877e2a7788_irgiib.png', 'brand', 'Crimsoune', 4, true),
  ('Kids Wear', 'https://res.cloudinary.com/dv6w0wyxk/image/upload/v1786099594/file_00000000445081fab93f08877e2a7788_irgiib.png', 'category', 'Kids', 5, true)
ON CONFLICT (position) DO NOTHING;
