import os
import random
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
        
        # 개선된 텍스트 품질 평가 함수
        def evaluate_text_quality(text):
            # 기본 검사: 빈 텍스트나 너무 짧은 텍스트
            if not text or len(text) < 10:
                return 0.1
                
            # 1. 단어 빈도 분석
            words = [w for w in text.split() if w]
            word_count = len(words)
            
            if word_count < 3:
                return 0.2  # 단어가 너무 적으면 낮은 점수
                
            # 정규화된 단어
            normalized_words = [w.lower().strip('.,!?;:') for w in words]
            word_freq = {}
            for word in normalized_words:
                if word:
                    word_freq[word] = word_freq.get(word, 0) + 1
                    
            # 2. 문자 수준의 반복 감지 (문자 바이그램)
            # 이는 "망겜망겜망겜"과 같은 반복 패턴을 감지하는데 효과적
            char_bigrams = {}
            total_bigrams = 0
            
            for i in range(len(text) - 1):
                bigram = text[i:i+2]
                char_bigrams[bigram] = char_bigrams.get(bigram, 0) + 1
                total_bigrams += 1
                
            # 바이그램 엔트로피 계산
            bigram_entropy = 0
            for bigram, freq in char_bigrams.items():
                prob = freq / total_bigrams
                bigram_entropy -= prob * math.log2(prob)
                
            # 정규화된 바이그램 엔트로피
            max_bigram_entropy = math.log2(total_bigrams) if total_bigrams > 1 else 1
            normalized_bigram_entropy = bigram_entropy / max_bigram_entropy if max_bigram_entropy > 0 else 0.5
            
            # 3. 가장 빈번한 단어나 문자의 비율 확인
            most_frequent_word_count = max(word_freq.values()) if word_freq else 0
            most_frequent_word_ratio = most_frequent_word_count / word_count if word_count > 0 else 0
            
            # 4. 가장 빈번한 바이그램의 비율 확인
            most_frequent_bigram_count = max(char_bigrams.values()) if char_bigrams else 0
            most_frequent_bigram_ratio = most_frequent_bigram_count / total_bigrams if total_bigrams > 0 else 0
            
            # 5. 반복 패턴 감지
            # 동일한 문자가 연속으로 많이 등장하는지 감지
            repeated_chars = 0
            current_char = ''
            current_run = 0
            
            for char in text:
                if char == current_char:
                    current_run += 1
                    if current_run > 2:  # 3글자 이상 연속되면 카운트
                        repeated_chars += 1
                else:
                    current_char = char
                    current_run = 1
                    
            repeated_char_ratio = repeated_chars / len(text) if len(text) > 0 else 0
            
            # 6. 단어 다양성 (TTR)
            unique_word_count = len(word_freq)
            ttr = unique_word_count / word_count if word_count > 0 else 0
            
            # 7. 연속된 단어 반복 패턴 감지
            word_pattern_repetition = 0
            word_pairs = {}
            
            if len(normalized_words) >= 2:
                for i in range(len(normalized_words) - 1):
                    pair = f"{normalized_words[i]}-{normalized_words[i+1]}"
                    word_pairs[pair] = word_pairs.get(pair, 0) + 1
                    
                    # 같은 단어 쌍이 3번 이상 반복되면 패널티
                    if word_pairs[pair] >= 3:
                        word_pattern_repetition += 0.2
            
            # 8. 문장 구조 검사
            sentence_end_markers = re.findall(r'[.!?]+', text)
            punctuation_score = 0.5
            
            if word_count > 20:
                if not sentence_end_markers:
                    punctuation_score = 0.2
                else:
                    avg_words_per_sentence = word_count / len(sentence_end_markers)
                    if avg_words_per_sentence > 30:
                        punctuation_score = 0.3
                    elif avg_words_per_sentence < 3:
                        punctuation_score = 0.4
                    else:
                        punctuation_score = 0.8
            
            # 9. 문자 다양성 비율
            unique_chars = len(set(text.replace(" ", "")))
            total_chars = len(text.replace(" ", ""))
            char_diversity = unique_chars / total_chars if total_chars > 0 else 0
            
            # -------- 반복 기반 패널티 계산 --------
            
            # 심각한 반복에 대한 강력한 패널티
            repetition_penalty = 0
            
            # 단어 반복 패널티
            if most_frequent_word_ratio > 0.1:
                # 단어 반복 패널티 (10% 이상 동일 단어 사용 시 패널티)
                repetition_penalty += pow(most_frequent_word_ratio, 1.5) * 2.0
            
            # 바이그램 반복 패널티
            if most_frequent_bigram_ratio > 0.08:
                # 바이그램 반복 패널티 (8% 이상 동일 바이그램 사용 시 패널티)
                repetition_penalty += pow(most_frequent_bigram_ratio, 1.5) * 2.5
            
            # 문자 다양성 패널티
            if char_diversity < 0.2:
                # 낮은 문자 다양성 패널티
                repetition_penalty += (0.2 - char_diversity) * 3.0
            
            # 연속 반복 문자 패널티
            repetition_penalty += repeated_char_ratio * 2.0
            
            # 단어 패턴 반복 패널티
            repetition_penalty += word_pattern_repetition
            
            # -------- 최종 점수 계산 --------
            
            # 기본 품질 점수 (정상적인 텍스트)
            base_quality_score = (
                0.3 * ttr +                       # 단어 다양성
                0.2 * normalized_bigram_entropy + # 문자 엔트로피
                0.2 * punctuation_score +         # 문장 구조
                0.1 * char_diversity              # 문자 다양성
            )
            
            # 패널티가 심각하면 기본 점수와 상관없이 매우 낮은 점수 부여
            is_extremely_repetitive = repetition_penalty > 1.0
            
            if is_extremely_repetitive:
                # 극도로 반복적인 텍스트는 0.1 이하의 낮은 점수
                final_score = max(0.05, 0.1 - (repetition_penalty - 1.0) * 0.05)
            else:
                # 일반적인 텍스트는 기본 점수에서 반복 패널티 차감
                final_score = max(0.05, base_quality_score - repetition_penalty)
            
            return final_score
        
        # 텍스트 특성 추출 함수 (기존 코드)
        def extract_features(text):
            words = [w for w in text.split() if w]
            
            word_freq = {}
            for word in words:
                word_freq[word] = word_freq.get(word, 0) + 1
            
            features = {
                'length': len(text),
                'word_count': len(words),
                'avg_word_length': len(text) / max(1, len(words)),
                'unique_word_ratio': len(word_freq) / max(1, len(words)),
                'special_char_ratio': sum(1 for c in text if not c.isalnum() and not c.isspace()) / max(1, len(text)),
                'digit_ratio': sum(1 for c in text if c.isdigit()) / max(1, len(text)),
                'sentence_count': sum(1 for c in text if c in '.!?')
            }
            
            return features
        
        # 두 텍스트 특성 간 거리 계산 (기존 코드)
        def calculate_distance(features1, features2):
            weights = {
                'length': 0.1,
                'word_count': 0.15,
                'avg_word_length': 0.2,
                'unique_word_ratio': 0.25,
                'special_char_ratio': 0.1,
                'digit_ratio': 0.1,
                'sentence_count': 0.1
            }
            
            distance = 0
            
            for key, weight in weights.items():
                diff = abs(features1[key] - features2[key])
                max_value = max(features1[key], features2[key]) or 1
                normalized_diff = diff / max_value
                
                distance += weight * normalized_diff
            
            return distance
        
        # 텍스트 품질 평가
        quality_scores = [evaluate_text_quality(text) for text in text_list]
        
        # 텍스트 특성 추출
        features = [extract_features(text) for text in text_list]
        
        # 품질 임계값 (일정 수준 이상의 텍스트만 후보로 고려)
        # 더 엄격한 임계값 적용
        QUALITY_THRESHOLD = 0.30
        
        # 품질 점수가 임계값 이상인 텍스트만 후보로 선택
        candidate_indices = [i for i, score in enumerate(quality_scores) if score >= QUALITY_THRESHOLD]
        
        # 후보가 없으면 품질 점수 기준으로 상위 30%는 유지
        if not candidate_indices:
            sorted_indices = sorted(range(len(quality_scores)), key=lambda i: quality_scores[i], reverse=True)
            top_count = max(1, int(len(text_list) * 0.3))
            candidate_indices = sorted_indices[:top_count]
        
        # 결과 저장 변수
        selected_indices = []
        selected_texts = []
        total_length = 0
        
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
            total_length += len(text_list[best_first_index])
            
            # 후보 목록에서 선택된 항목 제거
            candidate_indices.remove(best_first_index)
        else:
            # 후보가 없는 경우 (이론상 발생하지 않지만 안전을 위해)
            return []
        
        # 남은 텍스트에서 선택 (품질과 다양성 모두 고려)
        while candidate_indices and total_length < 5000:
            best_index = -1
            best_combined_score = -1
            
            # 각 후보 텍스트에 대해
            for index in candidate_indices[:]:
                text = text_list[index]
                
                # 길이 제한 확인
                if total_length + len(text) > 5000:
                    continue
                
                # 1. 다양성 점수 계산: 이미 선택된 모든 텍스트와의 최소 거리
                min_distance = float('inf')
                for selected_index in selected_indices:
                    distance = calculate_distance(features[index], features[selected_index])
                    min_distance = min(min_distance, distance)
                
                # 정규화된 다양성 점수 (0-1 범위)
                diversity_score = min(1, min_distance * 2)
                
                # 2. 품질 점수
                quality_score = quality_scores[index]
                
                # 3. 결합 점수 (품질 60%, 다양성 40%)
                combined_score = quality_score * 0.6 + diversity_score * 0.4
                
                # 최고 점수 갱신
                if combined_score > best_combined_score:
                    best_combined_score = combined_score
                    best_index = index
            
            # 더 이상 적합한 텍스트가 없으면 종료
            if best_index == -1:
                break
            
            # 선택된 텍스트 추가
            selected_indices.append(best_index)
            selected_texts.append(text_list[best_index])
            total_length += len(text_list[best_index])
            
            # 선택된 인덱스 제거
            candidate_indices.remove(best_index)
        
        # 선택된 텍스트와 품질 점수를 함께 저장
        selected_text_with_scores = [(text, quality_scores[idx]) for text, idx in zip(selected_texts, selected_indices)]
        
        # 품질 점수 기준으로 내림차순 정렬
        selected_text_with_scores.sort(key=lambda x: x[1], reverse=True)
        
        # 정렬된 결과 출력
        print("Selected texts with quality scores (highest first):")
        for i, (text, score) in enumerate(selected_text_with_scores):
            print(f"[{i+1}] Score: {score:.2f} - Text: {text[:50]}...")
        print("Selected texts: ", selected_texts)
        
        # 원래 순서의 텍스트만 반환
        return selected_texts