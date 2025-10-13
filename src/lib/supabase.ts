import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type UserRole = 'merchant' | 'admin';

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  created_at: string;
  updated_at: string;
}

export interface LoanApplication {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  father_mother_spouse_name: string;
  date_of_birth: string;
  aadhaar_number: string;
  pan_number: string;
  gender: 'Male' | 'Female' | 'Other';
  marital_status: 'Single' | 'Married' | 'Widowed' | 'Divorced';
  occupation: string;
  introduced_by?: string;
  email_id: string;
  address: string;
  pin_code: string;
  landmark?: string;
  permanent_address?: string;
  mobile_primary: string;
  mobile_alternative?: string;
  reference1_name: string;
  reference1_address: string;
  reference1_contact: string;
  reference1_relationship: string;
  reference2_name: string;
  reference2_address: string;
  reference2_contact: string;
  reference2_relationship: string;
  interest_scheme: string;
  gold_price_lock_date: string;
  down_payment_details?: string;
  loan_amount: number;
  tenure: 3 | 6 | 9 | 12;
  processing_fee: number;
  status: 'Pending' | 'Accepted' | 'Verified' | 'Loan Disbursed' | 'Rejected';
  declaration_accepted: boolean;
  created_at: string;
  updated_at: string;
}

export interface LoanDocument {
  id: string;
  loan_id: string;
  document_type: string;
  file_name: string;
  file_path: string;
  file_url?: string;
  file_size?: number;
  uploaded_at: string;
}
 export interface DocumentStatus {
   id: string;
   loan_id: string;
   document_type: string;
   status: 'Pending' | 'Verified' | 'Rejected';
   remarks?: string;
   updated_at: string;
 }
 