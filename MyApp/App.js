// App.js
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, createContext, useContext, useMemo } from 'react';
import {
  View,
  ScrollView,
  Share,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Image,
  Clipboard,
  RefreshControl,
  Animated,
} from 'react-native';
import { marked } from 'marked';

// React Navigation
import {
  NavigationContainer,
  DarkTheme as NavDarkTheme,
  useNavigation,
  createNavigationContainerRef,
  CommonActions
} from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';

// React Native Paper
import {
  Provider as PaperProvider,
  Text as PaperText,
  TextInput as PaperTextInput,
  Button as PaperButton,
  MD3DarkTheme as PaperDarkTheme,
  ActivityIndicator,
  Menu,
  Divider,
  IconButton,
  Surface
} from 'react-native-paper';

import Markdown from 'react-native-markdown-display';

import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// 필요한 import 추가
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios';
import cheerio from 'react-native-cheerio';

// PDF 생성 모듈 import
import { generateAndSharePDF } from './utils/pdfGenerator';

// 앱 전체에서 사용할 컨텍스트 생성
const AppContext = createContext(null);

// 토스트 메시지 컨텍스트 생성
const ToastContext = createContext(null);

// 디버그 모드 플래그
const DEBUG = false;

const log = (...args) => {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
  }
};

const CombinedDarkTheme = {
  ...NavDarkTheme,
  ...PaperDarkTheme,
  colors: {
    ...NavDarkTheme.colors,
    ...PaperDarkTheme.colors,
    background: '#000000',
    text: '#ffffff',
  },
};

// 스택 네비게이션 생성
const Stack = createNativeStackNavigator();

// 네비게이션 참조 생성
const navigationRef = createNavigationContainerRef();

// 토스트 컴포넌트
const Toast = ({ visible, message, type = 'info', onDismiss }) => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const timerRef = useRef(null);

  useEffect(() => {
    // 컴포넌트 언마운트 시 타이머 정리
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (visible) {
      // 이전 타이머가 있으면 제거
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // 페이드 인 애니메이션
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 200,
        useNativeDriver: true,
      }).start();

      // 자동 사라짐 타이머 설정
      timerRef.current = setTimeout(() => {
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }).start(() => {
          onDismiss();
        });
      }, 3000);
    }
  }, [visible, fadeAnim]); // onDismiss 제거하여 의존성 순환 방지

  if (!visible) return null;

  const backgroundColor =
    type === 'error' ? '#FF5252' :
      type === 'success' ? '#4CAF50' :
        '#323232';

  return (
    <Animated.View style={[
      styles.toast,
      { backgroundColor, opacity: fadeAnim }
    ]}>
      <PaperText style={styles.toastText}>{message}</PaperText>
    </Animated.View>
  );
};

