import React, { createContext, useContext, useEffect, useState } from 'react';
import { auth } from '../lib/firebase';
import { onAuthStateChanged, User, signOut as firebaseSignOut } from 'firebase/auth';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Safety fallback: Ensure app never hangs indefinitely on splash screen
    const safetyTimer = setTimeout(() => {
      setLoading(false);
    }, 1200);

    const unsubscribe = onAuthStateChanged(
      auth,
      (currentUser) => {
        clearTimeout(safetyTimer);
        setUser(currentUser);
        setLoading(false);
      },
      (error) => {
        console.warn('[AuthContext] onAuthStateChanged error:', error);
        clearTimeout(safetyTimer);
        setUser(null);
        setLoading(false);
      }
    );

    return () => {
      clearTimeout(safetyTimer);
      unsubscribe();
    };
  }, []);

  const logout = async () => {
    await firebaseSignOut(auth);
  };

  return (
    <AuthContext.Provider value={{ user, loading, logout }}>
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
