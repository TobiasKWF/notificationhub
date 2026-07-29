import { create } from 'zustand';
import type { User } from '@/lib/api';

interface AuthState {
  token: string | null;
  user:  User  | null;
  setAuth: (token: string, user: User) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: sessionStorage.getItem('nhub_token'),
  user:  null,
  setAuth: (token, user) => {
    sessionStorage.setItem('nhub_token', token);
    set({ token, user });
  },
  logout: () => {
    sessionStorage.removeItem('nhub_token');
    set({ token: null, user: null });
  },
}));
