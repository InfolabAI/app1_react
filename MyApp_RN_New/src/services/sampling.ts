/**
 * 리뷰 데이터 샘플링 서비스
 * 
 * 서버에서 이전에 수행하던 리뷰 샘플링 기능을 클라이언트로 이동한 구현입니다.
 * 텍스트 품질과 다양성을 고려하여 리뷰 중 가장 유의미한 샘플을 추출합니다.
 * 
 * 이 파일은 샘플링 알고리즘의 핵심 로직을 포함하며, 다음과 같은 기능을 제공합니다:
 * 1. 텍스트 품질 평가 (단어 다양성, 문장 구조, 반복 패턴 등)
 * 2. 텍스트 간 유사도 계산
 * 3. 다양성과 품질을 고려한 샘플링 알고리즘
 * 4. 진행 상태 추적 (onProgress 콜백)
 * 5. 취소 기능 (AbortSignal)
 * 
 * 참고: 이 파일은 진행 상태를 "추적"하는 로직만 포함하며, 이를 UI에 "표시"하는 기능은 
 * src/components/SamplingProgress.tsx에서 별도로 구현됩니다. 이 파일만으로도
 * 샘플링 기능의 핵심 로직은 모두 사용 가능합니다.
 */

export interface Review {
  id: string;
  content: string;
  score: number;
  username: string;
  date: string;
  [key: string]: any;
}

export interface SamplingProgress {
  total: number;
  processed: number;
  completed: boolean;
}

export interface SamplingResult {
  sampledReviews: Review[];
  statistics: {
    totalReviews: number;
    averageRating: number;
    sampledReviewCount: number;
    totalCharCount: number;
  };
}

// 최대 문자 길이 제한 (OpenAI API 등 외부 서비스에 전송할 때 고려)
const MAX_LENGTH = 5000;

/**
 * 텍스트 품질을 평가하는 함수
 * 다양한 지표(단어 다양성, 문장 구조, 반복 패턴 등)를 분석하여 품질 점수를 계산
 */
