import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { marked } from 'marked';

/**
 * PDF 생성을 위한 HTML 템플릿 생성
 */
const generateHtmlTemplate = (appName: string, summary: string): string => `
  <!doctype html>
  <html>
    <head>
      <meta charset="utf-8">
      <title>${appName} 리뷰 요약</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 20px;
          background-color: #fff;
        }
        h1 {
          color: #2c3e50;
          border-bottom: 2px solid #eee;
          padding-bottom: 10px;
          margin-bottom: 20px;
          text-align: center;
          font-size: 2em;
        }
        h2 {
          color: #2c3e50;
          margin-top: 30px;
          border-bottom: 1px solid #eee;
          padding-bottom: 5px;
          font-size: 1.5em;
        }
        h3 {
          color: #2c3e50;
          margin-top: 25px;
          font-size: 1.3em;
        }
        p {
          margin-bottom: 15px;
          text-align: justify;
          font-size: 1em;
        }
        strong {
          color: #2c3e50;
          font-weight: 600;
        }
        em {
          font-style: italic;
        }
        blockquote {
          border-left: 4px solid #ddd;
          margin: 20px 0;
          padding: 10px 20px;
          background-color: #f9f9f9;
          color: #666;
        }
        ul, ol {
          margin: 15px 0;
          padding-left: 20px;
        }
        li {
          margin: 5px 0;
          font-size: 1em;
        }
        code {
          background-color: #f5f5f5;
          padding: 2px 5px;
          border-radius: 3px;
          font-family: 'Courier New', Courier, monospace;
          font-size: 0.9em;
        }
        pre {
          background-color: #f5f5f5;
          padding: 15px;
          border-radius: 5px;
          overflow-x: auto;
          margin: 15px 0;
        }
        pre code {
          background-color: transparent;
          padding: 0;
        }
        a {
          color: #3498db;
          text-decoration: none;
        }
        a:hover {
          text-decoration: underline;
        }
        .content {
          background-color: #fff;
          padding: 20px;
        }
      </style>
    </head>
    <body>
      <div class="content">
        <h1>${appName} 리뷰 요약</h1>
        ${marked(summary)}
      </div>
    </body>
  </html>
`;

/**
 * 저장소 디렉토리 경로 가져오기
 */
const getStorageDirectory = async (): Promise<string> => {
    if (Platform.OS === 'ios') {
        return FileSystem.documentDirectory || '';
    }
    return FileSystem.cacheDirectory || '';
};

/**
 * 파일 경로 정규화
 */
const normalizePath = (path: string): string => {
    return path.replace(/\\/g, '/');
};

/**
 * 파일 존재 여부 확인
 */
const checkFileExists = async (filePath: string): Promise<boolean> => {
    try {
        const info = await FileSystem.getInfoAsync(filePath);
        return info.exists;
    } catch (error) {
        console.error('파일 확인 중 오류:', error);
        return false;
    }
};

/**
 * PDF 파일 공유
 */
const sharePDFFile = async (filePath: string, appName: string): Promise<void> => {
    try {
        const canShare = await Sharing.isAvailableAsync();
        if (!canShare) {
            Alert.alert('오류', '이 기기에서는 파일 공유가 지원되지 않습니다.');
            return;
        }

        await Sharing.shareAsync(filePath, {
            mimeType: 'application/pdf',
            dialogTitle: `${appName} 리뷰 요약`,
            UTI: 'com.adobe.pdf'
        });
    } catch (error) {
        console.error('파일 공유 중 오류:', error);
        Alert.alert('오류', '파일 공유 중 문제가 발생했습니다.');
    }
};

/**
 * PDF 생성 및 공유
 */
export const generateAndSharePDF = async (
    appName: string,
    summary: string,
    onProgress?: (progress: number) => void
): Promise<void> => {
    try {
        // HTML 템플릿 생성
        const html = generateHtmlTemplate(appName, summary);

        // PDF 생성 옵션
        const options = {
            html,
            fileName: `${appName}_리뷰_요약`,
            directory: 'Documents',
        };

        // PDF 생성
        const file = await RNHTMLtoPDF.convert(options);
        if (!file.filePath) {
            throw new Error('PDF 생성 실패');
        }

        // 파일 경로 정규화
        const normalizedPath = normalizePath(file.filePath);

        // 파일 존재 확인
        const exists = await checkFileExists(normalizedPath);
        if (!exists) {
            throw new Error('생성된 PDF 파일을 찾을 수 없습니다.');
        }

        // 파일 공유
        await sharePDFFile(normalizedPath, appName);

        // 진행률 콜백 호출
        if (onProgress) {
            onProgress(100);
        }
    } catch (error) {
        console.error('PDF 생성 중 오류:', error);
        Alert.alert('오류', 'PDF 생성 중 문제가 발생했습니다.');
        throw error;
    }
}; 