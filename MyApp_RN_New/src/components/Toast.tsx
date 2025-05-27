// src/components/Toast.tsx
import React, { useEffect, useRef } from 'react';
import { Animated, StyleSheet } from 'react-native';
import { Text as PaperText } from 'react-native-paper';
import { ToastProps } from '../types';

const Toast: React.FC<ToastProps> = ({ visible, message, type = 'info', onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  useEffect(() => {
    if (visible) {
      if (timerRef.current) clearTimeout(timerRef.current);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      timerRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(onDismiss);
      }, 3000);
    }
  }, [visible, fadeAnim, onDismiss]);

  if (!visible) return null;

  const backgroundColor = type === 'error' ? '#FF5252' : type === 'success' ? '#4CAF50' : '#323232';

  return (
    <Animated.View style={[styles.toast, { backgroundColor, opacity: fadeAnim }]}>
      <PaperText style={styles.toastText}>{message}</PaperText>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', 
    bottom: 50, 
    left: 20, 
    right: 20,
    backgroundColor: '#323232', 
    padding: 16, 
    borderRadius: 8,
    elevation: 6, 
    shadowColor: '#000', 
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27, 
    shadowRadius: 4.65, 
    zIndex: 9999
  },
  toastText: { 
    color: '#fff', 
    textAlign: 'center' 
  },
});

export default Toast;