/* eslint-disable react-refresh/only-export-components -- context hooks intentionally share their provider module */
import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { authApi } from '../api/auth.js';
import { invalidateAuthSession, onAuthFailure, refreshAccessToken, setAccessToken } from '../api/client.js';

const AuthContext = createContext(null);

// Module-level, not component-level: React StrictMode mounts, cleans up, and
// remounts effects in development. Keeping the promise here guarantees that
// both mounts share one refresh-token rotation.
let authBootstrapPromise = null;

function bootstrapSession() {
  if (authBootstrapPromise) return authBootstrapPromise;

  let currentPromise;
  currentPromise = refreshAccessToken()
    .then((session) => session.user)
    .catch((error) => {
      if (authBootstrapPromise === currentPromise) authBootstrapPromise = null;
      setAccessToken(null);
      throw error;
    });
  authBootstrapPromise = currentPromise;

  return currentPromise;
}

function resetBootstrapSession() {
  authBootstrapPromise = null;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const authEpochRef = useRef(0);

  useEffect(() => onAuthFailure(() => {
    authEpochRef.current += 1;
    resetBootstrapSession();
    setUser(null);
    setIsLoading(false);
  }), []);

  useEffect(() => {
    let mounted = true;
    const bootstrapEpoch = authEpochRef.current;

    bootstrapSession()
      .then((sessionUser) => {
        if (!mounted || bootstrapEpoch !== authEpochRef.current) return;
        setUser(sessionUser);
      })
      .catch(() => {
        if (!mounted || bootstrapEpoch !== authEpochRef.current) return;
        setUser(null);
      })
      .finally(() => {
        if (mounted && bootstrapEpoch === authEpochRef.current) setIsLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  const login = useCallback(async (identifier, password) => {
    const { data } = await authApi.login({ identifier, password });
    setAccessToken(data.data.accessToken);
    setUser(data.data.user);
    return data.data.user;
  }, []);

  const logout = useCallback(async () => {
    // Invalidate local retries first so UI reacts immediately and an older
    // request cannot trigger a refresh after logout.
    authEpochRef.current += 1;
    invalidateAuthSession();
    resetBootstrapSession();
    setUser(null);
    try {
      await authApi.logout();
    } catch {
      // Logout remains locally complete even if the network is unavailable.
    }
  }, []);

  const refreshUser = useCallback(async () => {
    const { data } = await authApi.getMe();
    setUser(data.data.user);
    return data.data.user;
  }, []);

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, refreshUser, setUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
