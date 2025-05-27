// src/contexts/AppContext.tsx
import React, { useState, useCallback, useMemo, createContext, useContext } from 'react';
import { AppContextType } from '../types';

// Create context
const AppContext = createContext<AppContextType | null>(null);

// AppProvider component
export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [refreshFunction, setRefreshFunction] = useState<(() => void) | null>(null);

  const triggerRefresh = useCallback(() => {
    if (refreshFunction) {
      refreshFunction();
    }
  }, [refreshFunction]);

  const appContextValue = useMemo(() => ({
    refreshFunction,
    setRefreshFunction,
    triggerRefresh
  }), [refreshFunction, triggerRefresh]);

  return (
    <AppContext.Provider value={appContextValue}>
      {children}
    </AppContext.Provider>
  );
};

// Custom hook for using AppContext
export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;