import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";

import { login as apiLogin, register as apiRegister } from "@/api/auth";
import { getMe } from "@/api/me";
import type { RegisterRequest, ResumeStatus, User } from "@/api/types";
import { clearAccessToken, getAccessToken, onAccessTokenCleared, setAccessToken } from "@/lib/token";

interface AuthValue {
  token: string | null;
  user: User | null;
  resumeStatus: ResumeStatus | null;
  login: (email: string, password: string) => Promise<ResumeStatus | null>;
  register: (body: RegisterRequest) => Promise<ResumeStatus | null>;
  refreshMe: () => Promise<ResumeStatus | null>;
  logout: () => void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => getAccessToken());
  const [user, setUser] = useState<User | null>(null);
  const [resumeStatus, setResumeStatus] = useState<ResumeStatus | null>(null);

  const refreshMe = useCallback(async () => {
    try {
      const me = await getMe();
      setUser({ id: me.id, email: me.email, full_name: me.full_name, is_admin: me.is_admin });
      setResumeStatus(me.profile.resume_status);
      return me.profile.resume_status;
    } catch {
      return null;
    }
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const response = await apiLogin(email, password);
      setAccessToken(response.access_token);
      setToken(response.access_token);
      setUser(response.user);
      return refreshMe();
    },
    [refreshMe],
  );

  const register = useCallback(
    async (body: RegisterRequest) => {
      const response = await apiRegister(body);
      setAccessToken(response.access_token);
      setToken(response.access_token);
      setUser(response.user);
      return refreshMe();
    },
    [refreshMe],
  );

  const logout = useCallback(() => {
    clearAccessToken();
    setToken(null);
    setUser(null);
    setResumeStatus(null);
  }, []);

  // 401 из любого запроса очищает токен через lib/token — здесь состояние синхронизируется.
  useEffect(() => {
    return onAccessTokenCleared(() => {
      setToken(null);
      setUser(null);
      setResumeStatus(null);
    });
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ token, user, resumeStatus, login, register, refreshMe, logout }),
    [token, user, resumeStatus, login, register, refreshMe, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth должен использоваться внутри AuthProvider");
  return context;
}
