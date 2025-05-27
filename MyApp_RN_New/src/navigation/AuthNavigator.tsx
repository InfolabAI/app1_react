// src/navigation/AuthNavigator.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text as PaperText, ActivityIndicator } from 'react-native-paper';
import { useAuth } from '../contexts/AuthContext';
import { RootStackParamList } from '../types';

// 화면 컴포넌트 import
import LoginScreen from '../screens/LoginScreen';
import AppListScreen from '../screens/AppListScreen';
import HelpScreen from '../screens/HelpScreen';
import ReviewScreen from '../screens/ReviewScreen';
import AISummaryScreen from '../screens/AISummaryScreen';
import SamplingDemoScreen from '../screens/SamplingDemoScreen';

// Stack 네비게이터 생성
const Stack = createNativeStackNavigator<RootStackParamList>();

/**
 * 인증 상태에 따른 네비게이션 처리 컴포넌트
 */
function AuthNavigator() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <PaperText style={{ marginTop: 16 }}>로딩 중...</PaperText>
      </View>
    );
  }

  return (
    <Stack.Navigator initialRouteName={user ? "AppList" : "Login"}>
      {!user ? (
        <Stack.Screen
          name="Login"
          component={LoginScreen}
          options={{
            title: '로그인',
            headerShown: false
          }}
        />
      ) : (
        <>
          <Stack.Screen name="AppList" component={AppListScreen} options={{ title: '앱 목록' }} />
          <Stack.Screen name="Help" component={HelpScreen} options={{ title: '앱 추가' }} />
          <Stack.Screen name="Review" component={ReviewScreen} options={{ title: '앱 리뷰' }} />
          <Stack.Screen name="AISummary" component={AISummaryScreen} options={{ title: 'AI 요약' }} />
          <Stack.Screen name="SamplingDemo" component={SamplingDemoScreen} options={{ title: '리뷰 샘플링 데모' }} />
        </>
      )}
    </Stack.Navigator>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#121212' 
  },
});

export default AuthNavigator;