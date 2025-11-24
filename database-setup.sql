-- Loan Application System Database Setup
-- Run this script in your Supabase SQL Editor

-- Create user_profiles table
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username text UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  role text NOT NULL CHECK (role IN ('merchant', 'admin','customer')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON user_profiles FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = id);

-- Sequence for human-friendly application numbers
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relname = 'loan_application_number_seq') THEN
    CREATE SEQUENCE loan_application_number_seq START WITH 1 INCREMENT BY 1;
  END IF;
END $$;

-- Create loans table
CREATE TABLE IF NOT EXISTS loans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  first_name text NOT NULL,
  last_name text NOT NULL,
  father_mother_spouse_name text NOT NULL,
  date_of_birth date NOT NULL,
  aadhaar_number text NOT NULL,
  pan_number text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('Male', 'Female', 'Other')),
  marital_status text NOT NULL CHECK (marital_status IN ('Single', 'Married', 'Widowed', 'Divorced')),
  occupation text NOT NULL,
  introduced_by text,
  email_id text NOT NULL,
  address text NOT NULL,
  pin_code text NOT NULL,
  landmark text,
  permanent_address text,
  mobile_primary text NOT NULL,
  mobile_alternative text,
  reference1_name text NOT NULL,
  reference1_address text NOT NULL,
  reference1_contact text NOT NULL,
  reference1_relationship text NOT NULL,
  reference2_name text NOT NULL,
  reference2_address text NOT NULL,
  reference2_contact text NOT NULL,
  reference2_relationship text NOT NULL,
  interest_scheme text NOT NULL,
  gold_price_lock_date date NOT NULL,
  down_payment_details text,
  loan_amount numeric NOT NULL,
  tenure integer NOT NULL CHECK (tenure IN (3, 6, 9, 12)),
  processing_fee numeric NOT NULL,
  status text NOT NULL DEFAULT 'Pending' CHECK (status IN ('Pending', 'Accepted', 'Rejected', 'Verified', 'Loan Disbursed')),
  declaration_accepted boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  documents_uploaded boolean DEFAULT false,
  documents_uploaded_at timestamptz,
  verification_status text DEFAULT 'Pending' CHECK (verification_status IN ('Pending', 'Verified')),
  verified_at timestamptz,
  verified_by uuid REFERENCES user_profiles(id),
  disbursement_date date,
  amount_disbursed numeric,
  transaction_reference text,
  disbursement_proof_url text,
  disbursement_remarks text,
  disbursed_at timestamptz,
  share_link_id uuid REFERENCES loan_share_links(id),
  paid_amount numeric NOT NULL DEFAULT 0,
  application_number text UNIQUE DEFAULT ('App' || lpad((nextval('loan_application_number_seq'))::text, 3, '0')),
  UNIQUE (user_id, first_name, last_name)
);

ALTER TABLE loans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Merchants can view own loans"
  ON loans FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id OR
    -- Allow users to view loans by email match (for public submissions)
    (SELECT email FROM auth.users WHERE id = auth.uid()) = email_id OR
    -- Allow admins to view all
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'nbfc_admin'))
  );

CREATE POLICY "Allow public to view loans by email"
  ON loans FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Merchants can insert own loans"
  ON loans FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Allow anon to insert loans"
  ON loans FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Merchants can update own loans"
  ON loans FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can update all loans"
  ON loans FOR UPDATE
  TO authenticated
  USING (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'nbfc_admin')))
  WITH CHECK (EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role IN ('admin', 'nbfc_admin')));

-- Create merchant_profiles table
CREATE TABLE IF NOT EXISTS merchant_profiles (
  merchant_id uuid PRIMARY KEY REFERENCES user_profiles(id) ON DELETE CASCADE,
  business_name text,
  owner_name text,
  email text,
  phone text,
  age integer,
  business_type text,
  business_category text,
  gst_number text,
  pan_number text,
  bank_name text,
  account_number text,
  ifsc_code text,
  upi_id text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  address text
);

ALTER TABLE merchant_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY IF NOT EXISTS "Merchants can manage own merchant profile"
  ON merchant_profiles FOR ALL
  TO authenticated
  USING (auth.uid() = merchant_id)
  WITH CHECK (auth.uid() = merchant_id);

