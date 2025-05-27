"""
서버(Python)와 클라이언트(JavaScript) 샘플링 알고리즘 직접 비교 스크립트

이 스크립트는 Python 버전의 샘플링 알고리즘(llm.py에서 추출)과 
JavaScript 버전의 알고리즘(sampling.ts에서 추출)을 직접 구현하여 비교합니다.
"""

import json
import math
import random
import numpy as np
from collections import Counter
import matplotlib.pyplot as plt
from tabulate import tabulate

# Python 버전 샘플링 알고리즘 (llm.py에서 추출)
def evaluate_text_quality_py(text):
    """Python 버전 텍스트 품질 평가 함수"""
    # 기본 검사: 빈 텍스트나 너무 짧은 텍스트
    if not text or len(text) < 10:
        return 0.1
    
    # 텍스트 길이 미리 계산 (반복 계산 방지)
    text_length = len(text)
        
    # 1. 단어 빈도 분석 최적화 - Collections 모듈 사용
    words = text.split()
    word_count = len(words)
    
    if word_count < 3:
        return 0.2  # 단어가 너무 적으면 낮은 점수
        
    # 정규화된 단어 - 리스트 컴프리헨션 최적화
    normalized_words = [w.lower().strip('.,!?;:') for w in words if w]
    word_freq = Counter(w for w in normalized_words if w)
    
    # 2. 문자 바이그램 분석 최적화
    # Counter 객체 사용으로 딕셔너리 조회 연산 감소
    char_bigrams = Counter()
    total_bigrams = max(1, text_length - 1)  # 미리 계산
    
    # 슬라이싱 최소화
    for i in range(text_length - 1):
        char_bigrams[text[i:i+2]] += 1
        
    # 3-4. 빈도 분석 최적화
    most_frequent_word_count = max(word_freq.values()) if word_freq else 0
    most_frequent_word_ratio = most_frequent_word_count / word_count if word_count > 0 else 0
    
    most_frequent_bigram_count = char_bigrams.most_common(1)[0][1] if char_bigrams else 0
    most_frequent_bigram_ratio = most_frequent_bigram_count / total_bigrams
    
    # 바이그램 엔트로피 계산 최적화 - 한 번의 루프로 처리
    bigram_entropy = 0
    for freq in char_bigrams.values():
        prob = freq / total_bigrams
        bigram_entropy -= prob * math.log2(prob)
        
    # 정규화된 바이그램 엔트로피
    max_bigram_entropy = math.log2(total_bigrams) if total_bigrams > 1 else 1
    normalized_bigram_entropy = bigram_entropy / max_bigram_entropy if max_bigram_entropy > 0 else 0.5
    
    # 5. 반복 패턴 감지 최적화
    repeated_chars = 0
    current_char = ''
    current_run = 0
    
    # 문자 반복 검사를 위한 단일 루프
    for char in text:
        if char == current_char:
            current_run += 1
            if current_run > 2:  # 3글자 이상 연속되면 카운트
                repeated_chars += 1
        else:
            current_char = char
            current_run = 1
            
    repeated_char_ratio = repeated_chars / text_length if text_length > 0 else 0
    
    # 6. 단어 다양성 (TTR)
    unique_word_count = len(word_freq)
    ttr = unique_word_count / word_count if word_count > 0 else 0
    
    # 7. 연속된 단어 반복 패턴 감지 최적화
    word_pattern_repetition = 0
    
    # 단어 쌍 패턴 감지 최적화 - 임계값 3 이상만 세기
    if len(normalized_words) >= 2:
        # 단어 쌍 미리 생성하여 Counter로 한 번에 처리
        word_pairs = [f"{normalized_words[i]}-{normalized_words[i+1]}" 
                     for i in range(len(normalized_words) - 1)]
        pair_counts = Counter(word_pairs)
        
        # 3회 이상 반복되는 쌍만 확인
        word_pattern_repetition = sum(0.2 for count in pair_counts.values() if count >= 3)
    
    # 8. 문장 구조 검사 최적화 - 정규식 대신 문자열 메서드 사용
    # 마침표, 느낌표, 물음표 세기
    sentence_count = text.count('.') + text.count('!') + text.count('?')
    punctuation_score = 0.5
    
    if word_count > 20:
        if sentence_count == 0:
            punctuation_score = 0.2
        else:
            avg_words_per_sentence = word_count / sentence_count
            if avg_words_per_sentence > 30:
                punctuation_score = 0.3
            elif avg_words_per_sentence < 3:
                punctuation_score = 0.4
            else:
                punctuation_score = 0.8
    
    # 9. 문자 다양성 비율 최적화 - 공백 제거 텍스트 미리 계산
    text_no_spaces = text.replace(" ", "")
    total_chars = len(text_no_spaces)
    unique_chars = len(set(text_no_spaces))
    char_diversity = unique_chars / total_chars if total_chars > 0 else 0
    
    # -------- 반복 기반 패널티 계산 --------
    repetition_penalty = 0
    
    # 조건부 패널티 계산 - 최적화된 방식으로 한 번에 계산
    if most_frequent_word_ratio > 0.1:
        repetition_penalty += pow(most_frequent_word_ratio, 1.5) * 2.0
    
    if most_frequent_bigram_ratio > 0.08:
        repetition_penalty += pow(most_frequent_bigram_ratio, 1.5) * 2.5
    
    if char_diversity < 0.2:
        repetition_penalty += (0.2 - char_diversity) * 3.0
    
    repetition_penalty += repeated_char_ratio * 2.0
    repetition_penalty += word_pattern_repetition
    
    # -------- 최종 점수 계산 --------
    base_quality_score = (
        0.3 * ttr +
        0.2 * normalized_bigram_entropy +
        0.2 * punctuation_score +
        0.1 * char_diversity
    )
    
    # 패널티 적용 로직 단순화
    if repetition_penalty > 1.0:
        final_score = max(0.05, 0.1 - (repetition_penalty - 1.0) * 0.05)
    else:
        final_score = max(0.05, base_quality_score - repetition_penalty)
    
    return final_score

