import os
import random
import numpy as np
from openai import OpenAI

MAX_LENGTH = 5000

class LLM:
    def __init__(self):
        # 환경 변수에서 API 키 가져오기(로컬에서 할때는 이 환경변수에 값을 넣고 실행해야 함)
        api_key = os.environ.get('OPENAI_API_KEY')
        if not api_key:
            raise ValueError("API key is not set")

        self.client = OpenAI(
            api_key=api_key,
        )

    def __call__(self, prompt, text):
        try:
            response = self.client.chat.completions.create(
                messages=[
                    {
                        "role": "system",
                        "content": prompt
                    },
                    {"role": "user", "content": text}
                ],
                model="o4-mini",
            )
            translated_text = response.choices[0].message.content.strip()
            return translated_text
        except Exception as e:
            raise ValueError(f"Failed to call OpenAI API: {e}")

    def sampling(self, text_list):
        """
        텍스트 품질과 다양성을 모두 고려하여 텍스트를 선택합니다.
        텍스트 내부의 중복 표현/단어를 피하고 유의미한 텍스트를 선호하며,
        선택된 텍스트들 간의 유사도가 낮도록 합니다.
        총 길이는 5000자를 넘지 않도록 합니다.
        
        Args:
            text_list (list): 텍스트 문자열들의 리스트
        Returns:
            list: 선택된 텍스트들의 리스트(총 길이 5000자 이하)
        """
        if not text_list:
            return []
        
        import re
        import math
        
        # 최적화된 텍스트 품질 평가 함수
        def evaluate_text_quality(text):
            # 기본 검사: 빈 텍스트나 너무 짧은 텍스트
            if not text or len(text) < 10:
                return 0.1
            
            # 텍스트 길이 미리 계산 (반복 계산 방지)
            text_length = len(text)
                
            # 1. 단어 빈도 분석 최적화 - Collections 모듈 사용
            from collections import Counter
            
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
        
        def jaccard_similarity(sentence1, sentence2):
            """
            두 문장의 단어 유사도를 측정하는 가장 가벼운 함수
            Jaccard 유사도 기반 (교집합/합집합)
            
            Args:
                sentence1 (str): 첫 번째 문장
                sentence2 (str): 두 번째 문장
            
            Returns:
                float: 0~1 사이의 유사도 점수 (높을수록 유사)
            """
            # 문장을 소문자로 변환하고 단어로 분리
            words1 = set(sentence1.lower().split())
            words2 = set(sentence2.lower().split())
            
            # 교집합과 합집합 계산
            intersection = words1.intersection(words2)
            union = words1.union(words2)
            
            # Jaccard 유사도 계산
            similarity = len(intersection) / len(union) if union else 1.0
            
            return similarity 
        
        print("Evaluating text quality...")
        # 텍스트 품질 평가
        quality_scores = [evaluate_text_quality(text) for text in text_list]
        
        # 품질 점수 기준으로 상위 N개만 후보로 선택
        sorted_indices = sorted(range(len(quality_scores)), key=lambda i: quality_scores[i], reverse=True)
        candidate_indices = sorted_indices[:min(100, len(sorted_indices))]
        
        # 결과 저장 변수
        selected_indices = []
        selected_texts = []
        total_length = 0
        selected_diversity_scores = []
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
        
        print("Selecting diverse texts...")
        # 남은 텍스트에서 선택 (품질과 다양성 모두 고려)
        
        # 선택된 텍스트들을 하나의 문자열로 누적
        accumulated_selected_text = text_list[selected_indices[0]]
        
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
                similarity = jaccard_similarity(text, accumulated_selected_text)
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
        
        # 선택된 텍스트와 품질 점수, 다양성 점수를 함께 저장
        selected_text_with_scores = [(text, quality_scores[idx], selected_diversity_scores[i]) 
                                    for i, (text, idx) in enumerate(zip(selected_texts, selected_indices))]
        
        # 품질 점수 기준으로 내림차순 정렬
        selected_text_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        # 정렬된 결과 출력
        print("Selected texts with quality scores and diversity scores (highest quality first):")
        for i, (text, quality, diversity) in enumerate(selected_text_with_scores):
            print(f"[{i+1}] Quality: {quality:.2f}, Diversity: {diversity:.2f} - Text: {text[:50]}...")
        print("Selected texts: ", selected_texts)
        
        # 원래 순서의 텍스트만 반환
        return selected_texts