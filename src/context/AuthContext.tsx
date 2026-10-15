/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  onAuthStateChanged, 
  signInWithEmailAndPassword,
  signOut, 
  User as FirebaseUser 
} from 'firebase/auth';
import { auth } from '../lib/firebase';
import { ShieldCheck, LogIn, Loader2, Lock, Mail } from 'lucide-react';
import { toast } from 'sonner';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
}

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  loginWithEmail: (email: string, pass: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  loginWithEmail: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isAuthenticating, setIsAuthenticating] = useState<boolean>(false);
  const [emailInput, setEmailInput] = useState<string>('');
  const [passwordInput, setPasswordInput] = useState<string>('');

  useEffect(() => {
    localStorage.removeItem('pigmy_local_user');

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseUser | null) => {
      if (firebaseUser) {
        setUser({
          uid: firebaseUser.uid,
          email: firebaseUser.email || 'user@pigmy.app',
          displayName: firebaseUser.displayName || (firebaseUser.email?.split('@')[0] || 'Pigmy User'),
          photoURL: firebaseUser.photoURL,
        });
      } else {
        setUser(null);
      }
      setLoading(false);
    }, (error) => {
      console.warn('Auth state change warning:', error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const loginWithEmail = async (email: string, pass: string) => {
    if (!email || !pass) {
      toast.error('Please enter both email and password');
      return;
    }
    setIsAuthenticating(true);
    try {
      await signInWithEmailAndPassword(auth, email, pass);
      toast.success('Successfully signed in!');
      window.location.href = '/';
    } catch (error: any) {
      console.error('Firebase Email Sign In Error:', error);
      toast.error(error?.message || 'Failed to sign in with email and password');
    } finally {
      setIsAuthenticating(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('pigmy_local_user');
      await signOut(auth);
      setUser(null);
      toast.success('Signed out successfully');
      window.location.href = '/';
    } catch (error: any) {
      console.error('Sign out error:', error);
      localStorage.removeItem('pigmy_local_user');
      setUser(null);
      toast.success('Signed out successfully');
      window.location.href = '/';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4">
        <Loader2 size={36} className="animate-spin text-accent mb-3" />
        <p className="text-xs font-bold text-text-secondary uppercase tracking-widest">Loading Pigmy Pro...</p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-bg flex flex-col items-center justify-center p-4 selection:bg-accent/20">
        <div className="w-full max-w-md bg-card border border-border/80 rounded-3xl p-8 shadow-2xl space-y-6 text-center backdrop-blur-xl">
          <div className="w-16 h-16 bg-accent/15 text-accent rounded-2xl mx-auto flex items-center justify-center shadow-inner">
            <ShieldCheck size={32} strokeWidth={2.5} />
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-black text-text-primary tracking-tight">Pigmy Pro Ledger</h1>
            <p className="text-xs text-text-secondary">Secure Digital Microfinance & Savings Collection Ledger</p>
          </div>

          <form 
            onSubmit={(e) => {
              e.preventDefault();
              loginWithEmail(emailInput, passwordInput);
            }}
            className="space-y-4 text-left"
          >
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Email Address</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary">
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  required
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="agent@pigmy.app"
                  className="w-full h-12 bg-muted/50 border border-border rounded-xl pl-10 pr-4 text-xs font-medium text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-text-secondary uppercase tracking-wider">Password</label>
              <div className="relative">
                <span className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-text-secondary">
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  required
                  value={passwordInput}
                  onChange={(e) => setPasswordInput(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-12 bg-muted/50 border border-border rounded-xl pl-10 pr-4 text-xs font-medium text-text-primary focus:outline-none focus:border-accent transition-colors"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isAuthenticating}
              className="w-full h-13 bg-accent hover:bg-accent/90 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-accent/25 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 mt-2"
            >
              {isAuthenticating ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  <span>Processing...</span>
                </>
              ) : (
                <>
                  <LogIn size={16} strokeWidth={2.5} />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, loginWithEmail, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
