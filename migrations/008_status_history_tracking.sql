-- ==============================================================================
-- PRODUCT LOAN STATUS TRACKING SYSTEM
-- ==============================================================================
-- This migration creates a comprehensive tracking system for product_loans status
-- Tracks all status transitions: Pending → Accepted → Verified → Loan Disbursed → Product Delivered
-- Also tracks Rejected status and provides complete audit trail
-- ==============================================================================

-- 1. CREATE STATUS HISTORY TABLE (Main audit log)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid(),
  loan_id UUID NOT NULL REFERENCES product_loans(id) ON DELETE CASCADE,
  old_status TEXT,
  new_status TEXT NOT NULL,
  changed_by TEXT,
  changed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  notes TEXT,
  ip_address INET,
  user_agent TEXT,
  CONSTRAINT status_history_pkey PRIMARY KEY (id),
  CONSTRAINT status_history_valid_new_status CHECK (new_status IN ('Pending', 'Accepted', 'Rejected', 'Verified', 'Loan Disbursed', 'Product Delivered'))
);

-- 2. CREATE INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_status_history_loan_id ON public.status_history(loan_id);
CREATE INDEX IF NOT EXISTS idx_status_history_changed_at ON public.status_history(changed_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_history_new_status ON public.status_history(new_status);
CREATE INDEX IF NOT EXISTS idx_status_history_loan_id_changed_at ON public.status_history(loan_id, changed_at DESC);

-- 3. ENABLE ROW LEVEL SECURITY
-- ==============================================================================
ALTER TABLE public.status_history ENABLE ROW LEVEL SECURITY;

-- 4. DROP EXISTING POLICIES (if any)
-- ==============================================================================
DROP POLICY IF EXISTS "Users can view their loan status history" ON public.status_history;
DROP POLICY IF EXISTS "Merchants can view their product status history" ON public.status_history;
DROP POLICY IF EXISTS "Admins can manage status history" ON public.status_history;
DROP POLICY IF EXISTS "Service role can insert status history" ON public.status_history;

-- 5. CREATE RLS POLICIES
-- ==============================================================================

-- Policy: Users can view status history for their own loans
CREATE POLICY "Users can view their loan status history" ON public.status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_loans 
      WHERE product_loans.id = status_history.loan_id 
      AND product_loans.user_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Merchants can view status history for their loans
CREATE POLICY "Merchants can view their product status history" ON public.status_history
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM product_loans 
      WHERE product_loans.id = status_history.loan_id 
      AND product_loans.merchant_id = auth.jwt() ->> 'sub'
    )
  );

-- Policy: Admin users can view all status history
CREATE POLICY "Admins can view all status history" ON public.status_history
  FOR SELECT
  USING (
    auth.jwt() ->> 'role' = 'admin' OR 
    auth.jwt() ->> 'role' = 'super_admin'
  );

-- Policy: Service role can insert/update (for internal functions)
CREATE POLICY "Service role can manage status history" ON public.status_history
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- 6. CREATE TRIGGER FUNCTION FOR AUTOMATIC STATUS TRACKING
-- ==============================================================================
DROP FUNCTION IF EXISTS fn_log_status_change() CASCADE;

CREATE OR REPLACE FUNCTION fn_log_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_user_id TEXT;
  v_status_changed BOOLEAN;
