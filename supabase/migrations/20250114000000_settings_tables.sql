/*
  # Settings Tables for Loan Application System

  ## Tables Created
  
  1. user_preferences
    - Stores user notification preferences
    - One row per user
  
  2. system_settings
    - Stores system-wide settings (admin only)
    - One row per admin user
  
  3. billing_info
    - Stores billing information for users
    - One row per user

  ## Security
  - RLS enabled on all tables
  - Users can only view/edit their own data
  - Proper policies for insert, update, select operations
*/

-- Create user_preferences table
CREATE TABLE IF NOT EXISTS user_preferences (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email_notifications boolean DEFAULT true,
  loan_updates boolean DEFAULT true,
  payment_reminders boolean DEFAULT true,
  system_alerts boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own preferences"
  ON user_preferences FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences"
  ON user_preferences FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences"
  ON user_preferences FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create system_settings table (admin only)
CREATE TABLE IF NOT EXISTS system_settings (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  auto_approve_loans boolean DEFAULT false,
  default_loan_tenure integer DEFAULT 12 CHECK (default_loan_tenure IN (3, 6, 9, 12)),
  max_loan_amount numeric,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view own system settings"
  ON system_settings FOR SELECT
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can update own system settings"
  ON system_settings FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  )
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "Admins can insert own system settings"
  ON system_settings FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create billing_info table
CREATE TABLE IF NOT EXISTS billing_info (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  billing_email text,
  billing_address text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE billing_info ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own billing info"
  ON billing_info FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own billing info"
  ON billing_info FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can insert own billing info"
  ON billing_info FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_user_preferences_user_id ON user_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_system_settings_user_id ON system_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_billing_info_user_id ON billing_info(user_id);


