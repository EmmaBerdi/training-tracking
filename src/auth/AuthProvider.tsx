import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as authClient from './authClient';
import { AuthContext, type AuthStatus, type AuthUser } from './authContext';
import { getRefreshToken, setTokens, clearTokens, registerOnExpired } from './tokenStore';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(() =>
    getRefreshToken() ? 'loading' : 'anonymous',
  );
  const [user, setUser] = useState<AuthUser | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const signOut = useCallback(() => {
    setUser(null);
    setStatus('anonymous');
  }, []);

  useEffect(() => registerOnExpired(signOut), [signOut]);

  useEffect(() => {
    const storedRefreshToken = getRefreshToken();
    if (!storedRefreshToken) return;
    authClient
      .refresh(storedRefreshToken)
      .then((result) => {
        setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
        setUser({ email: result.email, displayName: result.displayName });
        setStatus('authenticated');
      })
      .catch(() => {
        clearTokens();
        setStatus('anonymous');
      });
  }, []);

  const start = useCallback((result: authClient.AuthResult) => {
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    setUser({ email: result.email, displayName: result.displayName });
    setNotice(null);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => start(await authClient.login(email, password)),
    [start],
  );

  const register = useCallback(
    async (email: string, password: string, displayName?: string) =>
      start(await authClient.register(email, password, displayName)),
    [start],
  );

  const logout = useCallback(
    (nextNotice?: string) => {
      const rt = getRefreshToken();
      clearTokens();
      signOut();
      setNotice(nextNotice ?? null);
      if (rt) void authClient.logout(rt);
    },
    [signOut],
  );

  return (
    <AuthContext.Provider value={{ status, user, notice, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
