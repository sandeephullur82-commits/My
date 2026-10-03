import React, { createContext, useContext } from 'react';

export interface AuthUser {
  uid: string;
  email: string | null;
  displayName: string | null;
}

interface AuthContextType {
  user: AuthUser;
  loading: boolean;
  logout: () => Promise<void>;
}

const defaultUser: AuthUser = {
  uid: 'admin_user',
  email: 'admin@pigmypro.com',
  displayName: 'Pigmy Admin',
};

const AuthContext = createContext<AuthContextType>({
  user: defaultUser,
  loading: false,
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const logout = async () => {
    console.log('[Auth] Auth-free mode active. Sign-out is disabled.');
  };

  return (
    <AuthContext.Provider value={{ user: defaultUser, loading: false, logout }}>
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
