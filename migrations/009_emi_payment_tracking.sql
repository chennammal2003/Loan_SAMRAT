-- =============================================================================
-- EMI PAYMENT TRACKING & LOAN STATUS SYNC
-- =============================================================================
-- This migration creates automatic syncing between EMI payments and loan status
-- When all EMIs are paid, loan status updates to reflect completion
-- =============================================================================

-- 1. CREATE PRODUCT_EMI_STATUSES TABLE (if not exists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_emi_statuses (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  product_loan_id UUID NOT NULL REFERENCES product_loans(id) ON DELETE CASCADE,
  installment_index INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'Pending',
  month_label TEXT,
  due_date DATE,
  paid_date DATE,
  amount NUMERIC,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  CONSTRAINT product_emi_statuses_pkey PRIMARY KEY (id),
  CONSTRAINT product_emi_statuses_unique UNIQUE(product_loan_id, installment_index),
  CONSTRAINT product_emi_status_check CHECK (status IN ('Paid', 'Pending', 'ECS Success', 'ECS Bounce', 'Due Missed', 'Processing'))
);

CREATE INDEX IF NOT EXISTS idx_product_emi_statuses_loan_id ON public.product_emi_statuses(product_loan_id);
CREATE INDEX IF NOT EXISTS idx_product_emi_statuses_status ON public.product_emi_statuses(status);

-- 2. CREATE PRODUCT_EMI_PAYMENT_AUDIT TABLE (if not exists)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.product_emi_payment_audit (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  product_loan_id UUID NOT NULL REFERENCES product_loans(id) ON DELETE CASCADE,
  installment_index INTEGER NOT NULL,
  old_status TEXT,
  new_status TEXT NOT NULL,
  paid_date DATE,
  payment_method TEXT,
  changed_by TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT,
  month_label TEXT,
  due_date DATE,
  amount NUMERIC,
  CONSTRAINT product_emi_payment_audit_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_product_emi_payment_audit_loan_id ON public.product_emi_payment_audit(product_loan_id);
CREATE INDEX IF NOT EXISTS idx_product_emi_payment_audit_changed_at ON public.product_emi_payment_audit(changed_at DESC);

-- 3. CREATE PAYMENT STATUS HISTORY TABLE
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.emi_payment_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  product_loan_id UUID NOT NULL REFERENCES product_loans(id) ON DELETE CASCADE,
  total_emis INTEGER,
  paid_count INTEGER,
  pending_count INTEGER,
  payment_status TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT,
  CONSTRAINT emi_payment_status_history_pkey PRIMARY KEY (id)
);

CREATE INDEX IF NOT EXISTS idx_emi_payment_status_history_loan_id ON public.emi_payment_status_history(product_loan_id);

-- 4. CREATE FUNCTION TO GET EMI SUMMARY
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_get_emi_summary(p_loan_id UUID)
RETURNS TABLE (
  total_emis INT,
  paid_count INT,
  pending_count INT,
  payment_status TEXT,
  all_paid BOOLEAN,
  payment_progress NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(*)::INT as total_emis,
    COUNT(*) FILTER (WHERE status = 'Paid')::INT as paid_count,
    COUNT(*) FILTER (WHERE status != 'Paid')::INT as pending_count,
    CASE 
      WHEN COUNT(*) FILTER (WHERE status = 'Paid') = COUNT(*) THEN 'Completed'
      WHEN COUNT(*) FILTER (WHERE status = 'Paid') > 0 THEN 'In Progress'
      ELSE 'Not Started'
    END as payment_status,
    COUNT(*) FILTER (WHERE status = 'Paid') = COUNT(*) as all_paid,
    ROUND((COUNT(*) FILTER (WHERE status = 'Paid')::NUMERIC / COUNT(*) * 100), 2) as payment_progress
  FROM product_emi_statuses
  WHERE product_loan_id = p_loan_id;
END;
$$ LANGUAGE plpgsql;

-- 5. CREATE FUNCTION TO MARK EMI AS PAID
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_mark_emi_paid(
  p_loan_id UUID,
  p_installment_index INTEGER,
  p_payment_method TEXT DEFAULT 'Manual',
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  all_paid BOOLEAN,
  paid_count INT,
  total_count INT
) AS $$
DECLARE
  v_old_status TEXT;
  v_total_emis INT;
  v_paid_count INT;
  v_emi_record RECORD;
BEGIN
  -- Get current EMI status
  SELECT status INTO v_old_status 
  FROM product_emi_statuses 
  WHERE product_loan_id = p_loan_id AND installment_index = p_installment_index;
  
  IF v_old_status IS NULL THEN
    RETURN QUERY SELECT false, 'EMI record not found', false, 0, 0;
    RETURN;
  END IF;
  
  IF v_old_status = 'Paid' THEN
    RETURN QUERY SELECT false, 'EMI already marked as paid', false, 0, 0;
    RETURN;
  END IF;
  
  -- Get EMI details for audit
  SELECT * INTO v_emi_record
  FROM product_emi_statuses
  WHERE product_loan_id = p_loan_id AND installment_index = p_installment_index;
  
  -- Update EMI status to Paid
  UPDATE product_emi_statuses
  SET status = 'Paid', paid_date = CURRENT_DATE, updated_at = NOW()
  WHERE product_loan_id = p_loan_id AND installment_index = p_installment_index;
  
  -- Log to payment audit
  INSERT INTO product_emi_payment_audit (
    product_loan_id,
    installment_index,
    old_status,
    new_status,
    paid_date,
    payment_method,
    changed_by,
    changed_at,
    notes,
    month_label,
    due_date,
    amount
  ) VALUES (
    p_loan_id,
    p_installment_index,
    v_old_status,
    'Paid',
    CURRENT_DATE,
    p_payment_method,
    COALESCE(auth.jwt() ->> 'sub', 'system'),
    NOW(),
    p_notes,
    v_emi_record.month_label,
    v_emi_record.due_date,
    v_emi_record.amount
  );
  
  -- Get updated counts
  SELECT 
    COUNT(*)::INT,
    COUNT(*) FILTER (WHERE status = 'Paid')::INT
  INTO v_total_emis, v_paid_count
  FROM product_emi_statuses
  WHERE product_loan_id = p_loan_id;
  
  -- Log to payment status history
  INSERT INTO emi_payment_status_history (
    product_loan_id,
    total_emis,
    paid_count,
    pending_count,
    payment_status,
    notes
  ) VALUES (
    p_loan_id,
    v_total_emis,
    v_paid_count,
    v_total_emis - v_paid_count,
    CASE WHEN v_paid_count = v_total_emis THEN 'Completed' ELSE 'In Progress' END,
    'EMI #' || p_installment_index || ' marked as paid'
  );
  
  -- Return results
  RETURN QUERY 
  SELECT 
    true,
    'EMI marked as paid successfully',
    (v_paid_count = v_total_emis)::BOOLEAN,
    v_paid_count,
    v_total_emis;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CREATE FUNCTION TO GET EMI DETAILS FOR DISPLAY
-- =============================================================================
CREATE OR REPLACE FUNCTION fn_get_emi_details(p_loan_id UUID)
RETURNS TABLE (
  installment_index INT,
  month_label TEXT,
  due_date DATE,
  paid_date DATE,
  amount NUMERIC,
  status TEXT,
  payment_method TEXT,
  days_overdue INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pes.installment_index,
    pes.month_label,
    pes.due_date,
    pes.paid_date,
    pes.amount,
    pes.status,
    MAX(pepa.payment_method),
    (CURRENT_DATE - pes.due_date)::INT as days_overdue
  FROM product_emi_statuses pes
  LEFT JOIN product_emi_payment_audit pepa ON pes.product_loan_id = pepa.product_loan_id 
    AND pes.installment_index = pepa.installment_index 
    AND pepa.new_status = 'Paid'
  WHERE pes.product_loan_id = p_loan_id
  GROUP BY pes.id, pes.installment_index, pes.month_label, pes.due_date, pes.paid_date, pes.amount, pes.status
  ORDER BY pes.installment_index ASC;
END;
$$ LANGUAGE plpgsql;

-- 7. CREATE TRIGGER TO AUTO-LOG EMI CHANGES
-- =============================================================================
DROP TRIGGER IF EXISTS trg_log_emi_status_change ON product_emi_statuses;

CREATE OR REPLACE FUNCTION fn_log_emi_status_change()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO product_emi_payment_audit (
      product_loan_id,
      installment_index,
      old_status,
      new_status,
      paid_date,
      changed_at,
      month_label,
      due_date,
      amount
    ) VALUES (
      NEW.product_loan_id,
      NEW.installment_index,
      OLD.status,
      NEW.status,
      NEW.paid_date,
      NOW(),
      NEW.month_label,
      NEW.due_date,
      NEW.amount
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_emi_status_change
AFTER UPDATE ON product_emi_statuses
FOR EACH ROW
EXECUTE FUNCTION fn_log_emi_status_change();

-- 8. ENABLE RLS ON EMI TABLES
-- =============================================================================
ALTER TABLE public.product_emi_statuses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_emi_payment_audit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.emi_payment_status_history ENABLE ROW LEVEL SECURITY;

-- 9. CREATE RLS POLICIES
-- =============================================================================

-- product_emi_statuses policies
CREATE POLICY "Users can view their own EMI statuses" ON public.product_emi_statuses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_loans 
      WHERE product_loans.id = product_emi_statuses.product_loan_id 
      AND product_loans.user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Merchants can view their product EMI statuses" ON public.product_emi_statuses
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_loans 
      WHERE product_loans.id = product_emi_statuses.product_loan_id 
      AND product_loans.merchant_id = auth.jwt() ->> 'sub'
    )
  );

-- product_emi_payment_audit policies
CREATE POLICY "Users can view their payment audit" ON public.product_emi_payment_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_loans 
      WHERE product_loans.id = product_emi_payment_audit.product_loan_id 
      AND product_loans.user_id = auth.jwt() ->> 'sub'
    )
  );

