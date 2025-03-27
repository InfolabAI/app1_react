import RNHTMLtoPDF from 'react-native-html-to-pdf';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Alert, Platform } from 'react-native';
import { marked } from 'marked';

/**
 * PDF 생성을 위한 HTML 템플릿 생성
 */
const generateHtmlTemplate = (appName, summary) => `
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
          border-radius: 8px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        @media print {
          body {
            padding: 20px;
            max-width: none;
          }
          .content {
            box-shadow: none;
          }
          a {
            text-decoration: underline;
          }
          blockquote {
            border-left: 2px solid #ddd;
          }
        }
      </style>
    </head>
    <body>
      <h1>${appName} 리뷰 AI 요약</h1>
      <div class="content">
        ${marked(summary)}
      </div>
    </body>
  </html>
`;

/**
 * PDF 파일 저장 디렉토리 결정
 */
const getStorageDirectory = async () => {
    try {
        // 캐시 디렉토리를 기본값으로 사용 (더 안정적인 접근 제공)
        return FileSystem.cacheDirectory;
    } catch (error) {
        console.log('디렉토리 확인 오류:', error);
        return FileSystem.cacheDirectory;
    }
};

/**
 * 파일 경로 정규화 함수 개선
 */
const normalizePath = (path) => {
    if (!path) return '';

    // 플랫폼에 따라 다르게 처리
    if (Platform.OS === 'ios') {
        // iOS에서는 file:// 유지
        if (!path.startsWith('file://')) {
            return `file://${path}`;
        }
        return path;
    } else {
        // Android에서는 file:// 제거 (Expo Sharing이 전체 URI 형태를 요구할 수 있음)
        if (path.startsWith('file://')) {
            return path;
        }
        if (path.startsWith('/')) {
            return `file://${path}`;
        }
        return `file://${path}`;
    }
};

/**
 * 파일 존재 여부 확인 (정규화된 경로 및 원본 경로 모두 시도)
 */
const checkFileExists = async (filePath) => {
    // 원본 경로로 시도
    try {
        const fileInfo = await FileSystem.getInfoAsync(filePath);
        if (fileInfo.exists) {
            console.log('파일 존재 확인 (원본 경로):', filePath);
            return { exists: true, path: filePath };
        }
    } catch (e) {
        console.log('원본 경로 확인 실패:', e.message);
    }

    // file:// 없는 경로로 시도
    if (filePath.startsWith('file://')) {
        const pathWithoutProtocol = filePath.replace('file://', '');
        try {
            const fileInfo = await FileSystem.getInfoAsync(pathWithoutProtocol);
            if (fileInfo.exists) {
                console.log('파일 존재 확인 (protocol 제거):', pathWithoutProtocol);
                return { exists: true, path: pathWithoutProtocol };
            }
        } catch (e) {
            console.log('protocol 제거 경로 확인 실패:', e.message);
        }
    }

    // file:// 추가한 경로로 시도
    if (!filePath.startsWith('file://')) {
        const pathWithProtocol = `file://${filePath}`;
        try {
            const fileInfo = await FileSystem.getInfoAsync(pathWithProtocol);
            if (fileInfo.exists) {
                console.log('파일 존재 확인 (protocol 추가):', pathWithProtocol);
                return { exists: true, path: pathWithProtocol };
            }
        } catch (e) {
            console.log('protocol 추가 경로 확인 실패:', e.message);
        }
    }

    return { exists: false, path: filePath };
};

/**
 * PDF 파일 공유
 */
const sharePDFFile = async (filePath, appName) => {
    try {
        console.log('공유 시도 경로:', filePath);

        // 파일 존재 여부 확인 (여러 형식 시도)
        const fileStatus = await checkFileExists(filePath);

        if (!fileStatus.exists) {
            console.error('파일이 존재하지 않음:', filePath);
            throw new Error('파일을 찾을 수 없습니다.');
        }

        // 파일이 존재하는 경로 사용
        const finalPath = normalizePath(fileStatus.path);
        console.log('최종 공유 경로:', finalPath);

        // 파일 공유
        await Sharing.shareAsync(finalPath, {
            mimeType: 'application/pdf',
            dialogTitle: `${appName} 리뷰 요약`,
            UTI: 'com.adobe.pdf'
        });

        console.log('파일 공유 성공!');
    } catch (error) {
        console.error('파일 공유 오류:', error);
        throw error;
    }
};

