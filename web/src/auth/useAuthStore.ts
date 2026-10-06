import { create } from "zustand";

import { login as apiLogin, register as apiRegister } from "@/api/auth";
import { getMe } from "@/api/me";
import type { RegisterRequest, ResumeStatus, User } from "@/api/types";
import {
  clearAccessToken,
  getAccessToken,
  onAccessTokenCleared,
  setAccessToken,
} from "@/lib/token";

interface AuthState {
  token: string | null;
  user: User | null;
  resumeStatus: ResumeStatus | null;
  login: (email: string, password: string) => Promise<void>;
  register: (body: RegisterRequest) => Promise<void>;
  refreshMe: () => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: getAccessToken(),
  user: null,
  resumeStatus: null,

  async login(email, password) {
    const response = await apiLogin(email, password);
    setAccessToken(response.access_token);
    set({ token: response.access_token, user: response.user });
    await get().refreshMe();
  },

  async register(body) {
    const response = await apiRegister(body);
    setAccessToken(response.access_token);
    set({ token: response.access_token, user: response.user });
    await get().refreshMe();
  },

  async refreshMe() {
    try {
      const me = await getMe();
      set({
        user: { id: me.id, email: me.email, full_name: me.full_name, is_admin: me.is_admin },
        resumeStatus: me.profile.resume_status,
      });
    } catch {
      // /me недоступен — оставляем прежнее состояние, не разлогиниваем.
    }
  },

  logout() {
    clearAccessToken();
    set({ token: null, user: null, resumeStatus: null });
  },
}));

// 401 из любого запроса очищает токен через client.ts — здесь store синхронизируется.
onAccessTokenCleared(() => {
  useAuthStore.setState({ token: null, user: null, resumeStatus: null });
});
