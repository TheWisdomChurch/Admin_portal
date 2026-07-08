// src/providers/ThemeProvider.tsx
'use client';

import React, { useEffect, useState, createContext, useContext } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);
const THEME_COOKIE = 'theme';

const readThemeCookie = (): ThemeMode | null => {
  if (typeof document === 'undefined') return null;
  const cookie = document.cookie
    .split('; ')
    .find((entry) => entry.startsWith(`${THEME_COOKIE}=`));
  if (!cookie) return null;
  const value = decodeURIComponent(cookie.split('=')[1] || '');
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return null;
};

const writeThemeCookie = (theme: ThemeMode) => {
  if (typeof document === 'undefined') return;
  document.cookie = `${THEME_COOKIE}=${encodeURIComponent(theme)}; Path=/; Max-Age=31536000; SameSite=Lax`;
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: ThemeMode;
}

// Theming is pure CSS: `globals.css` defines every token under `:root` (light)
// and `.dark` (dark). This provider only decides which class is active and
// persists the preference — it does not compute or apply any color values.
export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
}) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    const saved = readThemeCookie();
    if (defaultTheme !== 'system') return defaultTheme;
    return saved || defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getSystemTheme = () => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const updateResolvedTheme = () => {
      const newResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
      setResolvedTheme(newResolvedTheme);
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newResolvedTheme);
      writeThemeCookie(theme);
    };

    updateResolvedTheme();

    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => updateResolvedTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
