import { createContext, useContext } from "react";
import { colorTokens } from "./colors";

export const semanticColors = {
  light: {
    background: {
      primary: colorTokens.surface.white,
      secondary: colorTokens.surface.light,
      tertiary: colorTokens.surface.muted,
      hover: colorTokens.neutral[100],
      active: colorTokens.neutral[200],
    },
    text: {
      primary: colorTokens.secondary[950],
      secondary: colorTokens.secondary[800],
      tertiary: colorTokens.secondary[600],
      inverse: colorTokens.surface.white,
      disabled: colorTokens.secondary[400],
      onPrimary: colorTokens.surface.white,
    },
    border: {
      primary: colorTokens.neutral[200],
      secondary: colorTokens.neutral[300],
      focus: colorTokens.primary[500],
      error: colorTokens.danger[500],
      success: colorTokens.success[500],
    },
    accent: {
      primary: colorTokens.primary[600],
      primaryHover: colorTokens.primary[700],
      primaryActive: colorTokens.primary[800],
      success: colorTokens.success[600],
      warning: colorTokens.warning[600],
      danger: colorTokens.danger[600],
      muted: colorTokens.neutral[500],
    },
  },
  dark: {
    background: {
      primary: colorTokens.surface.dark,
      secondary: colorTokens.secondary[900],
      tertiary: colorTokens.secondary[800],
      hover: colorTokens.neutral[800],
      active: colorTokens.neutral[700],
    },
    text: {
      primary: colorTokens.secondary[50],
      secondary: colorTokens.secondary[200],
      tertiary: colorTokens.secondary[400],
      inverse: colorTokens.surface.black,
      disabled: colorTokens.secondary[600],
      onPrimary: colorTokens.surface.white,
    },
    border: {
      primary: colorTokens.neutral[700],
      secondary: colorTokens.neutral[600],
      focus: colorTokens.primary[400],
      error: colorTokens.danger[400],
      success: colorTokens.success[400],
    },
    accent: {
      primary: colorTokens.primary[500],
      primaryHover: colorTokens.primary[400],
      primaryActive: colorTokens.primary[600],
      success: colorTokens.success[400],
      warning: colorTokens.warning[400],
      danger: colorTokens.danger[400],
      muted: colorTokens.neutral[500],
    },
  },
};

// ============================================================================
// THEME CONTEXT & PROVIDER
// ============================================================================

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
