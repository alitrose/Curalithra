import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AUTH_EXPIRED_EVENT,
  apiRequest,
  getStoredToken,
  setStoredToken,
} from '../api/client';
import type {
  AuthResponse,
  HospitalSettings,
  InitialSetupRequest,
  LoginRequest,
  SetupStatusResponse,
  UserSummary,
} from '../types/api';

interface AuthContextValue {
  user: UserSummary | null;
  settings: HospitalSettings | null;
  setupRequired: boolean;
  initializing: boolean;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
  hasPermission: (permission: string) => boolean;
  login: (req: LoginRequest) => Promise<UserSummary>;
  setupWorkspace: (req: InitialSetupRequest) => Promise<UserSummary>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshSetupStatus: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [settings, setSettings] = useState<HospitalSettings | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [sessionNotice, setSessionNotice] = useState<string | null>(null);

  const refreshSettings = useCallback(async () => {
    try {
      const s = await apiRequest<HospitalSettings>('/settings');
      setSettings(s);
    } catch {
      // ignore if unauthenticated or offline
    }
  }, []);

  const refreshSetupStatus = useCallback(async (): Promise<boolean> => {
    try {
      const res = await apiRequest<SetupStatusResponse>('/auth/setup-status');
      setSetupRequired(res.setupRequired);
      return res.setupRequired;
    } catch {
      return false;
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    const profile = await apiRequest<UserSummary>('/auth/me');
    setUser(profile);
  }, []);

  useEffect(() => {
    let mounted = true;
    const bootstrap = async () => {
      try {
        const statusRes = await apiRequest<SetupStatusResponse>('/auth/setup-status').catch(() => null);
        if (mounted && statusRes) {
          setSetupRequired(statusRes.setupRequired);
        }
        const token = getStoredToken();
        if (token) {
          try {
            const me = await apiRequest<UserSummary>('/auth/me');
            if (mounted) {
              setUser(me);
              const s = await apiRequest<HospitalSettings>('/settings').catch(() => null);
              if (mounted && s) setSettings(s);
            }
          } catch {
            setStoredToken(null);
            if (mounted) setUser(null);
          }
        }
      } finally {
        if (mounted) setInitializing(false);
      }
    };
    bootstrap();

    const handleExpired = (ev: Event) => {
      const detail = (ev as CustomEvent<string>).detail;
      setUser(null);
      setSettings(null);
      setSessionNotice(detail || 'Your session has expired. Please sign in again.');
    };

    window.addEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    return () => {
      mounted = false;
      window.removeEventListener(AUTH_EXPIRED_EVENT, handleExpired);
    };
  }, []);

  const login = useCallback(
    async (req: LoginRequest): Promise<UserSummary> => {
      const res = await apiRequest<AuthResponse>('/auth/login', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      setStoredToken(res.accessToken);
      setUser(res.user);
      setSetupRequired(false);
      setSessionNotice(null);
      await refreshSettings();
      return res.user;
    },
    [refreshSettings]
  );

  const setupWorkspace = useCallback(
    async (req: InitialSetupRequest): Promise<UserSummary> => {
      const res = await apiRequest<AuthResponse>('/auth/setup', {
        method: 'POST',
        body: JSON.stringify(req),
      });
      setStoredToken(res.accessToken);
      setUser(res.user);
      setSetupRequired(false);
      setSessionNotice(null);
      await refreshSettings();
      return res.user;
    },
    [refreshSettings]
  );

  const logout = useCallback(async () => {
    try {
      if (getStoredToken()) {
        await apiRequest<void>('/auth/logout', { method: 'POST' });
      }
    } catch {
      // Clear local session regardless of network hiccup
    } finally {
      setStoredToken(null);
      setUser(null);
      setSettings(null);
    }
  }, []);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      if (!user) return false;
      return user.permissions.includes(permission);
    },
    [user]
  );

  const clearSessionNotice = useCallback(() => setSessionNotice(null), []);

  return (
    <AuthContext.Provider
      value={{
        user,
        settings,
        setupRequired,
        initializing,
        sessionNotice,
        clearSessionNotice,
        hasPermission,
        login,
        setupWorkspace,
        logout,
        refreshProfile,
        refreshSettings,
        refreshSetupStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used inside AuthProvider');
  }
  return ctx;
}
