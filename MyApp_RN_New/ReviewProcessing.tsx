import React from 'react';
import { StyleSheet, View, Dimensions, Text, ScrollView } from 'react-native';
import {
    LineChart,
    BarChart,
    StackedBarChart
} from 'react-native-chart-kit';

/** 리뷰 데이터 형식 */
export type ReviewData = {
    date: string;   // YYYY-MM-DD 등 표시용
    rawDate: Date;  // 실제 날짜 객체
    score: number;  // 별점(문자열 가능성이 있어 Number() 변환 필요)
    content: string;
    username: string;
};

/** 차트에 사용할 데이터 구조 */
export type ChartData = {
    reviews: ReviewData[];
    timeRatings: Array<{ x: string; y: number }>;
    ratingDistribution: Array<{ x: number; y: number }>;
    keywordTrends: { [key: string]: Array<{ x: string; y: number }> };
    bugReports: Array<{ x: string; y: number }>;
    reviewLengthVsRating: Array<{ x: number; y: number; size: number }>;
    reviewVolume: Array<{ x: string; y: number }>;
};

/** 시간 단위 타입 정의 */
export type TimeUnit = 'day' | 'week' | 'month';

/** 내부 유틸: 리뷰를 시간 단위별로 그룹화 */
function groupByTimeUnit(reviews: ReviewData[], unit: TimeUnit) {
    const grouped: { [key: string]: ReviewData[] } = {};

    if (!reviews || reviews.length === 0) {
        return grouped;
    }

    reviews.forEach((review) => {
        if (!review.rawDate || !(review.rawDate instanceof Date)) {
            console.warn('Invalid date found in review data');
            return;
        }

        const date = review.rawDate;
        let timeKey = '';

        try {
            if (unit === 'day') {
                // ex: "2025-04-16"
                timeKey = date.toISOString().split('T')[0];
            } else if (unit === 'week') {
                // "월요일 기준"으로 주를 묶는 예시
                const day = date.getDay(); // 0=일,1=월,2=화, ...
                // 월요일=1 기준으로, 오늘이 day라면 "day-1" 일을 빼면 해당 주 월요일
                // 일요일(0)인 경우 -1이 되므로, 보정이 필요
                const offset = (day === 0) ? 6 : (day - 1); // 일요일이면 6일 빼서 저번주 월요일
                const monday = new Date(date);
                monday.setDate(monday.getDate() - offset);
                timeKey = monday.toISOString().split('T')[0];
            } else if (unit === 'month') {
                // ex: "2025-04"
                timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!timeKey) {
                console.warn('Empty timeKey generated');
                return;
            }

            if (!grouped[timeKey]) {
                grouped[timeKey] = [];
            }
            grouped[timeKey].push(review);
        } catch (error) {
            console.error('Error processing date:', error);
        }
    });

    return grouped;
}

