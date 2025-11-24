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

          // Role from metadata may be merchant, admin, customer, user, nbfc_admin, or super_admin
          const resolvedRole = (roleFromMeta ?? 'customer') as UserProfile['role'];

          const { error: upsertErr } = await supabase
            .from('user_profiles')
            .upsert(
              {
                id: userId,
                username: derivedUsername,
                email: emailFromAuth,
                role: resolvedRole,
                mobile: mobileSanitized,
                // All users start as active by default; any later blocking is enforced in the app
                is_active: true,
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
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        // Provide better error messages for common issues
        if (error.message?.includes('Failed to fetch')) {
          throw new Error('Connection error: Unable to reach authentication server');
        } else if (error.message?.includes('Invalid login credentials')) {
          throw new Error('Invalid email or password');
        } else if (error.message?.includes('Email not confirmed')) {
          throw new Error('Please verify your email before signing in');
        }
        throw error;
      }
      
      if (data.user) {
        // On successful auth, just load the profile
        await fetchProfile(data.user.id);
      }
    } catch (err: any) {
      console.error('Sign-in error:', err);
      throw err;
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

      const profileData = {
        id: authData.user.id,
        username,
        email,
        role,
        // All roles (merchant, admin, nbfc_admin, customer, user, super_admin) start active on signup
        is_active: true,
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