// 토스트 프로바이더 컴포넌트
const ToastProvider = ({ children }) => {
  const [toast, setToast] = useState({
    visible: false,
    message: '',
    type: 'info',
  });

  // 토스트 메시지를 보여주는 함수를 메모이제이션
  const showToast = useCallback((message, type = 'info') => {
    // 이미 토스트가 표시 중이라면 먼저 숨기고 나서 새로운 토스트 표시
    setToast(prev => {
      if (prev.visible) {
        // 이미 표시 중이면 즉시 새로운 메시지로 업데이트
        return { visible: true, message, type };
      } else {
        // 표시되지 않았으면 바로 표시
        return { visible: true, message, type };
      }
    });
  }, []);

  // 토스트 메시지를 숨기는 함수를 메모이제이션
  const hideToast = useCallback(() => {
    setToast(prev => ({ ...prev, visible: false }));
  }, []);

  // 컨텍스트 값을 메모이제이션하여 불필요한 리렌더링 방지
  const toastValue = useMemo(() => ({
    show: showToast
  }), [showToast]);

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

// 토스트 훅
const useToast = () => useContext(ToastContext);

/** 
 * 1) HomeScreen 
 * 첫 화면, "리뷰 로딩" 버튼 → AppListScreen으로 이동
 */
function HomeScreen({ navigation }) {
  return (
    <Surface style={styles.homeContainer}>
      <PaperText variant="titleLarge" style={{ marginBottom: 20 }}>
        메인 화면
      </PaperText>
      <PaperButton
        mode="contained"
        onPress={() => navigation.navigate('AppList')}
        style={{ width: "90%" }}
      >
        리뷰 로딩
      </PaperButton>
    </Surface>
  );
}

/** 
 * 2) AppListScreen 
 * 앱 목록 + 플레이스토어에서 가져오기 버튼 + 검색 기능
 */
function AppListScreen({ navigation, route }) {
  // 앱 전역 컨텍스트 사용
  const appContext = useContext(AppContext);
  const toast = useToast();

  // 앱 목록을 state로 관리 (id, name, icon)
  const [appList, setAppList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // 검색어 상태
  const [searchQuery, setSearchQuery] = useState('');

  // 필터링된 앱 목록
  const [filteredAppList, setFilteredAppList] = useState([]);

  // 새로고침 요청 진행 중 플래그 추가
  const isRefreshingRef = useRef(false);

  // 마지막 새로고침 시간 추적 (쿨다운 관리)
  const lastRefreshTimeRef = useRef(0);

  // toast 함수를 ref로 저장하여 의존성에서 제외
  const toastRef = useRef(toast);
  useEffect(() => {
    toastRef.current = toast;
  }, [toast]);

  // fetchAppList를 useCallback으로 감싸고 의존성을 명확히 함
  const fetchAppList = useCallback(async () => {
    if (isRefreshingRef.current) {
      log('이미 새로고침 진행 중 - fetchAppList 중복 요청 무시');
      return Promise.resolve();
    }

    try {
      log('앱 목록 가져오기 시작');
      setLoading(true);
      setRefreshing(true);
      isRefreshingRef.current = true;

      const response = await fetch('https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_type: 'app_info_read'
        }),
      });

      if (!response.ok) {
        throw new Error('앱 정보를 가져오는데 실패했습니다.');
      }

      const data = await response.json();
      log('API 응답 데이터:', data);

      const apps = data.apps || [];

      // 앱 정보를 필요한 형식으로 변환
      const formattedApps = apps.map(app => ({
        id: app.app_id,
        name: app.app_name,
        icon: app.app_logo || 'https://via.placeholder.com/180'
      }));

      setAppList(formattedApps);
      setFilteredAppList(formattedApps);
      log('앱 목록 업데이트 완료:', formattedApps.length);

    } catch (err) {
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

  // handleRefresh 함수를 useRef로 관리하여 의존성 사이클 끊기
  const handleRefreshRef = useRef(async () => {
    // 초기 빈 함수 - useEffect에서 실제 구현으로 교체됨
    log('handleRefresh 초기화되지 않음');
  });

  // 최신 상태를 참조하기 위해 함수 내용 정의
  useEffect(() => {
    handleRefreshRef.current = async () => {
      log('handleRefresh 호출됨');

      // 이미 새로고침 중이면 무시
      if (refreshing || isRefreshingRef.current) {
        log('이미 새로고침 중 - 요청 무시');
        return;
      }

      // 쿨다운 적용 (1초 이내 연속 새로고침 방지)
      const now = Date.now();
      if (now - lastRefreshTimeRef.current < 10000) {
        // 몇 초 남았는지 toast
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
      } catch (error) {
        console.error('새로고침 오류:', error);
      } finally {
        setRefreshing(false);
        isRefreshingRef.current = false;
      }
    };
  }, [refreshing, fetchAppList]);

  // 컴포넌트가 마운트될 때 fetchAppList 호출
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

    return () => {
      isMounted = false;
    };
  }, [fetchAppList]);

  // route.params.refreshTrigger가 변경될 때마다 fetchAppList 호출
  const lastRefreshTriggerRef = useRef(null);

  useEffect(() => {
    if (route.params?.refreshTrigger &&
      route.params.refreshTrigger !== lastRefreshTriggerRef.current) {
      log('새로운 refreshTrigger 감지됨:', route.params.refreshTrigger);
      lastRefreshTriggerRef.current = route.params.refreshTrigger;
      handleRefreshRef.current();
    }
  }, [route.params?.refreshTrigger]);

  // appContext와 의존성 순환을 끊기 위해 useEffect 분리
  const appContextRef = useRef(appContext);

  useEffect(() => {
    appContextRef.current = appContext;
  }, [appContext]);

  // useFocusEffect - 컨텍스트에 새로고침 함수 등록 (의존성 제거)
  useFocusEffect(
    useCallback(() => {
      log('AppListScreen 포커스됨');

      if (initialLoadDone) {
        log('새로고침 함수 설정 완료');
        // 다음 렌더링 사이클에서 실행되도록 setTimeout 사용
        setTimeout(() => {
          if (appContextRef.current && appContextRef.current.setRefreshFunction) {
            appContextRef.current.setRefreshFunction(() => handleRefreshRef.current());
          }
        }, 0);
      } else {
        log('초기 로딩 중 - 새로고침 함수 설정 연기');
      }

      return () => {
        log('AppListScreen 포커스 해제');
        setTimeout(() => {
          if (appContextRef.current && appContextRef.current.setRefreshFunction) {
            appContextRef.current.setRefreshFunction(null);
          }
        }, 0);
      };
    }, [initialLoadDone])
  );

  // 검색어가 변경될 때마다 목록 필터링
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

  // route.params 변경 처리를 위한 ref 추가
  const prevRouteParamsRef = useRef({});

  // HelpScreen에서 넘어온 데이터 처리
  useEffect(() => {
    const currentExtractedId = route.params?.extractedPackageId;
    const prevExtractedId = prevRouteParamsRef.current.extractedPackageId;

    // 새로운 앱 ID가 추가된 경우에만 처리 (중복 실행 방지)
    if (currentExtractedId && currentExtractedId !== prevExtractedId) {
      const appId = currentExtractedId;
      const appName = route.params?.extractedAppName || `앱 (${appId})`;
      const appIcon = route.params?.extractedAppIcon || 'https://via.placeholder.com/180';

      // 새 앱 추가
      setAppList(prevList => {
        // 이미 존재하는 앱인지 확인
        if (prevList.some(app => app.id === appId)) {
          return prevList;
        }
        return [...prevList, {
          id: appId,
          name: appName,
          icon: appIcon,
        }];
      });

      // 성공 메시지 (0ms 타임아웃을 1ms로 변경해 렌더링 사이클 분리)
      setTimeout(() => {
        toastRef.current.show(`"${appName}" 앱이 추가되었습니다.`, 'success');
      }, 1);
    }

    // 검색어 파라미터가 있고 이전과 다른 경우에만 업데이트
    const currentSearchQuery = route.params?.searchQuery;
    const prevSearchQuery = prevRouteParamsRef.current.searchQuery;

    if (currentSearchQuery && currentSearchQuery !== prevSearchQuery) {
      setSearchQuery(currentSearchQuery);
    }

    // 현재 파라미터를 저장
    prevRouteParamsRef.current = { ...route.params };
  }, [route.params]);

  // 검색어 지우기
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const renderItem = ({ item }) => {
    return (
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
              appId: item.id,
              appName: item.name,
              appIcon: item.icon,
            });
          }}
          style={{ marginHorizontal: 8 }}
        >
          리뷰 보기
        </PaperButton>
      </View>
    );
  };

  // 검색 결과가 없을 때의 안내 메시지
  const EmptySearchResult = () => (
    <View style={styles.emptyContainer}>
      <PaperText style={styles.emptyText}>
        검색 결과가 없습니다.
      </PaperText>
      <PaperText style={styles.emptySubText}>
        다른 검색어를 입력하거나 플레이스토어에서 앱을 추가해보세요.
      </PaperText>
      <PaperButton
        mode="outlined"
        onPress={handleClearSearch}
        style={styles.clearSearchButton}
      >
        검색어 지우기
      </PaperButton>
    </View>
  );

  // 앱 목록이 비어있을 때의 안내 메시지
  const EmptyListComponent = () => (
    <View style={styles.emptyContainer}>
      <PaperText style={styles.emptyText}>
        아직 추가된 앱이 없습니다.
      </PaperText>
      <PaperText style={styles.emptySubText}>
        아래 버튼을 눌러 구글 플레이스토어에서 앱을 추가해보세요.
      </PaperText>
    </View>
  );

  // 로딩 중일 때 표시
  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#6200ee" />
        <PaperText style={styles.loadingText}>앱 목록을 불러오는 중...</PaperText>
      </View>
    );
  }

  // 에러가 있을 때 표시
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
      {/* 검색 입력 필드 */}
      <View style={styles.searchContainer}>
        <PaperTextInput
          label="앱 이름 또는 ID로 검색"
          value={searchQuery}
          onChangeText={setSearchQuery}
          style={styles.searchInput}
          placeholder="검색어를 입력하세요"
          left={<PaperTextInput.Icon icon="magnify" />}
          right={
            searchQuery ? (
              <PaperTextInput.Icon
                icon="close"
                onPress={handleClearSearch}
              />
            ) : null
          }
        />
      </View>

      {/* 앱 추가 버튼 */}
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

      {/* 필터링 결과 표시 (검색어가 있는 경우) */}
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
        ListEmptyComponent={
          searchQuery.trim() !== '' ? EmptySearchResult : EmptyListComponent
        }
        contentContainerStyle={filteredAppList.length === 0 ? { flex: 1 } : null}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => handleRefreshRef.current()}
            colors={['#6200ee']}
          />
        }
      />
    </View>
  );
}

