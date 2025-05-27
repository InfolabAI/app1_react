import React, { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Animated } from 'react-native';
import { SamplingProgress } from '../services/sampling';

/**
 * 이 파일은 리뷰 샘플링의 진행 상태를 시각적으로 표시하는 UI 컴포넌트입니다.
 * 
 * 참고: 이 컴포넌트는 필수적인 것은 아닙니다. services/sampling.ts 파일이 
 * 샘플링 알고리즘의 핵심 로직과 진행 상태 추적 기능을 이미 포함하고 있습니다.
 * 
 * 이 컴포넌트는 서브태스크 3.3 "진행 상태 추적 기능 개발"의 일부로, 
 * "샘플링 과정의 진행 상태를 실시간으로 추적하고 표시하는 기능 구현"의 
 * "표시" 부분을 담당합니다.
 * 
 * 주요 기능:
 * 1. 진행 막대 애니메이션
 * 2. 진행률(%) 표시
 * 3. 처리된 리뷰 수 표시
 * 4. 취소 버튼
 * 
 * 이 UI 컴포넌트가 없어도 샘플링 기능 자체는 문제없이 작동합니다.
 */
interface SamplingProgressBarProps {
  progress: SamplingProgress;
  onCancel?: () => void;
  isComplete?: boolean;
}

/**
 * 샘플링 진행 상태를 표시하는 컴포넌트
 * 진행 바와 취소 버튼을 포함합니다.
 */
const SamplingProgressBar: React.FC<SamplingProgressBarProps> = ({ 
  progress, 
  onCancel,
  isComplete = false
}) => {
  const [percentage, setPercentage] = useState(0);
  const progressAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!progress) return;
    
    const percent = progress.total > 0 
      ? Math.floor((progress.processed / progress.total) * 100) 
      : 0;
    
    setPercentage(percent);
    
    // 진행바 애니메이션
    Animated.timing(progressAnim, {
      toValue: percent / 100,
      duration: 300,
      useNativeDriver: false,
    }).start();
  }, [progress, progressAnim]);

  // 진행 완료 시 효과
  useEffect(() => {
    if (isComplete) {
      Animated.timing(progressAnim, {
        toValue: 1,
        duration: 300,
        useNativeDriver: false,
      }).start();
    }
  }, [isComplete, progressAnim]);

  return (
    <View style={styles.container}>
      <View style={styles.progressInfo}>
        <Text style={styles.title}>
          {isComplete ? '샘플링 완료' : '리뷰 샘플링 진행 중...'}
        </Text>
        <Text style={styles.percentage}>{percentage}%</Text>
      </View>
      
      <View style={styles.progressBarContainer}>
        <Animated.View 
          style={[
            styles.progressBar, 
            { 
              width: progressAnim.interpolate({
                inputRange: [0, 1],
                outputRange: ['0%', '100%'],
              }),
              backgroundColor: isComplete ? '#4CAF50' : '#2196F3'
            }
          ]} 
        />
      </View>
      
      <View style={styles.statsContainer}>
        <Text style={styles.statsText}>
          {progress.processed} / {progress.total} 리뷰 처리됨
        </Text>
      </View>
      
      {!isComplete && onCancel && (
        <TouchableOpacity 
          style={styles.cancelButton} 
          onPress={onCancel}
          accessibilityLabel="샘플링 취소"
        >
          <Text style={styles.cancelButtonText}>취소</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 16,
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  percentage: {
    fontSize: 16,
    fontWeight: '700',
    color: '#2196F3',
  },
  progressBarContainer: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  statsContainer: {
    marginVertical: 8,
  },
  statsText: {
    fontSize: 14,
    color: '#666',
  },
  cancelButton: {
    backgroundColor: '#f44336',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    alignSelf: 'flex-end',
    marginTop: 8,
  },
  cancelButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});

export default SamplingProgressBar;