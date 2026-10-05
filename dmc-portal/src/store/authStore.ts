import { create } from "zustand";

import type { AuthUser } from "../types/auth";

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  setAuth: (user: AuthUser, token: string) => void;
  clearAuth: () => void;
}

const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: null,

  setAuth: (user, token) => {
    set({
      user,
      token,
    });
  },

  clearAuth: () => {
    set({
      user: null,
      token: null,
    });
  },
}));

export default useAuthStore;
