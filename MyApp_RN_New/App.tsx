// App.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { View, Linking } from 'react-native';
import { NavigationContainer, DarkTheme as NavDarkTheme } from '@react-navigation/native';
import { Provider as PaperProvider, MD3DarkTheme as PaperDarkTheme } from 'react-native-paper';
import mobileAds from 'react-native-google-mobile-ads';
import '@react-native-google-signin/google-signin';

// Import components and contexts
import { ToastProvider } from './src/contexts/ToastContext';
import { AuthProvider } from './src/contexts/AuthContext';
import { AppProvider } from './src/contexts/AppContext';
import AuthNavigator from './src/navigation/AuthNavigator';
import AdBanner from './src/components/AdBanner';
import { log } from './src/utils';

// Navigation linking configuration
import { createNavigationContainerRef } from '@react-navigation/native';
import { RootStackParamList } from './src/types';

// Import directly from the CommonJS exports
const { GoogleSignin } = require('@react-native-google-signin/google-signin');

// Initialize navigation ref
const navigationRef = createNavigationContainerRef<RootStackParamList>();

// Initialize mobile ads SDK
mobileAds()
  .initialize()
  .then(() => {
    console.log('Mobile Ads SDK initialized');
  })
  .catch((error: any) => {
    console.error('Mobile Ads initialization error:', error);
  });

// Initialize Google Sign-In
GoogleSignin.configure({
  webClientId: '7253862100-gt5oklb7ikkhogn81kvsibdv45n9nb83.apps.googleusercontent.com',
  offlineAccess: true,
});

// Theme configuration
const CombinedDarkTheme = {
  ...NavDarkTheme,
  ...PaperDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    ...PaperDarkTheme.colors,
    background: '#000000',
    text: '#ffffff',
  },
  fonts: {
    ...PaperDarkTheme.fonts,
    regular: { fontFamily: 'sans-serif', fontWeight: 'normal' },
    medium: { fontFamily: 'sans-serif-medium', fontWeight: 'normal' },
    bold: { fontFamily: 'sans-serif', fontWeight: 'bold' },
    heavy: { fontFamily: 'sans-serif', fontWeight: 'bold' },
  },
};

/**
 * Main App Component
 */
export default function App(): React.ReactElement {
  const [initialUrl, setInitialUrl] = useState<string | null>(null);

  useEffect(() => {
    const getInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        log('초기 URL:', url);
        setInitialUrl(url);
      }
    };

    getInitialURL();
    const subscription = Linking.addEventListener('url', ({ url }) => {
      log('앱 실행 중 수신된 URL:', url);
      setInitialUrl(url);
    });

    return () => { subscription.remove(); };
  }, []);

  const linking = {
    prefixes: ['appreviewanalyzer://', 'https://play.google.com'],
    config: {
      screens: {
        Login: 'login',
        AppList: 'apps',
        Help: 'help',
        Review: 'review/:appId',
        AISummary: 'summary/:appId',
      },
    },
    async getInitialURL() {
      return initialUrl;
    },
  };

  return (
    <ToastProvider>
      <AuthProvider>
        <AppProvider>
          <PaperProvider theme={CombinedDarkTheme}>
            <NavigationContainer theme={CombinedDarkTheme as any} linking={linking as any} ref={navigationRef}>
              <View style={{ flex: 1 }}>
                <AuthNavigator />
                <AdBanner />
              </View>
            </NavigationContainer>
          </PaperProvider>
        </AppProvider>
      </AuthProvider>
    </ToastProvider>
  );
}