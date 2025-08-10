import { create } from 'zustand';

type User = {
  id: number;
  firstName: string;
  lastName: string;
  avatarUrl?: string | null;
  weeklySpendCents: number;
  startDate?: string | null;
};

interface AppState {
  token: string | null;
  user: User | null;
  setAuth: (token: string, user: User) => void;
  clearAuth: () => void;
}

export const useAppStore = create<AppState>((set) => ({
  token: localStorage.getItem('token'),
  user: null,
  setAuth: (token, user) => {
    localStorage.setItem('token', token);
    set({ token, user });
  },
  clearAuth: () => {
    localStorage.removeItem('token');
    set({ token: null, user: null });
  }
}));


