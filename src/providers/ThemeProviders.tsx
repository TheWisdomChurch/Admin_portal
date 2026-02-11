// src/providers/ThemeProvider.tsx
'use client';

import { semanticColors } from '@/styles/tokens/semantic';
import React, { useEffect, useState, createContext, useContext } from 'react';

type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: ThemeMode;
  resolvedTheme: 'light' | 'dark';
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  colors: typeof semanticColors.light;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

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

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'system',
}) => {
  const [theme, setTheme] = useState<ThemeMode>(() => {
    if (typeof window === 'undefined') return defaultTheme;
    const saved = localStorage.getItem('theme') as ThemeMode | null;
    return saved || defaultTheme;
  });

  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>('light');

  // Apply CSS variables to document root
  const applyCSSVariables = (themeType: 'light' | 'dark') => {
    if (typeof document === 'undefined') return;

    const root = document.documentElement;
    const colors = semanticColors[themeType];

    // Clear existing variables
    const existingVars = Array.from(root.style).filter((prop) => prop.startsWith('--color-'));
    existingVars.forEach((varName) => root.style.removeProperty(varName));

    // ✅ Type guard: is this a plain object record?
    const isRecord = (v: unknown): v is Record<string, unknown> =>
      typeof v === 'object' && v !== null && !Array.isArray(v);

    // ✅ Flatten nested objects into CSS variables (type-safe)
    const flattenObject = (obj: unknown, prefix = ''): Record<string, string> => {
      const result: Record<string, string> = {};
      if (!isRecord(obj)) return result;

      for (const [key, value] of Object.entries(obj)) {
        const newKey = prefix ? `${prefix}-${key}` : key;

        if (isRecord(value)) {
          Object.assign(result, flattenObject(value, newKey));
        } else if (typeof value === 'string') {
          result[newKey] = value;
        }
      }

      return result;
    };

    // Apply all colors as CSS variables
    const flatColors = flattenObject(colors, 'color');
    Object.entries(flatColors).forEach(([key, value]) => {
      root.style.setProperty(`--${key}`, value);
    });
  };

  // Initialize theme on mount and handle changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const getSystemTheme = () => {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    };

    const updateResolvedTheme = () => {
      const newResolvedTheme = theme === 'system' ? getSystemTheme() : theme;
      setResolvedTheme(newResolvedTheme);

      // Update document class
      document.documentElement.classList.remove('light', 'dark');
      document.documentElement.classList.add(newResolvedTheme);

      // Apply CSS variables
      applyCSSVariables(newResolvedTheme);

      // Store preference
      localStorage.setItem('theme', theme);
    };

    updateResolvedTheme();

    // Listen for system theme changes
    if (theme === 'system') {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      const handler = () => updateResolvedTheme();
      mediaQuery.addEventListener('change', handler);
      return () => mediaQuery.removeEventListener('change', handler);
    }
  }, [theme]);

  const toggleTheme = () => {
    setTheme((current) => (current === 'light' ? 'dark' : 'light'));
  };

  const colors = semanticColors[resolvedTheme];

  const value: ThemeContextType = {
    theme,
    resolvedTheme,
    setTheme,
    toggleTheme,
    colors,
  };

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