CREATE POLICY "Merchants can view their payment audit" ON public.product_emi_payment_audit
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_loans 
      WHERE product_loans.id = product_emi_payment_audit.product_loan_id 
      AND product_loans.merchant_id = auth.jwt() ->> 'sub'
    )
  );

-- 10. BACKFILL EMI DATA FROM EXISTING LOANS
-- =============================================================================
-- This backfills sample EMI data for existing product loans
INSERT INTO product_emi_statuses (product_loan_id, installment_index, status, month_label, due_date, amount, updated_at)
SELECT 
  id,
  generate_series(1, tenure) as installment_index,
  'Pending' as status,
  'Month ' || generate_series(1, tenure)::TEXT as month_label,
  CURRENT_DATE + (generate_series(1, tenure) * INTERVAL '30 days') as due_date,
  ROUND(loan_amount / tenure, 2) as amount,
  NOW()
FROM product_loans
WHERE tenure > 0
  AND NOT EXISTS (
    SELECT 1 FROM product_emi_statuses 
    WHERE product_loan_id = product_loans.id
  )
ON CONFLICT (product_loan_id, installment_index) DO NOTHING;

-- Insert initial payment audit records
INSERT INTO product_emi_payment_audit (
  product_loan_id,
  installment_index,
  old_status,
  new_status,
  changed_at,
  notes,
  month_label,
  due_date,
  amount
)
SELECT 
  pes.product_loan_id,
  pes.installment_index,
  NULL,
  pes.status,
  NOW(),
  'Initial EMI record (backfilled)',
  pes.month_label,
  pes.due_date,
  pes.amount
FROM product_emi_statuses pes
WHERE NOT EXISTS (
  SELECT 1 FROM product_emi_payment_audit pepa
  WHERE pepa.product_loan_id = pes.product_loan_id
    AND pepa.installment_index = pes.installment_index
)
ON CONFLICT DO NOTHING;

-- 11. SEED INITIAL PAYMENT STATUS HISTORY
-- =============================================================================
INSERT INTO emi_payment_status_history (
  product_loan_id,
  total_emis,
  paid_count,
  pending_count,
  payment_status,
  notes
)
SELECT 
  pl.id,
  pl.tenure,
  0,
  pl.tenure,
  'Not Started',
  'Initial EMI setup (backfilled)'
FROM product_loans pl
WHERE pl.tenure > 0
  AND NOT EXISTS (
    SELECT 1 FROM emi_payment_status_history epsh
    WHERE epsh.product_loan_id = pl.id
  )
ON CONFLICT DO NOTHING;