def jaccard_similarity_py(sentence1, sentence2):
    """Python 버전 Jaccard 유사도 계산 함수"""
    # 문장을 소문자로 변환하고 단어로 분리
    words1 = set(sentence1.lower().split())
    words2 = set(sentence2.lower().split())
    
    # 교집합과 합집합 계산
    intersection = words1.intersection(words2)
    union = words1.union(words2)
    
    # Jaccard 유사도 계산
    similarity = len(intersection) / len(union) if union else 1.0
    
    return similarity

def sampling_py(text_list):
    """Python 버전 샘플링 함수"""
    if not text_list:
        return []
    
    print("Python 품질 평가 중...")
    # 텍스트 품질 평가
    quality_scores = [evaluate_text_quality_py(text) for text in text_list]
    
    # 품질 점수 기준으로 상위 N개만 후보로 선택
    sorted_indices = sorted(range(len(quality_scores)), key=lambda i: quality_scores[i], reverse=True)
    candidate_indices = sorted_indices[:min(100, len(sorted_indices))]
    
    # 결과 저장 변수
    selected_indices = []
    selected_texts = []
    selected_diversity_scores = []
    total_length = 0
    
    print("Python 다양성 기반 선택 중...")
    # 첫 텍스트 선택: 품질 점수와 길이를 모두 고려
    best_first_index = -1
    best_first_score = -1
    
    for index in candidate_indices:
        quality_score = quality_scores[index]
        length_score = min(1, len(text_list[index]) / 500)  # 적당한 길이 선호
        combined_score = quality_score * 0.7 + length_score * 0.3
        
        if combined_score > best_first_score:
            best_first_score = combined_score
            best_first_index = index
    
    # 첫 텍스트 추가
    if best_first_index >= 0:
        selected_indices.append(best_first_index)
        selected_texts.append(text_list[best_first_index])
        selected_diversity_scores.append(0)
        total_length += len(text_list[best_first_index])
        
        # 후보 목록에서 선택된 항목 제거
        candidate_indices.remove(best_first_index)
    else:
        # 후보가 없는 경우 (이론상 발생하지 않지만 안전을 위해)
        return []
    
    # 선택된 텍스트들을 하나의 문자열로 누적
    accumulated_selected_text = text_list[selected_indices[0]]
    
    # 남은 텍스트에서 선택 (품질과 다양성 모두 고려)
    while candidate_indices and total_length < 5000:
        best_index = -1
        best_combined_score = -1
        best_diversity_score = -1

        # 각 후보 텍스트에 대해
        for index in candidate_indices[:]:
            text = text_list[index]
            
            # 길이 제한 확인
            if total_length + len(text) > 5000:
                continue
            
            # 1. 다양성 점수 계산: 누적된 선택 텍스트와의 유사도 계산
            # 유사도가 낮을수록 다양성이 높음 (1 - 유사도)
            similarity = jaccard_similarity_py(text, accumulated_selected_text)
            diversity_score = 1 - similarity
            
            # 2. 품질 점수
            quality_score = quality_scores[index]
            
            # 3. 결합 점수 (품질 10%, 다양성 90%)
            combined_score = quality_score * 0.1 + diversity_score * 0.9
            
            # 최고 점수 갱신
            if combined_score > best_combined_score:
                best_combined_score = combined_score
                best_index = index
                best_diversity_score = diversity_score
        
        # 더 이상 적합한 텍스트가 없으면 종료
        if best_index == -1:
            break
        
        # 선택된 텍스트 추가
        selected_indices.append(best_index)
        selected_diversity_scores.append(best_diversity_score)
        selected_texts.append(text_list[best_index])
        total_length += len(text_list[best_index])
        
        # 누적 텍스트 업데이트 - 새로 선택된 텍스트 추가
        accumulated_selected_text += " " + text_list[best_index]
        
        # 선택된 인덱스 제거
        candidate_indices.remove(best_index)
    
    return selected_indices, selected_texts, quality_scores, selected_diversity_scores

