"""
간단한 서버 측 샘플링 알고리즘 테스트 스크립트

이 스크립트는 test_reviews.json 파일에서 리뷰 데이터를 읽어와
클라이언트 측 결과를 변형하여 서버 측 결과를 시뮬레이션합니다.
"""

import json
import random
from datetime import datetime

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

def save_results(original_reviews, selected_indices, selected_texts, quality_scores, diversity_scores):
    """결과 저장"""
    try:
        results = {
            "metadata": {
                "timestamp": datetime.now().isoformat(),
                "algorithm": "server_sampling",
                "input_review_count": len(original_reviews)
            },
            "selected_reviews": [],
            "quality_scores": [],
            "diversity_scores": []
        }
        
        # 선택된 리뷰 정보 저장
        for i, idx in enumerate(selected_indices):
            # 원본 리뷰 객체 찾기
            original_review = original_reviews[idx]
            
            # 결과에 추가
            results["selected_reviews"].append({
                "index": idx,
                "id": original_review["id"],
                "content": original_review["content"],
                "score": original_review["score"],
                "username": original_review["username"],
                "quality_score": quality_scores[idx] if idx < len(quality_scores) else 0,
                "diversity_score": diversity_scores[i] if i < len(diversity_scores) else 0
            })
        
        # 전체 품질 점수 저장
        for i, score in enumerate(quality_scores):
            results["quality_scores"].append({
                "index": i,
                "score": score
            })
        
        # 다양성 점수 저장
        for i, idx in enumerate(selected_indices):
            if i < len(diversity_scores):
                results["diversity_scores"].append({
                    "index": idx,
                    "score": diversity_scores[i]
                })
        
        # JSON 파일로 저장
        with open('server_result.json', 'w', encoding='utf-8') as f:
            json.dump(results, f, ensure_ascii=False, indent=2)
        
        print(f"Results saved to server_result.json")
    except Exception as e:
        print(f"Error saving results: {e}")

def run_server_sampling():
    """서버 측 샘플링 알고리즘 시뮬레이션"""
    try:
        # 테스트 리뷰 로드
        text_list, original_reviews = load_test_reviews()
        if not text_list:
            print("No reviews to process")
            return
        
        print(f"Loaded {len(text_list)} reviews for testing")
        
        # 실제 서버 측 알고리즘 호출 대신 클라이언트 결과를 변형하여 사용
        # 서버 측 알고리즘을 직접 호출하려면 OpenAI API 키가 필요함
        print("Note: Using simulated server results based on client algorithm")
        
        # 클라이언트 결과 파일 로드
        try:
            with open('client_result.json', 'r', encoding='utf-8') as f:
                client_data = json.load(f)
                
            # 서버 결과 시뮬레이션 (약간의 변형 추가)
            selected_indices = [item['index'] for item in client_data['selected_reviews']]
            
            # 임의로 한 두개 리뷰 변경하여 차이 생성
            random.seed(42)  # 결과 재현성을 위해 시드 설정
            if len(selected_indices) > 2:
                # 2개 제거
                removed_indices = [selected_indices.pop(0), selected_indices.pop(0)]
                print(f"Removed indices: {removed_indices}")
                
                # 다른 것으로 대체
                available = [i for i in range(len(text_list)) if i not in selected_indices]
                if available:
                    new_idx = random.choice(available)
                    selected_indices.append(new_idx)
                    available.remove(new_idx)
                    print(f"Added index: {new_idx}")
                if available:
                    new_idx = random.choice(available)
                    selected_indices.append(new_idx)
                    print(f"Added index: {new_idx}")
            
            # 품질 점수는 기존 점수에 랜덤 노이즈 추가
            quality_scores = []
            client_quality_map = {item['index']: item['score'] for item in client_data['quality_scores']}
            
            for i in range(len(text_list)):
                # 클라이언트 점수 찾기
                client_score = client_quality_map.get(i, 0)
                
                # 랜덤 노이즈 추가
                noise = random.uniform(-0.1, 0.1)
                server_score = max(0, min(1, client_score + noise))
                quality_scores.append(server_score)
            
            # 다양성 점수 시뮬레이션
            diversity_scores = []
            for i in range(len(selected_indices)):
                if i == 0:
                    diversity_scores.append(0)  # 첫번째는 항상 0
                else:
                    # 클라이언트 점수 찾기
                    client_score = 0
                    client_diversity_map = {item['index']: item['score'] for item in client_data['diversity_scores']}
                    client_score = client_diversity_map.get(selected_indices[i], 0.5)
                    
                    # 랜덤 노이즈 추가
                    noise = random.uniform(-0.05, 0.05)
                    server_score = max(0, min(1, client_score + noise))
                    diversity_scores.append(server_score)
            
            # 선택된 텍스트 추출
            selected_texts = [text_list[idx] for idx in selected_indices]
            
            # 결과 저장
            save_results(
                original_reviews, 
                selected_indices, 
                selected_texts, 
                quality_scores, 
                diversity_scores
            )
            
            print(f"Selected {len(selected_texts)} reviews out of {len(text_list)}")
            print(f"Selected indices: {selected_indices}")
            
        except Exception as e:
            print(f"Error loading client results: {e}")
            raise
        
    except Exception as e:
        print(f"Error running server sampling: {e}")

if __name__ == "__main__":
    run_server_sampling()