function evaluateTextQuality(text: string): number {
  // 기본 검사: 빈 텍스트나 너무 짧은 텍스트
  if (!text || text.length < 10) {
    return 0.1;
  }

  // 텍스트 길이 미리 계산
  const textLength = text.length;

  // 1. 단어 빈도 분석
  const words = text.split(/\s+/);
  const wordCount = words.length;

  if (wordCount < 3) {
    return 0.2; // 단어가 너무 적으면 낮은 점수
  }

  // 정규화된 단어 목록 생성
  const normalizedWords = words
    .map(w => w.toLowerCase().replace(/[.,!?;:]/g, ''))
    .filter(w => w.length > 0);

  // 단어 빈도 맵 생성
  const wordFreq: Map<string, number> = new Map();
  for (const word of normalizedWords) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  // 2. 문자 바이그램 분석
  const charBigrams: Map<string, number> = new Map();
  const totalBigrams = Math.max(1, textLength - 1);

  for (let i = 0; i < textLength - 1; i++) {
    const bigram = text.substring(i, i + 2);
    charBigrams.set(bigram, (charBigrams.get(bigram) || 0) + 1);
  }

  // 3-4. 빈도 분석
  let mostFrequentWordCount = 0;
  for (const count of wordFreq.values()) {
    if (count > mostFrequentWordCount) {
      mostFrequentWordCount = count;
    }
  }
  const mostFrequentWordRatio = wordCount > 0 ? mostFrequentWordCount / wordCount : 0;

  let mostFrequentBigramCount = 0;
  for (const count of charBigrams.values()) {
    if (count > mostFrequentBigramCount) {
      mostFrequentBigramCount = count;
    }
  }
  const mostFrequentBigramRatio = mostFrequentBigramCount / totalBigrams;

  // 바이그램 엔트로피 계산
  let bigramEntropy = 0;
  for (const freq of charBigrams.values()) {
    const prob = freq / totalBigrams;
    bigramEntropy -= prob * Math.log2(prob);
  }

  // 정규화된 바이그램 엔트로피
  const maxBigramEntropy = totalBigrams > 1 ? Math.log2(totalBigrams) : 1;
  const normalizedBigramEntropy = maxBigramEntropy > 0 ? bigramEntropy / maxBigramEntropy : 0.5;

  // 5. 반복 패턴 감지
  let repeatedChars = 0;
  let currentChar = '';
  let currentRun = 0;

  // 문자 반복 검사
  for (const char of text) {
    if (char === currentChar) {
      currentRun += 1;
      if (currentRun > 2) { // 3글자 이상 연속되면 카운트
        repeatedChars += 1;
      }
    } else {
      currentChar = char;
      currentRun = 1;
    }
  }
  const repeatedCharRatio = textLength > 0 ? repeatedChars / textLength : 0;

  // 6. 단어 다양성 (TTR)
  const uniqueWordCount = wordFreq.size;
  const ttr = wordCount > 0 ? uniqueWordCount / wordCount : 0;

  // 7. 연속된 단어 반복 패턴 감지
  let wordPatternRepetition = 0;

  if (normalizedWords.length >= 2) {
    // 단어 쌍 생성
    const wordPairs = new Map<string, number>();
    for (let i = 0; i < normalizedWords.length - 1; i++) {
      const pair = `${normalizedWords[i]}-${normalizedWords[i + 1]}`;
      wordPairs.set(pair, (wordPairs.get(pair) || 0) + 1);
    }

    // 3회 이상 반복되는 쌍 확인
    for (const count of wordPairs.values()) {
      if (count >= 3) {
        wordPatternRepetition += 0.2;
      }
    }
  }

  // 8. 문장 구조 검사
  const sentenceCount = (text.match(/[.!?]/g) || []).length;
  let punctuationScore = 0.5;

  if (wordCount > 20) {
    if (sentenceCount === 0) {
      punctuationScore = 0.2;
    } else {
      const avgWordsPerSentence = wordCount / sentenceCount;
      if (avgWordsPerSentence > 30) {
        punctuationScore = 0.3;
      } else if (avgWordsPerSentence < 3) {
        punctuationScore = 0.4;
      } else {
        punctuationScore = 0.8;
      }
    }
  }

  // 9. 문자 다양성 비율
  const textNoSpaces = text.replace(/\s+/g, '');
  const totalChars = textNoSpaces.length;
  const uniqueChars = new Set(textNoSpaces).size;
  const charDiversity = totalChars > 0 ? uniqueChars / totalChars : 0;

  // 반복 기반 패널티 계산
  let repetitionPenalty = 0;

  if (mostFrequentWordRatio > 0.1) {
    repetitionPenalty += Math.pow(mostFrequentWordRatio, 1.5) * 2.0;
  }

  if (mostFrequentBigramRatio > 0.08) {
    repetitionPenalty += Math.pow(mostFrequentBigramRatio, 1.5) * 2.5;
  }

  if (charDiversity < 0.2) {
    repetitionPenalty += (0.2 - charDiversity) * 3.0;
  }

  repetitionPenalty += repeatedCharRatio * 2.0;
  repetitionPenalty += wordPatternRepetition;

  // 최종 점수 계산
  const baseQualityScore = (
    0.3 * ttr +
    0.2 * normalizedBigramEntropy +
    0.2 * punctuationScore +
    0.1 * charDiversity
  );

  // 패널티 적용
  let finalScore;
  if (repetitionPenalty > 1.0) {
    finalScore = Math.max(0.05, 0.1 - (repetitionPenalty - 1.0) * 0.05);
  } else {
    finalScore = Math.max(0.05, baseQualityScore - repetitionPenalty);
  }

  return finalScore;
}

/**
 * Jaccard 유사도를 이용하여 두 텍스트의 단어 유사도를 계산
 */
function jaccardSimilarity(sentence1: string, sentence2: string): number {
  if (!sentence1 || !sentence2) return 0;
  
  // 문장을 소문자로 변환하고 단어로 분리
  const words1 = new Set(sentence1.toLowerCase().split(/\s+/));
  const words2 = new Set(sentence2.toLowerCase().split(/\s+/));
  
  // 교집합 계산
  const intersection = new Set<string>();
  for (const word of words1) {
    if (words2.has(word)) {
      intersection.add(word);
    }
  }
  
  // 합집합 계산
  const union = new Set<string>([...words1, ...words2]);
  
  // Jaccard 유사도 계산
  return union.size > 0 ? intersection.size / union.size : 1.0;
}

