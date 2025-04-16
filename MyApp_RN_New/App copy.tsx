// App.tsx
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, createContext, useContext, useMemo } from 'react';
import {
  View, ScrollView, Share, FlatList, TouchableOpacity, StyleSheet, Image,
  Clipboard, RefreshControl, Animated, Linking, Alert
} from 'react-native';
import {
  NavigationContainer, DarkTheme as NavDarkTheme, useNavigation,
  createNavigationContainerRef, NavigationProp, RouteProp
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import {
  Provider as PaperProvider, Text as PaperText, TextInput as PaperTextInput,
  Button as PaperButton, MD3DarkTheme as PaperDarkTheme, ActivityIndicator,
  Menu, IconButton, Surface, Avatar, Appbar, Dialog, Portal, Divider
} from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import axios from 'axios';
import cheerio from 'react-native-cheerio';
import { generateAndSharePDF } from './utils/pdfGenerator';
import mobileAds, { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import '@react-native-google-signin/google-signin';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import directly from the CommonJS exports
const { GoogleSignin, GoogleSigninButton, statusCodes } = require('@react-native-google-signin/google-signin');

// Type definitions
type AppContextType = {
  refreshFunction: (() => void) | null;
  setRefreshFunction: React.Dispatch<React.SetStateAction<(() => void) | null>>;
  triggerRefresh: () => void;
};

// Auth context type definition
type UserInfo = {
  id: string;
  email: string;
  name?: string;
  photo?: string;
};

type AuthContextType = {
  user: UserInfo | null;
  isLoading: boolean;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
};

type ToastContextType = { show: (message: string, type?: string) => void; };
type ToastProps = { visible: boolean; message: string; type?: string; onDismiss: () => void; };
type ToastProviderProps = { children: React.ReactNode; };
type AppItem = { id: string; name: string; icon: string; };
type Review = { date: string; score: number; content: string; username: string; };

// Navigation types
type RootStackParamList = {
  Login: undefined;
  AppList: {
    refreshTrigger?: number;
    extractedPackageId?: string;
    extractedAppName?: string;
    extractedAppIcon?: string;
    searchQuery?: string;
  };
  Help: undefined;
  Review: { appId: string; appName: string; appIcon: string; };
  AISummary: { appId: string; appName: string; };
};

// Context creation
const AppContext = createContext<AppContextType | null>(null);
const ToastContext = createContext<ToastContextType | null>(null);
const AuthContext = createContext<AuthContextType | null>(null);
const DEBUG = false;
const log = (...args: any[]): void => { if (DEBUG) console.log('[DEBUG]', ...args); };

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
// Google Sign-In 설정 수정
GoogleSignin.configure({
  // Android 디바이스를 위한 웹 클라이언트 ID 설정
  webClientId: '7253862100-gt5oklb7ikkhogn81kvsibdv45n9nb83.apps.googleusercontent.com',
  // iOS 디바이스를 위한 iOS 클라이언트 ID (필요한 경우)
  // iosClientId: 'YOUR_IOS_CLIENT_ID.apps.googleusercontent.com',
  offlineAccess: true,
  //forceCodeForRefreshToken: true, // 인증 코드 강제 새로고침
  //accountName: '', // 특정 계정으로 자동 선택 (선택 사항)
  //scopes: ['profile', 'email'],
  // 구글 Play 서비스 사용 불가 시 에러 핸들링 방식 설정
  //hostedDomain: '', // 특정 도메인으로 제한 (선택 사항)
  // 개발 모드에서 Google 웹 로그인 사용 (선택 사항)
  //uxMode: 'POPUP', // REDIRECT 또는 POPUP
}); //

// Use test ad unit ID in development, replace with actual ID in production
const adUnitId = __DEV__ ? TestIds.BANNER : 'ca-app-pub-7838208657677503/6303324511'; // TestIds.BANNER 라는 구글에서 제공하는 test ID 를 사용하다가 실제 앱 배포시에는 실제 앱의 광고단위 아이디를 사용.

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

const Stack = createNativeStackNavigator<RootStackParamList>();
const navigationRef = createNavigationContainerRef<RootStackParamList>();
const API_URL = 'https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF';

// Toast component
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
  }, [visible, fadeAnim]);

  if (!visible) return null;

  const backgroundColor = type === 'error' ? '#FF5252' : type === 'success' ? '#4CAF50' : '#323232';

  return (
    <Animated.View style={[styles.toast, { backgroundColor, opacity: fadeAnim }]}>
      <PaperText style={styles.toastText}>{message}</PaperText>
    </Animated.View>
  );
};

