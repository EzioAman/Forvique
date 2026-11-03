'use client';

import React, { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';

export type Theme = 'system' | 'light' | 'dark';

interface ThemeContextType {
  theme: Theme;
  setTheme: (theme: Theme) => void;
  resolvedTheme: 'light' | 'dark';
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

function subscribeTheme(callback: () => void) {
  window.addEventListener('storage', callback);
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
  mediaQuery.addEventListener('change', callback);
  return () => {
    window.removeEventListener('storage', callback);
    mediaQuery.removeEventListener('change', callback);
  };
}

function getStoredTheme(): Theme {
  try {
    const stored = (localStorage.getItem('theme') || document.documentElement.getAttribute('data-theme')) as Theme | null;
    return stored && ['system', 'light', 'dark'].includes(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function getSystemIsDark(): boolean {
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches;
  } catch {
    return false;
  }
}

function getServerTheme(): Theme {
  return 'system';
}

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const currentStoreTheme = useSyncExternalStore<Theme>(subscribeTheme, getStoredTheme, getServerTheme);
  const systemIsDark = useSyncExternalStore(subscribeTheme, getSystemIsDark, () => false);

  const [theme, setThemeState] = useState<Theme>(currentStoreTheme);
  const resolvedTheme: 'light' | 'dark' = theme === 'dark' || (theme === 'system' && systemIsDark) ? 'dark' : 'light';

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute('data-theme', theme);
    if (resolvedTheme === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.remove('dark');
      root.classList.add('light');
    }
  }, [theme, resolvedTheme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    try {
      localStorage.setItem('theme', newTheme);
    } catch {
      // localStorage may fail in restricted/private browsing
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme, resolvedTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
