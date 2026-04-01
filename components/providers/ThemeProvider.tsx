'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextValue {
  theme: Theme;
  isReady: boolean;
  setTheme: (theme: Theme) => void;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

const STORAGE_KEY = 'opd_theme';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setThemeState] = useState<Theme>('dark');
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'dark' || stored === 'light') {
      setThemeState(stored);
    } else if (window.matchMedia('(prefers-color-scheme: light)').matches) {
      setThemeState('light');
    }
    setIsReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    if (isReady) {
      localStorage.setItem(STORAGE_KEY, theme);
    }
  }, [theme, isReady]);

  const setTheme = useCallback((nextTheme: Theme) => {
    setThemeState(nextTheme);
  }, []);

  const toggleTheme = useCallback(() => {
    setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(
    () => ({ theme, isReady, setTheme, toggleTheme }),
    [theme, isReady, setTheme, toggleTheme]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return ctx;
}