// Toast provider
const ToastProvider: React.FC<ToastProviderProps> = ({ children }) => {
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
const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

// Auth provider with enhanced debugging
const AuthProvider: React.FC<ToastProviderProps> = ({ children }) => {
  const [user, setUser] = useState<UserInfo | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const toast = useToast();

  // Check if user is already logged in
  useEffect(() => {
    const checkUser = async () => {
      try {
        setIsLoading(true);
        console.log('🔍 체크: 이전 로그인 상태 확인 시작');
        // Check for cached user
        const userString = await AsyncStorage.getItem('@user');
        if (userString) {
          console.log('🔍 체크: 캐시된 사용자 정보 발견');
          const userData = JSON.parse(userString);
          setUser(userData);

          // Verify with the server
          try {
            console.log('🔍 체크: 서버 검증 시도');
            const response = await fetchFromAPI('user_info', {
              google_id: userData.id
            });
            console.log('🔍 체크: 서버 응답', response);
            if (!response.user) {
              console.log('🔍 체크: 서버에 사용자 정보가 없음');
              // User not found on server, clear local storage
              await AsyncStorage.removeItem('@user');
              setUser(null);
            }
          } catch (error) {
            console.error('🚨 오류: 서버 검증 실패:', error);
            // Keep the user signed in even if server validation fails
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
        // 서비스 사용 불가 시 설치/업데이트 다이얼로그 표시
        showPlayServicesUpdateDialog: true
      });

      console.log('🔍 로그인: Google 로그인 시도');
      const userInfo = await GoogleSignin.signIn();
      console.log('🔍 로그인: Google 로그인 성공');
      console.log('유저 정보', userInfo);
      console.log('유저 정보 중 user 정보', userInfo.data.user);

      // userInfo is correctly typed by the library
      const userData: UserInfo = {
        id: userInfo.data.user.id,
        email: userInfo.data.user.email,
        name: userInfo.data.user.name,
        photo: userInfo.data.user.photo || undefined
      };

      //setUser(userData);

      // Save to server
      try {
        console.log('🔍 로그인: 서버 로그인 시도');
        const response = await fetchFromAPI('user_login', {
          google_id: userData.id,
          email: userData.email
        });
        console.log('🔍 로그인: 서버 응답', response);

        if (response.user) {
          // Save to local storage
          console.log('🔍 로그인: 로컬 스토리지에 사용자 정보 저장');
          await AsyncStorage.setItem('@user', JSON.stringify(userData));
          setUser(userData);
          toast.show('로그인 되었습니다.', 'success');
        } else {
          console.log('🚨 오류: 서버 응답에 사용자 정보 없음');
          throw new Error('서버에 사용자 정보를 저장하는데 실패했습니다.');
        }
      } catch (error) {
        console.error('🚨 오류: 서버 로그인 오류:', error);
        console.log('🔍 로그인: 구글 로그아웃 시도');
        toast.show('서버 통신 중 오류가 발생했습니다.', 'error');
        // Sign out from Google as server login failed
        await GoogleSignin.signOut();
      }
    } catch (error: any) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) {
        // user cancelled the login flow
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
const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// API functions
const fetchFromAPI = async (requestType: string, params = {}) => {
  console.log(`🔍 API 요청: ${requestType}`, params);

  try {
    // Ensure request_type is properly included in the request body
    const requestBody = {
      request_type: requestType,
      ...params
    };

    console.log(`🔍 API 요청 본문:`, JSON.stringify(requestBody));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    console.log(`🔍 API 응답 상태: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🚨 API 오류 (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`🔍 API 응답 데이터:`, data);
    return data;
  } catch (error) {
    console.error(`🚨 API 요청 실패 (${requestType}):`, error);
    // 원본 오류를 그대로 던져서 상위에서 처리할 수 있게 함
    throw error;
  }
};

/**
 * 0) LoginScreen
 */
function LoginScreen({ navigation }: { navigation: NavigationProp<RootStackParamList, 'Login'> }): React.ReactElement {
  const { signIn, isLoading } = useAuth();

  return (
    <Surface style={styles.loginContainer}>
      <PaperText variant="headlineMedium" style={styles.appTitle}>
        앱 리뷰 분석기
      </PaperText>

      <Image
        source={require('./assets/app-placeholder.png')}
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

/** 
 * 2) AppListScreen 
 */
function AppListScreen({ navigation, route }: {
  navigation: NavigationProp<RootStackParamList, 'AppList'>,
  route: RouteProp<RootStackParamList, 'AppList'>
}): React.ReactElement {
  const appContext = useContext(AppContext);
  const toast = useToast();
  const { user, signOut } = useAuth();
  const [appList, setAppList] = useState<AppItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [initialLoadDone, setInitialLoadDone] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filteredAppList, setFilteredAppList] = useState<AppItem[]>([]);
  const [settingsMenuVisible, setSettingsMenuVisible] = useState<boolean>(false);
  const [logoutConfirmVisible, setLogoutConfirmVisible] = useState<boolean>(false);

  const isRefreshingRef = useRef<boolean>(false);
  const lastRefreshTimeRef = useRef<number>(0);
  const toastRef = useRef(toast);
  const lastRefreshTriggerRef = useRef<number | null>(null);
  const appContextRef = useRef(appContext);
  const prevRouteParamsRef = useRef<{
    extractedPackageId?: string;
    extractedAppName?: string;
    extractedAppIcon?: string;
    searchQuery?: string;
  }>({});

  useEffect(() => { toastRef.current = toast; }, [toast]);
  useEffect(() => { appContextRef.current = appContext; }, [appContext]);

  const fetchAppList = useCallback(async () => {
    if (isRefreshingRef.current) return Promise.resolve();

    try {
      log('앱 목록 가져오기 시작');
      setLoading(true);
      setRefreshing(true);
      isRefreshingRef.current = true;

      const data = await fetchFromAPI('app_info_read');
      log('API 응답 데이터:', data);

      const apps = data.apps || [];
      const formattedApps = apps.map((app: any) => ({
        id: app.app_id,
        name: app.app_name,
        icon: app.app_logo || 'https://via.placeholder.com/180'
      }));

      setAppList(formattedApps);
      setFilteredAppList(formattedApps);
      log('앱 목록 업데이트 완료:', formattedApps.length);

    } catch (err: any) {
      console.error('앱 목록 가져오기 오류:', err);
      setError(err.message);
      toastRef.current.show('앱 목록을 가져오는데 실패했습니다.', 'error');
    } finally {
      setLoading(false);
      setRefreshing(false);
      isRefreshingRef.current = false;
    }
    return Promise.resolve();
  }, []);

  const handleRefreshRef = useRef<() => Promise<void>>(async () => {
    log('handleRefresh 초기화되지 않음');
  });

  useEffect(() => {
    handleRefreshRef.current = async () => {
      log('handleRefresh 호출됨');
      if (refreshing || isRefreshingRef.current) {
        log('이미 새로고침 중 - 요청 무시');
        return;
      }

      const now = Date.now();
      if (now - lastRefreshTimeRef.current < 10000) {
        const remainingTime = Math.floor((10000 - (now - lastRefreshTimeRef.current)) / 1000);
        toastRef.current.show(`${remainingTime}초 후에 새로고침 가능합니다.`, 'info');
        return;
      }

      lastRefreshTimeRef.current = now;

      try {
        setRefreshing(true);
        isRefreshingRef.current = true;
        await fetchAppList();
        toastRef.current.show('앱 목록이 새로고침되었습니다.', 'success');
      } catch (error: any) {
        console.error('새로고침 오류:', error);
      } finally {
        setRefreshing(false);
        isRefreshingRef.current = false;
      }
    };
  }, [refreshing, fetchAppList]);

  useEffect(() => {
    log('AppListScreen 마운트됨 - 초기 데이터 로드');
    let isMounted = true;

    const initialLoad = async () => {
      try {
        await fetchAppList();
      } finally {
        if (isMounted) {
          setInitialLoadDone(true);
          log('초기 데이터 로딩 완료');
        }
      }
    };

    initialLoad();
    return () => { isMounted = false; };
  }, [fetchAppList]);

  useEffect(() => {
    if (route.params?.refreshTrigger &&
      route.params.refreshTrigger !== lastRefreshTriggerRef.current) {
      log('새로운 refreshTrigger 감지됨:', route.params.refreshTrigger);
      lastRefreshTriggerRef.current = route.params.refreshTrigger;
      handleRefreshRef.current();
    }
  }, [route.params?.refreshTrigger]);

  useFocusEffect(
    useCallback(() => {
      log('AppListScreen 포커스됨');
      if (initialLoadDone) {
        log('새로고침 함수 설정 완료');
        setTimeout(() => {
          if (appContextRef.current?.setRefreshFunction) {
            appContextRef.current.setRefreshFunction(() => handleRefreshRef.current());
          }
        }, 0);
      }

      return () => {
        log('AppListScreen 포커스 해제');
        setTimeout(() => {
          if (appContextRef.current?.setRefreshFunction) {
            appContextRef.current.setRefreshFunction(null);
          }
        }, 0);
      };
    }, [initialLoadDone])
  );

  useEffect(() => {
    if (searchQuery.trim() === '') {
      setFilteredAppList(appList);
    } else {
      const lowerCaseQuery = searchQuery.toLowerCase();
      const filtered = appList.filter(app =>
        app.name.toLowerCase().includes(lowerCaseQuery) ||
        app.id.toLowerCase().includes(lowerCaseQuery)
      );
      setFilteredAppList(filtered);
    }
  }, [searchQuery, appList]);

  useEffect(() => {
    const currentExtractedId = route.params?.extractedPackageId;
    const prevExtractedId = prevRouteParamsRef.current.extractedPackageId;

    if (currentExtractedId && currentExtractedId !== prevExtractedId) {
      const appId = currentExtractedId;
      const appName = route.params?.extractedAppName || `앱 (${appId})`;
      const appIcon = route.params?.extractedAppIcon || 'https://via.placeholder.com/180';

      setAppList(prevList => {
        if (prevList.some(app => app.id === appId)) return prevList;
        return [...prevList, { id: appId, name: appName, icon: appIcon }];
      });

      setTimeout(() => {
        toastRef.current.show(`"${appName}" 앱이 추가되었습니다.`, 'success');
      }, 1);
    }

    const currentSearchQuery = route.params?.searchQuery;
    const prevSearchQuery = prevRouteParamsRef.current.searchQuery;

    if (currentSearchQuery && currentSearchQuery !== prevSearchQuery) {
      setSearchQuery(currentSearchQuery);
    }

    prevRouteParamsRef.current = { ...route.params };
  }, [route.params]);

  const handleClearSearch = () => setSearchQuery('');

  const handleShowSettings = () => setSettingsMenuVisible(true);
  const handleHideSettings = () => setSettingsMenuVisible(false);

  const handleLogoutPress = () => {
    setSettingsMenuVisible(false);
    setLogoutConfirmVisible(true);
  };

  const handleConfirmLogout = async () => {
    setLogoutConfirmVisible(false);
    await signOut();
  };

  const renderItem = ({ item }: { item: AppItem }) => (
    <View style={styles.itemRowContainer}>
      <Image
        source={{ uri: item.icon }}
        style={styles.appIcon}
        defaultSource={require('./assets/app-placeholder.png')}
      />
      <View style={{ flex: 1 }}>
        <PaperText style={styles.appName}>{item.name}</PaperText>
        <PaperText style={styles.appId}>{item.id}</PaperText>
      </View>
      <PaperButton
        mode="contained"
        onPress={() => {
          navigation.navigate('Review', {
            appId: item.id, appName: item.name, appIcon: item.icon,
          });
        }}
        style={{ marginHorizontal: 8 }}
      >
        리뷰 보기
      </PaperButton>
    </View>
  );

  const EmptySearchResult = () => (
    <View style={styles.emptyContainer}>
      <PaperText style={styles.emptyText}>검색 결과가 없습니다.</PaperText>
      <PaperText style={styles.emptySubText}>
        다른 검색어를 입력하거나 플레이스토어에서 앱을 추가해보세요.
      </PaperText>
      <PaperButton mode="outlined" onPress={handleClearSearch} style={styles.clearSearchButton}>
        검색어 지우기
      </PaperButton>
    </View>
  );

  const EmptyListComponent = () => (
    <View style={styles.emptyContainer}>
      <PaperText style={styles.emptyText}>아직 추가된 앱이 없습니다.</PaperText>
      <PaperText style={styles.emptySubText}>
        아래 버튼을 눌러 구글 플레이스토어에서 앱을 추가해보세요.
      </PaperText>
    </View>
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <PaperText style={styles.loadingText}>앱 목록을 불러오는 중...</PaperText>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <PaperText style={styles.errorText}>{error}</PaperText>
        <PaperButton
          mode="contained"
          onPress={() => fetchAppList()}
          style={styles.retryButton}
        >
          다시 시도
        </PaperButton>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* User Profile Section */}
      <View style={styles.userProfileContainer}>
        <View style={styles.userInfoRow}>
          <View style={styles.userInfoContent}>
            {user?.photo ? (
              <Avatar.Image size={32} source={{ uri: user.photo }} style={styles.userAvatar} />
            ) : (
              <Avatar.Icon size={32} icon="account" style={styles.userAvatar} />
            )}
            <PaperText style={styles.userNameText}>
              {user?.name || '사용자'}님 환영합니다
            </PaperText>
          </View>
          <IconButton
            icon="cog"
            mode="contained"
            size={20}
            onPress={handleShowSettings}
            style={styles.settingsButton}
          />
        </View>
        <Divider style={styles.userDivider} />
      </View>

      <View style={styles.searchContainer}>
        <PaperTextInput
          label="앱 이름 또는 ID로 검색"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholder="검색어를 입력하세요"
          left={<PaperTextInput.Icon icon="magnify" />}
          right={searchQuery ? <PaperTextInput.Icon icon="close" onPress={handleClearSearch} /> : null}
        />
      </View>

      <View style={styles.addButtonContainer}>
        <View style={styles.addButtonRow}>
          <PaperButton
            mode="contained"
            icon="plus"
            onPress={() => navigation.navigate('Help')}
            style={[styles.addButton, { flex: 1, marginRight: 8 }]}
          >
            구글 플레이스토어에서 가져오기
          </PaperButton>
          <IconButton
            icon="refresh"
            mode="contained"
            onPress={() => handleRefreshRef.current()}
            loading={refreshing}
            disabled={refreshing}
            style={styles.refreshIconButton}
          />
        </View>
      </View>

      {searchQuery.trim() !== '' && (
        <View style={styles.searchResultInfo}>
          <PaperText style={styles.searchResultText}>
            검색 결과: {filteredAppList.length}개의 앱
          </PaperText>
        </View>
      )}

      <FlatList
        data={filteredAppList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        ListEmptyComponent={searchQuery.trim() !== '' ? EmptySearchResult : EmptyListComponent}
        contentContainerStyle={filteredAppList.length === 0 ? { flex: 1 } : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => handleRefreshRef.current()}
            colors={['#6200ee']}
          />
        }
      />

      {/* Settings Menu */}
      <Menu
        visible={settingsMenuVisible}
        onDismiss={handleHideSettings}
        anchor={{ x: 0, y: 0 }}
        style={styles.settingsMenu}
      >
        <Menu.Item
          leadingIcon="logout"
          onPress={handleLogoutPress}
          title="로그아웃"
        />
      </Menu>

      {/* Logout Confirmation Dialog */}
      <Portal>
        <Dialog visible={logoutConfirmVisible} onDismiss={() => setLogoutConfirmVisible(false)}>
          <Dialog.Title>로그아웃</Dialog.Title>
          <Dialog.Content>
            <PaperText>정말 로그아웃 하시겠습니까?</PaperText>
          </Dialog.Content>
          <Dialog.Actions>
            <PaperButton onPress={() => setLogoutConfirmVisible(false)}>취소</PaperButton>
            <PaperButton onPress={handleConfirmLogout}>로그아웃</PaperButton>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
}

/** 
 * 3) HelpScreen
 */
function HelpScreen({ navigation }: {
  navigation: NavigationProp<RootStackParamList, 'Help'>
}): React.ReactElement {
  const toast = useToast();
  const [playStoreLink, setPlayStoreLink] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  useEffect(() => {
    const getInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) handleIncomingLink(url);
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingLink(url);
    });

    getInitialUrl();
    return () => { subscription.remove(); };
  }, []);

  const handleIncomingLink = async (url: string) => {
    console.log('받은 URL:', url);
    try {
      setProcessing(true);
      const match = url.match(/id=([^&]+)/);
      if (match && match[1]) {
        await fetchAppInfo(match[1]);
      } else {
        toast.show("유효한 구글 플레이스토어 링크가 아닙니다.", "error");
      }
    } catch (error) {
      console.error('링크 처리 오류:', error);
      toast.show("링크를 처리하는 중 문제가 발생했습니다.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleManualLink = async () => {
    if (!playStoreLink) {
      toast.show("링크를 입력해주세요.", "error");
      return;
    }

    try {
      setProcessing(true);
      let match = playStoreLink.match(/[?&]id=([^&]+)/);

      if (!match) {
        match = playStoreLink.match(/apps\/details\/?id=([^&\s]+)/);
      }

      if (!match && playStoreLink.includes('.')) {
        match = ['', playStoreLink.trim()];
      }

      if (match && match[1]) {
        await fetchAppInfo(match[1]);
      } else {
        toast.show("유효한 구글 플레이스토어 링크나 패키지명이 아닙니다.", "error");
      }
    } catch (error) {
      console.error('링크 처리 오류:', error);
      toast.show("링크를 처리하는 중 문제가 발생했습니다.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const fetchAppInfo = async (appId: string) => {
    try {
      const url = `https://play.google.com/store/apps/details?id=${appId}&hl=ko`;
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);

      let appName = '';
      const metaTitle = $('meta[property="og:title"]').attr('content');
      if (metaTitle) {
        appName = metaTitle.split(' - ')[0].trim();
      }

      let iconUrl = '';
      const metaImage = $('meta[property="og:image"]').attr('content');
      if (metaImage) {
        iconUrl = metaImage;
      }

      if (!appName) appName = `앱 (${appId})`;
      if (!iconUrl) iconUrl = 'https://via.placeholder.com/180';

      const result = await fetchFromAPI('app_info_add', {
        app_id: appId,
        app_name: appName,
        app_logo: iconUrl
      });

      console.log('app_add_result:', result);
      if (result.success) {
        if (result.message && result.message.includes('이미 존재')) {
          toast.show("이미 추가된 앱입니다. 앱 목록에서 검색해보세요.", "info");
          navigation.navigate('AppList', { searchQuery: appId });
          return;
        }
        navigation.navigate('AppList', {
          extractedPackageId: appId,
          extractedAppName: appName,
          extractedAppIcon: iconUrl
        });
        return;
      }
      throw new Error(result.message || '앱 정보 등록에 실패했습니다.');

    } catch (error: any) {
      console.error('앱 정보 가져오기 오류:', error);
      let errorMessage = "앱 정보를 가져오는 중 오류가 발생했습니다.";

      if (error.response) {
        errorMessage = `서버 오류: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = "서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.";
      } else {
        errorMessage = error.message || "앱 정보를 가져오는 중 오류가 발생했습니다.";
      }

      toast.show(errorMessage, "error");
    }
  };

  const handleOpenPlayStore = () => {
    Linking.openURL('market://search?q=앱')
      .catch((err) => {
        console.warn("스토어 앱을 열 수 없습니다:", err);
        Linking.openURL('https://play.google.com/store');
      });
  };

  useEffect(() => {
    const validateAndProcessLink = async () => {
      if (!playStoreLink) return;

      try {
        let match = playStoreLink.match(/[?&]id=([^&]+)/);
        if (!match) match = playStoreLink.match(/apps\/details\/?id=([^&\s]+)/);
        if (!match && playStoreLink.includes('.')) match = ['', playStoreLink.trim()];

        if (match && match[1]) {
          const extractedId = match[1];
          await fetchAppInfo(extractedId);
        } else {
          toast.show("올바른 구글 플레이스토어 링크나 패키지명을 입력해주세요.", "error");
        }
      } catch (error) {
        console.error('링크 처리 오류:', error);
        toast.show("올바른 구글 플레이스토어 링크나 패키지명을 입력해주세요.", "error");
      }
    };

    const timeoutId = setTimeout(validateAndProcessLink, 1000);
    return () => clearTimeout(timeoutId);
  }, [playStoreLink]);

  const InstructionStep = ({ number, title, description }: {
    number: string, title: string, description: string
  }) => (
    <View style={styles.instructionStep}>
      <View style={styles.stepNumber}>
        <PaperText style={styles.stepNumberText}>{number}</PaperText>
      </View>
      <View style={styles.stepContent}>
        <PaperText style={styles.stepTitle}>{title}</PaperText>
        <PaperText style={styles.stepDescription}>{description}</PaperText>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.helpContainer}
      contentContainerStyle={styles.helpContentContainer}
      showsVerticalScrollIndicator={false}
    >
      {processing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <PaperText style={styles.loadingText}>앱 정보를 가져오는 중...</PaperText>
        </View>
      ) : (
        <>
          <View style={styles.linkInputContainer}>
            <PaperText style={styles.instructionText}>
              구글 플레이스토어 앱 링크를 붙여넣거나, 패키지명(예: com.kakao.talk)을 직접 입력하면 자동으로 추가됩니다.
            </PaperText>

            <View style={styles.linkInputRow}>
              <PaperTextInput
                label="플레이스토어 링크 또는 패키지명"
                value={playStoreLink}
                onChangeText={setPlayStoreLink}
                placeholder="https://play.google.com/store/apps/details?id=..."
                style={styles.linkInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <IconButton
                icon="google-play"
                mode="contained"
                onPress={handleOpenPlayStore}
                style={styles.playStoreIconButton}
              />
            </View>
          </View>

          <PaperText style={styles.sectionTitle}>플레이스토어 앱 연동</PaperText>
          <View style={styles.instructionContainer}>
            <InstructionStep
              number="1"
              title="구글 플레이스토어 열기"
              description="오른쪽의 구글 플레이스토어 아이콘을 눌러 스토어를 엽니다."
            />
            <InstructionStep
              number="2"
              title="원하는 앱 찾기"
              description="스토어에서 추가하고 싶은 앱을 검색하고 앱 페이지로 이동합니다."
            />
            <InstructionStep
              number="3"
              title="앱 공유하기"
              description="앱 페이지 우측 상단의 메뉴(⋮)를 눌러 '공유'를 선택합니다."
            />
            <InstructionStep
              number="4"
              title="링크 복사하기"
              description="공유 메뉴에서 '링크 복사'를 선택하고, 위 입력창에 붙여넣은 후 '앱 추가하기' 버튼을 누릅니다."
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

/**
 * 4) ReviewScreen
 */
function ReviewScreen({ route }: {
  route: RouteProp<RootStackParamList, 'Review'>
}): React.ReactElement {
  const toast = useToast();
  const { appId, appName, appIcon } = route.params;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = await fetchFromAPI('app_review_read', { app_id: appId });

      if (data && data.reviews && Array.isArray(data.reviews)) {
        const formattedReviews = data.reviews.map((review: any) => ({
          date: new Date(review.date).toLocaleDateString(),
          score: review.score,
          content: review.content,
          username: review.username || '익명'
        }));

        setReviews(formattedReviews);

        if (data.new_reviews_added) {
          toast.show("새로운 리뷰가 추가되었습니다.", "info");
        }
      } else {
        console.error('잘못된 응답 형식:', data);
        throw new Error('리뷰 데이터 형식이 올바르지 않습니다.');
      }
    } catch (err: any) {
      console.error('리뷰 가져오기 오류:', err);
      setError(true);
      toast.show(err.message || "리뷰를 가져오는 중 문제가 발생했습니다.", "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReviews();
  }, [appId]);

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <PaperText style={{ marginBottom: 8 }}>로딩 중...</PaperText>
        <ActivityIndicator animating />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <PaperText variant="titleLarge" style={{ textAlign: 'center', margin: 20 }}>
          리뷰를 불러오는데 실패했습니다
        </PaperText>
        <PaperButton
          mode="contained"
          onPress={() => { setError(false); setLoading(true); fetchReviews(); }}
          style={styles.retryButton}
        >
          다시 시도
        </PaperButton>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Image
          source={{ uri: appIcon }}
          style={styles.headerAppIcon}
          defaultSource={require('./assets/app-placeholder.png')}
        />
        <PaperText variant="titleLarge" style={{ textAlign: 'center', flex: 1 }}>
          {appName}
        </PaperText>
        <PaperButton
          mode="contained"
          onPress={() => navigation.navigate('AISummary', { appId, appName })}
          style={styles.summaryButton}
        >
          AI 요약
        </PaperButton>
      </View>
      <FlatList
        data={reviews}
        keyExtractor={(_, index) => index.toString()}
        renderItem={({ item }) => (
          <View style={styles.reviewItemContainer}>
            <PaperText>{`날짜: ${item.date}`}</PaperText>
            <PaperText>{`평점: ${item.score}`}</PaperText>
            <PaperText>{`내용: ${item.content}`}</PaperText>
          </View>
        )}
      />
    </View>
  );
}

/**
 * 5) AISummaryScreen
 */
function AISummaryScreen({ route, navigation }: {
  route: RouteProp<RootStackParamList, 'AISummary'>,
  navigation: NavigationProp<RootStackParamList, 'AISummary'>
}): React.ReactElement {
  const toast = useToast();
  const { appId, appName } = route.params;
  const [summary, setSummary] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [menuVisible, setMenuVisible] = useState<boolean>(false);
  const [downloadingPDF, setDownloadingPDF] = useState<boolean>(false);
  const scrollViewRef = useRef<ScrollView>(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton icon="dots-vertical" onPress={() => setMenuVisible(true)} />
          }
        >
          <Menu.Item
            onPress={downloadAsPDF}
            title="PDF로 저장"
            leadingIcon="file-pdf-box"
          />
          <Menu.Item
            onPress={shareContent}
            title="공유하기"
            leadingIcon="share-variant"
          />
        </Menu>
      ),
    });
  }, [navigation, menuVisible, summary]);

  useEffect(() => {
    let isMounted = true;

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const data = await fetchFromAPI('summary', { app_id: appId });

        if (!isMounted) return;

        if (data.success && data.summary) {
          setSummary(data.summary);

          if (data.date_range && isMounted) {
            setTimeout(() => {
              if (isMounted) {
                toast.show(`${data.date_range} 기간의 리뷰가 요약되었습니다.`, "success");
              }
            }, 100);
          }
        } else {
          throw new Error(data.error || '요약 생성에 실패했습니다.');
        }
      } catch (err: any) {
        console.error(err);
        if (isMounted) {
          setError(true);
          setTimeout(() => {
            if (isMounted) {
              toast.show(err.message, "error");
            }
          }, 100);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSummary();
    return () => { isMounted = false; };
  }, [appId]);

  const downloadAsPDF = async () => {
    try {
      setDownloadingPDF(true);
      setMenuVisible(false);
      await generateAndSharePDF(appName, summary);
    } catch (error) {
      console.error('PDF 생성 오류:', error);
    } finally {
      setDownloadingPDF(false);
    }
  };

  const shareContent = async () => {
    try {
      setMenuVisible(false);
      await Share.share({
        message: `${appName} 리뷰 AI 요약:\n\n${summary}`,
        title: `${appName} 리뷰 요약`
      });
    } catch (error) {
      console.error('공유 오류:', error);
      toast.show("공유 중 오류가 발생했습니다.", "error");
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <PaperText style={{ marginBottom: 8 }}>AI 요약 생성 중...</PaperText>
        <ActivityIndicator animating />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <PaperText variant="titleLarge" style={{ textAlign: 'center', margin: 20 }}>
          요약을 불러오는 중 오류가 발생했습니다
        </PaperText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <PaperText variant="titleLarge" style={{ textAlign: 'center', margin: 20 }}>
        {appName} 리뷰 AI 요약
      </PaperText>

      <View style={styles.buttonContainer}>
        <PaperButton
          mode="contained"
          onPress={downloadAsPDF}
          icon="file-pdf-box"
          style={styles.actionButton}
          contentStyle={styles.actionButtonContent}
          loading={downloadingPDF}
          disabled={downloadingPDF}
        >
          PDF 저장
        </PaperButton>

        <PaperButton
          mode="contained"
          onPress={shareContent}
          icon="share-variant"
          style={styles.actionButton}
          contentStyle={styles.actionButtonContent}
        >
          공유하기
        </PaperButton>
      </View>

      <ScrollView
        style={styles.scrollContainer}
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContentContainer}
      >
        <TouchableOpacity activeOpacity={1} onLongPress={shareContent}>
          <View style={styles.markdownContainer}>
            <Markdown
              style={{
                body: { color: '#ffffff' },
                heading1: { color: '#ffffff' },
                heading2: { color: '#ffffff' },
                heading3: { color: '#ffffff' },
                heading4: { color: '#ffffff' },
                heading5: { color: '#ffffff' },
                heading6: { color: '#ffffff' },
                strong: { color: '#ffffff' },
                em: { color: '#ffffff' },
                blockquote: { color: '#ffffff' },
                bullet_list: { color: '#ffffff' },
                ordered_list: { color: '#ffffff' },
                list_item: { color: '#ffffff' },
                paragraph: { color: '#ffffff', fontSize: 16, lineHeight: 24 },
                link: { color: '#3498db' },
                code_block: { backgroundColor: '#2c3e50', color: '#ffffff' },
                code_inline: { backgroundColor: '#2c3e50', color: '#ffffff' },
              }}
            >
              {summary}
            </Markdown>
          </View>
        </TouchableOpacity>
      </ScrollView>

      {downloadingPDF && (
        <View style={styles.overlay}>
          <ActivityIndicator size="large" color="#ffffff" />
          <PaperText style={{ color: '#ffffff', marginTop: 10 }}>
            PDF 생성 중...
          </PaperText>
        </View>
      )}
    </View>
  );
}

// Banner Ad Component
const AdBanner = () => {
  return (
    <View style={styles.adContainer}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.FULL_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
};

/**
 * Main App Component
 */
export default function App(): React.ReactElement {
  const [initialUrl, setInitialUrl] = useState<string | null>(null);
  const [refreshFunction, setRefreshFunction] = useState<(() => void) | null>(null);

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

  const appContextValue: AppContextType = {
    refreshFunction,
    setRefreshFunction,
    triggerRefresh: useCallback(() => {
      if (refreshFunction) refreshFunction();
    }, [refreshFunction])
  };

  return (
    <ToastProvider>
      <AuthProvider>
        <AppContext.Provider value={appContextValue}>
          <PaperProvider theme={CombinedDarkTheme}>
            <NavigationContainer theme={CombinedDarkTheme as any} linking={linking as any} ref={navigationRef}>
              <View style={{ flex: 1 }}>
                <AuthNavigator />
                <AdBanner />
              </View>
            </NavigationContainer>
          </PaperProvider>
        </AppContext.Provider>
      </AuthProvider>
    </ToastProvider>
  );
}

// Auth navigator that handles authentication flow
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
        </>
      )}
    </Stack.Navigator>
  );
}

// 스타일 정의
const styles = StyleSheet.create({
  // Common container styles
  container: { flex: 1, padding: 12, backgroundColor: '#121212' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#121212' },
  emptyContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },

  // Text styles
  title: { textAlign: 'center', marginBottom: 12, color: '#fff' },
  emptyText: { fontSize: 18, fontWeight: 'bold', marginBottom: 8, color: '#fff', textAlign: 'center' },
  emptySubText: { fontSize: 14, color: '#aaa', textAlign: 'center', marginBottom: 20 },
  errorText: { color: '#fff', marginBottom: 20 },
  loadingText: { marginTop: 16, fontSize: 16, color: '#aaa' },

  // App list styles
  itemRowContainer: {
    flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1,
    borderColor: '#333', padding: 12, backgroundColor: '#1E1E1E',
    borderRadius: 8, marginBottom: 8
  },
  appIcon: { width: 50, height: 50, borderRadius: 10, marginRight: 12, backgroundColor: '#2C2C2C' },
  appName: { fontSize: 16, fontWeight: 'bold', color: '#fff' },
  appId: { fontSize: 12, color: '#aaa', marginTop: 2 },

  // User profile styles
  userProfileContainer: {
    marginBottom: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 12,
  },
  userInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4
  },
  userInfoContent: {
    flexDirection: 'row',
    alignItems: 'center'
  },
  userAvatar: {
    marginRight: 8
  },
  userNameText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold'
  },
  settingsButton: {
    margin: 0,
    backgroundColor: '#333'
  },
  userDivider: {
    backgroundColor: '#333',
    height: 1,
    marginTop: 8
  },
  settingsMenu: {
    position: 'absolute',
    top: 50,
    right: 16
  },

  // Button styles
  addButtonContainer: { marginBottom: 16, paddingHorizontal: 12 },
  addButtonRow: { flexDirection: 'row', alignItems: 'center' },
  addButton: { width: '100%', paddingVertical: 8 },
  refreshIconButton: { margin: 0, backgroundColor: '#6200ee' },
  retryButton: { marginTop: 16 },
  clearSearchButton: { marginTop: 16 },
  actionButton: { marginVertical: 5, width: '100%' },
  actionButtonContent: { height: 48 },

  // Search styles
  searchContainer: { marginBottom: 8, paddingHorizontal: 12 },
  searchInput: { backgroundColor: '#2A2A2A' },
  searchResultInfo: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#222', marginBottom: 8, borderRadius: 4
  },
  searchResultText: { fontSize: 14, color: '#bbb' },

  // Help screen styles
  helpContainer: { flex: 1, backgroundColor: '#121212' },
  helpContentContainer: { padding: 16, paddingBottom: 32 },
  sectionTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 12, color: '#fff' },
  linkInputContainer: { marginBottom: 24, backgroundColor: '#1E1E1E', borderRadius: 8, padding: 16 },
  instructionText: { fontSize: 14, color: '#aaa', marginBottom: 12 },
  linkInputRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkInput: { flex: 1, backgroundColor: '#2C2C2C' },
  instructionContainer: { marginBottom: 24 },
  instructionStep: { flexDirection: 'row', marginBottom: 20, alignItems: 'flex-start' },
  stepNumber: {
    width: 32, height: 32, borderRadius: 16, backgroundColor: '#6200ee',
    justifyContent: 'center', alignItems: 'center', marginRight: 12, marginTop: 2
  },
  stepNumberText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  stepContent: { flex: 1 },
  stepTitle: { fontSize: 16, fontWeight: 'bold', marginBottom: 4, color: '#fff' },
  stepDescription: { fontSize: 14, color: '#aaa', lineHeight: 20 },
  playStoreIconButton: { margin: 0, backgroundColor: '#6200ee' },

  // Review styles
  reviewItemContainer: {
    padding: 15, borderBottomWidth: 1, borderColor: '#333',
    backgroundColor: '#1E1E1E', borderRadius: 8, marginBottom: 8
  },
  headerContainer: {
    flexDirection: 'row', alignItems: 'center', padding: 12,
    backgroundColor: '#1E1E1E', borderRadius: 8, marginBottom: 12
  },
  headerAppIcon: { width: 40, height: 40, borderRadius: 8, marginRight: 12 },
  summaryButton: { marginLeft: 'auto' },

  // AI Summary styles
  buttonContainer: { marginBottom: 10, paddingHorizontal: 12 },
  markdownContainer: {
    flex: 1, backgroundColor: '#1E1E1E', padding: 16,
    borderRadius: 8, elevation: 2
  },
  scrollContainer: { flex: 1 },
  scrollContentContainer: { flexGrow: 1, padding: 12 },
  overlay: {
    ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center', alignItems: 'center', zIndex: 1000
  },

  // Toast styles
  toast: {
    position: 'absolute', bottom: 50, left: 20, right: 20,
    backgroundColor: '#323232', padding: 16, borderRadius: 8,
    elevation: 6, shadowColor: '#000', shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.27, shadowRadius: 4.65, zIndex: 9999
  },
  toastText: { color: '#fff', textAlign: 'center' },

  // Ad styles
  adContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 5
  },

  // Login screen styles
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