/** 내부 유틸: 리뷰에서 관심 키워드를 추출 */
function extractKeywords(text: string): string[] {
    const commonKeywords = [
        '버그', '빠름', '느림', '디자인', '충돌', '멈춤',
        '좋아요', '편리', '불편', '업데이트', '기능', '오류'
    ];
    return commonKeywords.filter((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
    );
}

/** 내부 유틸: 버그/이슈 관련 키워드 포함 여부 */
function mentionsBugs(text: string): boolean {
    const bugKeywords = ['버그', '충돌', '멈춤', '오류', '에러', '문제'];
    return bugKeywords.some((keyword) =>
        text.toLowerCase().includes(keyword.toLowerCase())
    );
}

/**
 * 리뷰 데이터를 받아 차트용(ChartData)으로 변환
 */
export function generateChartData(reviewData: ReviewData[], timeUnit: TimeUnit): ChartData {
    // 빈 데이터 체크
    if (!reviewData || reviewData.length === 0) {
        return {
            reviews: [],
            timeRatings: [],
            ratingDistribution: [1, 2, 3, 4, 5].map(s => ({ x: s, y: 0 })),
            keywordTrends: {},
            bugReports: [],
            reviewLengthVsRating: [],
            reviewVolume: []
        };
    }

    const grouped = groupByTimeUnit(reviewData, timeUnit);

    // 1) 평점 추이 (Line)
    const timeRatings = Object.entries(grouped)
        .map(([timeKey, group]) => {
            let sum = 0;
            group.forEach(r => {
                const sc = Number(r.score);
                sum += isNaN(sc) ? 0 : sc;
            });
            const avg = sum / (group.length || 1);
            const safeAvg = isNaN(avg) ? 0 : avg;

            // 표시용 라벨
            let display = timeKey;
            if (timeUnit === 'day') {
                // ex: "2025-04-16" -> "04-16"
                const parts = timeKey.split('-');
                if (parts.length === 3) {
                    display = `${parts[1]}-${parts[2]}`;
                }
            } else if (timeUnit === 'week') {
                // ex: "2025-04-15" -> 그 주 "04-15" (월요일)
                const d = new Date(timeKey);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                display = `${mm}-${dd}`;
            } else if (timeUnit === 'month') {
                // ex: "2025-04" -> "04"
                const parts = timeKey.split('-');
                if (parts.length === 2) {
                    display = parts[1];
                }
            }

            return {
                original: timeKey,
                x: display,
                y: parseFloat(safeAvg.toFixed(2))
            };
        })
        .sort((a, b) => a.original.localeCompare(b.original))
        .map(({ x, y }) => ({ x, y }));

    // 2) 평점 분포 (Bar)
    const ratingCounts = [0, 0, 0, 0, 0];
    reviewData.forEach(r => {
        const score = Number(r.score);
        if (score >= 1 && score <= 5) {
            ratingCounts[score - 1]++;
        }
    });
    const ratingDistribution = ratingCounts.map((count, i) => ({
        x: i + 1,
        y: count
    }));

    // 3) 키워드 트렌드
    const keywordMap: { [k: string]: { [t: string]: number } } = {};
    Object.entries(grouped).forEach(([timeKey, group]) => {
        group.forEach(r => {
            const kws = extractKeywords(r.content);
            kws.forEach(kw => {
                if (!keywordMap[kw]) keywordMap[kw] = {};
                if (!keywordMap[kw][timeKey]) keywordMap[kw][timeKey] = 0;
                keywordMap[kw][timeKey]++;
            });
        });
    });
    const keywordTrends: { [k: string]: Array<{ x: string; y: number }> } = {};
    Object.entries(keywordMap).forEach(([kw, timeObj]) => {
        const arr = Object.entries(timeObj)
            .map(([timeKey, cnt]) => {
                let display = timeKey;
                if (timeUnit === 'day') {
                    const parts = timeKey.split('-');
                    if (parts.length === 3) display = `${parts[1]}-${parts[2]}`;
                } else if (timeUnit === 'week') {
                    const d = new Date(timeKey);
                    const mm = String(d.getMonth() + 1).padStart(2, '0');
                    const dd = String(d.getDate()).padStart(2, '0');
                    display = `${mm}-${dd}`;
                } else if (timeUnit === 'month') {
                    const parts = timeKey.split('-');
                    if (parts.length === 2) display = parts[1];
                }
                return { original: timeKey, x: display, y: cnt };
            })
            .sort((a, b) => a.original.localeCompare(b.original))
            .map(({ x, y }) => ({ x, y }));

        keywordTrends[kw] = arr;
    });

    // 4) 버그 보고 횟수 (Bar)
    const bugReports = Object.entries(grouped)
        .map(([timeKey, group]) => {
            let bugCount = 0;
            group.forEach(r => {
                if (mentionsBugs(r.content)) bugCount++;
            });
            let display = timeKey;
            if (timeUnit === 'day') {
                const parts = timeKey.split('-');
                if (parts.length === 3) display = `${parts[1]}-${parts[2]}`;
            } else if (timeUnit === 'week') {
                const d = new Date(timeKey);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                display = `${mm}-${dd}`;
            } else if (timeUnit === 'month') {
                const parts = timeKey.split('-');
                if (parts.length === 2) display = parts[1];
            }
            return { original: timeKey, x: display, y: bugCount };
        })
        .sort((a, b) => a.original.localeCompare(b.original))
        .map(({ x, y }) => ({ x, y }));

    // 5) 리뷰 길이 vs 평점
    const reviewLengthVsRating = reviewData.map(r => {
        const s = Number(r.score);
        const len = r.content.length;
        return {
            x: len,
            y: isNaN(s) ? 0 : s,
            size: 3
        };
    });

    // 6) 리뷰 볼륨
    const reviewVolume = Object.entries(grouped)
        .map(([timeKey, group]) => {
            let display = timeKey;
            if (timeUnit === 'day') {
                const parts = timeKey.split('-');
                if (parts.length === 3) display = `${parts[1]}-${parts[2]}`;
            } else if (timeUnit === 'week') {
                const d = new Date(timeKey);
                const mm = String(d.getMonth() + 1).padStart(2, '0');
                const dd = String(d.getDate()).padStart(2, '0');
                display = `${mm}-${dd}`;
            } else if (timeUnit === 'month') {
                const parts = timeKey.split('-');
                if (parts.length === 2) display = parts[1];
            }
            return { original: timeKey, x: display, y: group.length };
        })
        .sort((a, b) => a.original.localeCompare(b.original))
        .map(({ x, y }) => ({ x, y }));

    return {
        reviews: reviewData,
        timeRatings,
        ratingDistribution,
        keywordTrends,
        bugReports,
        reviewLengthVsRating,
        reviewVolume
    };
}

/** 차트 컨테이너 */
const ChartContainer: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => {
    return (
        <View style={styles.chartCard}>
            <Text style={styles.chartTitle}>{title}</Text>
            <View style={styles.chartContent}>{children}</View>
        </View>
    );
};

/** 차트 공통 설정 */
const chartConfig = {
    backgroundColor: '#2A2A2A',
    backgroundGradientFrom: '#2A2A2A',
    backgroundGradientTo: '#2A2A2A',
    decimalPlaces: 0,
    color: (opacity = 1) => `rgba(255,255,255,${opacity})`,
    labelColor: (opacity = 1) => `rgba(255,255,255,${opacity})`,
    style: {
        borderRadius: 16,
    }
};

/** 키워드별 색상(필요시) */
const keywordColors: { [kw: string]: string } = {
    '버그': 'rgba(255, 99, 132, 1)',
    '충돌': 'rgba(255, 159, 64, 1)',
    '멈춤': 'rgba(255, 205, 86, 1)',
    '오류': 'rgba(75, 192, 192, 1)',
    '에러': 'rgba(54, 162, 235, 1)',
    '문제': 'rgba(153, 102, 255, 1)',
    '빠름': 'rgba(46, 204, 113, 1)',
    '느림': 'rgba(231, 76, 60, 1)',
    '디자인': 'rgba(155, 89, 182, 1)',
    '좋아요': 'rgba(3, 218, 198, 1)',
    '편리': 'rgba(26, 188, 156, 1)',
    '불편': 'rgba(241, 196, 15, 1)',
    '업데이트': 'rgba(230, 126, 34, 1)',
    '기능': 'rgba(142, 68, 173, 1)'
};

/**
 * AISummaryCharts
 */
export const AISummaryCharts: React.FC<{ chartData: ChartData }> = ({ chartData }) => {
    const { width } = Dimensions.get('window');
    // 좌우 잘림 최소화를 위해 조금 줄인 폭 사용
    const chartWidth = Math.floor(width * 0.9);
    const hasData = chartData && chartData.timeRatings && chartData.timeRatings.length > 0;

    if (!hasData) {
        return (
            <ScrollView style={{ marginBottom: 16 }}>
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>데이터가 없습니다</Text>
                </View>
            </ScrollView>
        );
    }

    // -----------------------------------
    // 1) 평점 추이 (Line) - 최대 6개
    // -----------------------------------
    const timeRatingsSlice = chartData.timeRatings.slice(-6);
    const timeRatingData = {
        labels: timeRatingsSlice.map(v => v.x),
        datasets: [
            {
                data: timeRatingsSlice.map(v => v.y),
                color: (opacity = 1) => `rgba(255,99,132,${opacity})`,
                strokeWidth: 2
            }
        ]
    };

    // formatXLabel: 라이브러리가 (기본 3~4개 이상) 추가 라벨을 그릴 때 빈 문자열로
    const formatXLabel = (label: string) => {
        // 원래 라벨 반환
        return label;
    };

    // -----------------------------------
    // 2) 평점 분포 (Bar)
    // -----------------------------------
    const ratingDistData = {
        labels: ['1점', '2점', '3점', '4점', '5점'],
        datasets: [
            { data: chartData.ratingDistribution.map(r => r.y) }
        ]
    };

    // -----------------------------------
    // 3) 키워드 트렌드
    // -----------------------------------
    const keywordTrendCharts: React.ReactElement[] = [];
    const allKeywords = Object.keys(chartData.keywordTrends);
    allKeywords.forEach(kw => {
        const arr = chartData.keywordTrends[kw];
        if (!arr || arr.length === 0) return;
        // 최근 6개만
        const sliced = arr.slice(-6);
        const data = {
            labels: sliced.map(v => v.x),
            datasets: [
                {
                    data: sliced.map(v => v.y),
                    color: (opacity = 1) => {
                        const base = keywordColors[kw] || 'rgba(0,150,136,1)';
                        return base.replace(',1)', `,${opacity})`);
                    },
                    strokeWidth: 2
                }
            ]
        };

        const formatKwLabel = (label: string) => label;

        keywordTrendCharts.push(
            <ChartContainer key={kw} title={`키워드 트렌드: ${kw}`}>
                <LineChart
                    data={data}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    formatXLabel={formatKwLabel}
                />
            </ChartContainer>
        );
    });

    // -----------------------------------
    // 4) 버그 보고 횟수 (Bar) - 최대 5개
    // -----------------------------------
    const bugSlice = chartData.bugReports.slice(-5);
    const bugReportData = {
        labels: bugSlice.map(v => v.x),
        datasets: [
            {
                data: bugSlice.map(v => v.y),
                color: (opacity = 1) => `rgba(255,165,0,${opacity})`
            }
        ]
    };
    const formatBugLabel = (label: string) => label;

    // -----------------------------------
    // 5) 리뷰 길이 vs 평점 -> StackedBar
    // (바 위의 텍스트 제거, 평점 레전드는 아래쪽)
    // -----------------------------------
    const bins = [0, 100, 300, Infinity];
    const labels = ['0-100', '101-300', '301+'];
    const counters: { [rating: number]: number[] } = { 1: [0, 0, 0], 2: [0, 0, 0], 3: [0, 0, 0], 4: [0, 0, 0], 5: [0, 0, 0] };

    chartData.reviewLengthVsRating.forEach(item => {
        const r = Math.floor(item.y);
        if (r < 1 || r > 5) return;
        for (let i = 0; i < bins.length - 1; i++) {
            if (item.x >= bins[i] && item.x < bins[i + 1]) {
                counters[r][i]++;
                break;
            }
        }
    });

    // 스택형 바차트에서 data는 "X축 항목 하나마다 [스택1,스택2,스택3, ...]" 형태여야 함
    // 여기선 X축(3개 구간)마다 5개 평점을 쌓음 → 각 구간 i에 대해 [1점,2점,3점,4점,5점] 순서
    // 값은 0~1 사이 비율
    const stackedDataArr = labels.map((_, i) => {
        const sum = [1, 2, 3, 4, 5].reduce((acc, r) => acc + counters[r][i], 0);
        if (sum === 0) {
            return [0, 0, 0, 0, 0];
        } else {
            return [1, 2, 3, 4, 5].map(r => counters[r][i] / sum);
        }
    });

    const stackedData = {
        labels: labels,
        legend: ['1점', '2점', '3점', '4점', '5점'], // 아래 레전드
        data: stackedDataArr,
        barColors: ['#FF5252', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3']
    };

    // -----------------------------------
    // 6) 리뷰 볼륨 (Line) - 최대 6개
    // -----------------------------------
    const volSlice = chartData.reviewVolume.slice(-6);
    const volData = {
        labels: volSlice.map(v => v.x),
        datasets: [
            {
                data: volSlice.map(v => v.y),
                color: (opacity = 1) => `rgba(0,210,255,${opacity})`,
                strokeWidth: 2
            }
        ]
    };
    const formatVolLabel = (label: string) => label;

    return (
        <ScrollView style={{ marginBottom: 16 }}>
            {/* 차트1: 평점 추이 */}
            <ChartContainer title="평점 추이">
                <LineChart
                    data={timeRatingData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    formatXLabel={formatXLabel}
                />
            </ChartContainer>

            {/* 차트2: 평점 분포 */}
            <ChartContainer title="평점 분포">
                <BarChart
                    data={ratingDistData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    yAxisLabel=""
                    yAxisSuffix=""
                />
            </ChartContainer>

            {/* 차트3: 키워드 트렌드 */}
            {keywordTrendCharts}

            {/* 차트4: 버그 보고 횟수 */}
            <ChartContainer title="버그 보고 횟수">
                <BarChart
                    data={bugReportData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    yAxisLabel=""
                    yAxisSuffix=""
                />
            </ChartContainer>

            {/* 차트5: 리뷰 길이와 평점 관계 (스택바) */}
            <ChartContainer title="리뷰 길이와 평점 관계">
                <StackedBarChart
                    data={stackedData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    hideLegend={false}
                />
            </ChartContainer>

            {/* 차트6: 리뷰 작성 빈도 */}
            <ChartContainer title="리뷰 작성 빈도">
                <LineChart
                    data={volData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                    formatXLabel={formatVolLabel}
                />
            </ChartContainer>
        </ScrollView>
    );
};

/** 내부 스타일 */
const styles = StyleSheet.create({
    chartCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16
    },
    chartTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#FFFFFF',
        marginBottom: 12,
        textAlign: 'center'
    },
    chartContent: {
        backgroundColor: '#2A2A2A',
        borderRadius: 8,
        padding: 8,
        alignItems: 'center'
    },
    chart: {
        borderRadius: 8,
        padding: 8
    }
});
