// FileA.tsx
import React from 'react';
import { StyleSheet, View } from 'react-native';
import {
    CartesianChart, // 핵심 Chart 래퍼
    Line,          // 선형 차트
    Bar,
    Scatter,           // 막대 차트
    // BarGroup,    // 필요시 추가
    // Area,        // 필요시 추가
    // Pie,         // 필요시 추가
} from 'victory-native';

/** 리뷰 데이터 형식 */
export type ReviewData = {
    date: string;   // YYYY-MM-DD 등 표시용
    rawDate: Date;  // 실제 날짜 객체
    score: number;  // 별점
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

    reviews.forEach((review) => {
        const date = review.rawDate;
        let timeKey = '';

        if (unit === 'day') {
            // 2025-04-16 형태
            timeKey = date.toISOString().split('T')[0];
        } else if (unit === 'week') {
            // 해당 주의 월요일
            const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            const monday = new Date(date);
            monday.setDate(diff);
            timeKey = monday.toISOString().split('T')[0];
        } else if (unit === 'month') {
            // YYYY-MM
            timeKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!grouped[timeKey]) {
            grouped[timeKey] = [];
        }
        grouped[timeKey].push(review);
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
    // 시간 단위별 그룹
    const timeGrouped = groupByTimeUnit(reviewData, timeUnit);

    // 1) 평점 추이 (Line)
    const timeRatings = Object.entries(timeGrouped)
        .map(([time, reviews]) => {
            const avgRating = reviews.reduce((sum, r) => sum + r.score, 0) / reviews.length;
            return { x: time, y: parseFloat(avgRating.toFixed(2)) };
        })
        .sort((a, b) => a.x.localeCompare(b.x));

    // 2) 평점 분포 (Bar)
    const ratingCounts = [0, 0, 0, 0, 0]; // 1~5점
    reviewData.forEach((r) => {
        if (r.score >= 1 && r.score <= 5) {
            ratingCounts[r.score - 1]++;
        }
    });
    const ratingDistribution = ratingCounts.map((count, i) => ({
        x: i + 1,
        y: count,
    }));

    // 3) 키워드 트렌드 (여러 Line)
    const keywordTrends: { [key: string]: { [time: string]: number } } = {};
    Object.entries(timeGrouped).forEach(([time, reviews]) => {
        reviews.forEach((review) => {
            const keywords = extractKeywords(review.content);
            keywords.forEach((keyword) => {
                if (!keywordTrends[keyword]) {
                    keywordTrends[keyword] = {};
                }
                if (!keywordTrends[keyword][time]) {
                    keywordTrends[keyword][time] = 0;
                }
                keywordTrends[keyword][time]++;
            });
        });
    });
    const formattedKeywordTrends: { [key: string]: Array<{ x: string; y: number }> } = {};
    Object.entries(keywordTrends).forEach(([keyword, timeCounts]) => {
        formattedKeywordTrends[keyword] = Object.entries(timeCounts)
            .map(([time, count]) => ({ x: time, y: count }))
            .sort((a, b) => a.x.localeCompare(b.x));
    });

    // 4) 버그/이슈 보고 빈도 (Bar)
    const bugReports = Object.entries(timeGrouped)
        .map(([time, reviews]) => {
            const bugCount = reviews.filter((r) => mentionsBugs(r.content)).length;
            return { x: time, y: bugCount };
        })
        .sort((a, b) => a.x.localeCompare(b.x));

    // 5) 리뷰 길이 vs 평점 (Scatter 대체: strokeWidth=0)
    const reviewLengthVsRating = reviewData.map((r) => ({
        x: r.content.length, // 길이
        y: r.score,          // 평점
        size: 3,
    }));

    // 6) 리뷰 볼륨 (Line)
    const reviewVolume = Object.entries(timeGrouped)
        .map(([time, reviews]) => ({ x: time, y: reviews.length }))
        .sort((a, b) => a.x.localeCompare(b.x));

    return {
        reviews: reviewData,
        timeRatings,
        ratingDistribution,
        keywordTrends: formattedKeywordTrends,
        bugReports,
        reviewLengthVsRating,
        reviewVolume,
    };
}

/**
 * AISummaryCharts:
 *  6개 차트를 순서대로 표시하는 예시
 *  CartesianChart에 data, xKey, yKeys를 넘기고,
 *  자식은 (args) => ReactNode 형태로 작성
 */
export const AISummaryCharts: React.FC<{ chartData: ChartData }> = ({ chartData }) => {
    // 1) timeRatings => [{time, value}]
    const timeRatingsData = chartData.timeRatings.map(item => ({
        time: item.x,
        value: item.y,
    }));

    // 2) ratingDistribution => [{label, count}]
    const ratingDistData = chartData.ratingDistribution.map(item => ({
        label: String(item.x),
        count: item.y,
    }));

    // 3) 키워드 트렌드는 (keyword => [{time, freq}]) 형태로 여러 개 가능
    // 여기서는 최대 2개 키워드만 개별 차트로 예시
    const keywordTrendEntries = Object.entries(chartData.keywordTrends).slice(0, 2);
    const keywordTrendCharts = keywordTrendEntries.map(([kw, data]) => {
        const mapped = data.map(d => ({ time: d.x, freq: d.y }));
        return (
            <View style={localStyles.chartCard} key={kw}>
                <View style={localStyles.chartContent}>
                    <CartesianChart data={mapped} xKey="time" yKeys={["freq"]}>
                        {({ points }) => (
                            <Line points={points.freq} color="#03DAC6" strokeWidth={2} />
                        )}
                    </CartesianChart>
                </View>
            </View>
        );
    });

    // 4) bugReports => [{time, bugs}]
    const bugData = chartData.bugReports.map(item => ({
        time: item.x,
        bugs: item.y,
    }));

    // 5) scatter => [{length, rating}]
    const scatterData = chartData.reviewLengthVsRating.map(item => ({
        length: item.x,
        rating: item.y,
    }));

    // 6) reviewVolume => [{time, count}]
    const volumeData = chartData.reviewVolume.map(item => ({
        time: item.x,
        count: item.y,
    }));

    return (
        <View style={{ marginBottom: 16 }}>
            {/* 차트1: 평점 추이 (Line) */}
            <View style={localStyles.chartCard}>
                <View style={localStyles.chartContent}>
                    <CartesianChart data={timeRatingsData} xKey="time" yKeys={["value"]}>
                        {({ points }) => (
                            <Line points={points.value} color="red" strokeWidth={2} />
                        )}
                    </CartesianChart>
                </View>
            </View>

            <View style={localStyles.chartCard}>
                <View style={localStyles.chartContent}>
                    <CartesianChart data={ratingDistData} xKey="label" yKeys={["count"]}>
                        {({ points, chartBounds }) => (
                            <Bar
                                points={points.count}
                                chartBounds={chartBounds} // ★ 반드시 chartBounds 넘겨주기
                                color="blue"
                            />
                        )}
                    </CartesianChart>
                </View>
            </View>

            {/* 차트3: 키워드 트렌드 (2개까지) */}
            {keywordTrendCharts}

            {/* 차트4: 버그 보고 횟수 (Bar) */}
            <View style={localStyles.chartCard}>
                <View style={localStyles.chartContent}>
                    <CartesianChart data={bugData} xKey="time" yKeys={["bugs"]}>
                        {({ points, chartBounds }) => (
                            <Bar
                                points={points.bugs}
                                chartBounds={chartBounds} // ★ 반드시 chartBounds 넘겨주기
                                color="orange"
                            />
                        )}
                    </CartesianChart>
                </View>
            </View>

            {/* 차트5: 리뷰 길이 vs 평점 (Line 점만) */}
            <View style={localStyles.chartCard}>
                <View style={localStyles.chartContent}>
                    <CartesianChart data={scatterData} xKey="length" yKeys={["rating"]}>
                        {({ points, chartBounds }) => (
                            <Scatter
                                points={points.rating}
                                color="purple"
                                radius={5} // 점 크기
                            />
                        )}
                    </CartesianChart>
                </View>
            </View>

            {/* 차트6: 리뷰 볼륨 (Line) */}
            <View style={localStyles.chartCard}>
                <View style={localStyles.chartContent}>
                    <CartesianChart data={volumeData} xKey="time" yKeys={["count"]}>
                        {({ points }) => (
                            <Line points={points.count} color="cyan" strokeWidth={2} />
                        )}
                    </CartesianChart>
                </View>
            </View>
        </View>
    );
};

/** 내부 스타일들 */
const localStyles = StyleSheet.create({
    chartCard: {
        backgroundColor: '#1E1E1E',
        borderRadius: 8,
        padding: 16,
        marginBottom: 16,
    },
    chartContent: {
        height: 250,
        backgroundColor: '#2A2A2A',
        borderRadius: 8,
        padding: 8,
    },
});