# JavaScript/TypeScript 버전 샘플링 알고리즘 (sampling.ts에서 추출)
def evaluate_text_quality_js(text):
    """JavaScript 버전 텍스트 품질 평가 함수"""
    # 기본 검사: 빈 텍스트나 너무 짧은 텍스트
    if not text or len(text) < 10:
        return 0.1

    # 텍스트 길이 미리 계산
    text_length = len(text)

    # 1. 단어 빈도 분석
    words = text.split()
    word_count = len(words)

    if word_count < 3:
        return 0.2  # 단어가 너무 적으면 낮은 점수

    # 정규화된 단어 목록 생성
    normalized_words = []
    for w in words:
        normalized = w.lower()
        for char in '.,!?;:':
            normalized = normalized.replace(char, '')
        if normalized:
            normalized_words.append(normalized)

    # 단어 빈도 맵 생성
    word_freq = {}
    for word in normalized_words:
        word_freq[word] = word_freq.get(word, 0) + 1

    # 2. 문자 바이그램 분석
    char_bigrams = {}
    total_bigrams = max(1, text_length - 1)

    for i in range(text_length - 1):
        bigram = text[i:i+2]
        char_bigrams[bigram] = char_bigrams.get(bigram, 0) + 1

    # 3-4. 빈도 분석
    most_frequent_word_count = max(word_freq.values()) if word_freq else 0
    most_frequent_word_ratio = most_frequent_word_count / word_count if word_count > 0 else 0

    most_frequent_bigram_count = max(char_bigrams.values()) if char_bigrams else 0
    most_frequent_bigram_ratio = most_frequent_bigram_count / total_bigrams

    # 바이그램 엔트로피 계산
    bigram_entropy = 0
    for freq in char_bigrams.values():
        prob = freq / total_bigrams
        bigram_entropy -= prob * math.log2(prob)

    # 정규화된 바이그램 엔트로피
    max_bigram_entropy = math.log2(total_bigrams) if total_bigrams > 1 else 1
    normalized_bigram_entropy = bigram_entropy / max_bigram_entropy if max_bigram_entropy > 0 else 0.5

    # 5. 반복 패턴 감지
    repeated_chars = 0
    current_char = ''
    current_run = 0

    # 문자 반복 검사
    for char in text:
        if char == current_char:
            current_run += 1
            if current_run > 2:  # 3글자 이상 연속되면 카운트
                repeated_chars += 1
        else:
            current_char = char
            current_run = 1
    
    repeated_char_ratio = repeated_chars / text_length if text_length > 0 else 0

    # 6. 단어 다양성 (TTR)
    unique_word_count = len(word_freq)
    ttr = unique_word_count / word_count if word_count > 0 else 0

    # 7. 연속된 단어 반복 패턴 감지
    word_pattern_repetition = 0

    if len(normalized_words) >= 2:
        # 단어 쌍 생성
        word_pairs = {}
        for i in range(len(normalized_words) - 1):
            pair = f"{normalized_words[i]}-{normalized_words[i + 1]}"
            word_pairs[pair] = word_pairs.get(pair, 0) + 1

        # 3회 이상 반복되는 쌍 확인
        for count in word_pairs.values():
            if count >= 3:
                word_pattern_repetition += 0.2

    # 8. 문장 구조 검사
    sentence_count = 0
    for char in ['.', '!', '?']:
        sentence_count += text.count(char)
    
    punctuation_score = 0.5

    if word_count > 20:
        if sentence_count == 0:
            punctuation_score = 0.2
        else:
            avg_words_per_sentence = word_count / sentence_count
            if avg_words_per_sentence > 30:
                punctuation_score = 0.3
            elif avg_words_per_sentence < 3:
                punctuation_score = 0.4
            else:
                punctuation_score = 0.8

    # 9. 문자 다양성 비율
    text_no_spaces = text.replace(" ", "")
    total_chars = len(text_no_spaces)
    unique_chars = len(set(text_no_spaces))
    char_diversity = unique_chars / total_chars if total_chars > 0 else 0

    # 반복 기반 패널티 계산
    repetition_penalty = 0

    if most_frequent_word_ratio > 0.1:
        repetition_penalty += pow(most_frequent_word_ratio, 1.5) * 2.0

    if most_frequent_bigram_ratio > 0.08:
        repetition_penalty += pow(most_frequent_bigram_ratio, 1.5) * 2.5

    if char_diversity < 0.2:
        repetition_penalty += (0.2 - char_diversity) * 3.0

    repetition_penalty += repeated_char_ratio * 2.0
    repetition_penalty += word_pattern_repetition

    # 최종 점수 계산
    base_quality_score = (
        0.3 * ttr +
        0.2 * normalized_bigram_entropy +
        0.2 * punctuation_score +
        0.1 * char_diversity
    )

    # 패널티 적용
    if repetition_penalty > 1.0:
        final_score = max(0.05, 0.1 - (repetition_penalty - 1.0) * 0.05)
    else:
        final_score = max(0.05, base_quality_score - repetition_penalty)

    return final_score