-- Create loan_documents table
CREATE TABLE IF NOT EXISTS loan_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  document_type text NOT NULL,
  file_name text NOT NULL,
  file_path text NOT NULL,
  file_size integer,
  loan_type text DEFAULT 'general' CHECK (loan_type IN ('general', 'product')),
  uploaded_at timestamptz DEFAULT now()
);

ALTER TABLE loan_documents ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to view all documents
CREATE POLICY "Allow users to view documents"
  ON loan_documents FOR SELECT
  TO authenticated
  USING (true);

-- Allow anonymous users to view documents (for downloads before login)
CREATE POLICY "Allow anon to view documents"
  ON loan_documents FOR SELECT
  TO anon
  USING (true);

-- Allow authenticated users to insert documents
CREATE POLICY "Allow users to insert documents"
  ON loan_documents FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Allow anonymous users to insert documents (for share link submissions)
CREATE POLICY "Allow anon to insert documents"
  ON loan_documents FOR INSERT
  TO anon
  WITH CHECK (true);

-- Create emi_statuses table for tracking individual EMI payment statuses
CREATE TABLE IF NOT EXISTS emi_statuses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_index integer NOT NULL CHECK (installment_index >= 0),
  status text NOT NULL CHECK (status IN ('Pending', 'Paid', 'ECS Success', 'ECS Bounce', 'Due Missed')),
  updated_at timestamptz DEFAULT now(),
  UNIQUE (loan_id, installment_index)
);

ALTER TABLE emi_statuses ENABLE ROW LEVEL SECURITY;

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

-- Create emi_status_audit table for tracking EMI status changes
CREATE TABLE IF NOT EXISTS emi_status_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  installment_index integer NOT NULL,
  old_status text,
  new_status text NOT NULL,
  changed_by uuid REFERENCES user_profiles(id),
  changed_at timestamptz DEFAULT now(),
  amount_affected numeric,
  notes text
);

