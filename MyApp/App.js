// 명령: AISummaryScreen 에서 요약 길이가 폰을 넘어가는데 드래그가 안되니 되게 해줘. 그리고 이 내용을 복사할 수 있게 해줘. pdf 로 다운 받을 수 있는 기능도 추가해줘.

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
  Clipboard,
  Linking,            // 스토어 앱 열기 위해 추가
} from 'react-native';

// React Navigation
import { NavigationContainer, DarkTheme as NavDarkTheme, useNavigation } from '@react-navigation/native';
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
 * 앱 목록 + 추가/삭제 기능
 * 우측 상단에 Help 버튼 → HelpScreen 으로 이동
 */
function AppListScreen({ navigation, route }) {
  // 앱 목록을 state로 관리 (id, name)
  const [appList, setAppList] = useState([
    { id: 'com.nianticlabs.pokemongo', name: 'Pokémon GO' },
    { id: 'com.kakao.talk', name: '카카오톡' },
    { id: 'com.nhn.android.search', name: '네이버' },
  ]);

  // 새 앱 추가를 위한 입력값
  const [newAppId, setNewAppId] = useState('');
  const [newAppName, setNewAppName] = useState('');

  // ------------------------------------------
  // 1) 우측 상단에 Help 버튼 추가
  // ------------------------------------------
  useLayoutEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <PaperButton
          mode="text"
          onPress={() => navigation.navigate('Help')}
        >
          앱 패키지명 자동 입력
        </PaperButton>
      ),
    });
  }, [navigation]);

  // ------------------------------------------
  // 2) HelpScreen 에서 추출해 넘겨준 packageId 자동 반영
  // ------------------------------------------
  useEffect(() => {
    if (route.params?.extractedPackageId) {
      setNewAppId(route.params.extractedPackageId);
    }
  }, [route.params?.extractedPackageId]);

  // 앱 추가 함수
  const handleAddApp = () => {
    if (newAppId.trim() && newAppName.trim()) {
      if (appList.some((app) => app.id === newAppId)) {
        Alert.alert('오류', '이미 존재하는 앱 id입니다.');
        return;
      }
      setAppList([...appList, { id: newAppId, name: newAppName }]);
      setNewAppId('');
      setNewAppName('');
    } else {
      Alert.alert('오류', '앱 ID와 앱 이름을 모두 입력하세요.');
    }
  };

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

  const renderItem = ({ item }) => {
    return (
      <View style={styles.itemRowContainer}>
        {/* 앱 이름 (왼쪽) */}
        <PaperText style={{ flex: 1 }}>
          {item.name} ({item.id})
        </PaperText>

        {/* 리뷰 보기 (중간) */}

        <PaperButton
          mode="contained"
          onPress={() => {
            navigation.navigate('Review', { appId: item.id, appName: item.name });
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

  return (
    <View style={styles.container}>
      <PaperText variant="titleLarge" style={styles.title}>
        앱 목록
      </PaperText>

      {/* 새 앱 추가 영역 */}
      <View style={styles.addContainer}>
        <PaperTextInput
          style={styles.input}
          label="앱 패키지명 (예: com.kakao.talk)"
          value={newAppId}
          onChangeText={setNewAppId}
        />
        <PaperTextInput
          style={styles.input}
          label="앱 이름 (예: 카카오톡)"
          value={newAppName}
          onChangeText={setNewAppName}
        />
        <PaperButton
          mode="contained"
          onPress={handleAddApp}
          style={{ marginTop: 5 }}
        >
          추가
        </PaperButton>
      </View>

      <FlatList
        data={appList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

/** 
 * 3) HelpScreen
 * - "구글 스토어 열기" 버튼 → 스토어 앱 오픈 (Android)
 * - "링크" TextInput에 붙여넣기
 * - "입력" 누르면 id= 뒤의 패키지명을 추출 → AppListScreen 으로 전달
 */
function HelpScreen({ navigation }) {
  const [playStoreLink, setPlayStoreLink] = useState('');

  // 구글 스토어 앱 열기 (Android 전용)
  const handleOpenPlayStore = () => {
    // 간단히 플레이 스토어 메인 or 특정 앱으로 열 수도 있음
    // market:// 를 열 경우 Android 기기에서 스토어 앱이 실행됨
    Linking.openURL('market://search?q=카카오톡')
      .catch((err) => {
        console.warn("스토어 앱을 열 수 없습니다:", err);
        // fallback: 웹 브라우저로 열기
        Linking.openURL('https://play.google.com/store');
      });
  };

  // 링크에서 패키지명 추출 -> AppListScreen으로 이동
  const handleParseLink = () => {
    // 예: https://play.google.com/store/apps/details?id=com.nhn.android.search
    // 정규식으로 id= 뒤부터 & 전까지 추출
    const match = playStoreLink.match(/id=([^&]+)/);
    if (match && match[1]) {
      const extractedId = match[1];
      // 추출 성공 → AppListScreen 으로 보내면서 뒤로가기
      navigation.navigate('AppList', { extractedPackageId: extractedId });
    } else {
      Alert.alert("오류", "유효한 구글플레이 링크가 아닙니다.");
    }
  };

  return (
    <View style={[styles.container, { justifyContent: 'center' }]}>
      <PaperText variant="titleLarge" style={{ marginBottom: 12 }}>
        패키지명 자동 입력 가이드
      </PaperText>
      <PaperText style={{ marginBottom: 12 }}> 1. 아래 버튼을 눌러 구글 플레이스토어를 엽니다.  </PaperText>
      <PaperText style={{ marginBottom: 12 }}> 2. 원하는 앱을 찾아 누릅니다.  </PaperText>
      <PaperText style={{ marginBottom: 12 }}> 3. 앱 화면 우측 상단의 점 세 개를 누른 뒤, “공유”를 선택합니다.  </PaperText>
      <PaperText style={{ marginBottom: 12 }}> 4. 표시된 링크를 복사하고 다시 이 앱으로 돌아옵니다.  </PaperText>
      <PaperText style={{ marginBottom: 12 }}> 5. 아래 텍스트 상자에 링크를 붙여넣고, “입력” 버튼을 누릅니다.  </PaperText>

      <PaperButton
        mode="contained"
        onPress={handleOpenPlayStore}
        style={{ marginBottom: 12 }}
      >
        구글 스토어 앱 열기
      </PaperButton>

      <PaperTextInput
        label="구글플레이 링크"
        value={playStoreLink}
        onChangeText={setPlayStoreLink}
        style={styles.input}
      />

      <PaperButton
        mode="contained"
        onPress={handleParseLink}
        style={{ marginTop: 12 }}
      >
        입력
      </PaperButton>
    </View >
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
    // AWS API Gateway + Lambda 엔드포인트 (POST로 호출)
    const LAMBDA_URL = 'https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF';
    fetch(LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        is_summary: 'false'
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        return response.json(); // 이미 JSON 배열 반환
      })
      .then((data) => {
        // data가 [{ at: '2025-03-12 ...', score: 1, content: '...' }, ...] 라고 가정
        if (!Array.isArray(data) || data.length === 0) {
          setError(true);
        } else {
          setReviews(data);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
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
            onPress={copyToClipboard}
            title="복사하기"
            leadingIcon="content-copy"
          />
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
    // AWS API Gateway + Lambda 엔드포인트 (POST로 호출)
    const LAMBDA_URL = 'https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF';
    fetch(LAMBDA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        app_id: appId,
        is_summary: 'true'
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }
        return response.text();
      })
      .then((data) => {
        console.log('응답 데이터:', data); // 디버깅용 로그 추가
        console.log('데이터 타입:', typeof data);
        console.log('데이터 길이:', data.length);

        if (data && data.length > 0) {
          setSummary(data);
        } else {
          console.error('빈 응답 데이터 받음');
          setError(true);
        }
      })
      .catch((err) => {
        console.error(err);
        setError(true);
      })
      .finally(() => {
        setLoading(false);
      });
  }, [appId]);

  // 클립보드에 복사하는 함수
  const copyToClipboard = () => {
    Clipboard.setString(summary);
    Alert.alert("복사 완료", "요약 내용이 클립보드에 복사되었습니다.");
    setMenuVisible(false);
  };

  // PDF로 저장하는 함수
  const downloadAsPDF = async () => {
    try {
      setDownloadingPDF(true);
      setMenuVisible(false);

      // HTML 템플릿 생성
      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <title>${appName} 리뷰 요약</title>
            <style>
              body { font-family: Arial, sans-serif; margin: 20px; }
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

      const options = {
        html: htmlContent,
        fileName: `${appName.replace(/\s+/g, '_')}_리뷰_요약`,
        directory: 'Documents',
      };

      const file = await RNHTMLtoPDF.convert(options);

      // PDF 생성 성공
      if (file.filePath) {
        Alert.alert(
          "PDF 생성 완료",
          `${file.filePath}에 저장되었습니다.`,
          [
            {
              text: "확인",
              style: "cancel"
            },
            {
              text: "공유하기",
              onPress: () => shareFile(file.filePath)
            }
          ]
        );
      }
    } catch (error) {
      console.error('PDF 생성 오류:', error);
      Alert.alert("오류", "PDF 생성 중 오류가 발생했습니다.");
    } finally {
      setDownloadingPDF(false);
    }
  };

  // 파일 공유 함수
  const shareFile = async (filePath) => {
    try {
      await Sharing.shareAsync(filePath);
    } catch (error) {
      console.error('파일 공유 오류:', error);
      Alert.alert("오류", "파일 공유 중 오류가 발생했습니다.");
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

      {/* 액션 버튼 영역 */}
      <View style={styles.buttonContainer}>
        <PaperButton
          mode="contained"
          onPress={copyToClipboard}
          icon="content-copy"
          style={styles.actionButton}
        >
          복사하기
        </PaperButton>

        <PaperButton
          mode="contained"
          onPress={downloadAsPDF}
          icon="file-pdf-box"
          style={styles.actionButton}
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
          onLongPress={copyToClipboard}
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
 * PaperProvider로 감싸서 Paper 테마 적용
 */
export default function App() {
  return (
    <PaperProvider theme={CombinedDarkTheme}>
      <NavigationContainer theme={CombinedDarkTheme}>
        <Stack.Navigator>
          <Stack.Screen
            name="Home"
            component={HomeScreen}
            options={{ title: '메인화면' }}
          />
          <Stack.Screen
            name="AppList"
            component={AppListScreen}
            options={{ title: '앱 목록' }}
          />
          <Stack.Screen
            name="Help"
            component={HelpScreen}
            options={{ title: '도움말' }}
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

// 간단 스타일
const styles = StyleSheet.create({
  homeContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  container: {
    flex: 1,
    padding: 12,
  },
  title: {
    textAlign: 'center',
    marginBottom: 12,
  },
  addContainer: {
    marginBottom: 10,
  },
  input: {
    marginBottom: 5,
  },
  // 앱 목록 행 배치 (가로방향)
  itemRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: 1,
    borderColor: '#ccc',
    padding: 12,
  },
  reviewItemContainer: {
    padding: 15,
    borderBottomWidth: 1,
    borderColor: '#ccc',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 10,
  },
  actionButton: {
    margin: 5,
  },
  markdownContainer: {
    flex: 1,
    backgroundColor: '#222', // 다크테마에 맞는 배경색
    padding: 16,
    borderRadius: 8,
    elevation: 2,
  },
  scrollContainer: {
    flex: 1,
  },
  scrollContentContainer: {
    flexGrow: 1,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 1000,
  },
});
