// src/utils/index.ts

/**
 * 디버그 모드 여부
 */
export const DEBUG = false;

/**
 * 디버그 로그 출력 함수
 * DEBUG가 true인 경우에만 로그 출력
 */
export const log = (...args: any[]): void => { 
  if (DEBUG) console.log('[DEBUG]', ...args); 
};