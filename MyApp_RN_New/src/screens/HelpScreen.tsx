// src/screens/HelpScreen.tsx
import React, { useState, useEffect } from 'react';
import { View, ScrollView, StyleSheet, Linking } from 'react-native';
import {
  Text as PaperText, TextInput as PaperTextInput,
  Button as PaperButton, ActivityIndicator,
  IconButton
} from 'react-native-paper';
import axios from 'axios';
import cheerio from 'react-native-cheerio';
import { useToast } from '../contexts/ToastContext';
import { fetchFromAPI } from '../api/fetchFromAPI';
import { HelpScreenProps } from '../types';

/**
 * 도움말/앱 추가 화면 컴포넌트
 */
function HelpScreen({ navigation }: HelpScreenProps): React.ReactElement {
  const toast = useToast();
  const [playStoreLink, setPlayStoreLink] = useState<string>('');
  const [processing, setProcessing] = useState<boolean>(false);

  useEffect(() => {
    const getInitialUrl = async () => {
      const url = await Linking.getInitialURL();
      if (url) handleIncomingLink(url);
    };

    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleIncomingLink(url);
    });

    getInitialUrl();
    return () => { subscription.remove(); };
  }, []);

  const handleIncomingLink = async (url: string) => {
    console.log('받은 URL:', url);
    try {
      setProcessing(true);
      const match = url.match(/id=([^&]+)/);
      if (match && match[1]) {
        await fetchAppInfo(match[1]);
      } else {
        toast.show("유효한 구글 플레이스토어 링크가 아닙니다.", "error");
      }
    } catch (error) {
      console.error('링크 처리 오류:', error);
      toast.show("링크를 처리하는 중 문제가 발생했습니다.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const handleManualLink = async () => {
    if (!playStoreLink) {
      toast.show("링크를 입력해주세요.", "error");
      return;
    }

    try {
      setProcessing(true);
      let match = playStoreLink.match(/[?&]id=([^&]+)/);

      if (!match) {
        match = playStoreLink.match(/apps\/details\/?id=([^&\s]+)/);
      }
      if (!match && playStoreLink.includes('.')) {
        match = ['', playStoreLink.trim()];
      }

      if (match && match[1]) {
        await fetchAppInfo(match[1]);
      } else {
        toast.show("유효한 구글 플레이스토어 링크나 패키지명이 아닙니다.", "error");
      }
    } catch (error) {
      console.error('링크 처리 오류:', error);
      toast.show("링크를 처리하는 중 문제가 발생했습니다.", "error");
    } finally {
      setProcessing(false);
    }
  };

  const fetchAppInfo = async (appId: string) => {
    try {
      const url = `https://play.google.com/store/apps/details?id=${appId}&hl=ko`;
      const response = await axios.get(url);
      const html = response.data;
      const $ = cheerio.load(html);

      let appName = '';
      const metaTitle = $('meta[property="og:title"]').attr('content');
      if (metaTitle) {
        appName = metaTitle.split(' - ')[0].trim();
      }

      let iconUrl = '';
      const metaImage = $('meta[property="og:image"]').attr('content');
      if (metaImage) {
        iconUrl = metaImage;
      }

      if (!appName) appName = `앱 (${appId})`;
      if (!iconUrl) iconUrl = 'https://via.placeholder.com/180';

      const result = await fetchFromAPI('app_info_add', {
        app_id: appId,
        app_name: appName,
        app_logo: iconUrl
      });

      console.log('app_add_result:', result);
      if (result.success) {
        if (result.message && result.message.includes('이미 존재')) {
          toast.show("이미 추가된 앱입니다. 앱 목록에서 검색해보세요.", "info");
          navigation.navigate('AppList', { searchQuery: appId });
          return;
        }
        navigation.navigate('AppList', {
          extractedPackageId: appId,
          extractedAppName: appName,
          extractedAppIcon: iconUrl
        });
        return;
      }
      throw new Error(result.message || '앱 정보 등록에 실패했습니다.');
    } catch (error: any) {
      console.error('앱 정보 가져오기 오류:', error);
      let errorMessage = "앱 정보를 가져오는 중 오류가 발생했습니다.";

      if (error.response) {
        errorMessage = `서버 오류: ${error.response.status}`;
      } else if (error.request) {
        errorMessage = "서버에 연결할 수 없습니다. 인터넷 연결을 확인해주세요.";
      } else {
        errorMessage = error.message || "앱 정보를 가져오는 중 오류가 발생했습니다.";
      }

      toast.show(errorMessage, "error");
    }
  };

  const handleOpenPlayStore = () => {
    Linking.openURL('market://search?q=앱')
      .catch((err) => {
        console.warn("스토어 앱을 열 수 없습니다:", err);
        Linking.openURL('https://play.google.com/store');
      });
  };

  useEffect(() => {
    const validateAndProcessLink = async () => {
      if (!playStoreLink) return;
      try {
        let match = playStoreLink.match(/[?&]id=([^&]+)/);
        if (!match) match = playStoreLink.match(/apps\/details\/?id=([^&\s]+)/);
        if (!match && playStoreLink.includes('.')) match = ['', playStoreLink.trim()];

        if (match && match[1]) {
          const extractedId = match[1];
          await fetchAppInfo(extractedId);
        } else {
          toast.show("올바른 구글 플레이스토어 링크나 패키지명을 입력해주세요.", "error");
        }
      } catch (error) {
        console.error('링크 처리 오류:', error);
        toast.show("올바른 구글 플레이스토어 링크나 패키지명을 입력해주세요.", "error");
      }
    };

    const timeoutId = setTimeout(validateAndProcessLink, 1000);
    return () => clearTimeout(timeoutId);
  }, [playStoreLink]);

  const InstructionStep = ({ number, title, description }: {
    number: string, title: string, description: string
  }) => (
    <View style={styles.instructionStep}>
      <View style={styles.stepNumber}>
        <PaperText style={styles.stepNumberText}>{number}</PaperText>
      </View>
      <View style={styles.stepContent}>
        <PaperText style={styles.stepTitle}>{title}</PaperText>
        <PaperText style={styles.stepDescription}>{description}</PaperText>
      </View>
    </View>
  );

  return (
    <ScrollView
      style={styles.helpContainer}
      contentContainerStyle={styles.helpContentContainer}
      showsVerticalScrollIndicator={false}
    >
      {processing ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6200ee" />
          <PaperText style={styles.loadingText}>앱 정보를 가져오는 중...</PaperText>
        </View>
      ) : (
        <>
          <View style={styles.linkInputContainer}>
            <PaperText style={styles.instructionText}>
              구글 플레이스토어 앱 링크를 붙여넣거나, 패키지명(예: com.kakao.talk)을 직접 입력하면 자동으로 추가됩니다.
            </PaperText>

            <View style={styles.linkInputRow}>
              <PaperTextInput
                label="플레이스토어 링크 또는 패키지명"
                value={playStoreLink}
                onChangeText={setPlayStoreLink}
                placeholder="https://play.google.com/store/apps/details?id=..."
                style={styles.linkInput}
                autoCapitalize="none"
                autoCorrect={false}
              />
              <IconButton
                icon="google-play"
                mode="contained"
                onPress={handleOpenPlayStore}
                style={styles.playStoreIconButton}
              />
            </View>
          </View>

          <PaperText style={styles.sectionTitle}>플레이스토어 앱 연동</PaperText>
          <View style={styles.instructionContainer}>
            <InstructionStep
              number="1"
              title="구글 플레이스토어 열기"
              description="오른쪽의 구글 플레이스토어 아이콘을 눌러 스토어를 엽니다."
            />
            <InstructionStep
              number="2"
              title="원하는 앱 찾기"
              description="스토어에서 추가하고 싶은 앱을 검색하고 앱 페이지로 이동합니다."
            />
            <InstructionStep
              number="3"
              title="앱 공유하기"
              description="앱 페이지 우측 상단의 메뉴(⋮)를 눌러 '공유'를 선택합니다."
            />
            <InstructionStep
              number="4"
              title="링크 복사하기"
              description="공유 메뉴에서 '링크 복사'를 선택하고, 위 입력창에 붙여넣은 후 '앱 추가하기' 버튼을 누릅니다."
            />
          </View>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  helpContainer: { 
    flex: 1, 
    backgroundColor: '#121212' 
  },
  helpContentContainer: { 
    padding: 16, 
    paddingBottom: 32 
  },
  sectionTitle: { 
    fontSize: 18, 
    fontWeight: 'bold', 
    marginBottom: 12, 
    color: '#fff' 
  },
  linkInputContainer: { 
    marginBottom: 24, 
    backgroundColor: '#1E1E1E', 
    borderRadius: 8, 
    padding: 16 
  },
  instructionText: { 
    fontSize: 14, 
    color: '#aaa', 
    marginBottom: 12 
  },
  linkInputRow: { 
    flexDirection: 'row', 
    alignItems: 'center', 
    gap: 8 
  },
  linkInput: { 
    flex: 1, 
    backgroundColor: '#2C2C2C' 
  },
  instructionContainer: { 
    marginBottom: 24 
  },
  instructionStep: { 
    flexDirection: 'row', 
    marginBottom: 20, 
    alignItems: 'flex-start' 
  },
  stepNumber: {
    width: 32, 
    height: 32, 
    borderRadius: 16, 
    backgroundColor: '#6200ee',
    justifyContent: 'center', 
    alignItems: 'center', 
    marginRight: 12, 
    marginTop: 2
  },
  stepNumberText: { 
    color: '#fff', 
    fontWeight: 'bold', 
    fontSize: 16 
  },
  stepContent: { 
    flex: 1 
  },
  stepTitle: { 
    fontSize: 16, 
    fontWeight: 'bold', 
    marginBottom: 4, 
    color: '#fff' 
  },
  stepDescription: { 
    fontSize: 14, 
    color: '#aaa', 
    lineHeight: 20 
  },
  playStoreIconButton: { 
    margin: 0, 
    backgroundColor: '#6200ee' 
  },
  loadingContainer: { 
    flex: 1, 
    justifyContent: 'center', 
    alignItems: 'center', 
    backgroundColor: '#121212',
    padding: 50
  },
  loadingText: { 
    marginTop: 16, 
    fontSize: 16, 
    color: '#aaa' 
  },
});

export default HelpScreen;