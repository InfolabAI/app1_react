#!/bin/bash

# 결과를 저장할 파일명 설정
OUTPUT_FILE="react_native_environment_info.txt"

# 파일 생성 및 헤더 추가
echo "========= React Native 환경 정보 =========" > $OUTPUT_FILE
echo "생성 일시: $(date)" >> $OUTPUT_FILE
echo "=========================================" >> $OUTPUT_FILE

# 기본 시스템 정보
echo -e "\n[시스템 정보]" >> $OUTPUT_FILE
echo "운영체제: $(uname -s)" >> $OUTPUT_FILE
echo "운영체제 버전: $(uname -r)" >> $OUTPUT_FILE

# Node.js 및 npm 버전
echo -e "\n[Node.js 정보]" >> $OUTPUT_FILE
echo "Node.js 버전: $(node -v 2>/dev/null || echo '설치되지 않음')" >> $OUTPUT_FILE
echo "npm 버전: $(npm -v 2>/dev/null || echo '설치되지 않음')" >> $OUTPUT_FILE

# Yarn 버전 확인
echo "Yarn 버전: $(yarn -v 2>/dev/null || echo '설치되지 않음')" >> $OUTPUT_FILE

# Expo CLI 버전 확인
echo -e "\n[Expo 정보]" >> $OUTPUT_FILE
echo "Expo CLI 버전: $(npx expo --version 2>/dev/null || echo '설치되지 않음')" >> $OUTPUT_FILE

# package.json 파일에서 주요 의존성 정보 추출
echo -e "\n[package.json 의존성 정보]" >> $OUTPUT_FILE
if [ -f "package.json" ]; then
  # 주요 의존성 추출
  echo "React Native 버전: $(node -e "console.log(require('./package.json').dependencies['react-native'] || '정보 없음')" 2>/dev/null)" >> $OUTPUT_FILE
  echo "Expo 버전: $(node -e "console.log(require('./package.json').dependencies['expo'] || '정보 없음')" 2>/dev/null)" >> $OUTPUT_FILE
  echo "React 버전: $(node -e "console.log(require('./package.json').dependencies['react'] || '정보 없음')" 2>/dev/null)" >> $OUTPUT_FILE
  echo "React Native Google Mobile Ads 버전: $(node -e "console.log(require('./package.json').dependencies['react-native-google-mobile-ads'] || '정보 없음')" 2>/dev/null)" >> $OUTPUT_FILE
  
  # 전체 의존성 목록 추가
  echo -e "\n[전체 의존성 목록]" >> $OUTPUT_FILE
  node -e "const deps = require('./package.json').dependencies; for(const [key, value] of Object.entries(deps)) { console.log(\`\${key}: \${value}\`); }" 2>/dev/null >> $OUTPUT_FILE
  
  echo -e "\n[개발 의존성 목록]" >> $OUTPUT_FILE
  node -e "const devDeps = require('./package.json').devDependencies || {}; for(const [key, value] of Object.entries(devDeps)) { console.log(\`\${key}: \${value}\`); }" 2>/dev/null >> $OUTPUT_FILE
else
  echo "package.json 파일을 찾을 수 없습니다." >> $OUTPUT_FILE
fi

# app.json 또는 app.config.js 파일에서 Expo 설정 정보 추출
echo -e "\n[Expo 앱 설정 정보]" >> $OUTPUT_FILE
if [ -f "app.json" ]; then
  echo "Expo SDK 버전: $(node -e "try { const app = require('./app.json'); console.log(app.expo.sdkVersion || '정보 없음'); } catch(e) { console.log('파싱 오류'); }" 2>/dev/null)" >> $OUTPUT_FILE
  echo "앱 이름: $(node -e "try { const app = require('./app.json'); console.log(app.expo.name || '정보 없음'); } catch(e) { console.log('파싱 오류'); }" 2>/dev/null)" >> $OUTPUT_FILE
  echo "앱 버전: $(node -e "try { const app = require('./app.json'); console.log(app.expo.version || '정보 없음'); } catch(e) { console.log('파싱 오류'); }" 2>/dev/null)" >> $OUTPUT_FILE
elif [ -f "app.config.js" ]; then
  echo "app.config.js 파일이 존재합니다. 수동으로 확인하세요." >> $OUTPUT_FILE
else
  echo "Expo 앱 설정 파일을 찾을 수 없습니다." >> $OUTPUT_FILE
fi

# iOS 및 Android 특정 정보
echo -e "\n[iOS 정보]" >> $OUTPUT_FILE
if [ -d "ios" ]; then
  echo "iOS 디렉토리가 존재합니다." >> $OUTPUT_FILE
  if [ -f "ios/Podfile" ]; then
    echo "Podfile 존재: 예" >> $OUTPUT_FILE
    echo "iOS 최소 버전: $(grep -E "platform :ios, '[0-9.]+'" ios/Podfile | grep -o "[0-9.]*" 2>/dev/null || echo '정보 없음')" >> $OUTPUT_FILE
  else
    echo "Podfile 존재: 아니오" >> $OUTPUT_FILE
  fi
else
  echo "iOS 디렉토리가 존재하지 않습니다." >> $OUTPUT_FILE
fi

echo -e "\n[Android 정보]" >> $OUTPUT_FILE
if [ -d "android" ]; then
  echo "Android 디렉토리가 존재합니다." >> $OUTPUT_FILE
  if [ -f "android/build.gradle" ]; then
    echo "compileSdkVersion: $(grep -E "compileSdkVersion [0-9]+" android/build.gradle android/app/build.gradle 2>/dev/null | head -1 | grep -o "[0-9]*" || echo '정보 없음')" >> $OUTPUT_FILE
    echo "minSdkVersion: $(grep -E "minSdkVersion [0-9]+" android/build.gradle android/app/build.gradle 2>/dev/null | head -1 | grep -o "[0-9]*" || echo '정보 없음')" >> $OUTPUT_FILE
    echo "targetSdkVersion: $(grep -E "targetSdkVersion [0-9]+" android/build.gradle android/app/build.gradle 2>/dev/null | head -1 | grep -o "[0-9]*" || echo '정보 없음')" >> $OUTPUT_FILE
  else
    echo "build.gradle 파일이 존재하지 않습니다." >> $OUTPUT_FILE
  fi
else
  echo "Android 디렉토리가 존재하지 않습니다." >> $OUTPUT_FILE
fi

# Metro 설정 정보
echo -e "\n[Metro 설정 정보]" >> $OUTPUT_FILE
if [ -f "metro.config.js" ]; then
  echo "metro.config.js 파일이 존재합니다." >> $OUTPUT_FILE
else
  echo "metro.config.js 파일이 존재하지 않습니다." >> $OUTPUT_FILE
fi

# babel 설정 정보
echo -e "\n[Babel 설정 정보]" >> $OUTPUT_FILE
if [ -f "babel.config.js" ]; then
  echo "babel.config.js 파일이 존재합니다." >> $OUTPUT_FILE
elif [ -f ".babelrc" ]; then
  echo ".babelrc 파일이 존재합니다." >> $OUTPUT_FILE
else
  echo "Babel 설정 파일이 존재하지 않습니다." >> $OUTPUT_FILE
fi

echo -e "\n=========================================" >> $OUTPUT_FILE
echo "환경 정보가 $OUTPUT_FILE 파일에 저장되었습니다." >> $OUTPUT_FILE

echo "React Native 환경 정보가 $OUTPUT_FILE 파일에 저장되었습니다."