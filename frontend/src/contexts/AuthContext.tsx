import React, { useEffect, useState, useMemo } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import { AuthContext } from './authContextDef';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (isMounted) {
        setSession(currentSession);
        setUser(currentSession?.user ?? null);
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInWithPassword = async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
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
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password,
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

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (!error) {
        setSession(null);
        setUser(null);
      }
      return { error };
    } catch (err: unknown) {
      const authErr = err as AuthError;
      return { error: authErr };
    }
  };

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      signInWithPassword,
      signUpWithPassword,
      signOut,
    }),
    [user, session, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
