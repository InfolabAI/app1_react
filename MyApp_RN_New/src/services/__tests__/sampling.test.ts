import { sampleReviews, joinSampledReviews, Review } from '../sampling';

// 샘플 리뷰 데이터
const mockReviews: Review[] = [
  {
    id: '1',
    content: '이 앱은 정말 사용하기 쉽고 직관적입니다. 특히 검색 기능이 빠르고 정확해서 좋아요. 하지만 가끔 알림이 오지 않는 버그가 있는 것 같습니다. 개발자분들이 이 문제를 빨리 해결해주시면 좋겠어요.',
    score: 4,
    username: '사용자1',
    date: '2023-05-01T12:00:00Z'
  },
  {
    id: '2',
    content: '사용자 인터페이스가 너무 복잡하고 버튼들이 작아서 사용하기 어려워요. 특히 노년층 사용자들은 더 어려울 것 같습니다. 간결하고 큰 버튼으로 개선해주세요.',
    score: 2,
    username: '사용자2',
    date: '2023-05-02T14:30:00Z'
  },
  {
    id: '3',
    content: '로딩 시간이 너무 깁니다. 앱을 열 때마다 10초 이상 기다려야 하는 것이 불편합니다. 또한 데이터 사용량도 많아 보이는데 최적화가 필요합니다.',
    score: 2,
    username: '사용자3',
    date: '2023-05-03T09:15:00Z'
  },
  {
    id: '4',
    content: '최근 업데이트 후 배터리 소모가 심해졌습니다. 이전에는 하루 종일 써도 20% 정도만 소모됐는데, 지금은 금방 30-40%가 사라집니다. 배터리 최적화를 개선해주세요.',
    score: 3,
    username: '사용자4',
    date: '2023-05-04T18:45:00Z'
  },
  {
    id: '5',
    content: '이 앱은 완벽합니다! 제가 필요한 모든 기능이 있고, 디자인도 아름답습니다. 특히 다크 모드가 눈의 피로를 줄여주어 좋습니다. 앞으로도 좋은 기능 추가 부탁드립니다.',
    score: 5,
    username: '사용자5',
    date: '2023-05-05T11:20:00Z'
  },
  {
    id: '6',
    content: '동기화 기능에 문제가 있습니다. 여러 기기에서 사용할 때 데이터가 제대로 동기화되지 않아요. 클라우드 동기화 개선이 필요합니다.',
    score: 3,
    username: '사용자6',
    date: '2023-05-06T10:10:00Z'
  },
  {
    id: '7',
    content: '광고가 너무 많고 자주 뜹니다. 무료 버전이라도 사용자 경험을 해치지 않는 수준으로 광고를 줄여주세요. 아니면 저렴한 프리미엄 옵션을 제공해주세요.',
    score: 2,
    username: '사용자7',
    date: '2023-05-07T16:30:00Z'
  },
  {
    id: '8',
    content: '오프라인 모드가 잘 작동하지 않습니다. 인터넷 연결이 없을 때도 기본 기능은 사용할 수 있게 개선해주세요. 여행 중에 많이 사용하는데 불편합니다.',
    score: 3,
    username: '사용자8',
    date: '2023-05-08T09:00:00Z'
  },
  {
    id: '9',
    content: '최신 iOS 업데이트 후 앱이 자주 충돌합니다. 특히 카메라 기능을 사용할 때 문제가 발생합니다. 빠른 패치를 기대합니다.',
    score: 2,
    username: '사용자9',
    date: '2023-05-09T14:20:00Z'
  },
  {
    id: '10',
    content: '사용자 서포트가 매우 빠르고 친절합니다. 제가 버그를 보고했을 때 하루 만에 답변을 받았고, 다음 업데이트에서 수정되었습니다. 이런 서비스 품질 유지해주세요!',
    score: 5,
    username: '사용자10',
    date: '2023-05-10T13:40:00Z'
  }
];

