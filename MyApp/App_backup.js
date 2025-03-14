// App.js
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// RN 기본 컴포넌트
import { View, Text, Button, FlatList, TouchableOpacity } from 'react-native';

// 스택 네비게이션 생성
const Stack = createNativeStackNavigator();

/** 
 * 1) HomeScreen 
 * 첫 화면, "리뷰 로딩" 버튼 → AppListScreen으로 이동
 */
function HomeScreen({ navigation }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: 20, marginBottom: 20 }}>메인 화면</Text>
      <Button
        title="리뷰 로딩"
        onPress={() => {
          // AppListScreen 으로 이동
          navigation.navigate('AppList');
        }}
      />
    </View>
  );
}

/** 
 * 2) AppListScreen 
 * 구글 앱스토어의 앱 목록 (더미 데이터) 표시, 
 * 특정 앱 누르면 ReviewScreen으로 이동
 */
function AppListScreen({ navigation }) {
  // 더미 앱 목록 예시
  const appList = [
    { id: '1', name: '카카오톡' },
    { id: '2', name: '네이버' },
    { id: '3', name: '쿠팡' },
    { id: '4', name: '직방' },
    { id: '5', name: '배달의민족' },
  ];

  // 각 앱을 누르면 navigate('Review', { appId: ..., appName: ... })
  const renderItem = ({ item }) => (
    <TouchableOpacity
      style={{
        padding: 15,
        borderBottomWidth: 1,
        borderColor: '#ccc',
      }}
      onPress={() => {
        navigation.navigate('Review', {
          appId: item.id,
          appName: item.name,
        });
      }}
    >
      <Text style={{ fontSize: 16 }}>{item.name}</Text>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 20, textAlign: 'center', marginTop: 20 }}>
        앱 목록
      </Text>
      <FlatList
        data={appList}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
      />
    </View>
  );
}

/** 
 * 3) ReviewScreen
 * 선택된 앱에 대한 리뷰 표시 (더미 데이터 예시)
 */
function ReviewScreen({ route }) {
  // route.params로 받아온 appId, appName
  const { appId, appName } = route.params;

  // 더미 리뷰 데이터
  // 실제 크롤링 결과를 서버에서 fetch 해올 수도 있음.
  const reviews = [
    {
      date: '2025-01-01',
      text: '정말 유용한 앱이네요! 편리합니다.',
      rating: 5,
    },
    {
      date: '2025-01-03',
      text: '가끔 렉이 걸리지만 대체로 만족!',
      rating: 4,
    },
    {
      date: '2025-01-05',
      text: '업데이트 후 실행이 안되는 오류가 있네요.',
      rating: 2,
    },
  ];

  const renderItem = ({ item }) => (
    <View style={{ padding: 15, borderBottomWidth: 1, borderColor: '#ccc' }}>
      <Text>{`날짜: ${item.date}`}</Text>
      <Text>{`리뷰: ${item.text}`}</Text>
      <Text>{`평점: ${item.rating}`}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1 }}>
      <Text style={{ fontSize: 20, textAlign: 'center', margin: 20 }}>
        {appName} (id: {appId}) 리뷰
      </Text>
      <FlatList
        data={reviews}
        keyExtractor={(_, index) => index.toString()}
        renderItem={renderItem}
      />
    </View>
  );
}

/**
 * 메인 App 컴포넌트: NavigationContainer + Stack Navigator 설정
 */
export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        {/* 1) 홈 화면 */}
        <Stack.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: '메인화면' }}
        />
        {/* 2) 앱 목록 화면 */}
        <Stack.Screen
          name="AppList"
          component={AppListScreen}
          options={{ title: '앱 목록' }}
        />
        {/* 3) 리뷰 화면 */}
        <Stack.Screen
          name="Review"
          component={ReviewScreen}
          options={{ title: '앱 리뷰' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