ALTER TABLE emi_status_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view EMI audit for their loans"
  ON emi_status_audit FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = emi_status_audit.loan_id
      AND (loans.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Users can insert EMI audit for their loans"
  ON emi_status_audit FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = emi_status_audit.loan_id
      AND (loans.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- Create loan_disbursements table for tracking disbursement dates
CREATE TABLE IF NOT EXISTS loan_disbursements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  disbursement_date date NOT NULL,
  amount_disbursed numeric NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE loan_disbursements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view disbursements for their loans"
  ON loan_disbursements FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = loan_disbursements.loan_id
      AND (loans.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

CREATE POLICY "Users can insert disbursements for their loans"
  ON loan_disbursements FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM loans
      WHERE loans.id = loan_disbursements.loan_id
      AND (loans.user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin'))
    )
  );

-- Create payments table for recording individual payments
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loan_id uuid NOT NULL REFERENCES loans(id) ON DELETE CASCADE,
  borrower_name text,
  mobile_number text,
  payment_date date NOT NULL,
  payment_amount numeric NOT NULL,
  payment_mode text NOT NULL,
  transaction_id text,
  bank_name text,
  cheque_number text,
  upi_id text,
  remarks text,
  proof_path text,
  proof_url text,
  late_fee numeric DEFAULT 0,
  penalty_amount numeric DEFAULT 0,
  total_paid numeric NOT NULL,
  receipt_number text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view payments for their loans"
  ON payments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can insert payments for their loans"
  ON payments FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_loans_user_id ON loans(user_id);
CREATE INDEX IF NOT EXISTS idx_loans_status ON loans(status);
CREATE INDEX IF NOT EXISTS idx_loan_documents_loan_id ON loan_documents(loan_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);
CREATE INDEX IF NOT EXISTS idx_emi_statuses_loan_id ON emi_statuses(loan_id);
CREATE INDEX IF NOT EXISTS idx_emi_statuses_installment_index ON emi_statuses(installment_index);
CREATE INDEX IF NOT EXISTS idx_emi_status_audit_loan_id ON emi_status_audit(loan_id);
CREATE INDEX IF NOT EXISTS idx_emi_status_audit_changed_at ON emi_status_audit(changed_at);
CREATE INDEX IF NOT EXISTS idx_loans_paid_amount ON loans(paid_amount);
CREATE INDEX IF NOT EXISTS idx_payments_loan_id ON payments(loan_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_date ON payments(payment_date);
CREATE INDEX IF NOT EXISTS idx_loan_disbursements_loan_id ON loan_disbursements(loan_id);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Add triggers for updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_loans_updated_at ON loans;
CREATE TRIGGER update_loans_updated_at
  BEFORE UPDATE ON loans
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create storage bucket for loan documents (Run this separately in Supabase Dashboard > Storage)
-- Bucket name: loan_documents
-- Public: false
-- File size limit: 5MB
-- Allowed MIME types: application/pdf, image/jpeg, image/png

-- Shareable Loan Application Links
CREATE TABLE IF NOT EXISTS loan_share_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  link_id uuid UNIQUE NOT NULL,
  created_by uuid NOT NULL REFERENCES user_profiles(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz,
  is_active boolean DEFAULT true,
  opens_count integer DEFAULT 0,
  submissions_count integer DEFAULT 0
);

ALTER TABLE loan_share_links ENABLE ROW LEVEL SECURITY;

-- Authenticated users can create their own links
CREATE POLICY IF NOT EXISTS "Users can insert own share links"
  ON loan_share_links FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = created_by);

-- Authenticated users can view their own links
CREATE POLICY IF NOT EXISTS "Users can view own share links"
  ON loan_share_links FOR SELECT
  TO authenticated
  USING (auth.uid() = created_by);

-- Owners can update their links (e.g., activate/deactivate)
CREATE POLICY IF NOT EXISTS "Users can update own share links"
  ON loan_share_links FOR UPDATE
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

-- Public can validate active links (no sensitive data exposed)
CREATE POLICY IF NOT EXISTS "Public can validate active share links"
  ON loan_share_links FOR SELECT
  TO anon
  USING (is_active = true);

-- RPC: submit loan via public share link
CREATE OR REPLACE FUNCTION submit_loan_via_share_link(
  p_link_id uuid,
  p_payload jsonb
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_creator uuid;
  v_loan_id uuid;
  v_product jsonb;
  v_product_item record;
BEGIN
  SELECT created_by INTO v_creator
  FROM loan_share_links
  WHERE link_id = p_link_id AND is_active = true AND (expires_at IS NULL OR expires_at > now())
  LIMIT 1;

  IF v_creator IS NULL THEN
    RAISE EXCEPTION 'Invalid or inactive link';
  END IF;

  INSERT INTO loans (
    user_id,
    first_name,
    last_name,
    father_mother_spouse_name,
    date_of_birth,
    aadhaar_number,
    pan_number,
    gender,
    marital_status,
    occupation,
    introduced_by,
    email_id,
    address,
    pin_code,
    landmark,
    permanent_address,
    mobile_primary,
    mobile_alternative,
    reference1_name,
    reference1_address,
    reference1_contact,
    reference1_relationship,
    reference2_name,
    reference2_address,
    reference2_contact,
    reference2_relationship,
    interest_scheme,
    gold_price_lock_date,
    down_payment_details,
    loan_amount,
    tenure,
    processing_fee,
    status,
    declaration_accepted,
    share_link_id
  ) VALUES (
    v_creator,
    p_payload->>'first_name',
    p_payload->>'last_name',
    p_payload->>'father_mother_spouse_name',
    (p_payload->>'date_of_birth')::date,
    p_payload->>'aadhaar_number',
    p_payload->>'pan_number',
    p_payload->>'gender',
    p_payload->>'marital_status',
    p_payload->>'occupation',
    p_payload->>'introduced_by',
    p_payload->>'email_id',
    p_payload->>'address',
    p_payload->>'pin_code',
    p_payload->>'landmark',
    COALESCE(p_payload->>'permanent_address', p_payload->>'address'),
    p_payload->>'mobile_primary',
    p_payload->>'mobile_alternative',
    p_payload->>'reference1_name',
    p_payload->>'reference1_address',
    p_payload->>'reference1_contact',
    p_payload->>'reference1_relationship',
    p_payload->>'reference2_name',
    p_payload->>'reference2_address',
    p_payload->>'reference2_contact',
    p_payload->>'reference2_relationship',
    p_payload->>'interest_scheme',
    (p_payload->>'gold_price_lock_date')::date,
    p_payload->>'down_payment_details',
    (p_payload->>'loan_amount')::numeric,
    (p_payload->>'tenure')::integer,
    (p_payload->>'processing_fee')::numeric,
    'Pending',
    (p_payload->>'declaration_accepted')::boolean,
    (SELECT id FROM loan_share_links WHERE link_id = p_link_id)
  ) RETURNING id INTO v_loan_id;

  -- Create product_loans entries for each selected product
  IF p_payload->'selected_products' IS NOT NULL AND jsonb_array_length(p_payload->'selected_products') > 0 THEN
    FOR v_product_item IN 
      SELECT jsonb_array_elements(p_payload->'selected_products') AS item
    LOOP
      INSERT INTO product_loans (
        loan_id,
        merchant_id,
        user_id,
        first_name,
        last_name,
        email_id,
        mobile_primary,
        mobile_alternative,
        address,
        loan_amount,
        tenure,
        processing_fee,
        product_id,
        product_name,
        product_price,
        status,
        created_at,
        updated_at
      ) VALUES (
        v_loan_id,
        v_creator,
        v_creator,
        p_payload->>'first_name',
        p_payload->>'last_name',
        p_payload->>'email_id',
        p_payload->>'mobile_primary',
        p_payload->>'mobile_alternative',
        p_payload->>'address',
        (p_payload->>'loan_amount')::numeric,
        (p_payload->>'tenure')::integer,
        (p_payload->>'processing_fee')::numeric,
        v_product_item.item->>'id',
        v_product_item.item->>'name',
        (v_product_item.item->>'price')::numeric,
        'Pending',
        now(),
        now()
      );
    END LOOP;
  END IF;

  -- increment submissions count on the link
  UPDATE loan_share_links
  SET submissions_count = submissions_count + 1
  WHERE link_id = p_link_id;

  RETURN v_loan_id;
END;
$$;

GRANT EXECUTE ON FUNCTION submit_loan_via_share_link(uuid, jsonb) TO anon, authenticated;

-- Associate loans back to share link for reporting
ALTER TABLE IF NOT EXISTS loans
  ADD COLUMN IF NOT EXISTS share_link_id uuid REFERENCES loan_share_links(id);

-- Track an open event for a public link
CREATE OR REPLACE FUNCTION track_share_link_open(p_link_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_id uuid;
BEGIN
  SELECT id INTO v_id FROM loan_share_links WHERE link_id = p_link_id AND is_active = true;
  IF v_id IS NULL THEN
    RETURN;
  END IF;
  UPDATE loan_share_links SET opens_count = opens_count + 1 WHERE id = v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION track_share_link_open(uuid) TO anon, authenticated;

-- Aggregate stats for the current authenticated user
CREATE OR REPLACE FUNCTION get_share_link_stats()
RETURNS TABLE (
  id uuid,
  link_id uuid,
  created_at timestamptz,
  is_active boolean,
  opens_count integer,
  submissions_count integer,
  pending_count integer,
  accepted_count integer,
  rejected_count integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH my_links AS (
    SELECT * FROM loan_share_links WHERE created_by = auth.uid()
  )
  SELECT
    l.id,
    l.link_id,
    l.created_at,
    l.is_active,
    l.opens_count,
    l.submissions_count,
    COALESCE(SUM(CASE WHEN ln.status = 'Pending' THEN 1 ELSE 0 END),0) AS pending_count,
    COALESCE(SUM(CASE WHEN ln.status = 'Accepted' THEN 1 ELSE 0 END),0) AS accepted_count,
    COALESCE(SUM(CASE WHEN ln.status = 'Rejected' THEN 1 ELSE 0 END),0) AS rejected_count
  FROM my_links l
  LEFT JOIN loans ln ON ln.share_link_id = l.id
  GROUP BY l.id, l.link_id, l.created_at, l.is_active, l.opens_count, l.submissions_count
$$;

GRANT EXECUTE ON FUNCTION get_share_link_stats() TO authenticated;