/** 
 * 3) HelpScreen - 공유 링크 입력 기능 추가
 * 구글 플레이스토어 앱 공유 안내 및 처리
 */
function HelpScreen({ navigation }) {
  const toast = useToast();
  const [playStoreLink, setPlayStoreLink] = useState('');
  const [processing, setProcessing] = useState(false);

  // URL 리스너 설정 (앱이 실행 중일 때나 새로 열릴 때)
  useEffect(() => {
    // 앱이 열렸을 때 초기 URL 확인
    const getInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        handleIncomingLink(url);
      }
    };

    // 앱이 이미 실행 중일 때 URL 받기
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingLink(url);
    });

    getInitialUrl();

    return () => {
      subscription.remove();
    };
  }, []);

  // URL에서 패키지 ID 추출 및 앱 정보 가져오기
  const handleIncomingLink = async (url) => {
    console.log('받은 URL:', url);
    try {
      setProcessing(true);

      const match = url.match(/id=([^&]+)/);
      if (match && match[1]) {
        const extractedId = match[1];
        await fetchAppInfo(extractedId);
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

  // 직접 입력한 링크 처리하기
  const handleManualLink = async () => {
    if (!playStoreLink) {
      toast.show("링크를 입력해주세요.", "error");
      return;
    }

    try {
      setProcessing(true);

      // ID 추출 방법 1: ?id= 형식
      let match = playStoreLink.match(/[?&]id=([^&]+)/);

      // ID 추출 방법 2: apps/details/id= 형식
      if (!match) {
        match = playStoreLink.match(/apps\/details\/?id=([^&\s]+)/);
      }

      // ID 추출 방법 3: 직접 패키지명 입력한 경우
      if (!match && playStoreLink.includes('.')) {
        // com.example.app 형식으로 직접 입력한 것으로 간주
        match = [null, playStoreLink.trim()];
      }

      if (match && match[1]) {
        const extractedId = match[1];
        await fetchAppInfo(extractedId);
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

  // Google Play 스토어에서 앱 정보 가져오기
  const fetchAppInfo = async (appId) => {
    try {
      // 1. 먼저 웹 스크래핑으로 앱 정보 가져오기
      const url = `https://play.google.com/store/apps/details?id=${appId}&hl=ko`;
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);

      // 앱 이름과 아이콘 URL 추출
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

      // 백업 값 설정
      if (!appName) appName = `앱 (${appId})`;
      if (!iconUrl) iconUrl = 'https://via.placeholder.com/180';

      // 2. Lambda 함수를 통해 DB에 앱 정보 등록
      const LAMBDA_URL = 'https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF';
      const lambdaResponse = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_type: 'app_info_add',
          app_id: appId,
          app_name: appName,
          app_logo: iconUrl
        }),
      });

      const result = await lambdaResponse.json();
      console.log('Lambda 응답:', result);

      if (!lambdaResponse.ok) {
        throw new Error(`서버 오류: ${lambdaResponse.status}`);
      }

      console.log('app_add_result:', result);
      if (result.success) {
        if (result.message && result.message.includes('이미 존재')) {
          toast.show("이미 추가된 앱입니다. 앱 목록에서 검색해보세요.", "info");
          // AppListScreen으로 돌아가면서 검색어 설정
          navigation.navigate('AppList', {
            searchQuery: appId
          });
          return;
        }
        // 성공 시 AppListScreen으로 이동
        navigation.navigate('AppList', {
          extractedPackageId: appId,
          extractedAppName: appName,
          extractedAppIcon: iconUrl
        });
        return;
      }
      throw new Error(result.message || '앱 정보 등록에 실패했습니다.');

    } catch (error) {
      console.error('앱 정보 가져오기 오류:', error);
      let errorMessage = "앱 정보를 가져오는 중 오류가 발생했습니다.";

      if (error.response) {
        // 서버에서 응답이 왔지만 오류 상태 코드
        errorMessage = `서버 오류: ${error.response.status}`;
      } else if (error.request) {
        // 요청은 보냈지만 응답을 받지 못함
        errorMessage = "서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.";
      } else {
        // 요청 설정 중에 오류 발생
        errorMessage = error.message || "앱 정보를 가져오는 중 오류가 발생했습니다.";
      }

      toast.show(errorMessage, "error");
    }
  };

  // 구글 스토어 앱 열기
  const handleOpenPlayStore = () => {
    Linking.openURL('market://search?q=앱')
      .catch((err) => {
        console.warn("스토어 앱을 열 수 없습니다:", err);
        // fallback: 웹 브라우저로 열기
        Linking.openURL('https://play.google.com/store');
      });
  };

  useEffect(() => {
    const validateAndProcessLink = async () => {
      if (!playStoreLink) return;

      try {
        // ID 추출 방법 1: ?id= 형식
        let match = playStoreLink.match(/[?&]id=([^&]+)/);

        // ID 추출 방법 2: apps/details/id= 형식
        if (!match) {
          match = playStoreLink.match(/apps\/details\/?id=([^&\s]+)/);
        }

        // ID 추출 방법 3: 직접 패키지명 입력한 경우
        if (!match && playStoreLink.includes('.')) {
          // com.example.app 형식으로 직접 입력한 것으로 간주
          match = [null, playStoreLink.trim()];
        }

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

    // 디바운스 처리
    const timeoutId = setTimeout(validateAndProcessLink, 1000);
    return () => clearTimeout(timeoutId);
  }, [playStoreLink]);

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
          {/* 링크 직접 입력 섹션 */}
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
            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <PaperText style={styles.stepNumberText}>1</PaperText>
              </View>
              <View style={styles.stepContent}>
                <PaperText style={styles.stepTitle}>구글 플레이스토어 열기</PaperText>
                <PaperText style={styles.stepDescription}>
                  오른쪽의 구글 플레이스토어 아이콘을 눌러 스토어를 엽니다.
                </PaperText>
              </View>
            </View>

            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <PaperText style={styles.stepNumberText}>2</PaperText>
              </View>
              <View style={styles.stepContent}>
                <PaperText style={styles.stepTitle}>원하는 앱 찾기</PaperText>
                <PaperText style={styles.stepDescription}>
                  스토어에서 추가하고 싶은 앱을 검색하고 앱 페이지로 이동합니다.
                </PaperText>
              </View>
            </View>

            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <PaperText style={styles.stepNumberText}>3</PaperText>
              </View>
              <View style={styles.stepContent}>
                <PaperText style={styles.stepTitle}>앱 공유하기</PaperText>
                <PaperText style={styles.stepDescription}>
                  앱 페이지 우측 상단의 메뉴(⋮)를 눌러 '공유'를 선택합니다.
                </PaperText>
              </View>
            </View>

            <View style={styles.instructionStep}>
              <View style={styles.stepNumber}>
                <PaperText style={styles.stepNumberText}>4</PaperText>
              </View>
              <View style={styles.stepContent}>
                <PaperText style={styles.stepTitle}>링크 복사하기</PaperText>
                <PaperText style={styles.stepDescription}>
                  공유 메뉴에서 '링크 복사'를 선택하고, 위 입력창에 붙여넣은 후 '앱 추가하기' 버튼을 누릅니다.
                </PaperText>
              </View>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

/**
 * 4) ReviewScreen
 * 선택된 앱에 대한 리뷰를 서버에서 fetch 해와서 표시
 */
function ReviewScreen({ route }) {
  const toast = useToast();
  const { appId, appName, appIcon } = route.params;
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigation = useNavigation();

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const LAMBDA_URL = 'https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF';
      const response = await fetch(LAMBDA_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          request_type: 'app_review_read',
          app_id: appId
        }),
      });

      if (response.status !== 200) {
        throw new Error('리뷰를 가져오는데 실패했습니다.');
      }

      const data = await response.json();
      const reviewData = data;

      if (reviewData && reviewData.reviews && Array.isArray(reviewData.reviews)) {
        // 날짜 형식 변환 및 데이터 정리
        const formattedReviews = reviewData.reviews.map(review => ({
          date: new Date(review.date).toLocaleDateString(),
          score: review.score,
          content: review.content,
          username: review.username || '익명'
        }));

        setReviews(formattedReviews);

        if (reviewData.new_reviews_added) {
          toast.show("새로운 리뷰가 추가되었습니다.", "info");
        }
      } else {
        console.error('잘못된 응답 형식:', reviewData);
        throw new Error('리뷰 데이터 형식이 올바르지 않습니다.');
      }
    } catch (err) {
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

  const navigateToAISummary = () => {
    navigation.navigate('AISummary', {
      appId,
      appName
    });
  };

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
          onPress={() => {
            setError(false);
            setLoading(true);
            fetchReviews();
          }}
          style={styles.retryButton}
        >
          다시 시도
        </PaperButton>
      </View>
    );
  }

  const renderItem = ({ item }) => (
    <View style={styles.reviewItemContainer}>
      <PaperText>{`날짜: ${item.date}`}</PaperText>
      <PaperText>{`평점: ${item.score}`}</PaperText>
      <PaperText>{`내용: ${item.content}`}</PaperText>
    </View>
  );

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
          onPress={navigateToAISummary}
          style={styles.summaryButton}
        >
          AI 요약
        </PaperButton>
      </View>
      <FlatList
        data={reviews}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
      />
    </View>
  );
}

