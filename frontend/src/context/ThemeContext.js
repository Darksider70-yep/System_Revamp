import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const ThemeProvider = ({ children }) => {
  // Theme: 'light' | 'dark' | 'system'
  const [theme, setTheme] = useState(() => {
    return localStorage.getItem('sr_theme') || 'system';
  });

  // Effective theme: 'light' | 'dark'
  const [effectiveTheme, setEffectiveTheme] = useState('light');

  // Density: 'comfortable' | 'compact'
  const [density, setDensity] = useState(() => {
    return localStorage.getItem('sr_density') || 'comfortable';
  });

  // Presentation Mode: boolean
  const [presentationMode, setPresentationMode] = useState(() => {
    return localStorage.getItem('sr_presentation_mode') === 'true';
  });

  // Simulated Data indicator: boolean
  const [isSimulatedData, setIsSimulatedData] = useState(false);

  // Global Scope: { orgId: null, siteId: null, labId: null, labName: 'All Fleet' }
  const [scope, setScope] = useState({
    orgId: null,
    siteId: null,
    labId: null,
    name: 'All Fleet',
  });

  // Global Search Query
  const [globalSearch, setGlobalSearch] = useState('');

  // Handle System Theme changes
  useEffect(() => {
    const updateTheme = () => {
      let resolved = theme;
      if (theme === 'system') {
        const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        resolved = prefersDark ? 'dark' : 'light';
      }
      setEffectiveTheme(resolved);
      document.documentElement.setAttribute('data-theme', resolved);
    };

    updateTheme();
    localStorage.setItem('sr_theme', theme);

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    const handleChange = () => {
      if (theme === 'system') updateTheme();
    };
    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme]);

  // Handle Density changes
  useEffect(() => {
    document.documentElement.setAttribute('data-density', density);
    localStorage.setItem('sr_density', density);
  }, [density]);

  // Handle Presentation Mode changes
  useEffect(() => {
    document.documentElement.setAttribute('data-presentation', String(presentationMode));
    localStorage.setItem('sr_presentation_mode', String(presentationMode));
  }, [presentationMode]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'light' ? 'dark' : prev === 'dark' ? 'system' : 'light'));
  };

  const toggleDensity = () => {
    setDensity((prev) => (prev === 'comfortable' ? 'compact' : 'comfortable'));
  };

  const togglePresentationMode = () => {
    setPresentationMode((prev) => !prev);
  };

  // Auto-Refresh: interval in seconds (default: 5). 0 means paused/off.
  const [autoRefreshInterval, setAutoRefreshInterval] = useState(() => {
    const saved = localStorage.getItem('sr_auto_refresh_interval');
    return saved !== null ? Number(saved) : 5;
  });

  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshedAt, setLastRefreshedAt] = useState(new Date());
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Persist auto-refresh interval preference
  useEffect(() => {
    localStorage.setItem('sr_auto_refresh_interval', String(autoRefreshInterval));
  }, [autoRefreshInterval]);

  const triggerRefresh = React.useCallback(() => {
    setIsRefreshing(true);
    setRefreshKey((prev) => prev + 1);
    setLastRefreshedAt(new Date());
    setTimeout(() => setIsRefreshing(false), 600);
  }, []);

  // Interval timer for auto-refresh
  useEffect(() => {
    if (!autoRefreshInterval || autoRefreshInterval <= 0) return;

    const timer = setInterval(() => {
      triggerRefresh();
    }, autoRefreshInterval * 1000);

    return () => clearInterval(timer);
  }, [autoRefreshInterval, triggerRefresh]);

  // Window focus listener for instant refresh when returning to tab
  useEffect(() => {
    const handleFocus = () => {
      triggerRefresh();
    };
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [triggerRefresh]);

  return (
    <ThemeContext.Provider
      value={{
        theme,
        setTheme,
        effectiveTheme,
        toggleTheme,
        density,
        setDensity,
        toggleDensity,
        presentationMode,
        togglePresentationMode,
        isSimulatedData,
        setIsSimulatedData,
        scope,
        setScope,
        globalSearch,
        setGlobalSearch,
        autoRefreshInterval,
        setAutoRefreshInterval,
        refreshKey,
        lastRefreshedAt,
        isRefreshing,
        triggerRefresh,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};