def jaccard_similarity_js(sentence1, sentence2):
    """JavaScript 버전 Jaccard 유사도 계산 함수"""
    if not sentence1 or not sentence2:
        return 0
    
    # 문장을 소문자로 변환하고 단어로 분리
    words1 = set(sentence1.lower().split())
    words2 = set(sentence2.lower().split())
    
    # 교집합 계산
    intersection = set()
    for word in words1:
        if word in words2:
            intersection.add(word)
    
    # 합집합 계산
    union = words1.union(words2)
    
    # Jaccard 유사도 계산
    return len(intersection) / len(union) if len(union) > 0 else 1.0

def sampling_js(text_list):
    """JavaScript 버전 샘플링 함수"""
    print("JS 품질 평가 중...")
    # 품질 점수 저장
    quality_scores = [evaluate_text_quality_js(text) for text in text_list]
    
    # 품질 점수 기준으로 상위 100개 (또는 더 적은 수) 후보 선택
    sorted_indices = sorted(range(len(quality_scores)), key=lambda i: quality_scores[i], reverse=True)
    candidate_indices = sorted_indices[:min(100, len(sorted_indices))]
    
    # 결과 저장 변수
    selected_indices = []
    selected_texts = []
    selected_diversity_scores = []
    total_length = 0
    
    print("JS 다양성 기반 선택 중...")
    # 첫 텍스트 선택: 품질 점수와 길이를 모두 고려
    best_first_index = -1
    best_first_score = -1
    
    for index in candidate_indices:
        quality_score = quality_scores[index]
        length_score = min(1, len(text_list[index]) / 500)  # 적당한 길이 선호
        combined_score = quality_score * 0.7 + length_score * 0.3
        
        if combined_score > best_first_score:
            best_first_score = combined_score
            best_first_index = index
    
    # 첫 텍스트 추가
    if best_first_index >= 0:
        selected_indices.append(best_first_index)
        selected_texts.append(text_list[best_first_index])
        selected_diversity_scores.append(0)
        total_length += len(text_list[best_first_index])
        
        # 후보 목록에서 선택된 항목 제거
        candidate_indices.remove(best_first_index)
    
    # 누적 텍스트 초기화
    accumulated_selected_text = selected_texts[0] if selected_texts else ""
    
    # 남은 텍스트에서 선택 (품질과 다양성 모두 고려)
    while candidate_indices and total_length < 5000:
        best_index = -1
        best_combined_score = -1
        best_diversity_score = -1
        
        # 각 후보 텍스트에 대해
        for index in candidate_indices[:]:
            text = text_list[index]
            
            # 길이 제한 확인
            if total_length + len(text) > 5000:
                continue
            
            # 1. 다양성 점수 계산: 누적된 선택 텍스트와의 유사도 계산
            # 유사도가 낮을수록 다양성이 높음 (1 - 유사도)
            similarity = jaccard_similarity_js(text, accumulated_selected_text)
            diversity_score = 1 - similarity
            
            # 2. 품질 점수
            quality_score = quality_scores[index]
            
            # 3. 결합 점수 (품질 10%, 다양성 90%)
            combined_score = quality_score * 0.1 + diversity_score * 0.9
            
            # 최고 점수 갱신
            if combined_score > best_combined_score:
                best_combined_score = combined_score
                best_index = index
                best_diversity_score = diversity_score
        
        # 더 이상 적합한 텍스트가 없으면 종료
        if best_index == -1:
            break
        
        # 선택된 텍스트 추가
        selected_indices.append(best_index)
        selected_diversity_scores.append(best_diversity_score)
        selected_texts.append(text_list[best_index])
        total_length += len(text_list[best_index])
        
        # 누적 텍스트 업데이트 - 새로 선택된 텍스트 추가
        accumulated_selected_text += " " + text_list[best_index]
        
        # 선택된 인덱스 제거
        candidate_indices.remove(best_index)
    
    return selected_indices, selected_texts, quality_scores, selected_diversity_scores

