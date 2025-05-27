import React, { useState, useCallback, useRef } from 'react';
import { 
  StyleSheet, 
  View, 
  Text, 
  TouchableOpacity, 
  ScrollView, 
  ActivityIndicator, 
  Alert 
} from 'react-native';
import { sampleReviews, SamplingProgress, SamplingResult, Review } from '../services/sampling';
import SamplingProgressBar from '../components/SamplingProgress';

/**
 * 이 파일은 리뷰 샘플링 기능을 시연하기 위한 데모 화면입니다.
 * 
 * 참고: 이 화면은 필수적인 것은 아닙니다. services/sampling.ts 파일만으로도
 * 샘플링 알고리즘의 핵심 기능은 모두 사용 가능합니다.
 * 
 * 이 화면은 서브태스크 3.3 "진행 상태 추적 기능 개발"을 완전히 시연하기 위한 
 * 목적으로 구현되었으며, 다음의 기능을 보여줍니다:
 * 
 * 1. 다양한 크기의 리뷰 데이터셋으로 샘플링 실행
 * 2. 진행 상태 실시간 표시 (SamplingProgressBar 컴포넌트 사용)
 * 3. 취소 기능 시연
 * 4. 샘플링 결과 표시
 * 
 * 실제 앱에서는 이 데모 화면 대신, 실제 리뷰 데이터를 사용하여 
 * services/sampling.ts의 기능을 직접 통합하면 됩니다.
 */

// 더미 리뷰 데이터 (실제 앱에서는 API 또는 저장소에서 가져옴)
const generateDummyReviews = (count: number): Review[] => {
  const reviews: Review[] = [];
  const ratings = [1, 2, 3, 4, 5];
  const contents = [
    '이 앱은 정말 사용하기 쉽고 직관적입니다. 특히 검색 기능이 빠르고 정확해서 좋아요.',
    '사용자 인터페이스가 너무 복잡하고 버튼들이 작아서 사용하기 어려워요.',
    '로딩 시간이 너무 깁니다. 앱을 열 때마다 10초 이상 기다려야 하는 것이 불편합니다.',
    '최근 업데이트 후 배터리 소모가 심해졌습니다. 이전에는 하루 종일 써도 20% 정도만 소모됐는데, 지금은 금방 30-40%가 사라집니다.',
    '이 앱은 완벽합니다! 제가 필요한 모든 기능이 있고, 디자인도 아름답습니다.',
    '동기화 기능에 문제가 있습니다. 여러 기기에서 사용할 때 데이터가 제대로 동기화되지 않아요.',
    '광고가 너무 많고 자주 뜹니다. 무료 버전이라도 사용자 경험을 해치지 않는 수준으로 광고를 줄여주세요.',
    '오프라인 모드가 잘 작동하지 않습니다. 인터넷 연결이 없을 때도 기본 기능은 사용할 수 있게 개선해주세요.',
    '최신 iOS 업데이트 후 앱이 자주 충돌합니다. 특히 카메라 기능을 사용할 때 문제가 발생합니다.',
    '사용자 서포트가 매우 빠르고 친절합니다. 제가 버그를 보고했을 때 하루 만에 답변을 받았고, 다음 업데이트에서 수정되었습니다.'
  ];
  
  for (let i = 0; i < count; i++) {
    const randomDate = new Date();
    randomDate.setDate(randomDate.getDate() - Math.floor(Math.random() * 30));
    
    reviews.push({
      id: `review-${i}`,
      content: contents[i % contents.length] + ` (리뷰 ${i})`,
      score: ratings[Math.floor(Math.random() * ratings.length)],
      username: `사용자${i}`,
      date: randomDate.toISOString()
    });
  }
  
  return reviews;
};

import { SamplingDemoScreenProps } from '../types';

/**
 * 샘플링 기능을 시연하는 화면
 */
