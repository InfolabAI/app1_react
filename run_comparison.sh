#!/bin/bash

# 테스트 및 비교 실행 스크립트

echo "===== 샘플링 알고리즘 결과 일치성 검증 시작 ====="

echo ""
echo "1. 서버 측 샘플링 알고리즘 테스트 실행 중..."
echo ""
# Python 서버 측 샘플링 테스트
python test_server_sampling.py

echo ""
echo "2. 클라이언트 측 샘플링 알고리즘 테스트 실행 중..."
echo ""
# Node.js 클라이언트 측 샘플링 테스트
node test_client_sampling.js

echo ""
echo "3. 결과 비교 분석 실행 중..."
echo ""
# 결과 비교 분석
python compare_results.py

echo ""
echo "===== 샘플링 알고리즘 결과 일치성 검증 완료 ====="