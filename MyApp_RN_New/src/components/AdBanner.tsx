// src/components/AdBanner.tsx
import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';

// 개발 환경에서는 테스트 ID 사용, 프로덕션에서는 실제 광고 ID 사용
const adUnitId = __DEV__ 
  ? TestIds.BANNER 
  : 'ca-app-pub-7838208657677503/6303324511';

/**
 * 배너 광고 컴포넌트
 */
const AdBanner: React.FC = () => {
  return (
    <View style={styles.adContainer}>
      <BannerAd
        unitId={adUnitId}
        size={BannerAdSize.FULL_BANNER}
        requestOptions={{
          requestNonPersonalizedAdsOnly: true,
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  adContainer: {
    width: '100%',
    alignItems: 'center',
    backgroundColor: '#121212',
    padding: 5
  },
});

export default AdBanner;