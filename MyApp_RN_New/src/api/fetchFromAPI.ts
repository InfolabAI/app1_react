// src/api/fetchFromAPI.ts

// API 엔드포인트 주소
const API_URL = 'https://2frhmnck64.execute-api.ap-northeast-2.amazonaws.com/crawlF';

/**
 * API 호출을 위한 함수
 * 
 * @param requestType API 요청 타입 (app_info_read, app_review_read 등)
 * @param params 추가 파라미터
 * @returns API 응답 데이터
 */
export const fetchFromAPI = async (requestType: string, params = {}) => {
  console.log(`🔍 API 요청: ${requestType}`, params);

  try {
    const requestBody = {
      request_type: requestType,
      ...params
    };

    console.log(`🔍 API 요청 본문:`, JSON.stringify(requestBody));

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });

    console.log(`🔍 API 응답 상태: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`🚨 API 오류 (${response.status}):`, errorText);
      throw new Error(`API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    console.log(`🔍 API 응답 데이터:`, data);
    return data;
  } catch (error: any) {
    console.error(`🚨 API 요청 실패 (${requestType}):`, error);
    throw error;
  }
};