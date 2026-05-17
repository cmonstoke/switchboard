import { createContext, useContext, useCallback } from 'react';
import { SessionExpiredError } from '../api/switch';

interface AuthCtx {
  onSessionExpired: () => void;
  onSwitchChange: (switchId: string) => void;
}

const AuthContext = createContext<AuthCtx>({
  onSessionExpired: () => {},
  onSwitchChange: () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

export const AuthProvider = AuthContext.Provider;

// Wraps an async API call; if the session expired, calls onSessionExpired automatically.
export function useApiCall() {
  const { onSessionExpired } = useAuth();
  return useCallback(
    async <T,>(fn: () => Promise<T>): Promise<T | null> => {
      try {
        return await fn();
      } catch (e) {
        if (e instanceof SessionExpiredError) {
          onSessionExpired();
          return null;
        }
        throw e;
      }
    },
    [onSessionExpired],
  );
}
