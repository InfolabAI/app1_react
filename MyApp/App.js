// App.js
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, createContext, useContext } from 'react';
import {
  View,
  ScrollView,
  Share,
  FlatList,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Image,
  Clipboard,
  RefreshControl,
} from 'react-native';
import { marked } from 'marked'; // marked 라이브러리 추가

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
import axios from 'axios'; // axios 설치 필요
import cheerio from 'react-native-cheerio'; // cheerio 설치 필요

// PDF 생성 모듈 import
import { generateAndSharePDF } from './utils/pdfGenerator';

// 앱 전체에서 사용할 컨텍스트 생성
const AppContext = createContext(null);

// 디버그 모드 플래그
const DEBUG = true;

const log = (...args) => {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
    // 개발 중에만 Alert로도 표시
    // Alert.alert('Debug Log', JSON.stringify(args, null, 2));
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

  // 앱 목록을 state로 관리 (id, name, icon)
  const [appList, setAppList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  // 컴포넌트의 초기 상태 선언에 초기 로딩 플래그 추가
  const [initialLoadDone, setInitialLoadDone] = useState(false);

  // 검색어 상태
  const [searchQuery, setSearchQuery] = useState('');

  // 필터링된 앱 목록
  const [filteredAppList, setFilteredAppList] = useState([]);

  // 새로고침 요청 진행 중 플래그 추가
  const isRefreshingRef = useRef(false);

  // 앱 목록 가져오기
  const fetchAppList = async () => {
    // 이미 새로고침 중이면 중복 호출 방지
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
      Alert.alert('오류', '앱 목록을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
      setRefreshing(false);
      isRefreshingRef.current = false;
    }
    // 명시적으로 Promise를 반환
    return Promise.resolve();
  };

  // 새로고침 처리 함수
  const handleRefresh = useCallback(async () => {
    log('handleRefresh 호출됨');
    // 이미 새로고침 중이면 중복 실행 방지
    if (refreshing || isRefreshingRef.current) {
      log('이미 새로고침 중 - 요청 무시');
      return;
    }

    try {
      setRefreshing(true);
      isRefreshingRef.current = true;
      await fetchAppList();
      Alert.alert('알림', '앱 목록이 새로고침되었습니다.');
    } catch (error) {
      console.error('새로고침 오류:', error);
    } finally {
      setRefreshing(false);
      isRefreshingRef.current = false;
    }
  }, [refreshing]); // refreshing 상태에 의존성 추가

  // 컴포넌트가 마운트될 때 fetchAppList 호출
  useEffect(() => {
    log('AppListScreen 마운트됨 - 초기 데이터 로드');

    const initialLoad = async () => {
      try {
        await fetchAppList();
      } finally {
        setInitialLoadDone(true);
        log('초기 데이터 로딩 완료');
      }
    };

    initialLoad();
  }, []);

  // route.params.refreshTrigger가 변경될 때마다 fetchAppList 호출
  const lastRefreshTriggerRef = useRef(null);

  useEffect(() => {
    if (route.params?.refreshTrigger &&
      route.params.refreshTrigger !== lastRefreshTriggerRef.current) {
      log('새로운 refreshTrigger 감지됨:', route.params.refreshTrigger);
      lastRefreshTriggerRef.current = route.params.refreshTrigger;

      // 이미 새로고침 중인지 확인
      if (!refreshing && !isRefreshingRef.current) {
        handleRefresh();
      } else {
        log('이미 새로고침 중 - refreshTrigger에 의한 요청 무시');
      }
    }
  }, [route.params?.refreshTrigger, handleRefresh, refreshing]);

  // 명확한 참조를 위해 안정적인 refreshFunction 생성
  const stableRefreshFunction = useCallback(() => {
    log('안정적인 새로고침 함수 호출됨');
    handleRefresh();
  }, [handleRefresh]);

  // useFocusEffect 개선
  useFocusEffect(
    useCallback(() => {
      log('AppListScreen 포커스됨');

      // 초기 로딩이 완료된 후에만 새로고침 함수 설정
      if (initialLoadDone) {
        log('새로고침 함수 설정 완료');
        appContext.setRefreshFunction(() => stableRefreshFunction);
      } else {
        log('초기 로딩 중 - 새로고침 함수 설정 연기');
      }

      return () => {
        log('AppListScreen 포커스 해제');
        appContext.setRefreshFunction(null);
      };
    }, [initialLoadDone, stableRefreshFunction])
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

  // HelpScreen에서 넘어온 데이터 처리
  useEffect(() => {
    if (route.params?.extractedPackageId) {
      const appId = route.params.extractedPackageId;
      const appName = route.params?.extractedAppName || `앱 (${appId})`;
      const appIcon = route.params?.extractedAppIcon || 'https://via.placeholder.com/180';

      // 이미 존재하는 앱인지 확인
      if (appList.some((app) => app.id === appId)) {
        Alert.alert('알림', '이미 존재하는 앱입니다.');
        return;
      }

      // 새 앱 추가
      setAppList(prevList => [...prevList, {
        id: appId,
        name: appName,
        icon: appIcon,
      }]);

      // 성공 메시지
      Alert.alert('성공', `"${appName}" 앱이 추가되었습니다.`);
    }
  }, [route.params]);

  // 검색어 지우기
  const handleClearSearch = () => {
    setSearchQuery('');
  };

  const renderItem = ({ item }) => {
    return (
      <View style={styles.itemRowContainer}>
        {/* 앱 아이콘 */}
        <Image
          source={{ uri: item.icon }}
          style={styles.appIcon}
          defaultSource={require('./assets/app-placeholder.png')}
        />

        {/* 앱 이름 (왼쪽) */}
        <View style={{ flex: 1 }}>
          <PaperText style={styles.appName}>{item.name}</PaperText>
          <PaperText style={styles.appId}>{item.id}</PaperText>
        </View>

        {/* 리뷰 보기 (중간) */}
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
          onPress={fetchAppList}
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
            onPress={handleRefresh}
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
            onRefresh={handleRefresh}
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

        // 웹 스크래핑으로 앱 정보 가져오기
        await fetchAppInfo(extractedId);
      } else {
        Alert.alert("오류", "유효한 구글 플레이스토어 링크가 아닙니다.");
      }
    } catch (error) {
      console.error('링크 처리 오류:', error);
      Alert.alert("오류", "링크를 처리하는 중 문제가 발생했습니다.");
    } finally {
      setProcessing(false);
    }
  };

  // 직접 입력한 링크 처리하기
  const handleManualLink = async () => {
    if (!playStoreLink) {
      Alert.alert("오류", "링크를 입력해주세요.");
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

        // 웹 스크래핑으로 앱 정보 가져오기
        await fetchAppInfo(extractedId);
      } else {
        Alert.alert("오류", "유효한 구글 플레이스토어 링크나 패키지명이 아닙니다.");
      }
    } catch (error) {
      console.error('링크 처리 오류:', error);
      Alert.alert("오류", "링크를 처리하는 중 문제가 발생했습니다.");
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

      // 앱 이름과 아이콘 URL 추출 (기존 코드와 동일)
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

      if (!lambdaResponse.ok) {
        throw new Error('앱 정보 등록에 실패했습니다.');
      }

      const result = await lambdaResponse.json();
      if (!result.success) {
        throw new Error(result.message || '앱 정보 등록에 실패했습니다.');
      }

      // 성공 시 AppListScreen으로 이동
      navigation.navigate('AppList', {
        extractedPackageId: appId,
        extractedAppName: appName,
        extractedAppIcon: iconUrl
      });

    } catch (error) {
      console.error('앱 정보 가져오기 오류:', error);
      Alert.alert("오류", error.message || "앱 정보를 가져오는 중 오류가 발생했습니다.");
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
          {/* 링크 직접 입력 섹션 추가 */}
          <View style={styles.linkInputContainer}>
            <PaperText style={styles.sectionTitle}>앱 링크 직접 입력</PaperText>
            <PaperText style={styles.instructionText}>
              구글 플레이스토어 앱 링크를 붙여넣거나, 패키지명(예: com.kakao.talk)을 직접 입력하세요.
            </PaperText>

            <PaperTextInput
              label="플레이스토어 링크 또는 패키지명"
              value={playStoreLink}
              onChangeText={setPlayStoreLink}
              placeholder="https://play.google.com/store/apps/details?id=..."
              style={styles.linkInput}
              autoCapitalize="none"
              autoCorrect={false}
            />

            <PaperButton
              mode="contained"
              onPress={handleManualLink}
              style={styles.addButton}
            >
              앱 추가하기
            </PaperButton>
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
                  아래 버튼을 눌러 구글 플레이스토어 앱을 엽니다.
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

          <PaperButton
            mode="contained"
            icon="google-play"
            onPress={handleOpenPlayStore}
            style={styles.playStoreButton}
            contentStyle={styles.playStoreButtonContent}
          >
            구글 플레이스토어 열기
          </PaperButton>
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
  const { appId, appName } = route.params;
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

      console.log('response', response);
      console.log('response status:', response.status);

      // Lambda 응답의 statusCode 확인
      if (response.status !== 200) {
        throw new Error('리뷰를 가져오는데 실패했습니다.');
      }

      const data = await response.json();
      console.log('data received:', data);

      // body가 문자열로 온 경우 처리
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
          Alert.alert("알림", "새로운 리뷰가 추가되었습니다.");
        }
      } else {
        console.error('잘못된 응답 형식:', reviewData);
        throw new Error('리뷰 데이터 형식이 올바르지 않습니다.');
      }
    } catch (err) {
      console.error('리뷰 가져오기 오류:', err);
      setError(true);
      Alert.alert(
        "오류",
        err.message || "리뷰를 가져오는 중 문제가 발생했습니다."
      );
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
        <PaperText variant="titleLarge" style={{ textAlign: 'center', flex: 1 }}>
          {appName} ({appId}) 리뷰
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

        console.log('sum_response', response);

        if (!response.ok) {
          throw new Error('요약을 가져오는데 실패했습니다.');
        }

        const data = await response.json();
        console.log('sum_data', data);

        if (data.success && data.summary) {
          setSummary(data.summary);

          // 요약 기간 정보가 있다면 표시
          if (data.date_range) {
            Alert.alert("요약 완료", `${data.date_range} 기간의 리뷰가 요약되었습니다.`);
          }
        } else {
          throw new Error(data.error || '요약 생성에 실패했습니다.');
        }
      } catch (err) {
        console.error(err);
        setError(true);
        Alert.alert("오류", err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
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
      Alert.alert("오류", "공유 중 오류가 발생했습니다.");
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

      {/* 액션 버튼 영역 - 세로로 배치 */}
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

      {/* 스크롤 가능한 영역으로 변경 */}
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
                body: { color: '#ffffff' }, // 기본 텍스트 색상
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
                link: { color: '#3498db' }, // 링크 색상은 구분하기 쉽게
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
 * 딥링크 처리 기능 통합
 */
export default function App() {
  // 앱 시작 시 딥링크 확인
  const [initialUrl, setInitialUrl] = useState(null);
  // 새로고침 함수 상태 관리
  const [refreshFunction, setRefreshFunction] = useState(null);
  // 새로고침 상태 관리
  const [isRefreshing, setIsRefreshing] = useState(false);

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

  // 마지막 새로고침 시간을 추적하기 위한 ref 추가
  const lastRefreshTimeRef = useRef(0);

  const triggerRefresh = useCallback(() => {
    log('triggerRefresh 호출됨');

    // 새로고침 중이면 무시
    if (isRefreshing) {
      log('이미 새로고침 중 - 요청 무시');
      return;
    }

    // 빠르게 연속적인 새로고침 방지 (최소 1초 간격)
    const now = Date.now();
    if (now - lastRefreshTimeRef.current < 1000) {
      log('너무 빠른 새로고침 요청 무시 (1초 이내)');
      return;
    }

    lastRefreshTimeRef.current = now;

    if (refreshFunction) {
      log('저장된 새로고침 함수 실행');
      setIsRefreshing(true);

      // 새로고침 함수 호출 후 상태 업데이트
      Promise.resolve(refreshFunction())
        .finally(() => {
          setIsRefreshing(false);
        });
    } else if (navigationRef.current) {
      log('navigationRef를 통한 새로고침');
      const currentRoute = navigationRef.current.getCurrentRoute();

      if (currentRoute?.name === 'AppList') {
        setIsRefreshing(true);

        navigationRef.current.dispatch(
          CommonActions.setParams({
            refreshTrigger: now
          })
        );

        // 일정 시간 후 새로고침 상태 해제 (안전장치)
        setTimeout(() => {
          setIsRefreshing(false);
        }, 3000);
      }
    }
  }, [refreshFunction, isRefreshing]);

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
      // 커스텀 초기 URL 처리 로직
      return initialUrl;
    },
  };

  // 앱 전반에서 사용할 컨텍스트 값
  const appContextValue = {
    triggerRefresh,
    setRefreshFunction,
    isRefreshing,
    setIsRefreshing
  };

  return (
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
              options={{ title: '구글 플레이 스토어에서 앱 추가하기' }}
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
  );
}

// 스타일 정의 (중복 제거 및 정리)
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
    paddingBottom: 32, // 하단 여백 추가
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
  linkInput: {
    backgroundColor: '#2C2C2C',
    marginBottom: 16,
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
  playStoreButton: {
    marginTop: 8,
    paddingVertical: 8,
  },
  playStoreButtonContent: {
    height: 48,
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
  },
  summaryButton: {
    marginLeft: 'auto',
  },
  screenContainer: {
    flex: 1,
    backgroundColor: '#121212',
  },
  refreshButtonContainer: {
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 8,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
});