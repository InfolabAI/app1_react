"""
서버 측과 클라이언트 측 샘플링 알고리즘 결과 비교 스크립트

이 스크립트는 server_result.json과 client_result.json 파일을 로드하여
두 알고리즘의 결과를 비교하고 일치성을 분석합니다.
"""

import json
import matplotlib.pyplot as plt
import numpy as np
from tabulate import tabulate
import os

def load_result_file(filename):
    """결과 파일 로드"""
    try:
        with open(filename, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return data
    except Exception as e:
        print(f"Error loading {filename}: {e}")
        return None

def compare_quality_scores(server_data, client_data):
    """품질 점수 비교"""
    server_scores = {item['index']: item['score'] for item in server_data['quality_scores']}
    client_scores = {item['index']: item['score'] for item in client_data['quality_scores']}
    
    # 공통 인덱스 찾기
    common_indices = sorted(set(server_scores.keys()) & set(client_scores.keys()))
    
    # 비교 결과 계산
    comparison = []
    total_diff = 0
    max_diff = 0
    max_diff_idx = -1
    
    for idx in common_indices:
        server_score = server_scores.get(idx, 0)
        client_score = client_scores.get(idx, 0)
        diff = abs(server_score - client_score)
        diff_percent = diff / max(server_score, 0.001) * 100
        
        comparison.append({
            'index': idx,
            'server_score': server_score,
            'client_score': client_score,
            'diff': diff,
            'diff_percent': diff_percent
        })
        
        total_diff += diff
        if diff > max_diff:
            max_diff = diff
            max_diff_idx = idx
    
    avg_diff = total_diff / len(common_indices) if common_indices else 0
    
    return {
        'comparison': comparison,
        'avg_diff': avg_diff,
        'max_diff': max_diff,
        'max_diff_idx': max_diff_idx,
        'correlation': calculate_correlation([server_scores.get(i, 0) for i in common_indices], 
                                            [client_scores.get(i, 0) for i in common_indices])
    }

def compare_selected_reviews(server_data, client_data):
    """선택된 리뷰 비교"""
    server_selected = [item['index'] for item in server_data['selected_reviews']]
    client_selected = [item['index'] for item in client_data['selected_reviews']]
    
    # 교집합 (양쪽 모두 선택한 리뷰)
    common_selected = set(server_selected) & set(client_selected)
    
    # 차집합 (서버만 선택 / 클라이언트만 선택)
    server_only = set(server_selected) - set(client_selected)
    client_only = set(client_selected) - set(server_selected)
    
    # Jaccard 유사도 (교집합 / 합집합)
    jaccard = len(common_selected) / len(set(server_selected) | set(client_selected)) if server_selected or client_selected else 0
    
    return {
        'common_count': len(common_selected),
        'common_selected': sorted(common_selected),
        'server_only_count': len(server_only),
        'server_only': sorted(server_only),
        'client_only_count': len(client_only),
        'client_only': sorted(client_only),
        'server_selected_count': len(server_selected),
        'client_selected_count': len(client_selected),
        'jaccard_similarity': jaccard
    }

def calculate_correlation(x, y):
    """두 데이터 세트 간의 피어슨 상관계수 계산"""
    if not x or not y:
        return 0
        
    x_mean = sum(x) / len(x)
    y_mean = sum(y) / len(y)
    
    numerator = sum((xi - x_mean) * (yi - y_mean) for xi, yi in zip(x, y))
    denominator_x = sum((xi - x_mean) ** 2 for xi in x)
    denominator_y = sum((yi - y_mean) ** 2 for yi in y)
    
    if denominator_x == 0 or denominator_y == 0:
        return 0
        
    return numerator / (denominator_x ** 0.5 * denominator_y ** 0.5)

def plot_quality_scores(server_data, client_data, comparison_result):
    """품질 점수 비교 그래프 생성"""
    try:
        plt.figure(figsize=(12, 6))
        
        # 공통 인덱스 및 점수 추출
        indices = [item['index'] for item in comparison_result['comparison']]
        server_scores = [item['server_score'] for item in comparison_result['comparison']]
        client_scores = [item['client_score'] for item in comparison_result['comparison']]
        
        x = np.arange(len(indices))
        width = 0.35
        
        plt.bar(x - width/2, server_scores, width, label='Server')
        plt.bar(x + width/2, client_scores, width, label='Client')
        
        plt.xlabel('Review Index')
        plt.ylabel('Quality Score')
        plt.title('Quality Score Comparison')
        plt.xticks(x, indices, rotation=90)
        plt.legend()
        plt.tight_layout()
        
        plt.savefig('quality_score_comparison.png')
        print("Quality score comparison graph saved to quality_score_comparison.png")
    except Exception as e:
        print(f"Error creating quality score graph: {e}")

def plot_selected_reviews(server_data, client_data, comparison_result):
    """선택된 리뷰 비교 그래프 생성"""
    try:
        plt.figure(figsize=(10, 6))
        
        # 벤 다이어그램을 위한 데이터 준비
        from matplotlib_venn import venn2
        
        server_selected = set([item['index'] for item in server_data['selected_reviews']])
        client_selected = set([item['index'] for item in client_data['selected_reviews']])
        
        venn2([server_selected, client_selected], ('Server', 'Client'))
        plt.title('Selected Reviews Comparison')
        
        plt.savefig('selected_reviews_comparison.png')
        print("Selected reviews comparison graph saved to selected_reviews_comparison.png")
    except ImportError:
        print("matplotlib_venn package not installed. Skipping Venn diagram.")
    except Exception as e:
        print(f"Error creating selected reviews graph: {e}")

def generate_comparison_report(server_data, client_data):
    """비교 보고서 생성"""
    # 품질 점수 비교
    quality_comparison = compare_quality_scores(server_data, client_data)
    
    # 선택된 리뷰 비교
    selection_comparison = compare_selected_reviews(server_data, client_data)
    
    # 요약 통계
    summary = {
        'server_review_count': server_data['metadata']['input_review_count'],
        'client_review_count': client_data['metadata']['input_review_count'],
        'server_selected_count': selection_comparison['server_selected_count'],
        'client_selected_count': selection_comparison['client_selected_count'],
        'common_selected_count': selection_comparison['common_count'],
        'jaccard_similarity': selection_comparison['jaccard_similarity'],
        'quality_score_correlation': quality_comparison['correlation'],
        'avg_quality_diff': quality_comparison['avg_diff'],
        'max_quality_diff': quality_comparison['max_diff']
    }
    
    # 콘솔 출력
    print("==== 샘플링 알고리즘 비교 보고서 ====")
    print()
    
    print("입력 리뷰:")
    print(f"  서버: {summary['server_review_count']} 리뷰")
    print(f"  클라이언트: {summary['client_review_count']} 리뷰")
    print()
    
    print("선택된 리뷰:")
    print(f"  서버: {summary['server_selected_count']} 리뷰 선택")
    print(f"  클라이언트: {summary['client_selected_count']} 리뷰 선택")
    print(f"  공통: {summary['common_selected_count']} 리뷰 (Jaccard 유사도: {summary['jaccard_similarity']:.4f})")
    print()
    
    print("품질 점수:")
    print(f"  상관계수: {summary['quality_score_correlation']:.4f}")
    print(f"  평균 차이: {summary['avg_quality_diff']:.4f}")
    print(f"  최대 차이: {summary['max_quality_diff']:.4f}")
    print()
    
    print("서버만 선택한 리뷰:")
    print(f"  {selection_comparison['server_only']}")
    print()
    
    print("클라이언트만 선택한 리뷰:")
    print(f"  {selection_comparison['client_only']}")
    print()
    
    print("품질 점수 상위 10개 비교:")
    top_comparisons = sorted(quality_comparison['comparison'], key=lambda x: x['server_score'], reverse=True)[:10]
    headers = ["Index", "Server Score", "Client Score", "Difference", "Diff %"]
    table_data = [[item['index'], f"{item['server_score']:.4f}", f"{item['client_score']:.4f}", 
                  f"{item['diff']:.4f}", f"{item['diff_percent']:.2f}%"] for item in top_comparisons]
    print(tabulate(table_data, headers=headers, tablefmt="grid"))
    
    # 그래프 생성
    plot_quality_scores(server_data, client_data, quality_comparison)
    plot_selected_reviews(server_data, client_data, selection_comparison)
    
    # 보고서 파일로 저장
    report = {
        'summary': summary,
        'quality_comparison': {
            'correlation': quality_comparison['correlation'],
            'avg_diff': quality_comparison['avg_diff'],
            'max_diff': quality_comparison['max_diff'],
            'details': quality_comparison['comparison']
        },
        'selection_comparison': selection_comparison
    }
    
    with open('comparison_report.json', 'w', encoding='utf-8') as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    
    print("Detailed comparison report saved to comparison_report.json")
    
    return report

def run_comparison():
    """서버 측과 클라이언트 측 결과 비교 실행"""
    # 결과 파일 로드
    server_data = load_result_file('server_result.json')
    client_data = load_result_file('client_result.json')
    
    if not server_data or not client_data:
        print("Error: Could not load result files. Make sure both server_result.json and client_result.json exist.")
        return
    
    # 비교 보고서 생성
    generate_comparison_report(server_data, client_data)

if __name__ == "__main__":
    if not os.path.exists('server_result.json') or not os.path.exists('client_result.json'):
        print("Warning: One or both result files do not exist. Run test_server_sampling.py and test_client_sampling.js first.")
    else:
        run_comparison()