BEGIN
  -- Detect if status changed
  v_status_changed := (NEW.status IS DISTINCT FROM OLD.status);
  
  -- Only log if status actually changed
  IF v_status_changed THEN
    -- Get current user from auth context (could be NULL for service role)
    v_user_id := COALESCE(
      auth.jwt() ->> 'sub',
      'system'
    );
    
    -- Log the status change
    INSERT INTO status_history (
      loan_id,
      old_status,
      new_status,
      changed_by,
      changed_at,
      notes
    ) VALUES (
      NEW.id,
      OLD.status,
      NEW.status,
      v_user_id,
      NOW(),
      'Status transition via ' || COALESCE(current_setting('app.source', true), 'api')
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. DROP AND RECREATE TRIGGER
-- ==============================================================================
DROP TRIGGER IF EXISTS trg_log_product_status_change ON product_loans;

CREATE TRIGGER trg_log_product_status_change
AFTER UPDATE ON product_loans
FOR EACH ROW
EXECUTE FUNCTION fn_log_status_change();

-- 8. CREATE HELPER FUNCTION: Get Current Status Details
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_get_loan_status_details(p_loan_id UUID)
RETURNS TABLE (
  current_status TEXT,
  status_since TIMESTAMP WITH TIME ZONE,
  previous_status TEXT,
  previous_status_date TIMESTAMP WITH TIME ZONE,
  days_in_current_status BIGINT,
  total_transitions INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT NEW.status FROM product_loans WHERE id = p_loan_id),
    (SELECT MAX(sh.changed_at) FROM status_history sh WHERE sh.loan_id = p_loan_id AND sh.new_status = (SELECT NEW.status FROM product_loans WHERE id = p_loan_id)),
    (SELECT sh.new_status FROM status_history sh WHERE sh.loan_id = p_loan_id ORDER BY sh.changed_at DESC LIMIT 1 OFFSET 1),
    (SELECT sh.changed_at FROM status_history sh WHERE sh.loan_id = p_loan_id ORDER BY sh.changed_at DESC LIMIT 1 OFFSET 1),
    EXTRACT(DAY FROM NOW() - (SELECT MAX(sh.changed_at) FROM status_history sh WHERE sh.loan_id = p_loan_id AND sh.new_status = (SELECT NEW.status FROM product_loans WHERE id = p_loan_id)))::BIGINT,
    (SELECT COUNT(*) FROM status_history sh WHERE sh.loan_id = p_loan_id)::INT;
END;
$$ LANGUAGE plpgsql;

-- 9. CREATE HELPER FUNCTION: Get Full Status Timeline
-- ==============================================================================
CREATE OR REPLACE FUNCTION fn_get_status_timeline(p_loan_id UUID)
RETURNS TABLE (
  status TEXT,
  changed_at TIMESTAMP WITH TIME ZONE,
  changed_by TEXT,
  notes TEXT,
  previous_status TEXT,
  duration_seconds INT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sh.new_status,
    sh.changed_at,
    sh.changed_by,
    sh.notes,
    sh.old_status,
    EXTRACT(EPOCH FROM (
      LEAD(sh.changed_at) OVER (ORDER BY sh.changed_at DESC) - sh.changed_at
    ))::INT
  FROM status_history sh
  WHERE sh.loan_id = p_loan_id
  ORDER BY sh.changed_at ASC;
END;
$$ LANGUAGE plpgsql;

-- 10. CREATE HELPER FUNCTION: Update Loan Status (with validation)
-- ==============================================================================
DROP FUNCTION IF EXISTS fn_update_loan_status(UUID, TEXT, TEXT);

CREATE OR REPLACE FUNCTION fn_update_loan_status(
  p_loan_id UUID,
  p_new_status TEXT,
  p_notes TEXT DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  message TEXT,
  old_status TEXT,
  new_status TEXT
) AS $$
DECLARE
  v_old_status TEXT;
  v_loan_exists BOOLEAN;
  v_valid_transition BOOLEAN;
BEGIN
  -- Check if loan exists
  SELECT EXISTS(SELECT 1 FROM product_loans WHERE id = p_loan_id) INTO v_loan_exists;
  
  IF NOT v_loan_exists THEN
    RETURN QUERY SELECT false, 'Loan not found', NULL::TEXT, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Get current status
  SELECT status INTO v_old_status FROM product_loans WHERE id = p_loan_id;
  
  -- Validate status value
  IF p_new_status NOT IN ('Pending', 'Accepted', 'Rejected', 'Verified', 'Loan Disbursed', 'Product Delivered') THEN
    RETURN QUERY SELECT false, 'Invalid status: ' || p_new_status, v_old_status, NULL::TEXT;
    RETURN;
  END IF;
  
  -- Check if status is actually changing
  IF v_old_status = p_new_status THEN
    RETURN QUERY SELECT false, 'Status is already ' || p_new_status, v_old_status, p_new_status;
    RETURN;
  END IF;
  
  -- Update the loan status (trigger will automatically log the change)
  UPDATE product_loans
  SET status = p_new_status, updated_at = NOW()
  WHERE id = p_loan_id;
  
  -- Return success
  RETURN QUERY SELECT true, 'Status updated successfully', v_old_status, p_new_status;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 11. BACKFILL STATUS HISTORY FOR EXISTING LOANS
-- ==============================================================================
INSERT INTO status_history (loan_id, old_status, new_status, changed_by, changed_at, notes)
SELECT 
  pl.id,
  NULL::TEXT,
  pl.status,
  'system',
  pl.created_at,
  'Initial status (backfilled from product_loans)'
FROM product_loans pl
WHERE NOT EXISTS (
  SELECT 1 FROM status_history sh WHERE sh.loan_id = pl.id
)
ON CONFLICT DO NOTHING;
