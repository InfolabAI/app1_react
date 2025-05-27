// src/contexts/AuthContext.tsx
import React, { useState, useEffect, useContext, createContext } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AuthContextType, ToastProviderProps, UserInfo } from '../types';
import { useToast } from './ToastContext';
import { fetchFromAPI } from '../api/fetchFromAPI';

// Import directly from the CommonJS exports
const { GoogleSignin, statusCodes } = require('@react-native-google-signin/google-signin');

// Create context
const AuthContext = createContext<AuthContextType | null>(null);

// Auth provider
export const AuthProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const toast = useToast();

  useEffect(() => {
    const checkUser = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 체크: 이전 로그인 상태 확인 시작');

        const userString = await AsyncStorage.getItem('@user');
        if (userString) {
          console.log('🔍 체크: 캐시된 사용자 정보 발견');
          const userData = JSON.parse(userString);
          setUser(userData);

          // 서버 검증
          try {
            console.log('🔍 체크: 서버 검증 시도');
            const response = await fetchFromAPI('user_info', {
              google_id: userData.id
            });
            console.log('🔍 체크: 서버 응답', response);
            if (!response.user) {
              console.log('🔍 체크: 서버에 사용자 정보가 없음');
              await AsyncStorage.removeItem('@user');
              setUser(null);
            }
          } catch (error) {
            console.error('🚨 오류: 서버 검증 실패:', error);
          }
        } else {
          console.log('🔍 체크: 캐시된 사용자 정보 없음');
        }
      } catch (error) {
        console.error('🚨 오류: 로그인 상태 확인 오류:', error);
      } finally {
        setIsLoading(false);
      }
    };

    checkUser();
  }, []);

  const signIn = async () => {
    try {
      setIsLoading(true);
      console.log('🔍 로그인: Google Play 서비스 확인 시작');
      await GoogleSignin.hasPlayServices({
        showPlayServicesUpdateDialog: true
      });

      console.log('🔍 로그인: Google 로그인 시도');
      const userInfo = await GoogleSignin.signIn();
      console.log('🔍 로그인: Google 로그인 성공');
      console.log('유저 정보', userInfo);

      const userData: UserInfo = {
        id: userInfo.data.user.id,
        email: userInfo.data.user.email,
        name: userInfo.data.user.name,
        photo: userInfo.data.user.photo || undefined
      };

      // 서버 로그인
      console.log('🔍 로그인: 서버 로그인 시도');
      const response = await fetchFromAPI('user_login', {
        google_id: userData.id,
        email: userData.email
      });
      console.log('🔍 로그인: 서버 응답', response);

      if (response.user) {
        await AsyncStorage.setItem('@user', JSON.stringify(userData));
        setUser(userData);
        toast.show('로그인 되었습니다.', 'success');
      } else {
        console.log('🚨 오류: 서버 응답에 사용자 정보 없음');
        throw new Error('서버에 사용자 정보를 저장하는데 실패했습니다.');
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        console.log('🔍 로그인: 사용자가 로그인 취소');
        toast.show('로그인이 취소되었습니다.', 'info');
      } else if (error.code === statusCodes.IN_PROGRESS) {
        console.log('🔍 로그인: 이미 로그인 진행 중');
        toast.show('이미 로그인 진행 중입니다.', 'info');
      } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        console.log('🚨 오류: Google Play 서비스 사용 불가');
        toast.show('Google Play 서비스를 사용할 수 없습니다.', 'error');
      } else {
        console.error('🚨 오류: 로그인 오류:', error);
        toast.show('로그인 중 오류가 발생했습니다.', 'error');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    try {
      setIsLoading(true);
      console.log('🔍 로그아웃: Google 로그아웃 시도');
      await GoogleSignin.signOut();
      console.log('🔍 로그아웃: 로컬 스토리지 삭제');
      await AsyncStorage.removeItem('@user');
      setUser(null);
      toast.show('로그아웃 되었습니다.', 'success');
    } catch (error) {
      console.error('🚨 오류: 로그아웃 오류:', error);
      toast.show('로그아웃 중 오류가 발생했습니다.', 'error');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

// Auth hook
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;