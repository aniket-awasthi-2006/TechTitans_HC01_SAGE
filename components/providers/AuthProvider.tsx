'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'patient' | 'reception' | 'doctor';
}

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<{ error?: string }>;
  register: (data: RegisterData) => Promise<{ error?: string }>;
  logout: () => void;
  isLoading: boolean;
}

interface RegisterData {
  name: string;
  email: string;
  phone?: string;
  password: string;
  role?: string;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const storedToken = localStorage.getItem('opd_token');
    const storedUser = localStorage.getItem('opd_user');
    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) return { error: data.error || 'Login failed' };

      localStorage.setItem('opd_token', data.token);
      localStorage.setItem('opd_user', JSON.stringify(data.user));
      setToken(data.token);
      setUser(data.user);

      // Role-based redirect
      const redirectMap: Record<string, string> = {
        reception: '/reception/dashboard',
        doctor: '/doctor/dashboard',
        patient: '/patient/dashboard',
      };
      router.push(redirectMap[data.user.role] || '/');
      return {};
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  };

  const register = async (data: RegisterData) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) return { error: result.error || 'Registration failed' };

      localStorage.setItem('opd_token', result.token);
      localStorage.setItem('opd_user', JSON.stringify(result.user));
      setToken(result.token);
      setUser(result.user);
      router.push('/patient/dashboard');
      return {};
    } catch {
      return { error: 'Network error. Please try again.' };
    }
  };

  const logout = () => {
    localStorage.removeItem('opd_token');
    localStorage.removeItem('opd_user');
    setToken(null);
    setUser(null);
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, token, login, register, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
