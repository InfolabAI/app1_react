import React from 'react';
import { StyleSheet, View, Dimensions, Text, ScrollView } from 'react-native';
import {
    LineChart,
    BarChart,
    StackedBarChart
} from 'react-native-chart-kit';

/* ──────────────────── 타입 ──────────────────── */
export type ReviewData = {
    date: string;            // 표시용(“YYYY‑MM‑DD” 등)
    rawDate: Date;           // 실제 Date 객체
    score: number | string;  // 별점
    content: string;
    username: string;
};

export type ChartData = {
    reviews: ReviewData[];
    timeRatings: Array<{ x: string; y: number }>;
    ratingDistribution: Array<{ x: number; y: number }>;
    keywordTrends: { [k: string]: Array<{ x: string; y: number }> };
    bugReports: Array<{ x: string; y: number }>;
    reviewLengthVsRating: Array<{ x: number; y: number; size: number }>;
    reviewVolume: Array<{ x: string; y: number }>;
};

export type TimeUnit = 'day' | 'week' | 'month';

/* ──────────────────── 날짜 유틸 ──────────────────── */
const ymd = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
        d.getDate()
    ).padStart(2, '0')}`;

const mondayOfWeek = (d: Date) => {
    const day = d.getDay();               // 0(일)‑6(토)
    const offset = day === 0 ? 6 : day - 1;
    const m = new Date(d);
    m.setDate(m.getDate() - offset);
    m.setHours(0, 0, 0, 0);               // 타임존 보정
    return ymd(m);
};

/* ──────────────────── 그룹핑 ──────────────────── */
function groupByTimeUnit(reviews: ReviewData[], unit: TimeUnit) {
    const grouped: { [k: string]: ReviewData[] } = {};

    reviews.forEach((r) => {
        if (!(r.rawDate instanceof Date)) return;
        let key = '';

        if (unit === 'day') {
            key = ymd(r.rawDate);
        } else if (unit === 'week') {
            key = mondayOfWeek(r.rawDate);      // 월요일 날짜 하나로 대표
        } else if (unit === 'month') {
            key = `${r.rawDate.getFullYear()}-${String(r.rawDate.getMonth() + 1).padStart(2, '0')}`;
        }

        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(r);
    });

    return grouped;
}

/* ──────────────────── 키워드 유틸 ──────────────────── */
function extractKeywords(text: string) {
    const kws = [
        '버그', '빠름', '느림', '디자인', '충돌', '멈춤',
        '좋아요', '편리', '불편', '업데이트', '기능', '오류'
    ];
    return kws.filter(k => text.toLowerCase().includes(k.toLowerCase()));
}

function mentionsBugs(text: string) {
    const bug = ['버그', '충돌', '멈춤', '오류', '에러', '문제'];
    return bug.some(k => text.toLowerCase().includes(k.toLowerCase()));
}

/* ──────────────────── 데이터 변환 ──────────────────── */
export function generateChartData(reviewData: ReviewData[], timeUnit: TimeUnit): ChartData {
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

    /* 1) 평점 추이 */
    const timeRatings = Object.entries(grouped).map(([k, g]) => {
        const avg = g.reduce((s, r) => s + Number(r.score || 0), 0) / g.length;
        let label = k;
        if (timeUnit === 'day') label = k.slice(5);               // “MM‑DD”
        else if (timeUnit === 'week') label = k.slice(5);         // 주 시작 “MM‑DD”
        else if (timeUnit === 'month') label = k.split('-')[1];   // “MM”
        return { original: k, x: label, y: +avg.toFixed(2) };
    }).sort((a, b) => a.original.localeCompare(b.original))
        .map(({ x, y }) => ({ x, y }));

    /* 2) 평점 분포 */
    const ratingCounts = [0, 0, 0, 0, 0];
    reviewData.forEach(r => {
        const s = Number(r.score);
        if (s >= 1 && s <= 5) ratingCounts[s - 1]++;
    });
    const ratingDistribution = ratingCounts.map((c, i) => ({ x: i + 1, y: c }));

    /* 3) 키워드 트렌드 */
    const kwMap: { [k: string]: { [t: string]: number } } = {};
    Object.entries(grouped).forEach(([k, g]) => {
        g.forEach(r => {
            extractKeywords(r.content).forEach(kw => {
                if (!kwMap[kw]) kwMap[kw] = {};
                if (!kwMap[kw][k]) kwMap[kw][k] = 0;
                kwMap[kw][k]++;
            });
        });
    });
    const keywordTrends: { [k: string]: Array<{ x: string; y: number }> } = {};
    Object.entries(kwMap).forEach(([kw, tm]) => {
        keywordTrends[kw] = Object.entries(tm).map(([k, c]) => {
            let label = k;
            if (timeUnit === 'day') label = k.slice(5);
            else if (timeUnit === 'week') label = k.slice(5);
            else if (timeUnit === 'month') label = k.split('-')[1];
            return { original: k, x: label, y: c };
        }).sort((a, b) => a.original.localeCompare(b.original))
            .map(({ x, y }) => ({ x, y }));
    });

    /* 4) 버그 보고 */
    const bugReports = Object.entries(grouped).map(([k, g]) => {
        const bugCnt = g.filter(r => mentionsBugs(r.content)).length;
        let label = k;
        if (timeUnit === 'day') label = k.slice(5);
        else if (timeUnit === 'week') label = k.slice(5);
        else if (timeUnit === 'month') label = k.split('-')[1];
        return { original: k, x: label, y: bugCnt };
    }).sort((a, b) => a.original.localeCompare(b.original))
        .map(({ x, y }) => ({ x, y }));

    /* 5) 리뷰 길이 vs 평점 */
    const reviewLengthVsRating = reviewData.map(r => {
        const s = Number(r.score);
        return { x: r.content.length, y: isNaN(s) ? 0 : s, size: 3 };
    });

    /* 6) 리뷰 볼륨 */
    const reviewVolume = Object.entries(grouped).map(([k, g]) => {
        let label = k;
        if (timeUnit === 'day') label = k.slice(5);
        else if (timeUnit === 'week') label = k.slice(5);
        else if (timeUnit === 'month') label = k.split('-')[1];
        return { original: k, x: label, y: g.length };
    }).sort((a, b) => a.original.localeCompare(b.original))
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

/* ──────────────────── 공통 차트 설정 ──────────────────── */
const chartConfig = {
    backgroundColor: '#2A2A2A',
    backgroundGradientFrom: '#2A2A2A',
    backgroundGradientTo: '#2A2A2A',
    decimalPlaces: 0,
    barPercentage: 0.7,  // (0 ~ 1) 기본 1 → 폭을 70 %
    color: (o = 1) => `rgba(255,255,255,${o})`,
    labelColor: (o = 1) => `rgba(255,255,255,${o})`,
    style: { borderRadius: 16 }
};
/* 평점추이만 소수점 1자리 */
const ratingChartConfig = { ...chartConfig, decimalPlaces: 1 };

/* 키워드색 */
const keywordColors: { [k: string]: string } = {
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

/* ──────────────────── 뷰 래퍼 ──────────────────── */
const ChartContainer: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
    <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>{title}</Text>
        <View style={styles.chartContent}>{children}</View>
    </View>
);

/* ──────────────────── 메인 컴포넌트 ──────────────────── */
export const AISummaryCharts: React.FC<{ chartData: ChartData }> = ({ chartData }) => {
    const { width } = Dimensions.get('window');
    const chartWidth = Math.floor(width * 0.9);

    if (!chartData?.timeRatings?.length) {
        return (
            <ScrollView style={{ marginBottom: 16 }}>
                <View style={styles.chartCard}>
                    <Text style={styles.chartTitle}>데이터가 없습니다</Text>
                </View>
            </ScrollView>
        );
    }

    /* 1) 평점 추이 */
    const timeRatingsSlice = chartData.timeRatings.slice(-6);
    const timeRatingData = {
        labels: timeRatingsSlice.map(v => v.x),
        datasets: [{ data: timeRatingsSlice.map(v => v.y), color: (o = 1) => `rgba(255,99,132,${o})`, strokeWidth: 2 }]
    };
    console.log('[평점추이] 예:', timeRatingsSlice.slice(0, 3));

    /* 2) 평점 분포 */
    const ratingDistData = {
        labels: ['1점', '2점', '3점', '4점', '5점'],
        datasets: [{ data: chartData.ratingDistribution.map(r => r.y) }]
    };
    console.log('[평점분포] 예:', ratingDistData.datasets[0].data.slice(0, 3));

    /* 3) 키워드 트렌드 */
    const keywordTrendCharts: React.ReactElement[] = [];
    Object.keys(chartData.keywordTrends).forEach(kw => {
        const arr = chartData.keywordTrends[kw];
        if (!arr?.length) return;
        const sliced = arr.slice(-6);
        const data = {
            labels: sliced.map(v => v.x),
            datasets: [{
                data: sliced.map(v => v.y),
                color: (o = 1) => {
                    const base = keywordColors[kw] || 'rgba(0,150,136,1)';
                    return base.replace(',1)', `,${o})`);
                },
                strokeWidth: 2
            }]
        };
        console.log(`[키워드:${kw}] 예:`, sliced.slice(0, 3));
        keywordTrendCharts.push(
            <ChartContainer key={kw} title={`키워드 트렌드: ${kw}`}>
                <LineChart
                    data={data}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                />
            </ChartContainer>
        );
    });

    /* 4) 버그 보고 */
    const bugSlice = chartData.bugReports.slice(-5);
    const bugReportData = {
        labels: bugSlice.map(v => v.x),
        datasets: [{ data: bugSlice.map(v => v.y), color: (o = 1) => `rgba(255,165,0,${o})` }]
    };
    console.log('[버그리포트] 예:', bugSlice.slice(0, 3));

    /* 5) 리뷰 길이 vs 평점 (스택 바) */
    const bins = [0, 100, 300, Infinity];
    const labels = ['0‑100', '101‑300', '301+'];
    const cnt: { [r: number]: number[] } = { 1: [0, 0, 0], 2: [0, 0, 0], 3: [0, 0, 0], 4: [0, 0, 0], 5: [0, 0, 0] };
    chartData.reviewLengthVsRating.forEach(({ x, y }) => {
        const r = Math.floor(y);
        if (r < 1 || r > 5) return;
        for (let i = 0; i < bins.length - 1; i++) {
            if (x >= bins[i] && x < bins[i + 1]) { cnt[r][i]++; break; }
        }
    });
    const stackedDataArr = labels.map((_, i) => {
        const sum = [1, 2, 3, 4, 5].reduce((a, r) => a + cnt[r][i], 0);
        return sum === 0 ? [0, 0, 0, 0, 0] : [1, 2, 3, 4, 5].map(r => cnt[r][i] / sum);
    });
    const stackedData = {
        labels,
        legend: ['1점', '2점', '3점', '4점', '5점'],
        data: stackedDataArr,
        barColors: ['#FF5252', '#FF9800', '#FFEB3B', '#4CAF50', '#2196F3']
    };
    console.log('[리뷰길이‑평점] 스택데이터 예:', stackedDataArr);

    /* 6) 리뷰 볼륨 */
    const volSlice = chartData.reviewVolume.slice(-6);
    const volData = {
        labels: volSlice.map(v => v.x),
        datasets: [{ data: volSlice.map(v => v.y), color: (o = 1) => `rgba(0,210,255,${o})`, strokeWidth: 2 }]
    };
    console.log('[리뷰볼륨] 예:', volSlice.slice(0, 3));

    /* ──────────────────── 반환 뷰 ──────────────────── */
    return (
        <ScrollView style={{ marginBottom: 16 }}>
            {/* 1 평점추이 */}
            <ChartContainer title="평점 추이">
                <LineChart
                    data={timeRatingData}
                    width={chartWidth}
                    height={220}
                    chartConfig={ratingChartConfig}   /* 소수점 1자리 */
                    bezier
                    style={styles.chart}
                />
            </ChartContainer>

            {/* 2 평점 분포 */}
            <ChartContainer title="평점 분포">
                <BarChart
                    data={ratingDistData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    yAxisLabel=""
                    yAxisSuffix="개"
                />
            </ChartContainer>

            {/* 3 키워드 트렌드 */}
            {keywordTrendCharts}

            {/* 4 버그 보고 */}
            <ChartContainer title="버그 보고 횟수">
                <BarChart
                    data={bugReportData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    yAxisLabel=""
                    yAxisSuffix="개"
                />
            </ChartContainer>

            {/* 5 리뷰 길이 vs 평점 */}
            <ChartContainer title="리뷰 길이와 평점 관계">
                <StackedBarChart
                    data={stackedData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    style={styles.chart}
                    hideLegend           /* 기본 레전드 제거 */
                    withHorizontalLabels={false}   /* ← Y축 숫자·선 숨김 */
                />
                {/* 하단 커스텀 레전드 */}
                <View style={styles.customLegend}>
                    {stackedData.legend.map((l, i) => (
                        <View key={l} style={styles.legendItem}>
                            <View style={[styles.legendDot, { backgroundColor: stackedData.barColors[i] }]} />
                            <Text style={styles.legendText}>{l}</Text>
                        </View>
                    ))}
                </View>
            </ChartContainer>

            {/* 6 리뷰 작성 빈도 */}
            <ChartContainer title="리뷰 작성 빈도">
                <LineChart
                    data={volData}
                    width={chartWidth}
                    height={220}
                    chartConfig={chartConfig}
                    bezier
                    style={styles.chart}
                />
            </ChartContainer>
        </ScrollView>
    );
};

/* ──────────────────── 스타일 ──────────────────── */
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
    },
    /* 커스텀 레전드 */
    customLegend: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
    legendItem: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 4 },
    legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
    legendText: { color: '#FFF', fontSize: 12 }
});