def load_test_reviews():
    """테스트 리뷰 데이터 로드"""
    try:
        with open('test_reviews.json', 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # 리뷰 데이터에서 content 필드만 추출
        text_list = [review['content'] for review in data['reviews']]
        return text_list, data['reviews']
    except Exception as e:
        print(f"Error loading test reviews: {e}")
        return [], []

def compare_quality_scores(py_quality, js_quality):
    """품질 점수 비교"""
    # 비교 결과 계산
    comparison = []
    total_diff = 0
    max_diff = 0
    max_diff_idx = -1
    
    for i in range(len(py_quality)):
        py_score = py_quality[i]
        js_score = js_quality[i]
        diff = abs(py_score - js_score)
        diff_percent = diff / max(py_score, 0.001) * 100
        
        comparison.append({
            'index': i,
            'py_score': py_score,
            'js_score': js_score,
            'diff': diff,
            'diff_percent': diff_percent
        })
        
        total_diff += diff
        if diff > max_diff:
            max_diff = diff
            max_diff_idx = i
    
    avg_diff = total_diff / len(py_quality) if py_quality else 0
    
    # 피어슨 상관계수 계산
    correlation = np.corrcoef(py_quality, js_quality)[0, 1]
    
    return {
        'comparison': comparison,
        'avg_diff': avg_diff,
        'max_diff': max_diff,
        'max_diff_idx': max_diff_idx,
        'correlation': correlation
    }

def compare_selected_reviews(py_selected, js_selected):
    """선택된 리뷰 비교"""
    # 교집합 (양쪽 모두 선택한 리뷰)
    common_selected = set(py_selected) & set(js_selected)
    
    # 차집합 (Python만 선택 / JavaScript만 선택)
    py_only = set(py_selected) - set(js_selected)
    js_only = set(js_selected) - set(py_selected)
    
    # Jaccard 유사도 (교집합 / 합집합)
    jaccard = len(common_selected) / len(set(py_selected) | set(js_selected)) if py_selected or js_selected else 0
    
    return {
        'common_count': len(common_selected),
        'common_selected': sorted(common_selected),
        'py_only_count': len(py_only),
        'py_only': sorted(py_only),
        'js_only_count': len(js_only),
        'js_only': sorted(js_only),
        'py_selected_count': len(py_selected),
        'js_selected_count': len(js_selected),
        'jaccard_similarity': jaccard
    }

def plot_quality_scores(py_quality, js_quality, comparison_result):
    """품질 점수 비교 그래프 생성"""
    try:
        plt.figure(figsize=(12, 6))
        
        # 모든 인덱스에 대한 점수 추출
        indices = list(range(len(py_quality)))
        
        x = np.arange(len(indices))
        width = 0.35
        
        plt.bar(x - width/2, py_quality, width, label='Python (Server)')
        plt.bar(x + width/2, js_quality, width, label='JavaScript (Client)')
        
        plt.xlabel('Review Index')
        plt.ylabel('Quality Score')
        plt.title('Quality Score Comparison')
        plt.xticks(x[::2], indices[::2], rotation=90)  # 홀수 인덱스만 표시
        plt.legend()
        plt.tight_layout()
        
        plt.savefig('quality_score_comparison.png')
        print("Quality score comparison graph saved to quality_score_comparison.png")
    except Exception as e:
        print(f"Error creating quality score graph: {e}")

def generate_comparison_report(py_indices, py_texts, py_quality, py_diversity, 
                               js_indices, js_texts, js_quality, js_diversity):
    """비교 보고서 생성"""
    # 품질 점수 비교
    quality_comparison = compare_quality_scores(py_quality, js_quality)
    
    # 선택된 리뷰 비교
    selection_comparison = compare_selected_reviews(py_indices, js_indices)
    
    # 요약 통계
    summary = {
        'py_selected_count': len(py_indices),
        'js_selected_count': len(js_indices),
        'common_selected_count': selection_comparison['common_count'],
        'jaccard_similarity': selection_comparison['jaccard_similarity'],
        'quality_score_correlation': quality_comparison['correlation'],
        'avg_quality_diff': quality_comparison['avg_diff'],
        'max_quality_diff': quality_comparison['max_diff']
    }
    
    # 콘솔 출력
    print("==== 샘플링 알고리즘 비교 보고서 ====")
    print()
    
    print("선택된 리뷰:")
    print(f"  Python (서버): {summary['py_selected_count']} 리뷰 선택")
    print(f"  JavaScript (클라이언트): {summary['js_selected_count']} 리뷰 선택")
    print(f"  공통: {summary['common_selected_count']} 리뷰 (Jaccard 유사도: {summary['jaccard_similarity']:.4f})")
    print()
    
    print("품질 점수:")
    print(f"  상관계수: {summary['quality_score_correlation']:.4f}")
    print(f"  평균 차이: {summary['avg_quality_diff']:.4f}")
    print(f"  최대 차이: {summary['max_quality_diff']:.4f}")
    print()
    
    print("Python만 선택한 리뷰:")
    print(f"  {selection_comparison['py_only']}")
    print()
    
    print("JavaScript만 선택한 리뷰:")
    print(f"  {selection_comparison['js_only']}")
    print()
    
    print("품질 점수 상위 10개 비교:")
    top_comparisons = sorted(quality_comparison['comparison'], key=lambda x: x['py_score'], reverse=True)[:10]
    headers = ["Index", "Python Score", "JavaScript Score", "Difference", "Diff %"]
    table_data = [[item['index'], f"{item['py_score']:.4f}", f"{item['js_score']:.4f}", 
                  f"{item['diff']:.4f}", f"{item['diff_percent']:.2f}%"] for item in top_comparisons]
    print(tabulate(table_data, headers=headers, tablefmt="grid"))
    
    # 그래프 생성
    plot_quality_scores(py_quality, js_quality, quality_comparison)
    
    # 보고서 파일로 저장
    report = {
        'summary': summary,
        'quality_comparison': {
            'correlation': float(quality_comparison['correlation']),
            'avg_diff': quality_comparison['avg_diff'],
            'max_diff': quality_comparison['max_diff'],
            'details': quality_comparison['comparison']
        },
        'selection_comparison': selection_comparison
    }
    
    with open('comparison_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, default=lambda x: float(x) if isinstance(x, np.float64) else x, ensure_ascii=False, indent=2)
    
    print("Detailed comparison report saved to comparison_report.json")
    
    return report

def run_comparison():
    """직접 비교 실행"""
    # 테스트 리뷰 로드
    text_list, original_reviews = load_test_reviews()
    if not text_list:
        print("No reviews to process")
        return
    
    print(f"Loaded {len(text_list)} reviews for testing")
    
    # Python 버전 샘플링 실행
    print("Running Python (server) version sampling...")
    py_indices, py_texts, py_quality, py_diversity = sampling_py(text_list)
    print(f"Python version selected {len(py_indices)} reviews")
    print(f"Python selected indices: {py_indices}")
    
    # JavaScript 버전 샘플링 실행
    print("Running JavaScript (client) version sampling...")
    js_indices, js_texts, js_quality, js_diversity = sampling_js(text_list)
    print(f"JavaScript version selected {len(js_indices)} reviews")
    print(f"JavaScript selected indices: {js_indices}")
    
    # 비교 보고서 생성
    generate_comparison_report(py_indices, py_texts, py_quality, py_diversity, 
                               js_indices, js_texts, js_quality, js_diversity)

if __name__ == "__main__":
    run_comparison()