/**
 * ForecastScreen.js
 * Sales Forecast & Pipeline — Mobile Optimised
 * API: GET /reports/forecast?from=ISO&to=ISO&ownerFilter=team
 */

import React, { useState, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Modal,
    TextInput,
    Dimensions,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { BorderRadius, Shadow, Spacing } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import { reportsAPI } from '../../api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const TIMEFRAMES = [
    { label: 'This Month', value: 'this_month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'This Quarter', value: 'this_quarter' },
    { label: 'Last Quarter', value: 'last_quarter' },
    { label: 'This Year', value: 'this_year' },
];

const OWNER_FILTERS = [
    { label: 'My Team', value: 'team' },
    { label: 'Just Me', value: 'me' },
];

/** Map a preset timeframe to ISO date range */
const getDateRange = (value) => {
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth();

    const startOf = (year, month) => new Date(year, month, 1);
    const endOf = (year, month) => new Date(year, month + 1, 0, 23, 59, 59, 999);

    switch (value) {
        case 'this_month':
            return { from: startOf(y, m), to: endOf(y, m) };
        case 'last_month':
            return { from: startOf(y, m - 1), to: endOf(y, m - 1) };
        case 'this_quarter': {
            const qStart = Math.floor(m / 3) * 3;
            return { from: startOf(y, qStart), to: endOf(y, qStart + 2) };
        }
        case 'last_quarter': {
            const qStart = Math.floor(m / 3) * 3 - 3;
            return { from: startOf(y, qStart), to: endOf(y, qStart + 2) };
        }
        case 'this_year':
            return { from: startOf(y, 0), to: endOf(y, 11) };
        default:
            return { from: startOf(y, m), to: endOf(y, m) };
    }
};

const formatPeriod = (from, to) => {
    const opts = { day: '2-digit', month: 'short', year: 'numeric' };
    return `${from.toLocaleDateString('en-IN', opts)} – ${to.toLocaleDateString('en-IN', opts)}`;
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (val) => {
    if (!val && val !== 0) return '₹0';
    const n = Number(val);
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
};

const formatINRShort = (val) => {
    const n = Number(val ?? 0);
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n}`;
};

const formatDate = (str) => {
    if (!str) return 'N/A';
    try { return new Date(str).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }); }
    catch { return str; }
};

const getInitials = (name = '') =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

// ─── Sub-components ───────────────────────────────────────────────────────────

const Card = ({ children, style }) => (
    <View style={[styles.card, style]}>{children}</View>
);

const SectionHeader = ({ icon, title }) => (
    <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionIconWrap}>
            <IonIcon name={icon} size={ms(13)} color={Colors.primary} />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
    </View>
);

const Divider = () => <View style={styles.divider} />;

/** Dropdown selector modal */
const SelectorModal = ({ visible, title, options, selected, onSelect, onClose }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
            <TouchableOpacity activeOpacity={1} style={styles.pickerBox}>
                <Text style={styles.pickerTitle}>{title}</Text>
                <Divider />
                {options.map(opt => {
                    const active = opt.value === selected;
                    return (
                        <TouchableOpacity
                            key={opt.value}
                            style={[styles.pickerOption, active && styles.pickerOptionActive]}
                            onPress={() => { onSelect(opt); onClose(); }}
                        >
                            <Text style={[styles.pickerOptionText, active && styles.pickerOptionTextActive]}>
                                {opt.label}
                            </Text>
                            {active && <IonIcon name="checkmark" size={ms(16)} color={Colors.primary} />}
                        </TouchableOpacity>
                    );
                })}
            </TouchableOpacity>
        </TouchableOpacity>
    </Modal>
);

/** KPI summary card 2-column grid */
const MetricCard = ({ label, value, subtitle, icon, accentColor }) => (
    <View style={styles.metricCard}>
        <View style={styles.metricTop}>
            <Text style={styles.metricLabel}>{label}</Text>
            <IonIcon name={icon} size={ms(14)} color={accentColor || Colors.textTertiary} />
        </View>
        <Text style={[styles.metricValue, accentColor && { color: accentColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
        </Text>
        {subtitle ? <Text style={styles.metricSubtitle}>{subtitle}</Text> : null}
    </View>
);

/** Horizontal bar chart for pipeline by stage */
const HorizontalBarChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <View style={styles.chartEmpty}>
                <IonIcon name="bar-chart-outline" size={ms(34)} color={Colors.surfaceBorder} />
                <Text style={styles.chartEmptyText}>No pipeline data</Text>
            </View>
        );
    }
    const maxVal = Math.max(...data.map(d => d.value || d.totalValue || 0), 1);
    const TRACK_W = SCREEN_WIDTH - ms(120);

    return (
        <View>
            {data.map((item, idx) => {
                const val = item.value || item.totalValue || 0;
                const ratio = val / maxVal;
                const barW = Math.max(ratio * TRACK_W, ms(6));
                return (
                    <View key={idx} style={styles.hBarRow}>
                        <Text style={styles.hBarLabel} numberOfLines={1}>{item.stage || item.name || `Stage ${idx + 1}`}</Text>
                        <View style={styles.hBarTrack}>
                            <View style={[styles.hBarFill, { width: barW }]} />
                        </View>
                        <Text style={styles.hBarValue}>{formatINRShort(val)}</Text>
                    </View>
                );
            })}
        </View>
    );
};

/** Vertical bar chart for forecast vs actual */
const VerticalBarChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <View style={styles.chartEmpty}>
                <IonIcon name="trending-up-outline" size={ms(34)} color={Colors.surfaceBorder} />
                <Text style={styles.chartEmptyText}>No chart data available</Text>
            </View>
        );
    }
    const CHART_H = vs(100);
    const maxVal = Math.max(
        ...data.map(d => Math.max(d.forecasted || 0, d.actual || 0)),
        1
    );

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: ms(8) }}>
                {data.map((item, idx) => {
                    const fH = Math.max(((item.forecasted || 0) / maxVal) * CHART_H, ms(2));
                    const aH = Math.max(((item.actual || 0) / maxVal) * CHART_H, ms(2));
                    return (
                        <View key={idx} style={{ flex: 1, alignItems: 'center', flexDirection: 'row', gap: ms(3), justifyContent: 'center' }}>
                            <View style={{ alignItems: 'center' }}>
                                <View style={[styles.vBar, { height: fH, backgroundColor: Colors.primary + 'CC' }]} />
                                <Text style={styles.vBarLabel} numberOfLines={1}>{item.label || item.month || `M${idx + 1}`}</Text>
                            </View>
                            <View style={{ alignItems: 'center' }}>
                                <View style={[styles.vBar, { height: aH, backgroundColor: Colors.success + 'CC' }]} />
                            </View>
                        </View>
                    );
                })}
            </View>
            {/* Legend */}
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                    <Text style={styles.legendText}>Forecasted</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                    <Text style={styles.legendText}>Actual</Text>
                </View>
            </View>
        </View>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ForecastScreen = ({ navigation }) => {
    const [timeframe, setTimeframe] = useState(TIMEFRAMES[0]); // This Month
    const [ownerFilter, setOwnerFilter] = useState(OWNER_FILTERS[0]); // My Team
    const [showTimePicker, setShowTimePicker] = useState(false);
    const [showOwnerPicker, setShowOwnerPicker] = useState(false);
    const [monthlyTarget, setMonthlyTarget] = useState('');
    const [editingTarget, setEditingTarget] = useState(false);

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchData = useCallback(async (tf, of, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const { from, to } = getDateRange(tf.value);
        try {
            const res = await reportsAPI.getForecast({
                from: from.toISOString(),
                to: to.toISOString(),
                ownerFilter: of.value,
            });
            if (res.success) {
                setData(res.data);
                // Pre-fill monthly target from server if provided
                if (res.data?.monthlyTarget && !monthlyTarget) {
                    setMonthlyTarget(String(res.data.monthlyTarget));
                }
            } else {
                setError(res.error || 'Failed to load forecast');
            }
        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchData(timeframe, ownerFilter);
        }, [])
    );

    const onTimeframeSelect = (opt) => {
        setTimeframe(opt);
        fetchData(opt, ownerFilter);
    };

    const onOwnerSelect = (opt) => {
        setOwnerFilter(opt);
        fetchData(timeframe, opt);
    };

    const { from, to } = getDateRange(timeframe.value);

    // ── Derived values ────────────────────────────────────────────────────────

    const forecastedRevenue = data?.forecastedRevenue ?? 0;
    const weightedPipeline = data?.weightedPipeline ?? 0;
    const actualRevenue = data?.actualRevenue ?? 0;
    const target = Number(monthlyTarget) || data?.monthlyTarget || 0;

    const forecastVsTarget = forecastedRevenue - target;
    const actualVsTarget = actualRevenue - target;

    const pipelineByStage = data?.openPipelineByStage || data?.pipelineByStage || [];
    const chartData = data?.forecastVsActual || data?.chartData || [];
    const forecastBySalesRep = data?.forecastBySalesRep || data?.salesRepForecast || [];
    const deals = data?.deals || data?.dealsContributing || [];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* ── Nav Bar ── */}
            <View style={styles.navBar}>
                <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.goBack()}>
                    <IonIcon name="arrow-back" size={ms(20)} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.navCenter}>
                    <Text style={styles.navTitle}>Sales Forecast</Text>
                    <Text style={styles.navSub}>{timeframe.label}</Text>
                </View>
                <TouchableOpacity
                    style={styles.navRefreshBtn}
                    onPress={() => fetchData(timeframe, ownerFilter, true)}
                >
                    <IonIcon name="refresh-outline" size={ms(18)} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* ── Filters ── */}
            <View style={styles.filtersBar}>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setShowTimePicker(true)}>
                    <IonIcon name="time-outline" size={ms(14)} color={Colors.primary} />
                    <Text style={styles.filterBtnText} numberOfLines={1}>{timeframe.label}</Text>
                    <IonIcon name="chevron-down" size={ms(12)} color={Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setShowOwnerPicker(true)}>
                    <IonIcon name="people-outline" size={ms(14)} color={Colors.primary} />
                    <Text style={styles.filterBtnText} numberOfLines={1}>{ownerFilter.label}</Text>
                    <IonIcon name="chevron-down" size={ms(12)} color={Colors.textTertiary} />
                </TouchableOpacity>
            </View>
            <View style={styles.periodBanner}>
                <IonIcon name="calendar-outline" size={ms(12)} color={Colors.textTertiary} />
                <Text style={styles.periodText}>Period: {formatPeriod(from, to)}</Text>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchData(timeframe, ownerFilter, true)}
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
            >
                {loading && !data ? (
                    <View style={styles.centeredState}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.stateText}>Loading forecast…</Text>
                    </View>
                ) : error && !data ? (
                    <Card style={styles.errorCard}>
                        <IonIcon name="alert-circle-outline" size={ms(44)} color={Colors.danger} />
                        <Text style={styles.errorTitle}>Failed to load</Text>
                        <Text style={styles.errorMsg}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(timeframe, ownerFilter)}>
                            <IonIcon name="refresh-outline" size={ms(14)} color="#fff" />
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </Card>
                ) : (
                    <>
                        {/* ══ KPI METRICS 2×2 GRID ══ */}
                        <View style={styles.metricGrid}>
                            <MetricCard
                                label="Forecasted Revenue"
                                value={formatINR(forecastedRevenue)}
                                subtitle="Weighted value of open deals closing in period"
                                icon="analytics-outline"
                                accentColor={Colors.primary}
                            />
                            <MetricCard
                                label="Weighted Pipeline"
                                value={formatINR(weightedPipeline)}
                                subtitle="Sum of (amount × probability / 100)"
                                icon="trending-up-outline"
                                accentColor={Colors.info}
                            />
                            <MetricCard
                                label="Actual Revenue"
                                value={formatINR(actualRevenue)}
                                subtitle="Revenue from won deals (100% probability)"
                                icon="checkmark-done-outline"
                                accentColor={Colors.success}
                            />
                            <MetricCard
                                label="Monthly Target"
                                value={formatINR(target)}
                                subtitle="Editable below"
                                icon="flag-outline"
                                accentColor={Colors.warning}
                            />
                        </View>

                        {/* ══ TARGET TRACKING ══ */}
                        <Card>
                            <SectionHeader icon="trophy-outline" title="Target Tracking" />
                            <Divider />

                            {/* Monthly Target Input */}
                            <View style={styles.targetRow}>
                                <View style={{ flex: 1 }}>
                                    <Text style={styles.targetLabel}>Monthly Target (₹)</Text>
                                    <TextInput
                                        style={styles.targetInput}
                                        value={monthlyTarget}
                                        onChangeText={setMonthlyTarget}
                                        keyboardType="numeric"
                                        placeholder="e.g. 1000000"
                                        placeholderTextColor={Colors.textTertiary}
                                        onSubmitEditing={() => setEditingTarget(false)}
                                    />
                                </View>
                            </View>

                            <View style={styles.trackingRow}>
                                <View style={styles.trackingItem}>
                                    <Text style={styles.trackingLabel}>Forecast vs Target</Text>
                                    <Text style={[
                                        styles.trackingValue,
                                        { color: forecastVsTarget >= 0 ? Colors.success : Colors.danger },
                                    ]}>
                                        {forecastVsTarget >= 0 ? '+' : ''}{formatINR(forecastVsTarget)}
                                    </Text>
                                    <View style={styles.trackingBar}>
                                        <View style={[
                                            styles.trackingBarFill,
                                            {
                                                width: target > 0 ? `${Math.min(100, (forecastedRevenue / target) * 100)}%` : '0%',
                                                backgroundColor: forecastVsTarget >= 0 ? Colors.success : Colors.danger,
                                            },
                                        ]} />
                                    </View>
                                </View>
                                <View style={styles.trackingDivider} />
                                <View style={styles.trackingItem}>
                                    <Text style={styles.trackingLabel}>Actual vs Target</Text>
                                    <Text style={[
                                        styles.trackingValue,
                                        { color: actualVsTarget >= 0 ? Colors.success : Colors.danger },
                                    ]}>
                                        {actualVsTarget >= 0 ? '+' : ''}{formatINR(actualVsTarget)}
                                    </Text>
                                    <View style={styles.trackingBar}>
                                        <View style={[
                                            styles.trackingBarFill,
                                            {
                                                width: target > 0 ? `${Math.min(100, (actualRevenue / target) * 100)}%` : '0%',
                                                backgroundColor: actualVsTarget >= 0 ? Colors.success : Colors.danger,
                                            },
                                        ]} />
                                    </View>
                                </View>
                            </View>
                        </Card>

                        {/* ══ FORECAST VS ACTUAL CHART ══ */}
                        <Card>
                            <SectionHeader icon="bar-chart-outline" title="Forecast vs Actual Revenue" />
                            <Divider />
                            <VerticalBarChart data={chartData} />
                        </Card>

                        {/* ══ OPEN PIPELINE BY STAGE ══ */}
                        <Card>
                            <SectionHeader icon="funnel-outline" title="Open Pipeline by Stage" />
                            <Divider />
                            <HorizontalBarChart data={pipelineByStage} />
                        </Card>

                        {/* ══ FORECAST BY SALES REP ══ */}
                        <Card>
                            <SectionHeader icon="person-outline" title="Forecast by Sales Rep" />
                            <Divider />
                            {forecastBySalesRep.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <IonIcon name="person-outline" size={ms(34)} color={Colors.surfaceBorder} />
                                    <Text style={styles.emptyStateText}>No data available</Text>
                                </View>
                            ) : (
                                forecastBySalesRep.map((rep, idx) => (
                                    <View key={idx} style={[styles.repRow, idx < forecastBySalesRep.length - 1 && { borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder }]}>
                                        <View style={styles.repLeft}>
                                            <View style={styles.repAvatar}>
                                                <Text style={styles.repAvatarText}>{getInitials(rep.name || rep.userName)}</Text>
                                            </View>
                                            <View>
                                                <Text style={styles.repName}>{rep.name || rep.userName}</Text>
                                                <Text style={styles.repPipeline}>Pipeline: {formatINRShort(rep.pipeline || rep.pipelineValue)}</Text>
                                            </View>
                                        </View>
                                        <View style={styles.repRight}>
                                            <Text style={styles.repWeighted}>{formatINRShort(rep.weighted || rep.weightedValue)}</Text>
                                            <Text style={styles.repWeightedLabel}>Weighted</Text>
                                        </View>
                                    </View>
                                ))
                            )}
                        </Card>

                        {/* ══ DEALS CONTRIBUTING ══ */}
                        <Card>
                            <SectionHeader icon="document-text-outline" title="Deals Contributing to Forecast" />
                            <Divider />
                            {deals.length === 0 ? (
                                <View style={styles.emptyState}>
                                    <IonIcon name="document-outline" size={ms(34)} color={Colors.surfaceBorder} />
                                    <Text style={styles.emptyStateText}>
                                        No open deals with expected close date in the selected period.
                                    </Text>
                                </View>
                            ) : (
                                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                    <View>
                                        {/* Table Header */}
                                        <View style={styles.dealsTableHeader}>
                                            <Text style={[styles.dealHeadCell, { width: ms(130) }]}>Deal</Text>
                                            <Text style={styles.dealHeadCell}>Stage</Text>
                                            <Text style={styles.dealHeadCell}>Prob%</Text>
                                            <Text style={styles.dealHeadCell}>Amount</Text>
                                            <Text style={styles.dealHeadCell}>Weighted</Text>
                                            <Text style={styles.dealHeadCell}>Close</Text>
                                        </View>
                                        {deals.map((deal, idx) => (
                                            <View key={idx} style={[styles.dealRow, idx === deals.length - 1 && { borderBottomWidth: 0 }]}>
                                                <View style={{ width: ms(130) }}>
                                                    <Text style={styles.dealName} numberOfLines={1}>{deal.title || deal.name || 'N/A'}</Text>
                                                    <Text style={styles.dealCompany} numberOfLines={1}>{deal.company || deal.companyName || ''}</Text>
                                                </View>
                                                <Text style={styles.dealCell}>{deal.stage || 'N/A'}</Text>
                                                <Text style={[styles.dealCell, { color: Colors.info }]}>{deal.probability ?? 0}%</Text>
                                                <Text style={styles.dealCell}>{formatINR(deal.amount || deal.value)}</Text>
                                                <Text style={[styles.dealCell, { color: Colors.success }]}>{formatINR(deal.weighted || deal.weightedValue)}</Text>
                                                <Text style={styles.dealCell}>{formatDate(deal.closeDate || deal.expectedCloseDate)}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </ScrollView>
                            )}
                        </Card>

                        <View style={{ height: ms(40) }} />
                    </>
                )}
            </ScrollView>

            {/* ── Timeframe Picker ── */}
            <SelectorModal
                visible={showTimePicker}
                title="Select Timeframe"
                options={TIMEFRAMES}
                selected={timeframe.value}
                onSelect={onTimeframeSelect}
                onClose={() => setShowTimePicker(false)}
            />

            {/* ── Owner Filter Picker ── */}
            <SelectorModal
                visible={showOwnerPicker}
                title="Select Owner"
                options={OWNER_FILTERS}
                selected={ownerFilter.value}
                onSelect={onOwnerSelect}
                onClose={() => setShowOwnerPicker(false)}
            />
        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },

    // ── Nav Bar ──
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(14),
        paddingVertical: ms(10),
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
        gap: ms(10),
    },
    navIconBtn: {
        width: ms(36),
        height: ms(36),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.background,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navCenter: { flex: 1 },
    navTitle: {
        fontSize: ms(16),
        fontWeight: '800',
        color: Colors.textPrimary,
        letterSpacing: -0.2,
    },
    navSub: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        fontWeight: '500',
        marginTop: ms(1),
    },
    navRefreshBtn: {
        width: ms(36),
        height: ms(36),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // ── Filters ──
    filtersBar: {
        flexDirection: 'row',
        gap: ms(10),
        paddingHorizontal: ms(14),
        paddingVertical: ms(10),
        backgroundColor: Colors.surface,
        borderBottomWidth: 0,
    },
    filterBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        borderRadius: BorderRadius.md,
        paddingHorizontal: ms(10),
        paddingVertical: ms(9),
        backgroundColor: Colors.background,
    },
    filterBtnText: {
        flex: 1,
        fontSize: ms(13),
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    periodBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(5),
        paddingHorizontal: ms(14),
        paddingBottom: ms(10),
        backgroundColor: Colors.surface,
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    periodText: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        fontWeight: '500',
    },

    // ── Scroll ──
    scrollContent: {
        padding: ms(14),
        gap: ms(12),
    },

    // ── Card ──
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: ms(14),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        ...Shadow.sm,
    },
    divider: {
        height: 1,
        backgroundColor: Colors.surfaceBorder,
        marginVertical: ms(10),
    },

    // ── Section Header ──
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
        marginBottom: ms(4),
    },
    sectionIconWrap: {
        width: ms(26),
        height: ms(26),
        borderRadius: BorderRadius.xs,
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    sectionTitle: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
    },

    // ── Metric Grid ──
    metricGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ms(10),
    },
    metricCard: {
        width: (SCREEN_WIDTH - ms(28) - ms(10)) / 2,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: ms(14),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        ...Shadow.sm,
    },
    metricTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: ms(8),
    },
    metricLabel: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        fontWeight: '600',
        flex: 1,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    metricValue: {
        fontSize: ms(20),
        fontWeight: '900',
        color: Colors.textPrimary,
        letterSpacing: -0.5,
    },
    metricSubtitle: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        lineHeight: ms(14),
        marginTop: ms(4),
    },

    // ── Target Tracking ──
    targetRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(10),
        marginBottom: ms(12),
    },
    targetLabel: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        marginBottom: ms(6),
    },
    targetInput: {
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: ms(12),
        paddingVertical: ms(10),
        fontSize: ms(15),
        fontWeight: '700',
        color: Colors.textPrimary,
        backgroundColor: Colors.background,
    },
    trackingRow: {
        flexDirection: 'row',
        gap: ms(10),
    },
    trackingItem: {
        flex: 1,
    },
    trackingDivider: {
        width: 1,
        backgroundColor: Colors.surfaceBorder,
    },
    trackingLabel: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        fontWeight: '600',
        marginBottom: ms(4),
    },
    trackingValue: {
        fontSize: ms(16),
        fontWeight: '800',
        marginBottom: ms(6),
    },
    trackingBar: {
        height: ms(6),
        backgroundColor: Colors.surfaceBorder,
        borderRadius: ms(3),
        overflow: 'hidden',
    },
    trackingBarFill: {
        height: '100%',
        borderRadius: ms(3),
    },

    // ── Charts ──
    chartEmpty: {
        alignItems: 'center',
        paddingVertical: ms(24),
        gap: ms(8),
    },
    chartEmptyText: {
        fontSize: ms(12),
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },
    hBarRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: ms(10),
        gap: ms(8),
    },
    hBarLabel: {
        width: ms(70),
        fontSize: ms(11),
        color: Colors.textSecondary,
        fontWeight: '600',
        textAlign: 'right',
    },
    hBarTrack: {
        flex: 1,
        height: ms(16),
        backgroundColor: Colors.background,
        borderRadius: ms(4),
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    hBarFill: {
        height: '100%',
        backgroundColor: Colors.primary,
        borderRadius: ms(4),
    },
    hBarValue: {
        width: ms(50),
        fontSize: ms(11),
        color: Colors.textPrimary,
        fontWeight: '700',
    },
    vBar: {
        width: ms(12),
        borderTopLeftRadius: ms(3),
        borderTopRightRadius: ms(3),
    },
    vBarLabel: {
        fontSize: ms(9),
        color: Colors.textTertiary,
        marginTop: ms(3),
        textAlign: 'center',
        fontWeight: '500',
    },
    legendRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: ms(16),
        marginTop: ms(12),
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(5),
    },
    legendDot: {
        width: ms(10),
        height: ms(10),
        borderRadius: ms(5),
    },
    legendText: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        fontWeight: '500',
    },

    // ── Sales Rep ──
    repRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: ms(12),
    },
    repLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(10),
        flex: 1,
    },
    repAvatar: {
        width: ms(34),
        height: ms(34),
        borderRadius: ms(17),
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    repAvatarText: {
        fontSize: ms(12),
        fontWeight: '800',
        color: Colors.primary,
    },
    repName: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    repPipeline: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        marginTop: ms(1),
    },
    repRight: {
        alignItems: 'flex-end',
    },
    repWeighted: {
        fontSize: ms(15),
        fontWeight: '800',
        color: Colors.success,
    },
    repWeightedLabel: {
        fontSize: ms(10),
        color: Colors.textTertiary,
    },

    // ── Deals Table ──
    dealsTableHeader: {
        flexDirection: 'row',
        paddingVertical: ms(8),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    dealHeadCell: {
        width: ms(80),
        fontSize: ms(11),
        fontWeight: '700',
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    dealRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(12),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    dealName: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    dealCompany: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        marginTop: ms(1),
    },
    dealCell: {
        width: ms(80),
        fontSize: ms(12),
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'center',
    },

    // ── States ──
    centeredState: {
        alignItems: 'center',
        paddingVertical: ms(60),
        gap: ms(12),
    },
    stateText: {
        fontSize: ms(14),
        color: Colors.textSecondary,
    },
    errorCard: {
        alignItems: 'center',
        paddingVertical: ms(32),
        gap: ms(8),
    },
    errorTitle: {
        fontSize: ms(16),
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    errorMsg: {
        fontSize: ms(12),
        color: Colors.textSecondary,
        textAlign: 'center',
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
        paddingHorizontal: ms(20),
        paddingVertical: ms(10),
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        marginTop: ms(6),
    },
    retryText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: ms(13),
    },
    emptyState: {
        alignItems: 'center',
        paddingVertical: ms(20),
        gap: ms(8),
    },
    emptyStateText: {
        fontSize: ms(12),
        color: Colors.textTertiary,
        textAlign: 'center',
        lineHeight: ms(18),
    },

    // ── Picker Modal ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: ms(24),
    },
    pickerBox: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        paddingVertical: ms(8),
        paddingHorizontal: ms(4),
        ...Shadow.sm,
    },
    pickerTitle: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.textPrimary,
        paddingHorizontal: ms(16),
        paddingVertical: ms(12),
    },
    pickerOption: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ms(16),
        paddingVertical: ms(13),
    },
    pickerOptionActive: {
        backgroundColor: Colors.primaryBackground,
        borderRadius: BorderRadius.sm,
    },
    pickerOptionText: {
        fontSize: ms(14),
        color: Colors.textPrimary,
        fontWeight: '500',
    },
    pickerOptionTextActive: {
        color: Colors.primary,
        fontWeight: '700',
    },
});

export default ForecastScreen;
