/* eslint-disable react-refresh/only-export-components -- theme hook intentionally shares its provider module */
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const STORAGE_KEY = 'attendance-register.theme';
const VALID_THEMES = new Set(['light', 'dark', 'system']);
const ThemeContext = createContext(null);

function readStoredTheme() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    return VALID_THEMES.has(stored) ? stored : 'system';
  } catch {
    return 'system';
  }
}

function resolveTheme(theme) {
  if (theme !== 'system') return theme;
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ThemeProvider({ children }) {
  const [theme, setThemeState] = useState(readStoredTheme);
  const [resolvedTheme, setResolvedTheme] = useState(() => resolveTheme(readStoredTheme()));

  useEffect(() => {
    const apply = () => setResolvedTheme(resolveTheme(theme));
    apply();
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* preference storage is optional */ }
    document.documentElement.dataset.theme = resolveTheme(theme);
    document.documentElement.style.colorScheme = resolveTheme(theme);

    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media || theme !== 'system') return undefined;
    const onChange = () => {
      const next = resolveTheme('system');
      setResolvedTheme(next);
      document.documentElement.dataset.theme = next;
      document.documentElement.style.colorScheme = next;
    };
    media.addEventListener?.('change', onChange);
    return () => media.removeEventListener?.('change', onChange);
  }, [theme]);

  const setTheme = useCallback((nextTheme) => {
    if (VALID_THEMES.has(nextTheme)) setThemeState(nextTheme);
  }, []);

  const value = useMemo(() => ({ theme, resolvedTheme, setTheme }), [theme, resolvedTheme, setTheme]);
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
