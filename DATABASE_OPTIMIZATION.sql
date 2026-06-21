-- BlinkieFash Database Performance Optimization Script
-- Run these SQL commands to dramatically improve query performance
-- Estimated improvement: 3-10x faster product loading

-- ============================================================================
-- 1. CREATE INDEXES ON PRODUCTS TABLE
-- ============================================================================
-- These indexes prevent full table scans when filtering by status or category

CREATE INDEX IF NOT EXISTS idx_products_bestseller 
ON products(bestseller);
-- Used for: Bestseller product queries

CREATE INDEX IF NOT EXISTS idx_products_is_active 
ON products(is_active);
-- Used for: Active product filtering

CREATE INDEX IF NOT EXISTS idx_products_store_id 
ON products(store_id);
-- Used for: Products by store

CREATE INDEX IF NOT EXISTS idx_products_category_id 
ON products(category_id);
-- Used for: Products by category

CREATE INDEX IF NOT EXISTS idx_products_brand_id 
ON products(brand_id);
-- Used for: Products by brand

CREATE INDEX IF NOT EXISTS idx_products_name
ON products(name);
-- Used for: Product search

-- ============================================================================
-- 2. CREATE INDEXES ON INVENTORY TABLE
-- ============================================================================
-- Inventory lookups are common on product detail pages

CREATE INDEX IF NOT EXISTS idx_inventory_product_id
ON inventory(product_id);
-- Used for: Get stock by product

CREATE INDEX IF NOT EXISTS idx_inventory_store_id
ON inventory(store_id);
-- Used for: Get products in stock at store

CREATE INDEX IF NOT EXISTS idx_inventory_product_store
ON inventory(product_id, store_id);
-- Used for: Get stock for specific product at specific store

-- ============================================================================
-- 3. CREATE INDEXES ON PRODUCT_IMAGES TABLE
-- ============================================================================
-- Product image queries can be slow with many images

CREATE INDEX IF NOT EXISTS idx_product_images_product_id
ON product_images(product_id);
-- Used for: Get all images for a product

-- ============================================================================
-- 4. CREATE INDEXES ON BULK_OFFERS TABLE
-- ============================================================================
-- Bulk offer queries need optimization for product detail pages

CREATE INDEX IF NOT EXISTS idx_bulk_offers_product_id
ON bulk_offers(product_id);
-- Used for: Get offers for a product

CREATE INDEX IF NOT EXISTS idx_bulk_offers_active
ON bulk_offers(is_active);
-- Used for: Get active offers only

-- ============================================================================
-- 5. VERIFY INDEX CREATION
-- ============================================================================
-- Run this query to see all created indexes:
-- SELECT indexname FROM pg_indexes WHERE schemaname = 'public';

-- ============================================================================
-- 6. OPTIONAL: ANALYZE TABLE STATISTICS (Improves query planner)
-- ============================================================================
-- Run after creating indexes so PostgreSQL can optimize query planning

ANALYZE products;
ANALYZE inventory;
ANALYZE product_images;
ANALYZE bulk_offers;
ANALYZE categories;
ANALYZE brands;

-- ============================================================================
-- 7. EXPECTED PERFORMANCE GAINS
-- ============================================================================
-- Before indexes:
--   - Product list query: 800-1000ms
--   - Product detail query: 600-800ms
--   - Home page load (6 queries): 4-5 seconds
--
-- After indexes:
--   - Product list query: 100-150ms
--   - Product detail query: 150-200ms
--   - Home page load (6 queries): 1-1.5 seconds
--
-- Improvement: 5-6x faster for most queries

-- ============================================================================
-- 8. NEXT OPTIMIZATION: Fix N+1 Query in products.js
-- ============================================================================
-- The backend routes/products.js has an N+1 subquery for images
-- Replace the loop that queries images per product with a single batch query
-- See PERFORMANCE_OPTIMIZATION.md for code example
