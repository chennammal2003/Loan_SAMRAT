import type { UserProfile as SupabaseUserProfile } from './lib/supabase';

// Shared user type used for Super Admin filters
export type UserType = 'all' | 'nbfc_admin' | 'merchant' | 'customer';

// Re-export Supabase UserProfile type so components can import from a single place
export type UserProfile = SupabaseUserProfile;
