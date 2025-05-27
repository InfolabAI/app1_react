/**
 * 클라이언트 측 샘플링 알고리즘 테스트 스크립트
 * 
 * 이 스크립트는 test_reviews.json 파일에서 리뷰 데이터를 읽어와
 * 클라이언트 측 샘플링 알고리즘(React Native 앱의 sampling.ts)에 적용하고
 * 결과를 client_result.json 파일로 저장합니다.
 */
const fs = require('fs');
const path = require('path');

// TypeScript 코드를 직접 사용할 수 없으므로 알고리즘을 JavaScript로 변환하여 사용
// 실제로는 TypeScript 컴파일러를 통해 변환하거나 ts-node 등을 사용할 수 있습니다
// 여기서는 간단한 테스트를 위해 핵심 알고리즘만 JavaScript로 구현합니다

// MAX_LENGTH 상수 정의
const MAX_LENGTH = 5000;

/**
 * 텍스트 품질을 평가하는 함수
 */
function evaluateTextQuality(text) {
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
  const wordFreq = new Map();
  for (const word of normalizedWords) {
    wordFreq.set(word, (wordFreq.get(word) || 0) + 1);
  }

  // 2. 문자 바이그램 분석
  const charBigrams = new Map();
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
    const wordPairs = new Map();
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
function jaccardSimilarity(sentence1, sentence2) {
  if (!sentence1 || !sentence2) return 0;
  
  // 문장을 소문자로 변환하고 단어로 분리
  const words1 = new Set(sentence1.toLowerCase().split(/\s+/));
  const words2 = new Set(sentence2.toLowerCase().split(/\s+/));
  
  // 교집합 계산
  const intersection = new Set([...words1].filter(word => words2.has(word)));
  
  // 합집합 계산
  const union = new Set([...words1, ...words2]);
  
  // Jaccard 유사도 계산
  return union.size > 0 ? intersection.size / union.size : 1.0;
}

/**
 * 리뷰 샘플링 함수
 */
function sampleReviews(reviews) {
  console.log("Evaluating review quality...");

  // 품질 점수 저장
  const qualityScores = [];
  
  // 리뷰 콘텐츠 추출
  const textList = reviews.map(review => review.content);
  
  // 리뷰 품질 평가
  for (let i = 0; i < textList.length; i++) {
    qualityScores[i] = evaluateTextQuality(textList[i]);
  }
  
  // 품질 점수 기준으로 상위 100개 (또는 더 적은 수) 후보 선택
  const sortedIndices = qualityScores
    .map((score, index) => ({ score, index }))
    .sort((a, b) => b.score - a.score)
    .map(item => item.index);
    
  const candidateIndices = sortedIndices.slice(0, Math.min(100, sortedIndices.length));
  
  // 결과 저장 변수
  const selectedIndices = [];
  const selectedTexts = [];
  const selectedDiversityScores = [];
  let totalLength = 0;
  
  console.log("Selecting diverse reviews...");
  
  // 첫 텍스트 선택: 품질 점수와 길이를 모두 고려
  let bestFirstIndex = -1;
  let bestFirstScore = -1;
  
  for (const index of candidateIndices) {
    const qualityScore = qualityScores[index];
    const lengthScore = Math.min(1, textList[index].length / 500); // 적당한 길이 선호
    const combinedScore = qualityScore * 0.7 + lengthScore * 0.3;
    
    if (combinedScore > bestFirstScore) {
      bestFirstScore = combinedScore;
      bestFirstIndex = index;
    }
  }
  
  // 첫 텍스트 추가
  if (bestFirstIndex >= 0) {
    selectedIndices.push(bestFirstIndex);
    selectedTexts.push(textList[bestFirstIndex]);
    selectedDiversityScores.push(0);
    totalLength += textList[bestFirstIndex].length;
    
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
      const text = textList[index];
      
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
    selectedDiversityScores.push(bestDiversityScore);
    const selectedText = textList[bestIndex];
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
  
  // 결과 구성 
  const sampledReviews = selectedIndices.map(index => reviews[index]);

  return {
    selectedIndices,
    selectedTexts,
    qualityScores,
    diversityScores: selectedDiversityScores,
    sampledReviews
  };
}

// 테스트 실행 함수
async function runClientSampling() {
  try {
    // 테스트 리뷰 데이터 로드
    console.log("Loading test reviews...");
    const reviewsData = JSON.parse(fs.readFileSync('test_reviews.json', 'utf8'));
    const reviews = reviewsData.reviews;
    
    console.log(`Loaded ${reviews.length} reviews for testing`);
    
    // 샘플링 알고리즘 실행
    console.log("Running client sampling algorithm...");
    const result = sampleReviews(reviews);
    
    // 결과 저장
    const outputData = {
      metadata: {
        timestamp: new Date().toISOString(),
        algorithm: "client_sampling",
        input_review_count: reviews.length
      },
      selected_reviews: [],
      quality_scores: [],
      diversity_scores: []
    };
    
    // 선택된 리뷰 정보 저장
    for (let i = 0; i < result.selectedIndices.length; i++) {
      const idx = result.selectedIndices[i];
      const review = reviews[idx];
      
      outputData.selected_reviews.push({
        index: idx,
        id: review.id,
        content: review.content,
        score: review.score,
        username: review.username,
        quality_score: result.qualityScores[idx],
        diversity_score: result.diversityScores[i]
      });
    }
    
    // 전체 품질 점수 저장
    for (let i = 0; i < result.qualityScores.length; i++) {
      outputData.quality_scores.push({
        index: i,
        score: result.qualityScores[i]
      });
    }
    
    // 다양성 점수 저장
    for (let i = 0; i < result.diversityScores.length; i++) {
      outputData.diversity_scores.push({
        index: result.selectedIndices[i],
        score: result.diversityScores[i]
      });
    }
    
    // 결과 파일 저장
    fs.writeFileSync('client_result.json', JSON.stringify(outputData, null, 2));
    console.log(`Selected ${result.selectedIndices.length} reviews out of ${reviews.length}`);
    console.log(`Selected indices: ${result.selectedIndices}`);
    console.log("Results saved to client_result.json");
    
  } catch (error) {
    console.error("Error running client sampling:", error);
  }
}

// 테스트 실행
runClientSampling();