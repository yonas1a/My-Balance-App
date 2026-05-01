import { MaterialCommunityIcons } from '@expo/vector-icons';
import React, { useEffect, useState } from 'react';
import { Dimensions, SafeAreaView, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import Svg, { Circle, Defs, Line, Path, Stop, LinearGradient as SvgGradient, Text as SvgText } from 'react-native-svg';
import { AppColors } from '../constants/theme';
import { BalanceSnapshot, filterHistory, loadHistory } from '../utils/balanceHistory';


const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CHART_WIDTH = SCREEN_WIDTH - 48;
const CHART_HEIGHT = 220;
const PADDING = { top: 20, bottom: 30, left: 48, right: 16 };

const TIMEFRAMES = ['1W', '1M', '3M', '1Y', 'ALL'];
const TIMEFRAME_DAYS: Record<string, number> = {
  '1W': 7,
  '1M': 30,
  '3M': 90,
  '1Y': 365,
  ALL: 9999,
};

interface DailyBalance {
  date: string;
  balance: number;
}

// ─── Mock data fallback ────────────────────────────────────────────────────────
function generateMockDailyData(days: number, seed: number = 18000): DailyBalance[] {
  const data: DailyBalance[] = [];
  let balance = seed + Math.random() * 3000;
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const isPayday = d.getDate() === 25 || d.getDate() === 10;
    const change = isPayday ? Math.random() * 8000 + 4000 : (Math.random() - 0.42) * 1800;
    balance = Math.max(3000, balance + change);
    data.push({
      date: `${d.getDate()}/${d.getMonth() + 1}`,
      balance: Math.round(balance),
    });
  }
  return data;
}