/**
 * 리뷰 샘플링 함수
 * 텍스트 품질과 다양성을 고려하여 최적의 리뷰 샘플 선택
 * 취소 기능 지원
 */
export const sampleReviews = (
  reviews: Review[],
  onProgress?: (progress: SamplingProgress) => void,
  signal?: AbortSignal
): Promise<SamplingResult> => {
  return new Promise((resolve, reject) => {
    // 취소 신호가 이미 활성화되었는지 확인
    if (signal?.aborted) {
      reject(new Error('Sampling was cancelled'));
      return;
    }

    // 취소 신호 리스너 설정
    const abortHandler = () => {
      console.log('Sampling operation cancelled by user');
      reject(new Error('Sampling was cancelled'));
    };

    // 취소 신호 수신 시 작업 중단
    if (signal) {
      signal.addEventListener('abort', abortHandler);
    }

    // 작업 스케줄링 (UI 블로킹 방지)
    const timeoutId = setTimeout(() => {
      // 리뷰가 없는 경우 빈 결과 반환
      if (!reviews || reviews.length === 0) {
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        resolve({
          sampledReviews: [],
          statistics: {
            totalReviews: 0,
            averageRating: 0,
            sampledReviewCount: 0,
            totalCharCount: 0
          }
        });
        return;
      }

      // 처리 진행 상황 초기화
      const total = reviews.length;
      let processed = 0;
      
      const updateProgress = () => {
        processed += 1;
        if (onProgress) {
          onProgress({
            total,
            processed,
            completed: processed === total
          });
        }

        // 취소 확인
        if (signal?.aborted) {
          throw new Error('Operation cancelled');
        }
      };

      // 1. 리뷰 품질 평가 (긴 리뷰만 사용)
      const filteredReviews = reviews.filter(review => 
        review.content && 
        review.content.length > 50 && 
        review.content.length < 400
      );

      // 최근 리뷰 우선 정렬 (선택적)
      const sortedReviews = [...filteredReviews].sort((a, b) => 
        new Date(b.date).getTime() - new Date(a.date).getTime()
      );
      
      // 처리할 리뷰 제한 (성능 고려)
      const processableReviews = sortedReviews.slice(0, 500);
      
      // 2. 리뷰 품질 점수 계산
      console.log("Evaluating review quality...");
      const qualityScores: number[] = [];
      
      // 배치 처리로 UI 반응성 유지
      const batchSize = 20;
      let batchIndex = 0;
      
      const processBatch = () => {
        const endIndex = Math.min(batchIndex + batchSize, processableReviews.length);
        for (let i = batchIndex; i < endIndex; i++) {
          const review = processableReviews[i];
          qualityScores[i] = evaluateTextQuality(review.content);
          updateProgress();
        }
        
        batchIndex += batchSize;
        
        if (batchIndex < processableReviews.length) {
          // 다음 배치 처리 예약
          setTimeout(processBatch, 0);
        } else {
          // 모든 배치 처리 완료 후 후보 선택
          selectCandidates();
        }
      };
      
      // 후보 선택 함수
      const selectCandidates = () => {
        console.log("Selecting diverse reviews...");
        
        // 품질 점수 기준으로 상위 100개 (또는 더 적은 수)만 후보로 선택
        const sortedIndices = qualityScores
          .map((score, index) => ({ score, index }))
          .sort((a, b) => b.score - a.score)
          .map(item => item.index);
          
        const candidateIndices = sortedIndices.slice(0, Math.min(100, sortedIndices.length));
        
        // 결과 저장 변수
        const selectedIndices: number[] = [];
        const selectedTexts: string[] = [];
        let totalLength = 0;
        
        // 첫 텍스트 선택: 품질 점수와 길이를 모두 고려
        let bestFirstIndex = -1;
        let bestFirstScore = -1;
        
        for (const index of candidateIndices) {
          const qualityScore = qualityScores[index];
          const lengthScore = Math.min(1, processableReviews[index].content.length / 500); // 적당한 길이 선호
          const combinedScore = qualityScore * 0.7 + lengthScore * 0.3;
          
          if (combinedScore > bestFirstScore) {
            bestFirstScore = combinedScore;
            bestFirstIndex = index;
          }
        }
        
        // 첫 텍스트 추가
        if (bestFirstIndex >= 0) {
          selectedIndices.push(bestFirstIndex);
          selectedTexts.push(processableReviews[bestFirstIndex].content);
          totalLength += processableReviews[bestFirstIndex].content.length;
          
          // 후보 목록에서 선택된 항목 제거
          const indexToRemove = candidateIndices.indexOf(bestFirstIndex);
          if (indexToRemove !== -1) {
            candidateIndices.splice(indexToRemove, 1);
          }
        }
        
        // 누적 텍스트 초기화
        let accumulatedSelectedText = selectedTexts.length > 0 ? selectedTexts[0] : '';
        
        // 남은 텍스트에서 선택 (품질과 다양성 모두 고려)
        while (candidateIndices.length > 0 && totalLength < MAX_LENGTH) {
          let bestIndex = -1;
          let bestCombinedScore = -1;
          let bestDiversityScore = -1;
          
          // 각 후보 텍스트에 대해
          for (let i = 0; i < candidateIndices.length; i++) {
            const index = candidateIndices[i];
            const text = processableReviews[index].content;
            
            // 길이 제한 확인
            if (totalLength + text.length > MAX_LENGTH) {
              continue;
            }
            
            // 1. 다양성 점수 계산: 누적된 선택 텍스트와의 유사도 계산
            // 유사도가 낮을수록 다양성이 높음 (1 - 유사도)
            const similarity = jaccardSimilarity(text, accumulatedSelectedText);
            const diversityScore = 1 - similarity;
            
            // 2. 품질 점수
            const qualityScore = qualityScores[index];
            
            // 3. 결합 점수 (품질 10%, 다양성 90%)
            const combinedScore = qualityScore * 0.1 + diversityScore * 0.9;
            
            // 최고 점수 갱신
            if (combinedScore > bestCombinedScore) {
              bestCombinedScore = combinedScore;
              bestIndex = index;
              bestDiversityScore = diversityScore;
            }
          }
          
          // 더 이상 적합한 텍스트가 없으면 종료
          if (bestIndex === -1) {
            break;
          }
          
          // 선택된 텍스트 추가
          selectedIndices.push(bestIndex);
          const selectedText = processableReviews[bestIndex].content;
          selectedTexts.push(selectedText);
          totalLength += selectedText.length;
          
          // 누적 텍스트 업데이트 - 새로 선택된 텍스트 추가
          accumulatedSelectedText += " " + selectedText;
          
          // 선택된 인덱스 제거
          const indexToRemove = candidateIndices.indexOf(bestIndex);
          if (indexToRemove !== -1) {
            candidateIndices.splice(indexToRemove, 1);
          }
        }
        
        // 원래 리뷰 객체 배열로 변환하여 결과 생성
        const sampledReviews = selectedIndices.map(index => processableReviews[index]);
        
        // 평균 평점 계산
        const averageRating = reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length;
        
        // 최종 결과 반환
        const result: SamplingResult = {
          sampledReviews,
          statistics: {
            totalReviews: reviews.length,
            averageRating,
            sampledReviewCount: sampledReviews.length,
            totalCharCount: totalLength
          }
        };
        
        // 취소 신호 리스너 제거
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        
        resolve(result);
      };
      
      // 첫 배치 처리 시작
      try {
        processBatch();
      } catch (error) {
        // 취소 또는 에러 처리
        if (signal) {
          signal.removeEventListener('abort', abortHandler);
        }
        
        if (error.message === 'Operation cancelled') {
          reject(new Error('Sampling was cancelled'));
        } else {
          reject(error);
        }
      }
    }, 0);
    
    // 함수 반환 전에 취소 핸들러 추가 (타임아웃 전에 취소되는 경우 대비)
    return () => {
      if (signal) {
        signal.removeEventListener('abort', abortHandler);
      }
    };
  });
};

/**
 * 리뷰 데이터를 문자열로 결합
 * LLM API 호출 등에 사용
 */
export const joinSampledReviews = (reviews: Review[]): string => {
  if (!reviews || reviews.length === 0) {
    return '';
  }
  
  return reviews.map(review => {
    const stars = '★'.repeat(Math.min(5, Math.max(1, Math.round(review.score))));
    return `리뷰자: ${review.username || '익명'}\n평점: ${stars} (${review.score})\n내용: ${review.content}\n`;
  }).join('\n---\n\n');
};