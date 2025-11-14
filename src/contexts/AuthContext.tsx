import React, { createContext, useContext, useEffect, useState } from 'react';
import { User } from '@supabase/supabase-js';
import { supabase, UserProfile } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (username: string, email: string, password: string, role: 'merchant' | 'admin' | 'customer', mobile: string) => Promise<void>;
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
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      (async () => {
        setUser(session?.user ?? null);
        if (session?.user) {
          await fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setLoading(false);
        }
      })();
    });

    return () => subscription.unsubscribe();
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
          const roleFromMeta = (authUser.user_metadata as any)?.role as 'merchant' | 'admin' | 'customer' | undefined;
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
      await fetchProfile(data.user.id);
    }
  };

  const signUp = async (username: string, email: string, password: string, role: 'merchant' | 'admin' | 'customer', mobile: string) => {
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
      const { error: profileError } = await supabase
        .from('user_profiles')
        .insert({
          id: authData.user.id,
          username,
          email,
          role,
          mobile: mobileSanitized,
        });

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
