'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { PlexUser } from './types';
import { getPlexUser } from './plex-auth';

interface AuthContextType {
  user: PlexUser | null;
  isLoading: boolean;
  login: (authToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'plex_auth_token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<PlexUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedToken = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedToken) {
      getPlexUser(storedToken)
        .then(setUser)
        .catch(() => localStorage.removeItem(AUTH_STORAGE_KEY))
        .finally(() => setIsLoading(false));
    } else {
      Promise.resolve().then(() => setIsLoading(false));
    }
  }, []);

  const login = async (authToken: string) => {
    const plexUser = await getPlexUser(authToken);
    localStorage.setItem(AUTH_STORAGE_KEY, authToken);
    setUser(plexUser);
  };

  const logout = () => {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
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
