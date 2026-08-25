-- Migration to fix user_id column type from UUID to TEXT in addresses table
-- This allows Firebase UIDs (text strings) to be stored properly

BEGIN;

-- Alter addresses.user_id to TEXT type
ALTER TABLE addresses 
  ALTER COLUMN user_id TYPE TEXT USING user_id::TEXT;

COMMIT;
