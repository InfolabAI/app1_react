// src/screens/AISummaryScreen.tsx
import React, { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import { View, ScrollView, StyleSheet, TouchableOpacity, Share } from 'react-native';
import {
  Text as PaperText,
  Button as PaperButton,
  ActivityIndicator,
  Menu,
  IconButton
} from 'react-native-paper';
import Markdown from 'react-native-markdown-display';
import { generateChartData, AISummaryCharts, ReviewData, ChartData, TimeUnit } from '../../ReviewProcessing';
import { useToast } from '../contexts/ToastContext';
import { useAuth } from '../contexts/AuthContext';
import { fetchFromAPI } from '../api/fetchFromAPI';
import { AISummaryScreenProps } from '../types';

/**
 * AI 요약 화면 컴포넌트
 */
function AISummaryScreen({ route, navigation }: AISummaryScreenProps): React.ReactElement {
  const toast = useToast();
  const { user } = useAuth();
  const { appId, appName, sampledReviews } = route.params;
  const [summary, setSummary] = useState<string>('');
  const [summaryLoading, setSummaryLoading] = useState<boolean>(false);
  const [summaryVisible, setSummaryVisible] = useState<boolean>(false);
  const [reviews, setReviews] = useState<ReviewData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [summaryUsageExceeded, setSummaryUsageExceeded] = useState<boolean>(false);
  const [summaryCount, setSummaryCount] = useState<number>(0);
  const [summaryAttemptCount, setSummaryAttemptCount] = useState<number>(0);
  const [chartLoading, setChartLoading] = useState<boolean>(false);

  // ChartData는 ReviewProcessing의 ChartData 타입 사용
  const [chartData, setChartData] = useState<ChartData | null>(null);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('week');

  const [menuVisible, setMenuVisible] = useState<boolean>(false);
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
            onPress={shareContent}
            title="공유하기"
            leadingIcon="share-variant"
          />
        </Menu>
      ),
    });
  }, [navigation, menuVisible, summary]);

  // Check summary usage count
  const checkSummaryUsage = useCallback(async () => {
    if (!user) return;

    try {
      // Get the current date
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(now.getDate() - 7);

      // Format dates for API request
      const startDate = sevenDaysAgo.toISOString();
      const endDate = now.toISOString();

      const data = await fetchFromAPI('summary_count', {
        google_id: user.id,
        start_date: startDate,
        end_date: endDate
      });

      if (data && data.total_count !== undefined) {
        setSummaryCount(data.total_count);
        setSummaryUsageExceeded(data.total_count >= 20);
      }
    } catch (err) {
      console.error('요약 사용량 조회 오류:', err);
      // Fail safe - if we can't check the limit, don't let them generate
      setSummaryUsageExceeded(true);
      toast.show('요약 사용량을 확인할 수 없습니다.', 'error');
    }
  }, [user, toast]);

  // AI 요약 불러오기
  const fetchSummary = async () => {
    if (!user) {
      toast.show('로그인이 필요합니다.', 'error');
      return;
    }

    if (summaryUsageExceeded) {
      toast.show('일주일 동안 요약 생성 한도(20회)를 초과했습니다.', 'error');
      return;
    }

    try {
      setSummaryLoading(true);

      // 최대 3번 재시도하는 로직 추가
      let attempt = 0;
      const maxAttempts = 3;
      let lastError;

      // 재시도 간격을 더 길게 설정 (초 단위)
      const retryDelays = [5, 10];

      while (attempt < maxAttempts) {
        try {
          console.log(`AI 요약 시도 ${attempt + 1}/${maxAttempts}`);
          setSummaryAttemptCount(attempt + 1);

          const data = await fetchFromAPI('summary', {
            app_id: appId,
            google_id: user.id  // Include google_id in the request
          });

          if (data.success && data.summary) {
            setSummary(data.summary);
            setSummaryVisible(true);

            toast.show(`${data.date_range} 기간의 리뷰가 요약되었습니다. 오늘 해당 요약이 이미 실행된 적이 있었다면 요약 사용량이 증가하지 않습니다.`, 'success');
            checkSummaryUsage();
            return; // 성공했으므로 함수 종료
          } else {
            throw new Error(data.error || '요약 생성에 실패했습니다.');
          }
        } catch (err: any) {
          console.log(`재시도 ${attempt + 1}/${maxAttempts} 실패:`, err.message);
          lastError = err;
          attempt++;

          // 마지막 시도가 아니면 잠시 대기 후 재시도
          if (attempt < maxAttempts) {
            const delay = retryDelays[attempt - 1] || 15;
            console.log(`재시도 ${attempt}/${maxAttempts} - ${delay}초 후 다시 시도합니다...`);

            // 현재 상태 업데이트
            if (attempt === 1) {
              toast.show(`요약 생성 중입니다. 잠시만 기다려주세요.`, 'info');
            }

            await new Promise(resolve => setTimeout(resolve, delay * 1000));
          }
        }
      }

      // 모든 시도가 실패한 경우에만 오류 메시지 표시
      throw lastError || new Error('요약 생성에 실패했습니다.');
    } catch (err: any) {
      console.error('AI 요약 오류:', err);
      toast.show(err.message || '요약 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.', 'error');
    } finally {
      setSummaryLoading(false);
    }
  };

  // 리뷰 불러오기
  useEffect(() => {
    let isMounted = true;

    const fetchReviewData = async () => {
      try {
        setLoading(true);
        
        let formattedReviews: ReviewData[];
        
        // sampledReviews가 있으면 해당 데이터를 사용, 없으면 전체 리뷰 데이터 가져오기
        if (sampledReviews && Array.isArray(sampledReviews)) {
          formattedReviews = sampledReviews.map((review: any) => ({
            date: new Date(review.date).toLocaleDateString(),
            rawDate: new Date(review.date),
            score: review.score,
            content: review.content,
            username: review.username || '익명',
          }));
        } else {
          const data = await fetchFromAPI('app_review_read', { app_id: appId });

          if (!isMounted) return;
          if (data && data.reviews && Array.isArray(data.reviews)) {
            formattedReviews = data.reviews.map((review: any) => ({
              date: new Date(review.date).toLocaleDateString(),
              rawDate: new Date(review.date),
              score: review.score,
              content: review.content,
              username: review.username || '익명',
            }));
          } else {
            throw new Error('리뷰 데이터 형식이 올바르지 않습니다.');
          }
        }

        if (!isMounted) return;

        // 최신순 정렬
        formattedReviews.sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime());
        setReviews(formattedReviews);

        // Victory 로직 대신 ReviewProcessing의 generateChartData를 사용
        const generated = generateChartData(formattedReviews, timeUnit);
        setChartData(generated);

        // Check summary usage
        await checkSummaryUsage();
      } catch (err: any) {
        console.error('리뷰 데이터 가져오기 오류:', err);
        if (isMounted) {
          setError(true);
          toast.show('리뷰 데이터를 가져오는 중 오류가 발생했습니다.', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchReviewData();
    return () => { isMounted = false; };
  }, [appId, sampledReviews]); // sampledReviews 의존성 추가

  // 화면 진입 시 자동으로 요약 생성 시작
  useEffect(() => {
    if (!loading && !summaryLoading && !summaryVisible && !summaryUsageExceeded) {
      fetchSummary();
    }
  }, [loading]); // loading이 false가 되면 (리뷰 데이터 로딩 완료 시) 요약 시작

  // timeUnit이 변경될 때마다 차트 데이터 재생성
  useEffect(() => {
    if (reviews.length > 0) {
      setChartLoading(true);

      // setTimeout으로 UI 업데이트 시간을 확보
      setTimeout(() => {
        try {
          const generated = generateChartData(reviews, timeUnit);
          setChartData(generated);
        } catch (error) {
          console.error('차트 데이터 생성 오류:', error);
          toast.show('차트 데이터를 생성하는 중 오류가 발생했습니다.', 'error');
        } finally {
          setChartLoading(false);
        }
      }, 100);
    }
  }, [timeUnit, reviews]);

  const shareContent = async () => {
    try {
      setMenuVisible(false);
      await Share.share({
        message: `${appName} 리뷰 AI 요약:\n\n${summary}`,
        title: `${appName} 리뷰 요약`
      });
    } catch (error) {
      console.error('공유 오류:', error);
      toast.show('공유 중 오류가 발생했습니다.', 'error');
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <PaperText style={{ marginBottom: 8 }}>리뷰 데이터 분석 중...</PaperText>
        <ActivityIndicator animating />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.container}>
        <PaperText variant="titleLarge" style={{ textAlign: 'center', margin: 20 }}>
          데이터를 불러오는 중 오류가 발생했습니다
        </PaperText>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.container}
      ref={scrollViewRef}
      contentContainerStyle={styles.scrollContentContainer}
    >
      <PaperText variant="titleLarge" style={{ textAlign: 'center', margin: 20 }}>
        {appName}
      </PaperText>
      
      {/* 샘플링된 리뷰 사용 안내 */}
      {sampledReviews && (
        <View style={styles.samplingInfoContainer}>
          <PaperText style={styles.samplingInfoText}>
            📊 샘플링된 {sampledReviews.length}개의 대표 리뷰로 분석되었습니다
          </PaperText>
        </View>
      )}

      {/* Usage limit warning */}
      {summaryUsageExceeded && !summaryVisible && (
        <View style={styles.usageLimitWarning}>
          <PaperText style={styles.usageLimitText}>
            일주일 동안 요약 생성 한도(20회)를 초과했습니다.
          </PaperText>
        </View>
      )}

      {/* 텍스트 요약 상태 / 내용 */}
      <View style={styles.summarySection}>
        {!summaryVisible ? (
          <>
            {summaryUsageExceeded ? (
              <View style={styles.usageLimitWarning}>
                <PaperText style={styles.usageLimitText}>
                  일주일 동안 요약 생성 한도(20회)를 초과했습니다.
                </PaperText>
              </View>
            ) : summaryLoading ? (
              <View style={styles.summaryLoadingContainer}>
                <ActivityIndicator size="small" color="#6200ee" style={{ marginRight: 8 }} />
                <PaperText style={styles.summaryLoadingText}>
                  AI 요약 생성 중입니다. 최대 몇 분이 소요될 수 있으며 처리가 완료될 때까지 기다려주세요.
                </PaperText>
              </View>
            ) : (
              <View style={styles.summaryLoadingContainer}>
                <ActivityIndicator size="small" color="#6200ee" style={{ marginRight: 8 }} />
                <PaperText style={styles.summaryLoadingText}>
                  AI 요약 준비 중입니다...
                </PaperText>
              </View>
            )}
          </>
        ) : (
          <>
            <View style={styles.buttonContainer}>
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
          </>
        )}
      </View>

      {/* 시간 단위 선택 */}
      <View style={styles.timeUnitSelector}>
        <PaperText style={styles.sectionTitle}>시간 단위 선택:</PaperText>
        <View style={styles.timeUnitButtons}>
          <PaperButton
            mode={timeUnit === 'day' ? 'contained' : 'outlined'}
            onPress={() => setTimeUnit('day')}
            style={styles.timeUnitButton}
            disabled={chartLoading}
          >
            일별
          </PaperButton>
          <PaperButton
            mode={timeUnit === 'week' ? 'contained' : 'outlined'}
            onPress={() => setTimeUnit('week')}
            style={styles.timeUnitButton}
            disabled={chartLoading}
          >
            주별
          </PaperButton>
          <PaperButton
            mode={timeUnit === 'month' ? 'contained' : 'outlined'}
            onPress={() => setTimeUnit('month')}
            style={styles.timeUnitButton}
            disabled={chartLoading}
          >
            월별
          </PaperButton>
        </View>
      </View>

      {/* 차트 로딩 상태 또는 차트 */}
      {chartLoading ? (
        <View style={styles.chartLoadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <PaperText style={styles.chartLoadingText}>차트 업데이트 중...</PaperText>
        </View>
      ) : chartData ? (
        <AISummaryCharts chartData={chartData} />
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    padding: 12, 
    backgroundColor: '#121212' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#121212' 
  },
  scrollContentContainer: { 
    flexGrow: 1, 
    padding: 12 
  },
  summarySection: {
    marginTop: 16,
    marginBottom: 24,
    padding: 16,
  },
  usageLimitWarning: {
    backgroundColor: '#FF5252',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  usageLimitText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  summaryLoadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 16,
    backgroundColor: '#2D2D2D',
    borderRadius: 8,
    padding: 16,
    borderWidth: 1,
    borderColor: '#444',
  },
  summaryLoadingText: {
    color: '#ccc',
    fontSize: 14,
    flex: 1,
    lineHeight: 20,
  },
  buttonContainer: { 
    marginBottom: 10, 
    paddingHorizontal: 12 
  },
  actionButton: { 
    marginVertical: 5, 
    width: '100%' 
  },
  actionButtonContent: { 
    height: 48 
  },
  markdownContainer: {
    flex: 1, 
    backgroundColor: '#1E1E1E', 
    padding: 16,
    borderRadius: 8, 
    elevation: 2
  },
  timeUnitSelector: {
    marginBottom: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    padding: 16,
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 12, 
    color: '#fff' 
  },
  timeUnitButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  timeUnitButton: {
    flex: 1,
    marginHorizontal: 4,
  },
  chartLoadingContainer: {
    padding: 40,
    marginBottom: 16,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    height: 300,
  },
  chartLoadingText: {
    color: '#fff',
    fontSize: 16,
    marginTop: 16,
  },
  samplingInfoContainer: {
    backgroundColor: '#4CAF50',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginBottom: 16,
  },
  samplingInfoText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 'bold',
    textAlign: 'center',
  },
});

export default AISummaryScreen;