/**
 * PDF 생성 및 공유
 */
export const generateAndSharePDF = async (appName, summary, onProgress) => {
    try {
        if (!RNHTMLtoPDF) {
            throw new Error('PDF 변환 모듈이 초기화되지 않았습니다.');
        }

        // HTML 템플릿 생성
        const htmlContent = generateHtmlTemplate(appName, summary);

        // 저장 디렉토리 결정
        const directory = await getStorageDirectory();
        console.log('PDF 저장 디렉토리:', directory);

        // 고유한 파일명 생성
        const timestamp = Date.now();
        const filename = `${appName.replace(/\s+/g, '_')}_리뷰_요약_${timestamp}`;

        // PDF 변환 옵션
        const options = {
            html: htmlContent,
            filename: filename,
            directory: 'cache', // RNHTMLtoPDF 내장 캐시 디렉토리 사용
            base64: true,
        };

        // PDF 변환
        console.log('PDF 변환 시작...');
        const file = await RNHTMLtoPDF.convert(options);
        console.log('PDF 변환 결과:', file);

        if (!file) {
            throw new Error('PDF 변환 결과가 없습니다.');
        }

        let filePath = file.filePath || file.filepath || file.path;

        if (!filePath && file.base64) {
            // 원본 파일 경로가 없을 경우 base64 데이터로 임시 파일 생성
            console.log('base64 데이터로 임시 파일 생성');
            const tempFilePath = `${FileSystem.cacheDirectory}${filename}.pdf`;

            // base64 데이터를 파일로 저장
            await FileSystem.writeAsStringAsync(
                tempFilePath,
                file.base64,
                { encoding: FileSystem.EncodingType.Base64 }
            );

            filePath = tempFilePath;
        }

        if (!filePath) {
            throw new Error('PDF 파일 경로가 생성되지 않았습니다.');
        }

        console.log('생성된 PDF 경로:', filePath);

        // PDF 생성 성공 알림
        Alert.alert(
            "PDF 생성 완료",
            "PDF가 생성되었습니다. 저장 위치를 선택해주세요.",
            [
                {
                    text: "취소",
                    style: "cancel"
                },
                {
                    text: "저장/공유",
                    onPress: async () => {
                        try {
                            await sharePDFFile(filePath, appName);
                        } catch (error) {
                            console.error('파일 공유 상세 오류:', error);

                            // base64 데이터로 재시도
                            if (file.base64) {
                                try {
                                    console.log('base64 데이터로 새 임시 파일 생성 시도');
                                    const newTempFilePath = `${FileSystem.cacheDirectory}temp_retry_${Date.now()}.pdf`;

                                    // base64 데이터를 새 파일로 저장
                                    await FileSystem.writeAsStringAsync(
                                        newTempFilePath,
                                        file.base64,
                                        { encoding: FileSystem.EncodingType.Base64 }
                                    );

                                    console.log('새 임시 파일 생성 성공:', newTempFilePath);

                                    // 새 임시 파일로 공유 재시도
                                    await sharePDFFile(newTempFilePath, appName);
                                } catch (retryError) {
                                    console.error('재시도 실패:', retryError);
                                    Alert.alert("오류", `PDF 공유에 실패했습니다: ${retryError.message}`);
                                }
                            } else {
                                Alert.alert("오류", `파일 공유 중 오류가 발생했습니다: ${error.message}`);
                            }
                        }
                    }
                }
            ]
        );

        return true;
    } catch (error) {
        console.error('PDF 생성 오류:', error);
        Alert.alert("오류", `PDF 생성 중 오류가 발생했습니다: ${error.message}`);
        throw error;
    }
};