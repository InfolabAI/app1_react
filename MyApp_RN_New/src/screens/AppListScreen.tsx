// src/screens/AppListScreen.tsx
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback, useContext } from 'react';
import {
  View, ScrollView, FlatList, TouchableOpacity, StyleSheet, Image,
  RefreshControl, Linking
} from 'react-native';
import {
  Text as PaperText, TextInput as PaperTextInput,
  Button as PaperButton, ActivityIndicator,
  Menu, IconButton, Surface, Avatar, Dialog, Portal, Divider
} from 'react-native-paper';

import AppContext from '../contexts/AppContext';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchFromAPI } from '../api/fetchFromAPI';
import { AppListScreenProps, AppItem } from '../types';
import { log } from '../utils';

/**
 * 앱 목록 화면 컴포넌트
 */
function AppListScreen({ navigation, route }: AppListScreenProps): React.ReactElement {
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
  const [summaryCount, setSummaryCount] = useState<number>(0);
  const [summaryCountLoading, setSummaryCountLoading] = useState<boolean>(false);

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

  const fetchSummaryCount = useCallback(async () => {
    if (!user) return;

    try {
      setSummaryCountLoading(true);

      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);

      const startDate = sevenDaysAgo.toISOString();
      const endDate = now.toISOString();

      const data = await fetchFromAPI('summary_count', {
        google_id: user.id,
        start_date: startDate,
        end_date: endDate
      });

      if (data && data.total_count !== undefined) {
        setSummaryCount(data.total_count);
      }
    } catch (err) {
      console.error('요약 사용량 조회 오류:', err);
    } finally {
      setSummaryCountLoading(false);
    }
  }, [user]);

  // 화면이 포커스될 때마다 요약 사용량을 다시 불러오기
  React.useLayoutEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      if (user) {
        fetchSummaryCount();
      }
    });

    return unsubscribe;
  }, [navigation, user, fetchSummaryCount]);

  const handleSummaryCountPress = useCallback(() => {
    toast.show('최근 7일간 AI 요약 사용량입니다. 일주일에 최대 20회까지 사용 가능합니다.', 'info');
  }, [toast]);

  useEffect(() => {
    if (user) {
      fetchSummaryCount();
    }
  }, [user, fetchSummaryCount]);

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

  useEffect(() => {
    const setupRefreshFunction = () => {
      if (initialLoadDone && appContextRef.current?.setRefreshFunction) {
        appContextRef.current.setRefreshFunction(() => handleRefreshRef.current());
      }
    };

    const cleanupRefreshFunction = () => {
      if (appContextRef.current?.setRefreshFunction) {
        appContextRef.current.setRefreshFunction(null);
      }
    };

    // 화면 포커스 시 함수 설정
    const onFocus = navigation.addListener('focus', setupRefreshFunction);
    
    // 화면 블러 시 함수 제거
    const onBlur = navigation.addListener('blur', cleanupRefreshFunction);
    
    // 화면 마운트 시 함수 설정
    if (initialLoadDone) {
      setupRefreshFunction();
    }

    return () => {
      onFocus();
      onBlur();
      cleanupRefreshFunction();
    };
  }, [navigation, initialLoadDone]);

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
        defaultSource={require('../../assets/app-placeholder.png')}
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
          <View style={styles.userInfoRight}>
            <TouchableOpacity onPress={handleSummaryCountPress}>
              <PaperText style={styles.summaryCountText}>
                {summaryCountLoading ? '...' : `${summaryCount}/20`}
              </PaperText>
            </TouchableOpacity>
            <IconButton
              icon="cog"
              mode="contained"
              size={20}
              onPress={handleShowSettings}
              style={styles.settingsButton}
            />
          </View>
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
        
        {/* 샘플링 데모 버튼 */}
        <View style={styles.demoButtonRow}>
          <PaperButton
            mode="outlined"
            icon="flask"
            onPress={() => navigation.navigate('SamplingDemo')}
            style={styles.demoButton}
          >
            리뷰 샘플링 데모
          </PaperButton>
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
  userInfoRight: {
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
  summaryCountText: {
    color: '#4CAF50',
    fontSize: 14,
    fontWeight: 'bold',
    marginRight: 8
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
  demoButtonRow: { marginTop: 8 },
  demoButton: { width: '100%', borderColor: '#BB86FC', marginVertical: 4 },

  // Search styles
  searchContainer: { marginBottom: 8, paddingHorizontal: 12 },
  searchInput: { backgroundColor: '#2A2A2A' },
  searchResultInfo: {
    paddingHorizontal: 16, paddingVertical: 8,
    backgroundColor: '#222', marginBottom: 8, borderRadius: 4
  },
  searchResultText: { fontSize: 14, color: '#bbb' },
});

export default AppListScreen;