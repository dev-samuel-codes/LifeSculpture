import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';

export const ThemeContext = createContext({
  theme: 'light',
  toggleTheme: () => {},
});

const STORAGE_KEY = 'lifesculpture_theme';

const getPreferredTheme = () => {
  if (typeof window === 'undefined') {
    return 'light';
  }

  const storedTheme = window.localStorage.getItem(STORAGE_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  return 'light';
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getPreferredTheme);

  useEffect(() => {
    const handleSystemThemeChange = (event) => {
      const storedTheme = window.localStorage.getItem(STORAGE_KEY);
      if (storedTheme === 'light' || storedTheme === 'dark') {
        return;
      }

      setTheme(event.matches ? 'dark' : 'light');
    };

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleSystemThemeChange);
      return () => {
        mediaQuery.removeEventListener('change', handleSystemThemeChange);
      };
    }

    if (typeof mediaQuery.addListener === 'function') {
      mediaQuery.addListener(handleSystemThemeChange);
      return () => {
        mediaQuery.removeListener(handleSystemThemeChange);
      };
    }

    return () => {};
  }, []);

  useEffect(() => {
    if (typeof document === 'undefined') {
      return;
    }

    const nextTheme = theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.theme = nextTheme;
    document.documentElement.dataset.theme = nextTheme;
    document.documentElement.style.colorScheme = nextTheme;
    window.localStorage.setItem(STORAGE_KEY, nextTheme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
  }, []);

  const value = useMemo(() => ({ theme, toggleTheme }), [theme, toggleTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => React.useContext(ThemeContext);
