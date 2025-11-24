-- Migration: Add EMI Tracking Fields (Month and Due Date)
-- Purpose: Store month label and due date for complete EMI payment tracking
-- Date: 2025-11-24

-- Add columns to product_emi_statuses table
ALTER TABLE IF EXISTS public.product_emi_statuses
ADD COLUMN IF NOT EXISTS month_label text,
ADD COLUMN IF NOT EXISTS due_date text;

-- Add columns to emi_statuses table (legacy)
ALTER TABLE IF EXISTS public.emi_statuses
ADD COLUMN IF NOT EXISTS month_label text,
ADD COLUMN IF NOT EXISTS due_date text;

-- Add columns to product_emi_payment_audit table
ALTER TABLE IF EXISTS public.product_emi_payment_audit
ADD COLUMN IF NOT EXISTS month_label text,
ADD COLUMN IF NOT EXISTS due_date text;

-- Add columns to emi_payment_audit table (legacy)
ALTER TABLE IF EXISTS public.emi_payment_audit
ADD COLUMN IF NOT EXISTS month_label text,
ADD COLUMN IF NOT EXISTS due_date text;

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_product_emi_statuses_loan_month 
ON public.product_emi_statuses(product_loan_id, month_label);

CREATE INDEX IF NOT EXISTS idx_emi_statuses_loan_month 
ON public.emi_statuses(loan_id, month_label);

-- Add constraints to ensure data consistency
-- Note: These are informational columns and can be nullable initially
-- They will be populated going forward

-- Verify the schema changes
-- Run this to check if columns were added successfully:
-- SELECT column_name FROM information_schema.columns 
-- WHERE table_name IN ('product_emi_statuses', 'emi_statuses', 'product_emi_payment_audit', 'emi_payment_audit')
-- AND column_name IN ('month_label', 'due_date')
-- ORDER BY table_name, column_name;

COMMIT;
