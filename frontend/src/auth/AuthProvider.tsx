import { useCallback, useEffect, useState, type ReactNode } from 'react';
import * as authClient from './authClient';
import { AuthContext, type AuthStatus, type AuthUser } from './authContext';
import { getRefreshToken, setTokens, clearTokens, registerOnExpired } from './tokenStore';

function toUser(result: authClient.AuthResult): AuthUser {
  return { email: result.email, displayName: result.displayName, admin: result.admin };
}

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
        setUser(toUser(result));
        setStatus('authenticated');
      })
      .catch(() => {
        clearTokens();
        setStatus('anonymous');
      });
  }, []);

  const start = useCallback((result: authClient.AuthResult) => {
    setTokens({ accessToken: result.accessToken, refreshToken: result.refreshToken });
    setUser(toUser(result));
    setNotice(null);
    setStatus('authenticated');
  }, []);

  const login = useCallback(
    async (email: string, password: string) => start(await authClient.login(email, password)),
    [start],
  );

  const acceptInvitation = useCallback(
    async (token: string, password: string, displayName?: string) => {
      const result = await authClient.acceptInvitation(token, password, displayName);
      // Only once the new account is in, so a failed attempt leaves the old session untouched.
      const previous = getRefreshToken();
      start(result);
      if (previous) void authClient.logout(previous);
    },
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
    <AuthContext.Provider value={{ status, user, notice, login, acceptInvitation, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
