import { createContext } from 'react';
import type { User, Session, AuthError } from '@supabase/supabase-js';

export interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isPasswordRecovery: boolean;
  signInWithPassword: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUpWithPassword: (email: string, password: string) => Promise<{
    error: AuthError | null;
    user: User | null;
    session: Session | null;
  }>;
  resetPasswordForEmail: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (newPassword: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<{ error: AuthError | null }>;
  clearPasswordRecovery: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
