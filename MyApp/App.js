// App.js
import React, { useState, useEffect, useLayoutEffect, useRef } from 'react';
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
} from 'react-native';

// React Navigation
import { NavigationContainer, DarkTheme as NavDarkTheme, useNavigation, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

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
import { useFocusEffect } from '@react-navigation/native';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

// 1. 필요한 import 추가
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import axios from 'axios'; // axios 설치 필요: npm install axios
import cheerio from 'react-native-cheerio'; // cheerio 설치 필요: npm install react-native-cheerio

// 파일 상단에 추가
const DEBUG = true;  // 디버그 모드 플래그

const log = (...args) => {
  if (DEBUG) {
    console.log('[DEBUG]', ...args);
    // Alert로도 표시 (개발 중에만)
    Alert.alert('Debug Log', JSON.stringify(args, null, 2));
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
  // 앱 목록을 state로 관리 (id, name, icon)
  const [appList, setAppList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // 검색어 상태
  const [searchQuery, setSearchQuery] = useState('');

  // 필터링된 앱 목록
  const [filteredAppList, setFilteredAppList] = useState([]);

  // 앱 목록 가져오기
  const fetchAppList = async () => {
    try {
      setLoading(true);
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
      const apps = data.apps || [];

      // 앱 정보를 필요한 형식으로 변환
      const formattedApps = apps.map(app => ({
        id: app.app_id,
        name: app.app_name,
        icon: app.app_logo || 'https://via.placeholder.com/180'
      }));

      setAppList(formattedApps);
      setFilteredAppList(formattedApps);
    } catch (err) {
      console.error('앱 목록 가져오기 오류:', err);
      setError(err.message);
      Alert.alert('오류', '앱 목록을 가져오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 컴포넌트 마운트 시 앱 목록 가져오기
  useEffect(() => {
    fetchAppList();
  }, []);

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

  // 앱 삭제 함수
  const handleRemoveApp = (targetId) => {
    setAppList(appList.filter((app) => app.id !== targetId));
  };

  const handleRemoveAppConfirm = (targetId) => {
    Alert.alert(
      "삭제 확인",
      "정말 삭제하시겠습니까?",
      [
        { text: "아니오", style: "cancel" },
        { text: "예", onPress: () => handleRemoveApp(targetId) }
      ]
    );
  };

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

        {/* 삭제 버튼 (오른쪽) */}
        <PaperButton
          mode="outlined"
          onPress={() => handleRemoveAppConfirm(item.id)}
        >
          삭제
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
  if (loading) {
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
      <PaperText variant="titleLarge" style={styles.title}>
        앱 목록
      </PaperText>

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
        <PaperButton
          mode="contained"
          icon="plus"
          onPress={() => navigation.navigate('Help')}
          style={styles.addButton}
        >
          구글 플레이스토어에서 가져오기
        </PaperButton>
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
 * (기존 코드 예시 그대로)
 */
function ReviewScreen({ route }) {
  const { appId, appName } = route.params;
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const navigation = useNavigation();

  useEffect(() => {
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
        console.log('response statusText:', response.statusText);
        console.log('response headers:', [...response.headers.entries()]);
        console.log('response type:', response.type);
        console.log('response url:', response.url);

        // Lambda 응답의 statusCode 확인
        if (response.status !== 200) {
          throw new Error(data.error || '리뷰를 가져오는데 실패했습니다.');
        }

        const data = await response.json();
        // API Gateway를 통해 Lambda 함수를 호출할 때 응답 구조 이해하기
        // 1. Lambda 함수는 { statusCode: xxx, body: xxx } 형태로 응답을 반환함
        // 2. API Gateway는 이 응답을 그대로 클라이언트에 전달함
        // 3. fetch 요청 후 response.json()을 호출하면 Lambda 응답의 body 내용이 파싱되어 data에 들어옴
        // 4. 로그를 보면 data.statusCode가 undefined이고 data.body도 undefined임
        // 5. 즉, data 자체가 이미 Lambda 응답의 body 내용이므로 별도로 data.body로 접근할 필요 없음
        // 6. 따라서 data 자체를 reviewData로 사용해야 함

        console.log('data.statusCode', data.statusCode);
        console.log('data.body exists?', data.body !== undefined);
        console.log('data.body type:', typeof data.body);
        console.log('data.body content:', data.body);

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

    fetchReviews();
  }, [appId]);

  // 에러 화면 개선
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
          앱을 찾을 수 없습니다
        </PaperText>
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

  // Add this to your component imports
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

      // RNHTMLtoPDF 모듈이 제대로 초기화되었는지 확인
      if (!RNHTMLtoPDF) {
        throw new Error('PDF 변환 모듈이 초기화되지 않았습니다.');
      }

      // HTML 템플릿 생성
      const htmlContent = `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${appName} 리뷰 요약</title>
            <style>
              body { font-family: arial, sans-serif; margin: 20px; }
              h1 { color: #333; text-align: center; }
              .content { line-height: 1.6; }
            </style>
          </head>
          <body>
            <h1>${appName} 리뷰 AI 요약</h1>
            <div class="content">
              ${summary.replace(/\n/g, '<br/>')}
            </div>
          </body>
        </html>
      `;

      // 에뮬레이터 환경에서 PDF 생성 문제 해결
      let directory;

      try {
        // 먼저 문서 디렉토리 확인 (더 안정적인 옵션)
        const documentDir = FileSystem.documentDirectory;
        const dirInfo = await FileSystem.getInfoAsync(documentDir);

        if (dirInfo.exists && dirInfo.isDirectory) {
          directory = documentDir;
        } else {
          // 폴백으로 캐시 디렉토리 사용
          directory = FileSystem.cacheDirectory;
        }

        console.log('PDF 저장 디렉토리:', directory);
      } catch (dirError) {
        console.log('디렉토리 확인 오류:', dirError);
        // 오류 발생 시 기본값으로 캐시 디렉토리 사용
        directory = FileSystem.cacheDirectory;
      }

      const options = {
        html: htmlContent,
        filename: `${appName.replace(/\s+/g, '_')}_리뷰_요약`,
        directory: directory,
        base64: true, // base64 형식으로도 반환 (파일 접근 문제 대비)
      };

      console.log('PDF 변환 시작...');
      try {
        const file = await RNHTMLtoPDF.convert(options);
        console.log('PDF 변환 결과:', file);

        if (!file) {
          throw new Error('PDF 변환 결과가 없습니다.');
        }

        // file 객체의 구조 확인 및 처리
        const filePath = file.filePath || file.filepath || file.path;
        if (!filePath) {
          throw new Error('PDF 파일 경로가 생성되지 않았습니다.');
        }

        console.log('PDF 변환 완료:', filePath);

        // PDF 생성 성공
        console.log('생성된 PDF 경로:', filePath);

        Alert.alert(
          "PDF 생성 완료",
          "PDF가 생성되었습니다. 저장 위치를 선택해주세요.",
          [
            {
              text: "취소",
              style: "cancel"
            },
            {
              text: "저장/공유",
              onPress: async () => {
                try {
                  // 파일 경로가 file:// 프로토콜로 시작하는지 확인
                  const fullPath = filePath.startsWith('file://')
                    ? filePath
                    : `file://${filePath}`;

                  // 파일 존재 여부 확인 전에 경로 정규화
                  const normalizedPath = fullPath.replace('file://', '');

                  try {
                    // 파일이 존재하는지 확인
                    const fileInfo = await FileSystem.getInfoAsync(normalizedPath);
                    if (!fileInfo.exists) {
                      console.error('파일이 존재하지 않음:', normalizedPath);

                      // base64 데이터가 있으면 임시 파일 생성 시도
                      if (file.base64) {
                        console.log('base64 데이터로 임시 파일 생성 시도');
                        const tempFilePath = `${FileSystem.cacheDirectory}temp_${Date.now()}.pdf`;
                        await FileSystem.writeAsStringAsync(
                          tempFilePath,
                          file.base64,
                          { encoding: FileSystem.EncodingType.Base64 }
                        );

                        // 새로 생성한 파일 공유
                        await Sharing.shareAsync(tempFilePath, {
                          mimeType: 'application/pdf',
                          dialogTitle: `${appName} 리뷰 요약`,
                          UTI: 'com.adobe.pdf'
                        });
                        return;
                      }

                      throw new Error('파일을 찾을 수 없습니다.');
                    }

                    console.log('공유할 파일 경로:', normalizedPath);
                    console.log('파일 정보:', fileInfo);

                    // 파일 공유
                    await Sharing.shareAsync(normalizedPath, {
                      mimeType: 'application/pdf',
                      dialogTitle: `${appName} 리뷰 요약`,
                      UTI: 'com.adobe.pdf'
                    });
                  } catch (fsError) {
                    console.error('파일 시스템 접근 오류:', fsError);
                    // 파일 시스템 접근 실패 시 base64 데이터로 재시도
                    if (file.base64) {
                      console.log('base64 데이터로 임시 파일 생성 시도');
                      const tempFilePath = `${FileSystem.cacheDirectory}temp_${Date.now()}.pdf`;
                      await FileSystem.writeAsStringAsync(
                        tempFilePath,
                        file.base64,
                        { encoding: FileSystem.EncodingType.Base64 }
                      );

                      // 새로 생성한 파일 공유
                      await Sharing.shareAsync(tempFilePath, {
                        mimeType: 'application/pdf',
                        dialogTitle: `${appName} 리뷰 요약`,
                        UTI: 'com.adobe.pdf'
                      });
                    } else {
                      throw new Error('파일 시스템 접근에 실패했습니다.');
                    }
                  }
                } catch (error) {
                  console.error('파일 공유 상세 오류:', error);
                  Alert.alert("오류", `파일 공유 중 오류가 발생했습니다: ${error.message}`);
                }
              }
            }
          ]
        );
      } catch (pdfError) {
        console.error('PDF 변환 중 오류 발생:', pdfError);
        throw new Error(`PDF 변환 실패: ${pdfError.message}`);
      }
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      Alert.alert("오류", `PDF 생성 중 오류가 발생했습니다: ${error.message}`);
    } finally {
      setDownloadingPDF(false);
    }
  };

  // 파일 공유 함수
  const shareFile = async (filePath) => {
    try {
      // 파일 경로가 file:// 프로토콜로 시작하는지 확인
      const fullPath = filePath.startsWith('file://')
        ? filePath
        : `file://${filePath}`;

      // 파일이 존재하는지 확인
      const fileInfo = await FileSystem.getInfoAsync(fullPath);
      if (!fileInfo.exists) {
        throw new Error('파일을 찾을 수 없습니다.');
      }

      console.log('공유할 파일 경로:', fullPath);
      console.log('파일 정보:', fileInfo);

      // 파일 공유
      await Sharing.shareAsync(fullPath, {
        mimeType: 'application/pdf',
        dialogTitle: `${appName} 리뷰 요약`,
        UTI: 'com.adobe.pdf'
      });
    } catch (error) {
      console.error('파일 공유 상세 오류:', error);
      Alert.alert("오류", `파일 공유 중 오류가 발생했습니다: ${error.message}`);
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

  // 앱이 백그라운드에서 실행될 때 딥링크 처리
  useEffect(() => {
    // 초기 URL 확인
    const getInitialURL = async () => {
      const url = await Linking.getInitialURL();
      if (url) {
        console.log('초기 URL:', url);
        setInitialUrl(url);
      }
    };

    getInitialURL();

    // 앱 실행 중 URL 리스너
    const subscription = Linking.addEventListener('url', ({ url }) => {
      console.log('앱 실행 중 수신된 URL:', url);
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
      // 커스텀 초기 URL 처리 로직
      return initialUrl;
    },
  };

  return (
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
              title: '앱 목록',
              headerRight: () => (
                <IconButton
                  icon="help-circle-outline"
                  onPress={() => navigationRef.current?.navigate('Help')}
                  color="#fff"
                />
              ),
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
  addButton: {
    width: '100%',
    paddingVertical: 8,
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
});