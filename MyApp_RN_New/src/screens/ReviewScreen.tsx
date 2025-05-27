// src/screens/ReviewScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, StyleSheet, Image, FlatList } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import {
  Text as PaperText,
  Button as PaperButton,
  ActivityIndicator
} from 'react-native-paper';
import { useToast } from '../contexts/ToastContext';
import { fetchFromAPI } from '../api/fetchFromAPI';
import { ReviewScreenProps, Review, RootStackParamList } from '../types';
import { NavigationProp } from '@react-navigation/native';
import { sampleReviews, SamplingProgress, SamplingResult } from '../services/sampling';
import SamplingProgressBar from '../components/SamplingProgress';

/**
 * 앱 리뷰 화면 컴포넌트
 */
function ReviewScreen({ route }: ReviewScreenProps): React.ReactElement {
  const toast = useToast();
  const { appId, appName, appIcon } = route.params;
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<boolean>(false);
  const [samplingInProgress, setSamplingInProgress] = useState<boolean>(false);
  const [samplingProgress, setSamplingProgress] = useState<SamplingProgress | null>(null);
  const [samplingResult, setSamplingResult] = useState<SamplingResult | null>(null);
  const [samplingError, setSamplingError] = useState<string | null>(null);
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchReviews = async () => {
    try {
      setLoading(true);
      const data = await fetchFromAPI('app_review_read', { app_id: appId });

      if (data && data.reviews && Array.isArray(data.reviews)) {
        const formattedReviews = data.reviews.map((review: any) => ({
          date: new Date(review.date).toLocaleDateString(),
          rawDate: new Date(review.date),
          score: review.score,
          content: review.content,
          username: review.username || '익명'
        }));

        // 최신순 정렬
        formattedReviews.sort((a: any, b: any) => b.rawDate.getTime() - a.rawDate.getTime());

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

  // 샘플링 시작 함수
  const startSampling = useCallback(async () => {
    if (reviews.length === 0) {
      toast.show('리뷰 데이터가 없습니다.', 'error');
      return;
    }

    try {
      setSamplingInProgress(true);
      setSamplingProgress(null);
      setSamplingResult(null);
      setSamplingError(null);
      
      // 취소 컨트롤러 생성
      abortControllerRef.current = new AbortController();
      
      // 리뷰 데이터를 샘플링 서비스 형식으로 변환
      const reviewsForSampling = reviews.map((review, index) => ({
        id: `review-${index}`,
        content: review.content,
        score: review.score,
        username: review.username,
        date: review.rawDate.toISOString()
      }));
      
      // 진행 상황 콜백 함수
      const handleProgress = (progress: SamplingProgress) => {
        setSamplingProgress(progress);
      };
      
      // 샘플링 실행
      const result = await sampleReviews(
        reviewsForSampling, 
        handleProgress, 
        abortControllerRef.current.signal
      );
      
      setSamplingResult(result);
      toast.show('샘플링이 완료되었습니다. AI 요약을 생성합니다.', 'success');
      
      // 샘플링 완료 후 AI 요약 화면으로 이동
      navigation.navigate('AISummary', { 
        appId, 
        appName, 
        sampledReviews: result.sampledReviews 
      });
      
    } catch (err: any) {
      if (err.message === 'Sampling was cancelled') {
        setSamplingError('샘플링이 취소되었습니다.');
        toast.show('샘플링이 취소되었습니다.', 'info');
      } else {
        setSamplingError(`샘플링 오류: ${err.message}`);
        toast.show(`샘플링 중 오류가 발생했습니다: ${err.message}`, 'error');
      }
    } finally {
      setSamplingInProgress(false);
      abortControllerRef.current = null;
    }
  }, [reviews, navigation, appId, appName, toast]);

  // 샘플링 취소 함수
  const cancelSampling = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);

  // AI 요약 화면으로 이동하는 함수 (기존 방식 - 전체 리뷰)
  const navigateToAISummary = () => {
    if (reviews.length === 0) {
      toast.show('리뷰 데이터가 없습니다.', 'error');
      return;
    }
    startSampling();
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
          defaultSource={require('../../assets/app-placeholder.png')}
        />
        <PaperText variant="titleLarge" style={{ textAlign: 'center', flex: 1 }}>
          {appName}
        </PaperText>
        <PaperButton
          mode="contained"
          onPress={navigateToAISummary}
          disabled={samplingInProgress || reviews.length === 0}
          style={styles.summaryButton}
        >
          {samplingInProgress ? '샘플링 중...' : 'AI 요약 보기'}
        </PaperButton>
      </View>
      
      {/* 샘플링 진행 상태 표시 */}
      {(samplingInProgress || samplingResult) && samplingProgress && (
        <SamplingProgressBar 
          progress={samplingProgress} 
          onCancel={samplingInProgress ? cancelSampling : undefined}
          isComplete={!samplingInProgress && samplingResult !== null}
        />
      )}
      
      {/* 샘플링 에러 메시지 */}
      {samplingError && (
        <View style={styles.errorContainer}>
          <PaperText style={styles.errorText}>{samplingError}</PaperText>
        </View>
      )}
      
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
  headerContainer: {
    flexDirection: 'row', 
    alignItems: 'center', 
    padding: 12,
    backgroundColor: '#1E1E1E', 
    borderRadius: 8, 
    marginBottom: 12
  },
  headerAppIcon: { 
    width: 40, 
    height: 40, 
    borderRadius: 8, 
    marginRight: 12 
  },
  summaryButton: { 
    marginLeft: 'auto' 
  },
  reviewItemContainer: {
    padding: 15, 
    borderBottomWidth: 1, 
    borderColor: '#333',
    backgroundColor: '#1E1E1E', 
    borderRadius: 8, 
    marginBottom: 8
  },
  retryButton: { 
    marginTop: 16 
  },
  errorContainer: {
    backgroundColor: '#ffebee',
    padding: 12,
    margin: 12,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#f44336',
  },
  errorText: {
    color: '#d32f2f',
    fontSize: 14,
  },
});

export default ReviewScreen;