describe('리뷰 샘플링 테스트', () => {
  test('샘플링된 리뷰 목록이 반환되어야 함', async () => {
    // 프로그레스 콜백 모의 함수
    const mockProgressCallback = jest.fn();
    
    // 샘플링 실행
    const result = await sampleReviews(mockReviews, mockProgressCallback);
    
    // 결과 검증
    expect(result).toBeDefined();
    expect(result.sampledReviews).toBeDefined();
    expect(result.sampledReviews.length).toBeGreaterThan(0);
    expect(result.sampledReviews.length).toBeLessThanOrEqual(mockReviews.length);
    
    // 통계 정보 검증
    expect(result.statistics.totalReviews).toBe(mockReviews.length);
    expect(result.statistics.averageRating).toBeCloseTo(3.1, 1); // 대략적인 평균 평점
    expect(result.statistics.sampledReviewCount).toBe(result.sampledReviews.length);
    
    // 중복 체크
    const ids = new Set(result.sampledReviews.map(r => r.id));
    expect(ids.size).toBe(result.sampledReviews.length);
    
    // 프로그레스 콜백이 호출되었는지 확인
    expect(mockProgressCallback).toHaveBeenCalled();
  });
  
  test('빈 리뷰 목록에 대해 빈 결과가 반환되어야 함', async () => {
    const result = await sampleReviews([]);
    
    expect(result.sampledReviews).toEqual([]);
    expect(result.statistics.totalReviews).toBe(0);
    expect(result.statistics.averageRating).toBe(0);
  });
  
  test('취소 신호로 샘플링 중단이 가능해야 함', async () => {
    // AbortController 생성
    const controller = new AbortController();
    const { signal } = controller;
    
    // 프로그레스 콜백 모의 함수
    const mockProgressCallback = jest.fn();
    
    // 샘플링 실행 (프로미스 생성)
    const samplingPromise = sampleReviews(mockReviews, mockProgressCallback, signal);
    
    // 즉시 취소 신호 전송
    controller.abort();
    
    // 취소로 인한 거부가 발생해야 함
    await expect(samplingPromise).rejects.toThrow('Sampling was cancelled');
  });
  
  test('진행 상태가 정확하게 보고되어야 함', async () => {
    // 프로그레스 콜백 모의 함수 (진행 상태 저장)
    const progressUpdates: Array<{ processed: number; total: number; completed: boolean }> = [];
    const mockProgressCallback = jest.fn(progress => {
      progressUpdates.push({...progress});
    });
    
    // 샘플링 실행
    await sampleReviews(mockReviews, mockProgressCallback);
    
    // 최소한 몇 개의 진행 상태 업데이트가 있어야 함
    expect(progressUpdates.length).toBeGreaterThan(0);
    
    // 첫 번째 업데이트에서는 total이 올바르게 설정되어야 함
    expect(progressUpdates[0].total).toBe(mockReviews.length);
    
    // 모든 업데이트에서 processed는 증가해야 함
    for (let i = 1; i < progressUpdates.length; i++) {
      expect(progressUpdates[i].processed).toBeGreaterThanOrEqual(progressUpdates[i-1].processed);
    }
    
    // 마지막 업데이트에서는 completed가 true여야 함
    const lastUpdate = progressUpdates[progressUpdates.length - 1];
    expect(lastUpdate.completed).toBe(true);
    expect(lastUpdate.processed).toBe(lastUpdate.total);
  });
  
  test('리뷰를 문자열로 결합', () => {
    const sampleReviews = mockReviews.slice(0, 3);
    const result = joinSampledReviews(sampleReviews);
    
    expect(result).toContain('리뷰자: 사용자1');
    expect(result).toContain('평점: ★★★★');
    expect(result).toContain('리뷰자: 사용자2');
    expect(result).toContain('평점: ★★');
    expect(result).toContain('리뷰자: 사용자3');
    
    // 구분자 확인
    expect(result).toContain('---');
  });
});