import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  AUTH_EXPIRED_EVENT,
  apiRequest,
  getStoredToken,
  setStoredToken,
} from '../api/client';
import type {
  AuthResponse,
  DemoResetResponse,
  DemoStatusResponse,
  HospitalSettings,
  InitialSetupRequest,
  LoginRequest,
  Role,
  SetupStatusResponse,
  UserSummary,
} from '../types/api';

interface AuthContextValue {
  user: UserSummary | null;
  settings: HospitalSettings | null;
  setupRequired: boolean;
  demoStatus: DemoStatusResponse | null;
  demoRevision: number;
  initializing: boolean;
  sessionNotice: string | null;
  clearSessionNotice: () => void;
  hasPermission: (permission: string) => boolean;
  login: (req: LoginRequest) => Promise<UserSummary>;
  loginWithDemoRole: (role: Role) => Promise<UserSummary>;
  resetDemoData: () => Promise<DemoResetResponse>;
  setupWorkspace: (req: InitialSetupRequest) => Promise<UserSummary>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  refreshSettings: () => Promise<void>;
  refreshSetupStatus: () => Promise<boolean>;
  refreshDemoStatus: () => Promise<DemoStatusResponse | null>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserSummary | null>(null);
  const [settings, setSettings] = useState<HospitalSettings | null>(null);
  const [setupRequired, setSetupRequired] = useState(false);
  const [demoStatus, setDemoStatus] = useState<DemoStatusResponse | null>(null);
  const [demoRevision, setDemoRevision] = useState(0);
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
      const next = Boolean(res?.setupRequired);
      setSetupRequired(next);
      return next;
    } catch {
      return false;
    }
  }, []);

  const refreshDemoStatus = useCallback(async (): Promise<DemoStatusResponse | null> => {
    try {
      const res = await apiRequest<DemoStatusResponse>('/auth/demo-status');
      if (res && typeof res.enabled === 'boolean') {
        setDemoStatus(res);
        return res;
      }
      return null;
    } catch {
      return null;
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
        const [statusRes, demoRes] = await Promise.all([
          apiRequest<SetupStatusResponse>('/auth/setup-status').catch(() => null),
          apiRequest<DemoStatusResponse>('/auth/demo-status').catch(() => null),
        ]);
        if (mounted && statusRes && typeof statusRes.setupRequired === 'boolean') {
          setSetupRequired(statusRes.setupRequired);
        }
        if (mounted && demoRes && typeof demoRes.enabled === 'boolean') {
          setDemoStatus(demoRes);
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

  const loginWithDemoRole = useCallback(
    async (role: Role): Promise<UserSummary> => {
      const res = await apiRequest<AuthResponse>('/auth/demo-login', {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      setStoredToken(res.accessToken);
      setUser(res.user);
      setSetupRequired(false);
      setSessionNotice(null);
      setDemoRevision((prev) => prev + 1);
      await refreshSettings();
      return res.user;
    },
    [refreshSettings]
  );

  const resetDemoData = useCallback(async (): Promise<DemoResetResponse> => {
    const res = await apiRequest<DemoResetResponse>('/demo/reset', {
      method: 'POST',
    });
    if (res?.session?.accessToken) {
      setStoredToken(res.session.accessToken);
      setUser(res.session.user);
    }
    setDemoRevision((prev) => prev + 1);
    await refreshSettings();
    return res;
  }, [refreshSettings]);

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
        demoStatus,
        demoRevision,
        initializing,
        sessionNotice,
        clearSessionNotice,
        hasPermission,
        login,
        loginWithDemoRole,
        resetDemoData,
        setupWorkspace,
        logout,
        refreshProfile,
        refreshSettings,
        refreshSetupStatus,
        refreshDemoStatus,
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
