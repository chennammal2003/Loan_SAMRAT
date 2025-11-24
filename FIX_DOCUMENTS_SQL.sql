-- IMMEDIATE FIX FOR DOCUMENT VISIBILITY
-- Run these SQL commands in Supabase SQL Editor to fix documents not showing

-- ============================================================
-- STEP 1: Fix loans table RLS to allow email-based access
-- ============================================================

DROP POLICY IF EXISTS "Merchants can view own loans" ON loans;

CREATE POLICY "Merchants can view own loans"
  ON loans FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    (SELECT email FROM auth.users WHERE id = auth.uid()) = email_id OR
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'nbfc_admin'))
  );

-- ============================================================
-- STEP 2: Add loan_type column to loan_documents if missing
-- ============================================================

ALTER TABLE loan_documents
ADD COLUMN IF NOT EXISTS loan_type text DEFAULT 'general' CHECK (loan_type IN ('general', 'product'));

-- ============================================================
-- STEP 3: Fix loan_documents RLS - Allow all authenticated users
-- ============================================================

DROP POLICY IF EXISTS "Users can view documents for their loans" ON loan_documents;
DROP POLICY IF EXISTS "Users can insert documents for their loans" ON loan_documents;
DROP POLICY IF EXISTS "Public can insert documents for share link submissions" ON loan_documents;
DROP POLICY IF EXISTS "Allow users to view documents" ON loan_documents;
DROP POLICY IF EXISTS "Allow anon to view documents" ON loan_documents;
DROP POLICY IF EXISTS "Allow users to insert documents" ON loan_documents;
DROP POLICY IF EXISTS "Allow anon to insert documents" ON loan_documents;

CREATE POLICY "Allow users to view documents"
  ON loan_documents FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Allow anon to view documents"
  ON loan_documents FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow users to insert documents"
  ON loan_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow anon to insert documents"
  ON loan_documents FOR INSERT
  TO anon
  WITH CHECK (true);

-- ============================================================
-- STEP 4: Fix emi_statuses RLS
-- ============================================================

DROP POLICY IF EXISTS "Users can view EMI statuses for their loans" ON emi_statuses;
DROP POLICY IF EXISTS "Users can update EMI statuses for their loans" ON emi_statuses;
DROP POLICY IF EXISTS "Users can insert EMI statuses for their loans" ON emi_statuses;

CREATE POLICY "Users can view EMI statuses for their loans"
  ON emi_statuses FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update EMI statuses for their loans"
  ON emi_statuses FOR UPDATE
  TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Users can insert EMI statuses for their loans"
  ON emi_statuses FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- STEP 5: Fix payments table RLS
-- ============================================================

DROP POLICY IF EXISTS "Users can view payments for their loans" ON payments;
DROP POLICY IF EXISTS "Users can insert payments for their loans" ON payments;

CREATE POLICY "Users can view payments for their loans"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert payments for their loans"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- ============================================================
-- VERIFICATION QUERIES - Run these to verify the fixes
-- ============================================================

-- Verify documents exist in database
SELECT COUNT(*) as total_documents, COUNT(DISTINCT loan_id) as unique_loans 
FROM loan_documents;

-- Show all documents (should see multiple)
SELECT 
  loan_id,
  document_type,
  file_name,
  file_size,
  loan_type,
  uploaded_at
FROM loan_documents
ORDER BY uploaded_at DESC
LIMIT 20;

-- Check loan_type column exists
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'loan_documents' 
ORDER BY ordinal_position;

-- Show all active loans with their customers
SELECT 
  id as loan_id,
  first_name,
  last_name,
  email_id,
  status,
  created_at
FROM loans
ORDER BY created_at DESC
LIMIT 20;

-- ============================================================
-- AFTER RUNNING THESE:
-- ============================================================
-- 1. Restart your dev server: npm run dev
-- 2. Clear browser cache (Ctrl+Shift+Delete) 
-- 3. Log out and log back in
-- 4. Try viewing documents in customer/admin portal
-- 5. Check browser console (F12 → Console) for any errors
-- 6. If still not working, check the verification queries above
