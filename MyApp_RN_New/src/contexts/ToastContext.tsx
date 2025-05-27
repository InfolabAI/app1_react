// src/contexts/ToastContext.tsx
import React, { useState, useCallback, useMemo, useContext, createContext } from 'react';
import { ToastContextType, ToastProviderProps } from '../types';
import Toast from '../components/Toast';

// Create context
const ToastContext = createContext<ToastContextType | null>(null);

// Toast provider
export const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' });

  const showToast = useCallback((message: string, type = 'info') => {
    setToast({ visible: true, message, type });
  }, []);

  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  const toastValue = useMemo(() => ({ show: showToast }), [showToast]);

  return (
    <ToastContext.Provider value={toastValue}>
      {children}
      <Toast
        visible={toast.visible}
        message={toast.message}
        type={toast.type}
        onDismiss={hideToast}
      />
    </ToastContext.Provider>
  );
};

// Toast hook
export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export default ToastContext;