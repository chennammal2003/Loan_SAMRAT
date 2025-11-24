-- Migration: Fix Product Delivery Status Values
-- Purpose: Ensure product_delivery_status has correct CHECK constraint
-- Date: 2025-11-24

-- First, let's verify and update the CHECK constraint for product_delivery_status
-- The current options should be: 'Pending', 'Product Delivered', 'Loan Disbursed'

-- Option 1: If you need to update existing records from 'Delivered' to 'Product Delivered'
UPDATE product_loans 
SET product_delivery_status = 'Product Delivered' 
WHERE product_delivery_status = 'Delivered';

-- Option 2: Verify the CHECK constraint exists and has correct values
-- This is informational - shows current constraint
SELECT constraint_name, constraint_definition 
FROM information_schema.table_constraints 
WHERE table_name = 'product_loans' 
AND constraint_type = 'CHECK';

-- Option 3: If constraint needs to be recreated (if it's missing)
-- You may need to run this in Supabase SQL Editor if the constraint is missing:
-- ALTER TABLE product_loans 
-- DROP CONSTRAINT IF EXISTS product_delivery_status_check;
--
-- ALTER TABLE product_loans
-- ADD CONSTRAINT product_delivery_status_check 
-- CHECK (product_delivery_status IN ('Pending', 'Product Delivered', 'Loan Disbursed'));

-- Verify the column exists and has correct type
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'product_loans'
AND column_name IN ('product_delivered_date', 'product_delivery_status');

COMMIT;
