import React, { useEffect, useState, useMemo } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase, getAuthRedirectUrl } from '../lib/supabase';
import { AuthContext } from './authContextDef';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPasswordRecovery, setIsPasswordRecovery] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      const search = window.location.search;
      return hash.includes('type=recovery') || search.includes('type=recovery');
    }
    return false;
  });

  useEffect(() => {
    let isMounted = true;

    // 1. Initial session detection on application startup
    async function initializeAuth() {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('[APIForge Auth] Error resolving initial session:', error.message);
        }
        if (isMounted) {
          setSession(data.session ?? null);
          setUser(data.session?.user ?? null);
        }
      } catch (err) {
        console.error('[APIForge Auth] Unexpected error fetching session:', err);
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    initializeAuth();

    // 2. Supabase auth state change listener with subscription cleanup
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);

        if (event === 'PASSWORD_RECOVERY') {
          setIsPasswordRecovery(true);
        } else if (event === 'SIGNED_OUT') {
          setIsPasswordRecovery(false);
        }
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      });

      if (!error && data.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return { error };
    } catch (err: unknown) {
      const authErr = err as AuthError;
      return { error: authErr };
    }
  };

  const signUpWithPassword = async (email: string, password: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });

      if (!error && data.session) {
        setSession(data.session);
        setUser(data.user);
      }

      return {
        error,
        user: data.user ?? null,
        session: data.session ?? null,
      };
    } catch (err: unknown) {
      const authErr = err as AuthError;
      return {
        error: authErr,
        user: null,
        session: null,
      };
    }
  };

  const resetPasswordForEmail = async (email: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: getAuthRedirectUrl(),
      });
      return { error };
    } catch (err: unknown) {
      const authErr = err as AuthError;
      return { error: authErr };
    }
  };

  const resendSignUpConfirmation = async (email: string) => {
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
        options: {
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });
      return { error };
    } catch (err: unknown) {
      const authErr = err as AuthError;
      return { error: authErr };
    }
  };

  const updatePassword = async (newPassword: string) => {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (!error) {
        setIsPasswordRecovery(false);
        // Clear any URL hash containing recovery tokens
        if (typeof window !== 'undefined' && window.history) {
          window.history.replaceState(null, '', window.location.pathname);
        }
      }

      return { error };
    } catch (err: unknown) {
      const authErr = err as AuthError;
      return { error: authErr };
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (!error) {
        setSession(null);
        setUser(null);
        setIsPasswordRecovery(false);
      }
      return { error };
    } catch (err: unknown) {
      const authErr = err as AuthError;
      return { error: authErr };
    }
  };

  const clearPasswordRecovery = () => {
    setIsPasswordRecovery(false);
    if (typeof window !== 'undefined' && window.history) {
      window.history.replaceState(null, '', window.location.pathname);
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isPasswordRecovery,
      signInWithPassword,
      signUpWithPassword,
      resetPasswordForEmail,
      resendSignUpConfirmation,
      updatePassword,
      signOut,
      clearPasswordRecovery,
    }),
    [user, session, loading, isPasswordRecovery]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
