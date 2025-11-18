import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string, role: 'merchant' | 'admin' | 'customer' | 'super_admin', mobile: string) => Promise<void>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  updatePassword: (newPassword: string) => Promise<void>;
  updateProfile: (username: string) => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let profileChannel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      const authUser = session?.user ?? null;
      setUser(authUser);
      if (authUser) {
        fetchProfile(authUser.id);
        // Listen for realtime changes to this user's profile (e.g., is_active toggled by Super Admin)
        profileChannel = supabase
          .channel(`user-profile-${authUser.id}`)
          .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${authUser.id}` }, () => {
            fetchProfile(authUser.id);
          })
          .subscribe();
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        const authUser = session?.user ?? null;
        setUser(authUser);
        if (authUser) {
          await fetchProfile(authUser.id);
          // Re-subscribe to profile changes for the new user
          if (profileChannel) supabase.removeChannel(profileChannel);
          profileChannel = supabase
            .channel(`user-profile-${authUser.id}`)
            .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'user_profiles', filter: `id=eq.${authUser.id}` }, () => {
              fetchProfile(authUser.id);
            })
            .subscribe();
        } else {
          setProfile(null);
          setLoading(false);
          if (profileChannel) {
            supabase.removeChannel(profileChannel);
            profileChannel = null;
          }
        }
      })();
    });

    return () => {
      subscription.unsubscribe();
      if (profileChannel) supabase.removeChannel(profileChannel);
    };
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('Error fetching profile:', error);
        throw error;
      }

      if (!data) {
        console.error('No profile found for user:', userId);
        // Attempt to create profile now that we have an authenticated session
        const { data: userRes } = await supabase.auth.getUser();
        const authUser = userRes?.user || null;
        if (authUser) {
          const usernameFromMeta = (authUser.user_metadata as any)?.username as string | undefined;
          const roleFromMeta = (authUser.user_metadata as any)?.role as 'merchant' | 'admin' | 'customer' | 'super_admin' | undefined;
          const emailFromAuth = authUser.email ?? '';
          const mobileFromMetaRaw = (authUser.user_metadata as any)?.mobile as string | undefined;
          const mobileSanitized = (mobileFromMetaRaw || '').replace(/\D/g, '').slice(-10) || null;
          const derivedUsername = usernameFromMeta || (emailFromAuth ? emailFromAuth.split('@')[0] : 'user');

          const { error: upsertErr } = await supabase
            .from('user_profiles')
            .upsert(
              {
                id: userId,
                username: derivedUsername,
                email: emailFromAuth,
                role: (roleFromMeta ?? 'customer'),
                mobile: mobileSanitized,
                // Merchants and NBFC/admin users must be approved by Super Admin before they can log in
                is_active: (roleFromMeta === 'merchant' || roleFromMeta === 'admin') ? false : 
                          (roleFromMeta === 'customer' || roleFromMeta === 'super_admin') ? true : false,
              },
              { onConflict: 'id' }
            );

          if (!upsertErr) {
            const { data: refetched } = await supabase
              .from('user_profiles')
              .select('*')
              .eq('id', userId)
              .maybeSingle();
            if (refetched) {
              setProfile(refetched);
              return;
            }
          } else {
            console.error('Profile upsert error:', upsertErr);
          }
        }
      } else {
        setProfile(data);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (error) throw error;
    if (data.user) {
      // On successful auth, just load the profile. Individual screens will
      // enforce approval requirements using profile.is_active and role.
      await fetchProfile(data.user.id);
    }
  };

  const signUp = async (username: string, email: string, password: string, role: 'merchant' | 'admin' | 'customer' | 'super_admin', mobile: string) => {
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          username,
          role,
          mobile,
        },
      },
    });

    if (authError) throw authError;
    if (!authData.user) throw new Error('User creation failed');

    // Insert profile only if a session exists (e.g., email auto-confirm enabled)
    if (authData.session) {
      const mobileSanitized = (mobile || '').replace(/\D/g, '').slice(-10) || null;
      // Ensure merchants and admins are ALWAYS inactive by default
      let isActiveValue: boolean;
      if (role === 'merchant' || role === 'admin') {
        isActiveValue = false; // Always inactive for merchants and admins
      } else if (role === 'customer' || role === 'super_admin') {
        isActiveValue = true;  // Active for customers and super admins
      } else {
        isActiveValue = false; // Default to inactive for any other roles
      }
      
      const profileData = {
        id: authData.user.id,
        username,
        email,
        role,
        // Merchants and NBFC/admin users must be approved by Super Admin before they can log in
        is_active: isActiveValue,
        mobile: mobileSanitized,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert(profileData);

      if (profileError) {
        console.error('Profile creation error:', profileError);
        throw new Error(`Failed to create user profile: ${profileError.message}`);
      }

      // CRITICAL: Force is_active to false for merchants/admins (override database defaults)
      // This is essential because the database has DEFAULT true for is_active
      if (role === 'merchant' || role === 'admin') {
        // First update attempt
        const { error: updateError1 } = await supabase
          .from('user_profiles')
          .update({ 
            is_active: false,
            updated_at: new Date().toISOString()
          })
          .eq('id', authData.user.id);

        if (updateError1) {
          console.error('First attempt to set is_active failed:', updateError1);
          
          // Second attempt with different approach
          const { error: updateError2 } = await supabase
            .from('user_profiles')
            .upsert({ 
              id: authData.user.id,
              is_active: false,
              updated_at: new Date().toISOString()
            }, { onConflict: 'id' });

          if (updateError2) {
            console.error('Second attempt to set is_active failed:', updateError2);
          }
        }

        // Final verification - ensure the user is definitely inactive
        const { data: finalCheck } = await supabase
          .from('user_profiles')
          .select('is_active')
          .eq('id', authData.user.id)
          .single();

        if (finalCheck?.is_active === true) {
          console.error('CRITICAL: User is still active after all attempts to set inactive');
          // One more forceful attempt
          await supabase
            .from('user_profiles')
            .update({ is_active: false })
            .eq('id', authData.user.id);
        }
      }

      // Verify the profile was created with correct is_active value
      const { error: verifyError } = await supabase
        .from('user_profiles')
        .select('is_active, role')
        .eq('id', authData.user.id)
        .single();

      if (verifyError) {
        console.error('Error verifying profile creation:', verifyError);
      }
    }
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  };

  const updatePassword = async (newPassword: string) => {
    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });
    if (error) throw error;
  };

  const updateProfile = async (username: string) => {
    if (!user) throw new Error('User not authenticated');
    const { error } = await supabase
      .from('user_profiles')
      .update({ 
        username,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);
    if (error) throw error;
    await fetchProfile(user.id);
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchProfile(user.id);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        resetPassword,
        updatePassword,
        updateProfile,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