function AISummaryScreen({ route, navigation }) {
  const toast = useToast();
  const { appId, appName } = route.params;
  const [summary, setSummary] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const [downloadingPDF, setDownloadingPDF] = useState(false);
  const scrollViewRef = useRef(null);

  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <Menu
          visible={menuVisible}
          onDismiss={() => setMenuVisible(false)}
          anchor={
            <IconButton
              icon="dots-vertical"
              onPress={() => setMenuVisible(true)}
            />
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
    let isMounted = true; // 컴포넌트 마운트 상태 추적

    const fetchSummary = async () => {
      try {
        setLoading(true);
        const LAMBDA_URL = 'https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF';
        const response = await fetch(LAMBDA_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            request_type: 'summary',
            app_id: appId
          }),
        });

        if (!isMounted) return; // 비동기 작업 중 컴포넌트가 언마운트된 경우

        if (!response.ok) {
          throw new Error('요약을 가져오는데 실패했습니다.');
        }

        const data = await response.json();

        if (!isMounted) return;

        if (data.success && data.summary) {
          setSummary(data.summary);

          // 요약 기간 정보가 있다면 표시 (setTimeout으로 렌더링 사이클 분리)
          if (data.date_range) {
            setTimeout(() => {
              if (isMounted) {
                toast.show(`${data.date_range} 기간의 리뷰가 요약되었습니다.`, "success");
              }
            }, 100);
          }
        } else {
          throw new Error(data.error || '요약 생성에 실패했습니다.');
        }
      } catch (err) {
        console.error(err);
        if (isMounted) {
          setError(true);
          // 에러 메시지 표시 지연
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

    // 클린업 함수
    return () => {
      isMounted = false;
    };
    // toast 의존성 제거하여 순환 참조 방지
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appId]);

  // PDF로 저장하는 함수
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

  // 텍스트 공유 함수
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
        <TouchableOpacity
          activeOpacity={1}
          onLongPress={shareContent}
        >
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

