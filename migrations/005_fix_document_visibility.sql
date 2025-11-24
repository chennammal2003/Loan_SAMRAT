-- Migration: Fix Document Visibility Issues
-- This migration allows customers, admins, and nbfc_admins to view documents properly

-- 1. Update loan_documents RLS policy to include email-based matching
DROP POLICY IF EXISTS "Users can view documents for their loans" ON loan_documents;

CREATE POLICY "Users can view documents for their loans"
  ON loan_documents FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loans
      LEFT JOIN user_profiles up ON auth.uid() = up.id
      WHERE loans.id = loan_documents.loan_id
      AND (
        -- Loan owner (for merchant-created loans)
        loans.user_id = auth.uid()
        -- Customer who submitted (by email match for public applications)
        OR loans.email_id = (SELECT email FROM auth.users WHERE id = auth.uid())
        -- Admin or nbfc_admin role
        OR up.role IN ('admin', 'nbfc_admin')
      )
    )
  );

-- 2. Update insert policy to allow customers by email
DROP POLICY IF EXISTS "Users can insert documents for their loans" ON loan_documents;

CREATE POLICY "Users can insert documents for their loans"
  ON loan_documents FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = loan_documents.loan_id
      AND (
        -- Loan owner can insert
        loans.user_id = auth.uid()
        -- Customer who submitted can insert
        OR loans.email_id = (SELECT email FROM auth.users WHERE id = auth.uid())
      )
    )
  );

-- 3. Allow anonymous users to insert documents (for public share link applications)
CREATE POLICY "Public can insert documents for share link submissions"
  ON loan_documents FOR INSERT
  TO anon
  WITH CHECK (true);

-- 4. Grant access to storage buckets for document viewing
-- This is typically done through Supabase dashboard, but we'll document it here:
-- 
-- For loan_documents bucket:
-- - SELECT: Allow authenticated users and anon to download documents
-- - INSERT: Allow authenticated and anon to upload documents
--
-- Storage policies should be configured as:
--
-- For authenticated users (SELECT):
-- bucket_id = 'loan_documents' 
-- (role = 'authenticated' OR role = 'anon')
--
-- For authenticated users (INSERT):
-- bucket_id = 'loan_documents'
-- (role = 'authenticated' OR role = 'anon')
--
-- For authenticated users (DELETE):
-- bucket_id = 'loan_documents'
-- role = 'authenticated' AND (auth.uid() = owner OR auth.jwt()->>'role' = 'admin')

-- Note: Storage bucket policies must be set in Supabase dashboard:
-- 1. Go to Storage → loan_documents bucket
-- 2. Click "Policies" tab
-- 3. Create policies for SELECT, INSERT, DELETE as needed
-- 4. Allow users by email and role matching
