// src/screens/LoginScreen.tsx
import React from 'react';
import { Image, StyleSheet } from 'react-native';
import { Surface, Text as PaperText, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { LoginScreenProps } from '../types';

// Import directly from the CommonJS exports
const { GoogleSigninButton } = require('@react-native-google-signin/google-signin');

/**
 * 로그인 화면 컴포넌트
 */
function LoginScreen({ navigation }: LoginScreenProps): React.ReactElement {
  const { signIn, isLoading } = useAuth();

  return (
    <Surface style={styles.loginContainer}>
      <PaperText variant="headlineMedium" style={styles.appTitle}>
        앱 리뷰 분석기
      </PaperText>

      <Image
        source={require('../../assets/app-placeholder.png')}
        style={styles.appLogo}
      />

      <PaperText style={styles.loginText}>
        구글 계정으로 로그인하여 앱 리뷰 분석 서비스를 이용하세요.
      </PaperText>

      {isLoading ? (
        <ActivityIndicator size="large" color="#6200ee" style={{ marginTop: 20 }} />
      ) : (
        <GoogleSigninButton
          style={{ width: 220, height: 60, marginTop: 20 }}
          size={GoogleSigninButton.Size.Wide}
          color={GoogleSigninButton.Color.Dark}
          onPress={signIn}
        />
      )}
    </Surface>
  );
}

const styles = StyleSheet.create({
  loginContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#121212'
  },
  appTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 20,
    color: '#fff'
  },
  appLogo: {
    width: 100,
    height: 100,
    marginBottom: 20
  },
  loginText: {
    fontSize: 16,
    color: '#aaa',
    marginBottom: 20,
    textAlign: 'center'
  },
});

export default LoginScreen;