/**
 * 메인 App 컴포넌트
 */
// App.js의 개선된 버전 - 불필요한 triggerRefresh 로직 제거
// AppContext 간소화
/**
 * 메인 App 컴포넌트
 */
export default function App() {
  const [initialUrl, setInitialUrl] = useState(null);
  // refreshFunction만 유지하고 관련 상태는 제거
  const [refreshFunction, setRefreshFunction] = useState(null);

  // 앱이 백그라운드에서 실행될 때 딥링크 처리
  useEffect(() => {
    // 초기 URL 확인
    const getInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        log('초기 URL:', url);
        setInitialUrl(url);
      }
    };

    getInitialURL();

    // 앱 실행 중 URL 리스너
    const subscription = Linking.addEventListener('url', ({ url }) => {
      log('앱 실행 중 수신된 URL:', url);
      setInitialUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // 공유된 URL이 있으면 Help 화면 표시 준비
  const linking = {
    prefixes: ['appreviewanalyzer://', 'https://play.google.com'],
    config: {
      screens: {
        Help: 'help',
        AppList: 'apps',
        Review: 'review/:appId',
        AISummary: 'summary/:appId',
      },
    },
    async getInitialURL() {
      return initialUrl;
    },
  };

  // 앱 전반에서 사용할 컨텍스트 값 - 간소화된 버전
  const appContextValue = {
    refreshFunction,
    setRefreshFunction,
    // triggerRefresh 제거하고 직접 refreshFunction 호출하도록 수정
    triggerRefresh: useCallback(() => {
      if (refreshFunction) {
        refreshFunction();
      }
    }, [refreshFunction])
  };

  return (
    <ToastProvider>
      <AppContext.Provider value={appContextValue}>
        <PaperProvider theme={CombinedDarkTheme}>
          <NavigationContainer theme={CombinedDarkTheme} linking={linking} ref={navigationRef}>
            <Stack.Navigator initialRouteName="Home">
              <Stack.Screen
                name="Home"
                component={HomeScreen}
                options={{ title: '메인화면' }}
              />
              <Stack.Screen
                name="AppList"
                component={AppListScreen}
                options={{
                  title: '앱 목록'
                }}
              />
              <Stack.Screen
                name="Help"
                component={HelpScreen}
                options={{ title: '앱 추가' }}
              />
              <Stack.Screen
                name="Review"
                component={ReviewScreen}
                options={{ title: '앱 리뷰' }}
              />
              <Stack.Screen
                name="AISummary"
                component={AISummaryScreen}
                options={{ title: 'AI 요약' }}
              />
            </Stack.Navigator>
          </NavigationContainer>
        </PaperProvider>
      </AppContext.Provider>
    </ToastProvider>
  );
}

// 스타일 정의
const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    padding: 12,
    backgroundColor: '#121212',
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
    color: '#fff',
  },
  itemRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#333',
    padding: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginBottom: 8,
  },
  reviewItemContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#333',
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginBottom: 8,
  },
  buttonContainer: {
    marginBottom: 10,
    paddingHorizontal: 12,
  },
  actionButton: {
    marginVertical: 5,
    width: '100%',
  },
  actionButtonContent: {
    height: 48,
  },
  markdownContainer: {
    flex: 1,
    backgroundColor: '#1E1E1E',
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
    padding: 12,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
  appIcon: {
    width: 50,
    height: 50,
    borderRadius: 10,
    marginRight: 12,
    backgroundColor: '#2C2C2C',
  },
  appName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  appId: {
    fontSize: 12,
    color: '#aaa',
    marginTop: 2,
  },
  addButtonContainer: {
    marginBottom: 16,
    paddingHorizontal: 12,
  },
  addButtonRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  addButton: {
    width: '100%',
    paddingVertical: 8,
  },
  refreshIconButton: {
    margin: 0,
    backgroundColor: '#6200ee',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#fff',
    textAlign: 'center',
  },
  emptySubText: {
    fontSize: 14,
    color: '#aaa',
    textAlign: 'center',
    marginBottom: 20,
  },
  helpContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  helpContentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    color: '#fff',
  },
  linkInputContainer: {
    marginBottom: 24,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
  },
  instructionText: {
    fontSize: 14,
    color: '#aaa',
    marginBottom: 12,
  },
  linkInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  linkInput: {
    flex: 1,
    backgroundColor: '#2C2C2C',
  },
  instructionContainer: {
    marginBottom: 24,
  },
  instructionStep: {
    flexDirection: 'row',
    marginBottom: 20,
    alignItems: 'flex-start',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#6200ee',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  stepNumberText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  stepContent: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
    color: '#fff',
  },
  stepDescription: {
    fontSize: 14,
    color: '#aaa',
    lineHeight: 20,
  },
  playStoreIconButton: {
    margin: 0,
    backgroundColor: '#6200ee',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#121212',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: '#aaa',
  },
  searchContainer: {
    marginBottom: 8,
    paddingHorizontal: 12,
  },
  searchInput: {
    backgroundColor: '#2A2A2A',
  },
  searchResultInfo: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: '#222',
    marginBottom: 8,
    borderRadius: 4,
  },
  searchResultText: {
    fontSize: 14,
    color: '#bbb',
  },
  clearSearchButton: {
    marginTop: 16,
  },
  errorText: {
    color: '#fff',
    marginBottom: 20,
  },
  retryButton: {
    marginTop: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    marginBottom: 12,
  },
  headerAppIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  summaryButton: {
    marginLeft: 'auto',
  },
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
    zIndex: 9999,
  },
  toastText: {
    color: '#fff',
    textAlign: 'center',
  },
});