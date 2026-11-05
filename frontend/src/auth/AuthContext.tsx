import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authStorage, login as loginRequest, setRefreshTokenCallback, type ApiUser, type AuthResponse } from '../lib/api';

interface AuthContextValue {
  user: ApiUser | null;
  token: string | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<ApiUser | null>(() => authStorage.getUser());
  const [token, setToken] = useState<string | null>(() => authStorage.getAccessToken());

  const login = useCallback(async (email: string, password: string) => {
    const auth = await loginRequest(email, password);
    setUser(auth.user);
    setToken(auth.accessToken);
    return auth;
  }, []);

  const logout = useCallback(() => {
    authStorage.clear();
    setUser(null);
    setToken(null);
  }, []);

  // Đăng ký callback để nhận token mới khi refresh thành công
  useEffect(() => {
    setRefreshTokenCallback((newToken) => {
      if (newToken) {
        setToken(newToken);
      } else {
        setToken(null);
        setUser(null);
      }
    });
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({ user, token, login, logout }),
    [user, token, login, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return context;
}