const SamplingDemoScreen: React.FC<SamplingDemoScreenProps> = ({ navigation }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<SamplingProgress | null>(null);
  const [result, setResult] = useState<SamplingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  
  // 샘플링 시작 함수
  const startSampling = useCallback(async (reviewCount: number) => {
    try {
      // 이전 상태 초기화
      setIsLoading(true);
      setProgress(null);
      setResult(null);
      setError(null);
      
      // 취소 컨트롤러 생성
      abortControllerRef.current = new AbortController();
      
      // 더미 리뷰 데이터 생성
      const reviews = generateDummyReviews(reviewCount);
      
      // 진행 상황 콜백 함수
      const handleProgress = (progress: SamplingProgress) => {
        setProgress(progress);
      };
      
      // 샘플링 실행
      const samplingResult = await sampleReviews(
        reviews, 
        handleProgress, 
        abortControllerRef.current.signal
      );
      
      // 결과 저장
      setResult(samplingResult);
    } catch (err) {
      if (err.message === 'Sampling was cancelled') {
        setError('샘플링이 취소되었습니다.');
      } else {
        setError(`오류 발생: ${err.message}`);
        Alert.alert('오류', `샘플링 중 오류가 발생했습니다: ${err.message}`);
      }
    } finally {
      setIsLoading(false);
      abortControllerRef.current = null;
    }
  }, []);
  
  // 샘플링 취소 함수
  const cancelSampling = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
  }, []);
  
  // 샘플링 완료 여부
  const isComplete = !isLoading && result !== null;
  
  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>리뷰 샘플링 데모</Text>
        <Text style={styles.subtitle}>
          텍스트 품질과 다양성을 고려하여 최적의 리뷰 샘플링을 진행합니다.
        </Text>
      </View>
      
      <View style={styles.buttonContainer}>
        <TouchableOpacity
          style={[styles.button, isLoading && styles.disabledButton]}
          onPress={() => startSampling(50)}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>50개 리뷰 샘플링</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, isLoading && styles.disabledButton]}
          onPress={() => startSampling(200)}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>200개 리뷰 샘플링</Text>
        </TouchableOpacity>
        
        <TouchableOpacity
          style={[styles.button, isLoading && styles.disabledButton]}
          onPress={() => startSampling(500)}
          disabled={isLoading}
        >
          <Text style={styles.buttonText}>500개 리뷰 샘플링</Text>
        </TouchableOpacity>
      </View>
      
      {/* 진행 상태 표시 */}
      {(isLoading || isComplete) && progress && (
        <SamplingProgressBar 
          progress={progress} 
          onCancel={isLoading ? cancelSampling : undefined}
          isComplete={isComplete}
        />
      )}
      
      {/* 에러 메시지 */}
      {error && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}
      
      {/* 샘플링 결과 표시 */}
      {result && (
        <View style={styles.resultContainer}>
          <Text style={styles.resultTitle}>샘플링 결과</Text>
          
          <View style={styles.statsContainer}>
            <Text style={styles.statsItem}>
              전체 리뷰: {result.statistics.totalReviews}개
            </Text>
            <Text style={styles.statsItem}>
              선택된 리뷰: {result.statistics.sampledReviewCount}개
            </Text>
            <Text style={styles.statsItem}>
              평균 평점: {result.statistics.averageRating.toFixed(1)}
            </Text>
            <Text style={styles.statsItem}>
              총 문자 수: {result.statistics.totalCharCount}자
            </Text>
          </View>
          
          <Text style={styles.sampledTitle}>샘플링된 리뷰 목록:</Text>
          
          {result.sampledReviews.map((review, index) => (
            <View key={review.id} style={styles.reviewItem}>
              <View style={styles.reviewHeader}>
                <Text style={styles.reviewUsername}>{review.username}</Text>
                <Text style={styles.reviewScore}>
                  {Array(Math.round(review.score)).fill('★').join('')}
                </Text>
                <Text style={styles.reviewDate}>
                  {new Date(review.date).toLocaleDateString()}
                </Text>
              </View>
              <Text style={styles.reviewContent}>{review.content}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F6FA',
  },
  header: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
  },
  subtitle: {
    fontSize: 16,
    color: '#666666',
    lineHeight: 22,
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 16,
    flexWrap: 'wrap',
  },
  button: {
    backgroundColor: '#2196F3',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginVertical: 8,
    width: '48%',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#B0BEC5',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    marginVertical: 16,
  },
  errorContainer: {
    backgroundColor: '#FFEBEE',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#F44336',
  },
  errorText: {
    color: '#D32F2F',
    fontSize: 16,
  },
  resultContainer: {
    backgroundColor: '#FFFFFF',
    padding: 16,
    margin: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  resultTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 16,
    color: '#333333',
  },
  statsContainer: {
    backgroundColor: '#EFF6FF',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statsItem: {
    fontSize: 16,
    marginBottom: 4,
    color: '#333333',
  },
  sampledTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginVertical: 12,
    color: '#333333',
  },
  reviewItem: {
    backgroundColor: '#F9F9F9',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
    borderLeftWidth: 3,
    borderLeftColor: '#2196F3',
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
    alignItems: 'center',
  },
  reviewUsername: {
    fontWeight: '600',
    color: '#333333',
    flex: 1,
  },
  reviewScore: {
    color: '#FFC107',
    marginHorizontal: 8,
  },
  reviewDate: {
    color: '#9E9E9E',
    fontSize: 14,
  },
  reviewContent: {
    color: '#333333',
    lineHeight: 20,
  },
});

export default SamplingDemoScreen;