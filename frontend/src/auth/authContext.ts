import { createContext } from 'react';

export interface AuthUser {
  email: string;
  displayName: string | null;
  /** Only decides whether the admin menu shows; the server checks every admin call itself. */
  admin: boolean;
}

export type AuthStatus = 'loading' | 'authenticated' | 'anonymous';

export interface AuthContextValue {
  status: AuthStatus;
  user: AuthUser | null;
  /** Shown on the login screen after a logout that needs explaining, e.g. a changed password. */
  notice: string | null;
  login: (email: string, password: string) => Promise<void>;
  /** Replaces any session already open in this browser with the invited account's. */
  acceptInvitation: (token: string, password: string, displayName?: string) => Promise<void>;
  logout: (notice?: string) => void;
  /** After a confirmed change of address: the session stays, only the shown address moves on. */
  updateEmail: (email: string) => void;
}

/** Split from AuthProvider so the provider module exports only its component (fast refresh). */
export const AuthContext = createContext<AuthContextValue | null>(null);