// ─── SVG helpers ──────────────────────────────────────────────────────────────
function buildPath(data: DailyBalance[], minVal: number, maxVal: number): string {
  const range = maxVal - minVal || 1;
  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
  return data
    .map((point, i) => {
      const x = PADDING.left + (i / Math.max(1, data.length - 1)) * innerW;
      const y = PADDING.top + (1 - (point.balance - minVal) / range) * innerH;
      return `${i === 0 ? 'M' : 'L'} ${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');
}

function buildAreaPath(data: DailyBalance[], minVal: number, maxVal: number): string {
  const line = buildPath(data, minVal, maxVal);
  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
  const bottomY = (PADDING.top + CHART_HEIGHT - PADDING.top - PADDING.bottom).toFixed(1);
  return `${line} L ${(PADDING.left + innerW).toFixed(1)},${bottomY} L ${PADDING.left.toFixed(1)},${bottomY} Z`;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function AnalyticsScreen() {
  const [activeTimeframe, setActiveTimeframe] = useState('1M');
  const [history, setHistory] = useState<BalanceSnapshot[]>([]);
  const [selectedBank, setSelectedBank] = useState<string>('Total');
  const [availableBanks, setAvailableBanks] = useState<string[]>([]);
  const [dailyData, setDailyData] = useState<DailyBalance[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<DailyBalance | null>(null);
  const [usingMock, setUsingMock] = useState(false);

  // Load history from storage on mount
  useEffect(() => {
    loadHistory().then(h => {
      setHistory(h);
      // Collect all unique bank names across all snapshots
      const banks = new Set<string>();
      h.forEach(snap => Object.keys(snap.banks).forEach(b => banks.add(b)));
      setAvailableBanks(Array.from(banks));
    });
  }, []);

  // Rebuild chart data whenever timeframe, bank selection, or history changes
  useEffect(() => {
    const days = TIMEFRAME_DAYS[activeTimeframe] ?? 30;
    const filtered = filterHistory(history, selectedBank, days);

    if (filtered.length >= 2) {
      setDailyData(filtered);
      setSelectedPoint(filtered[filtered.length - 1]);
      setUsingMock(false);
    } else {
      // Not enough real data yet — show mock
      const mock = generateMockDailyData(days);
      setDailyData(mock);
      setSelectedPoint(mock[mock.length - 1]);
      setUsingMock(true);
    }
  }, [history, activeTimeframe, selectedBank]);

  const minVal = dailyData.length > 0 ? Math.min(...dailyData.map(d => d.balance)) : 0;
  const maxVal = dailyData.length > 0 ? Math.max(...dailyData.map(d => d.balance)) : 1;
  const range = maxVal - minVal || 1;

  const currentBalance = selectedPoint?.balance ?? 0;
  const firstBalance = dailyData[0]?.balance ?? currentBalance;
  const growthAmt = currentBalance - firstBalance;
  const growthPct = firstBalance > 0 ? ((growthAmt / firstBalance) * 100).toFixed(2) : '0.00';
  const isPositive = growthAmt >= 0;

  // Y-axis labels
  const yLabels = [maxVal, maxVal - range / 2, minVal].map(v =>
    v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v.toFixed(0)
  );

  // Decimate for display if too many points
  let displayData = dailyData;
  if (dailyData.length > 60) {
    const n = Math.ceil(dailyData.length / 60);
    displayData = dailyData.filter((_, i) => i % n === 0);
    const last = dailyData[dailyData.length - 1];
    if (displayData[displayData.length - 1] !== last) displayData = [...displayData, last];
  }

  const linePath = displayData.length > 1 ? buildPath(displayData, minVal, maxVal) : '';
  const areaPath = displayData.length > 1 ? buildAreaPath(displayData, minVal, maxVal) : '';

  // Touch to select a point
  const handleChartPress = (evt: any) => {
    const x = evt.nativeEvent.locationX;
    const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
    const ratio = Math.max(0, Math.min(1, (x - PADDING.left) / innerW));
    const idx = Math.round(ratio * (displayData.length - 1));
    if (displayData[idx]) setSelectedPoint(displayData[idx]);
  };

  // Selected dot position
  let dotX = 0, dotY = 0;
  if (selectedPoint && displayData.length > 1) {
    const idx = displayData.findIndex(d => d === selectedPoint);
    const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
    const innerH = CHART_HEIGHT - PADDING.top - PADDING.bottom;
    dotX = PADDING.left + (Math.max(0, idx) / (displayData.length - 1)) * innerW;
    dotY = PADDING.top + (1 - (selectedPoint.balance - minVal) / range) * innerH;
  }

  const bankFilters = ['Total', ...availableBanks];

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.container}>

        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>Analytics</Text>
        </View>

        <ScrollView style={{ flex: 1 }} contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>

          {/* Balance header */}
          <View style={styles.balanceSection}>
            <Text style={styles.balanceLabel}>
              {selectedBank === 'Total' ? 'Total Balance' : selectedBank}
              {usingMock ? '  (demo)' : ''}
            </Text>
            <Text style={styles.balanceText}>
              {currentBalance.toLocaleString('en-US')} ETB
            </Text>
            <View style={styles.growthRow}>
              <MaterialCommunityIcons
                name={isPositive ? 'trending-up' : 'trending-down'}
                size={18}
                color={isPositive ? '#4ADE80' : '#EF4444'}
              />
              <Text style={[styles.growthText, { color: isPositive ? '#4ADE80' : '#EF4444' }]}>
                {isPositive ? '+' : ''}{growthAmt.toLocaleString('en-US')} ETB ({isPositive ? '+' : ''}{growthPct}%)
              </Text>
              <Text style={styles.growthSubtext}>  {activeTimeframe}</Text>
            </View>
          </View>

          {/* Bank filter chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.bankFilterScroll}
            contentContainerStyle={styles.bankFilterContent}
          >
            {bankFilters.map(bank => (
              <TouchableOpacity
                key={bank}
                style={[styles.bankChip, selectedBank === bank && styles.bankChipActive]}
                onPress={() => setSelectedBank(bank)}
              >
                {bank !== 'Total' && (
                  <MaterialCommunityIcons
                    name="bank-outline"
                    size={13}
                    color={selectedBank === bank ? '#FFF' : '#9CA3AF'}
                    style={{ marginRight: 4 }}
                  />
                )}
                <Text style={[styles.bankChipText, selectedBank === bank && styles.bankChipTextActive]}>
                  {bank}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* Tooltip */}
          {selectedPoint && (
            <View style={styles.tooltip}>
              <View style={styles.tooltipLeft}>
                <Text style={styles.tooltipDate}>{selectedPoint.date}</Text>
                {usingMock && <Text style={styles.tooltipMockBadge}>preview</Text>}
              </View>
              <Text style={styles.tooltipBalance}>
                {selectedPoint.balance.toLocaleString('en-US')} ETB
              </Text>
            </View>
          )}

          {/* SVG Chart */}
          <View style={styles.chartArea} onTouchStart={handleChartPress} onTouchMove={handleChartPress}>
            {displayData.length > 1 ? (
              <Svg width={CHART_WIDTH} height={CHART_HEIGHT}>
                <Defs>
                  <SvgGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                    <Stop offset="0%" stopColor={AppColors.primaryGreenStart} stopOpacity="0.45" />
                    <Stop offset="100%" stopColor={AppColors.primaryGreenStart} stopOpacity="0.02" />
                  </SvgGradient>
                </Defs>

                {/* Grid lines + Y labels */}
                {[0, 0.5, 1].map((ratio, i) => {
                  const y = PADDING.top + ratio * (CHART_HEIGHT - PADDING.top - PADDING.bottom);
                  return (
                    <React.Fragment key={i}>
                      <Line x1={PADDING.left} y1={y} x2={CHART_WIDTH - PADDING.right} y2={y}
                        stroke={AppColors.border} strokeWidth="1" strokeDasharray="4,4" />
                      <SvgText x={PADDING.left - 6} y={y + 4} fill={AppColors.subText} fontSize="10" textAnchor="end">
                        {yLabels[i]}
                      </SvgText>
                    </React.Fragment>
                  );
                })}

                {/* Area */}
                <Path d={areaPath} fill="url(#areaGrad)" />
                {/* Line */}
                <Path d={linePath} stroke={AppColors.primaryGreenStart} strokeWidth="2.5" fill="none"
                  strokeLinejoin="round" strokeLinecap="round" />

                {/* Selected indicator */}
                {selectedPoint && dotX > 0 && (
                  <>
                    <Line x1={dotX} y1={PADDING.top} x2={dotX} y2={CHART_HEIGHT - PADDING.bottom}
                      stroke={AppColors.primaryGreenStart} strokeWidth="1" strokeDasharray="4,4" opacity="0.6" />
                    <Circle cx={dotX} cy={dotY} r={6} fill={AppColors.primaryGreenStart} />
                    <Circle cx={dotX} cy={dotY} r={10} fill={AppColors.primaryGreenStart} opacity="0.25" />
                  </>
                )}

                {/* X-axis labels */}
                {displayData.length > 0 && (() => {
                  const indices = [0, Math.floor(displayData.length / 2), displayData.length - 1];
                  const innerW = CHART_WIDTH - PADDING.left - PADDING.right;
                  return indices.map((idx) => (
                    <SvgText key={idx}
                      x={PADDING.left + (idx / (displayData.length - 1)) * innerW}
                      y={CHART_HEIGHT - 4}
                      fill={AppColors.subText} fontSize="10" textAnchor="middle"
                    >
                      {displayData[idx]?.date}
                    </SvgText>
                  ));
                })()}
              </Svg>
            ) : (
              <View style={styles.chartPlaceholder}>
                <MaterialCommunityIcons name="chart-line" size={40} color="#27272A" />
                <Text style={styles.chartPlaceholderText}>No data yet</Text>
                <Text style={styles.chartPlaceholderSub}>Open the app daily to build your chart</Text>
              </View>
            )}
          </View>

          {/* Stats row */}
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="arrow-up-bold-circle-outline" size={24} color={AppColors.success} />
              <Text style={styles.statLabel}>Highest</Text>
              <Text style={styles.statValue}>{maxVal.toLocaleString('en-US')}</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="arrow-down-bold-circle-outline" size={24} color={AppColors.error} />
              <Text style={styles.statLabel}>Lowest</Text>
              <Text style={styles.statValue}>{minVal.toLocaleString('en-US')}</Text>
            </View>
            <View style={styles.statCard}>
              <MaterialCommunityIcons name="chart-bar" size={24} color={AppColors.primaryGreenStart} />
              <Text style={styles.statLabel}>Avg</Text>
              <Text style={styles.statValue}>
                {dailyData.length > 0
                  ? Math.round(dailyData.reduce((s, d) => s + d.balance, 0) / dailyData.length).toLocaleString('en-US')
                  : '0'}
              </Text>
            </View>
          </View>

          {/* Data points count */}
          <Text style={styles.dataNote}>
            {usingMock
              ? '⚠️ Demo data — launch the app daily to build real history'
              : `📊 ${dailyData.length} day${dailyData.length !== 1 ? 's' : ''} of real data`}
          </Text>

        </ScrollView>

        {/* Timeframe Selector */}
        <View style={styles.timeframeContainer}>
          {TIMEFRAMES.map(tf => (
            <TouchableOpacity
              key={tf}
              style={[styles.tfItem, activeTimeframe === tf && styles.tfItemActive]}
              onPress={() => setActiveTimeframe(tf)}
            >
              <Text style={[styles.tfText, activeTimeframe === tf && styles.tfTextActive]}>
                {tf}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { paddingTop: 35, flex: 1, backgroundColor: AppColors.background },
  container: { flex: 1, backgroundColor: AppColors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '500', color: AppColors.text },
  scrollContent: { paddingHorizontal: 24, paddingTop: 10, paddingBottom: 30 },
  balanceSection: { marginBottom: 16 },
  balanceLabel: { fontSize: 13, color: AppColors.subText, marginBottom: 4, fontWeight: '500' },
  balanceText: { fontSize: 30, fontWeight: '800', color: AppColors.text, letterSpacing: -0.5, marginBottom: 8 },
  growthRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  growthText: { fontSize: 14, fontWeight: '600' },
  growthSubtext: { color: AppColors.subText, fontWeight: 'normal', fontSize: 13 },

  bankFilterScroll: { marginBottom: 16 },
  bankFilterContent: { gap: 8, paddingRight: 8 },
  bankChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: AppColors.card,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  bankChipActive: { backgroundColor: AppColors.primaryGreenEnd, borderColor: AppColors.primaryGreenEnd },
  bankChipText: { color: AppColors.subText, fontWeight: '600', fontSize: 13 },
  bankChipTextActive: { color: '#000000' },

  tooltip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AppColors.card,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: AppColors.primaryGreenEnd + '50',
  },
  tooltipLeft: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  tooltipDate: { color: AppColors.subText, fontSize: 13, fontWeight: '500' },
  tooltipMockBadge: {
    fontSize: 10,
    color: '#F59E0B',
    backgroundColor: '#F59E0B22',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
    fontWeight: '700',
  },
  tooltipBalance: { color: AppColors.primaryGreenStart, fontSize: 15, fontWeight: '700' },

  chartArea: { height: CHART_HEIGHT, width: CHART_WIDTH, marginBottom: 20 },
  chartPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  chartPlaceholderText: { color: AppColors.subText, fontSize: 16, fontWeight: '600' },
  chartPlaceholderSub: { color: AppColors.subText, fontSize: 13, textAlign: 'center' },

  statsRow: { flexDirection: 'row', gap: 12, marginTop: 4 },
  statCard: {
    flex: 1,
    backgroundColor: AppColors.card,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    gap: 6,
  },
  statLabel: { color: AppColors.subText, fontSize: 12, fontWeight: '500' },
  statValue: { color: AppColors.text, fontSize: 13, fontWeight: '700' },

  dataNote: {
    color: AppColors.subText,
    fontSize: 12,
    textAlign: 'center',
    marginTop: 16,
    fontStyle: 'italic',
  },

  timeframeContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 30,
    paddingVertical: 14,
    backgroundColor: AppColors.card,
    borderRadius: 25,
    marginHorizontal: 24,
    marginBottom: 135, // Positioned above the floating tab bar (50 bottom + 75 height + 10 gap)
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
  },
  tfItem: { width: 44, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  tfItemActive: { backgroundColor: AppColors.primaryGreenEnd },
  tfText: { color: AppColors.subText, fontSize: 13, fontWeight: '600' },
  tfTextActive: { color: '#000000' },
});
