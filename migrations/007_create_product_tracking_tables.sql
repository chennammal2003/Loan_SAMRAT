-- Migration 007: Create Product Tracking Tables for Real-time Tracking
-- Run this in Supabase SQL Editor to enable Product Loan tracking

-- Step 1: Create product_delivery_audit table
CREATE TABLE IF NOT EXISTS public.product_delivery_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.product_loans(id) ON DELETE CASCADE,
  delivery_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  delivery_status VARCHAR(255) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_delivery_audit_loan_id 
  ON public.product_delivery_audit(loan_id);
CREATE INDEX IF NOT EXISTS idx_product_delivery_audit_created_at 
  ON public.product_delivery_audit(created_at DESC);

-- Enable RLS
ALTER TABLE public.product_delivery_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Merchants can view delivery records for their loans
CREATE POLICY "Merchants can view own delivery records"
  ON public.product_delivery_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_delivery_audit.loan_id
      AND pl.merchant_id = auth.uid()
    )
  );

-- RLS Policy: Merchants can insert delivery records
CREATE POLICY "Merchants can insert delivery records"
  ON public.product_delivery_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_delivery_audit.loan_id
      AND pl.merchant_id = auth.uid()
    )
  );

-- RLS Policy: Merchants can update delivery records
CREATE POLICY "Merchants can update delivery records"
  ON public.product_delivery_audit FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_delivery_audit.loan_id
      AND pl.merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_delivery_audit.loan_id
      AND pl.merchant_id = auth.uid()
    )
  );

-- Step 2: Create product_emi_statuses table
CREATE TABLE IF NOT EXISTS public.product_emi_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.product_loans(id) ON DELETE CASCADE,
  installment_index INTEGER NOT NULL,
  status VARCHAR(255) NOT NULL,
  due_date TIMESTAMP WITH TIME ZONE,
  amount NUMERIC(12, 2),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  CONSTRAINT product_emi_statuses_loan_installment_unique UNIQUE(loan_id, installment_index)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_emi_statuses_loan_id 
  ON public.product_emi_statuses(loan_id);
CREATE INDEX IF NOT EXISTS idx_product_emi_statuses_installment 
  ON public.product_emi_statuses(loan_id, installment_index);

-- Enable RLS
ALTER TABLE public.product_emi_statuses ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Merchants can view EMI status for their loans
CREATE POLICY "Merchants can view own EMI statuses"
  ON public.product_emi_statuses FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_emi_statuses.loan_id
      AND pl.merchant_id = auth.uid()
    )
  );

-- RLS Policy: Merchants can insert EMI records
CREATE POLICY "Merchants can insert EMI statuses"
  ON public.product_emi_statuses FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_emi_statuses.loan_id
      AND pl.merchant_id = auth.uid()
    )
  );

-- RLS Policy: Merchants can update EMI records
CREATE POLICY "Merchants can update EMI statuses"
  ON public.product_emi_statuses FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_emi_statuses.loan_id
      AND pl.merchant_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_emi_statuses.loan_id
      AND pl.merchant_id = auth.uid()
    )
  );

-- Step 3: Create product_emi_payment_audit table
CREATE TABLE IF NOT EXISTS public.product_emi_payment_audit (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES public.product_loans(id) ON DELETE CASCADE,
  installment_index INTEGER NOT NULL,
  old_status VARCHAR(255) NOT NULL,
  new_status VARCHAR(255) NOT NULL,
  amount_paid NUMERIC(12, 2),
  notes TEXT,
  changed_by UUID REFERENCES public.user_profiles(id),
  changed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_product_emi_payment_audit_loan_id 
  ON public.product_emi_payment_audit(loan_id);
CREATE INDEX IF NOT EXISTS idx_product_emi_payment_audit_changed_at 
  ON public.product_emi_payment_audit(changed_at DESC);

-- Enable RLS
ALTER TABLE public.product_emi_payment_audit ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Merchants can view payment audit for their loans
CREATE POLICY "Merchants can view own payment audits"
  ON public.product_emi_payment_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_emi_payment_audit.loan_id
      AND pl.merchant_id = auth.uid()
    )
  );

-- RLS Policy: Merchants can insert payment audit records
CREATE POLICY "Merchants can insert payment audits"
  ON public.product_emi_payment_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.product_loans pl
      WHERE pl.id = product_emi_payment_audit.loan_id
      AND pl.merchant_id = auth.uid()
    )
  );

-- Enable Replication for Real-time
-- Tables must be included in Replication for RealtimeChannels to work
ALTER PUBLICATION supabase_realtime ADD TABLE product_delivery_audit;
ALTER PUBLICATION supabase_realtime ADD TABLE product_emi_statuses;
ALTER PUBLICATION supabase_realtime ADD TABLE product_emi_payment_audit;

-- Verify tables were created
SELECT tablename FROM pg_tables WHERE tablename IN ('product_delivery_audit', 'product_emi_statuses', 'product_emi_payment_audit');
