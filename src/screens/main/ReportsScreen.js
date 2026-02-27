/**
 * ReportsScreen.js
 * CRM Analytics Dashboard — Responsive · Live API
 * API: GET /reports/crm-overview?dateFrom=DD/MM/YYYY&dateTo=DD/MM/YYYY
 */

import React, { useState, useCallback } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    RefreshControl,
    Dimensions,
    Modal,
    TextInput,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { reportsAPI } from '../../api';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format number to INR short form */
const formatINR = (val) => {
    if (val === null || val === undefined) return '₹0';
    const n = Number(val);
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
};

/** Format Date object → "DD/MM/YYYY" for API */
const toApiFormat = (date) => {
    const dd = String(date.getDate()).padStart(2, '0');
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const yyyy = date.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
};

/** Format Date object → human-readable "24 Feb 2026" */
const toDisplayFormat = (date) => {
    return date.toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
    });
};

/** Trend formatted string */
const trendStr = (val) => {
    if (!val || val === 0) return '0.0%';
    return `${val > 0 ? '+' : ''}${Number(val).toFixed(1)}%`;
};

// Stage badge colors
const STAGE_COLORS = [
    Colors.primary,
    Colors.info,
    Colors.warning,
    Colors.success,
    '#8B5CF6',
    '#EC4899',
];

// ─── Primitive Components ─────────────────────────────────────────────────────

const Divider = () => <View style={styles.divider} />;

/** Solid section card */
const Card = ({ children, style }) => (
    <View style={[styles.card, style]}>{children}</View>
);

/** Card title row */
const SectionHeader = ({ icon, title, badge }) => (
    <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
            <View style={styles.sectionIconWrap}>
                <IonIcon name={icon} size={ms(13)} color={Colors.primary} />
            </View>
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
        {badge != null && (
            <View style={styles.sectionBadge}>
                <Text style={styles.sectionBadgeText}>{badge}</Text>
            </View>
        )}
    </View>
);

/** Trend pill */
const TrendPill = ({ value = 0 }) => {
    const up = value > 0;
    const down = value < 0;
    const color = up ? Colors.success : down ? Colors.danger : Colors.textTertiary;
    const icon = up ? 'trending-up' : down ? 'trending-down' : 'remove';
    return (
        <View style={[styles.trendPill, { backgroundColor: color + '1A' }]}>
            <IonIcon name={icon} size={ms(8)} color={color} />
            <Text style={[styles.trendText, { color }]}>{trendStr(value)}</Text>
        </View>
    );
};

/** Single KPI card (responsive: 3 per row) */
const KpiCard = ({ icon, iconBg, label, value, trend = 0 }) => (
    <View style={styles.kpiCard}>
        <View style={[styles.kpiIconWrap, { backgroundColor: iconBg || Colors.primaryBackground }]}>
            <IonIcon name={icon} size={ms(16)} color={Colors.primary} />
        </View>
        <Text style={styles.kpiValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {value}
        </Text>
        <Text style={styles.kpiLabel} numberOfLines={2}>{label}</Text>
        <TrendPill value={trend} />
    </View>
);

/** Date picker button */
const DateButton = ({ label, date, onPress }) => (
    <TouchableOpacity style={styles.dateBtn} onPress={onPress} activeOpacity={0.75}>
        <View style={styles.dateBtnLeft}>
            <IonIcon name="calendar-outline" size={ms(15)} color={Colors.primary} />
        </View>
        <View style={styles.dateBtnBody}>
            <Text style={styles.dateBtnLabel}>{label}</Text>
            <Text style={styles.dateBtnValue}>{toDisplayFormat(date)}</Text>
        </View>
        <IonIcon name="chevron-down" size={ms(14)} color={Colors.textTertiary} />
    </TouchableOpacity>
);

// ─── Chart: Horizontal Funnel ─────────────────────────────────────────────────

const FunnelChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <View style={styles.chartEmpty}>
                <IonIcon name="bar-chart-outline" size={ms(34)} color={Colors.surfaceBorder} />
                <Text style={styles.chartEmptyText}>No funnel data</Text>
            </View>
        );
    }

    const maxCount = Math.max(...data.map((d) => d.count || 0), 1);
    const BAR_TRACK = SCREEN_WIDTH - ms(116); // account for label column + card padding

    return (
        <View style={styles.funnelWrap}>
            {data.map((item, idx) => {
                const fillRatio = item.count / maxCount;
                const barW = Math.max(fillRatio * BAR_TRACK, ms(6));
                const color = STAGE_COLORS[idx % STAGE_COLORS.length];
                return (
                    <View key={idx} style={styles.funnelRow}>
                        <Text style={styles.funnelStageLabel} numberOfLines={1}>
                            {item.stage}
                        </Text>
                        <View style={styles.funnelTrack}>
                            <View style={[styles.funnelFill, { width: barW, backgroundColor: color }]}>
                                {item.count > 0 && (
                                    <Text style={styles.funnelCount}>{item.count}</Text>
                                )}
                            </View>
                        </View>
                        <Text style={styles.funnelValue}>{formatINR(item.value)}</Text>
                    </View>
                );
            })}
            {/* X-axis */}
            <View style={styles.funnelAxis}>
                {[0, 0.25, 0.5, 0.75, 1].map((p, i) => (
                    <Text key={i} style={styles.funnelAxLabel}>
                        {Math.round(p * maxCount)}
                    </Text>
                ))}
            </View>
            <View style={styles.legend}>
                <View style={[styles.legendDot, { backgroundColor: Colors.primary }]} />
                <Text style={styles.legendText}>Leads by Stage</Text>
            </View>
        </View>
    );
};

// ─── Chart: Sales by Month ────────────────────────────────────────────────────

const SalesByMonthChart = ({ data }) => {
    if (!data || data.length === 0) {
        return (
            <View style={styles.chartEmpty}>
                <IonIcon name="trending-up-outline" size={ms(34)} color={Colors.surfaceBorder} />
                <Text style={styles.chartEmptyText}>No sales data for this period</Text>
            </View>
        );
    }

    const maxRev = Math.max(...data.map((d) => d.revenue || 0), 1);
    const CHART_H = vs(90);

    return (
        <View>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: CHART_H, gap: ms(5) }}>
                {data.map((item, idx) => {
                    const h = Math.max(((item.revenue || 0) / maxRev) * CHART_H, ms(4));
                    return (
                        <View key={idx} style={{ flex: 1, alignItems: 'center' }}>
                            <View style={[styles.monthBar, { height: h }]} />
                            <Text style={styles.monthLabel} numberOfLines={1}>
                                {item.month || item.label || `M${idx + 1}`}
                            </Text>
                        </View>
                    );
                })}
            </View>
            <View style={[styles.legend, { marginTop: ms(10) }]}>
                <View style={[styles.legendDot, { backgroundColor: Colors.success }]} />
                <Text style={styles.legendText}>Revenue</Text>
            </View>
        </View>
    );
};

// ─── Table Components ─────────────────────────────────────────────────────────

const TableHeader = ({ cols }) => (
    <View style={styles.tableHeader}>
        {cols.map((col, i) => (
            <Text
                key={i}
                style={[
                    styles.tableHeaderCell,
                    i === 0 ? styles.colMain : styles.colNum,
                ]}
            >
                {col}
            </Text>
        ))}
    </View>
);

const SourceRow = ({ item, isLast }) => (
    <View style={[styles.tableRow, isLast && styles.tableRowLast]}>
        <View style={styles.colMain}>
            <Text style={styles.tableRowMain}>{item.source || 'Unknown'}</Text>
        </View>
        <Text style={[styles.tableRowNum]}>{item.leadsCount ?? 0}</Text>
        <Text style={[styles.tableRowNum, { color: Colors.info, fontWeight: '700' }]}>
            {item.convertedCount ?? 0}
        </Text>
        <View style={[styles.colNum, { alignItems: 'center' }]}>
            <View style={styles.pctBadge}>
                <Text style={styles.pctText}>{(item.conversionRate ?? 0).toFixed(1)}%</Text>
            </View>
        </View>
        <Text style={styles.tableRowNum}>{formatINR(item.totalValue)}</Text>
    </View>
);

const UserRow = ({ item, isLast }) => {
    const initials = (item.userName || 'U')
        .split(' ')
        .map((w) => w[0])
        .slice(0, 2)
        .join('')
        .toUpperCase();

    return (
        <View style={[styles.tableRow, isLast && styles.tableRowLast]}>
            <View style={[styles.colMain, { flexDirection: 'row', alignItems: 'center', gap: ms(7) }]}>
                <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{initials}</Text>
                </View>
                <Text style={styles.tableRowMain} numberOfLines={1}>
                    {item.userName || 'Unknown'}
                </Text>
            </View>
            <Text style={styles.tableRowNum}>{item.leadsAssigned ?? 0}</Text>
            <Text style={[styles.tableRowNum, { color: Colors.info, fontWeight: '700' }]}>
                {item.dealsWon ?? 0}
            </Text>
            <View style={[styles.colNum, { alignItems: 'center' }]}>
                <View style={styles.pctBadge}>
                    <Text style={styles.pctText}>{(item.winRate ?? 0).toFixed(1)}%</Text>
                </View>
            </View>
            <Text style={styles.tableRowNum}>{formatINR(item.revenueClosed)}</Text>
        </View>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const ReportsScreen = ({ navigation }) => {
    const today = new Date();
    const yearStart = new Date(today.getFullYear(), 0, 1);

    const [fromDate, setFromDate] = useState(yearStart);
    const [toDate, setToDate] = useState(today);

    // Simple modal date picker state
    const [pickerOpen, setPickerOpen] = useState(null); // 'from' | 'to' | null
    const [inputDay, setInputDay] = useState('');
    const [inputMonth, setInputMonth] = useState('');
    const [inputYear, setInputYear] = useState('');

    const [reportData, setReportData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchReport = useCallback(async (from, to, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const res = await reportsAPI.getCrmOverview({
                dateFrom: toApiFormat(from),
                dateTo: toApiFormat(to),
            });
            if (res.success) {
                setReportData(res.data);
            } else {
                setError(res.error || 'Failed to load report');
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
            fetchReport(fromDate, toDate);
        }, [])
    );

    // ── Simple modal date picker handlers ─────────────────────────────────────

    const openPicker = (field) => {
        const d = field === 'from' ? fromDate : toDate;
        setInputDay(String(d.getDate()).padStart(2, '0'));
        setInputMonth(String(d.getMonth() + 1).padStart(2, '0'));
        setInputYear(String(d.getFullYear()));
        setPickerOpen(field);
    };

    const confirmPicker = () => {
        const day = parseInt(inputDay, 10);
        const month = parseInt(inputMonth, 10);
        const year = parseInt(inputYear, 10);

        if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) {
            Alert.alert('Invalid Date', 'Please enter a valid date (DD / MM / YYYY).');
            return;
        }

        const selected = new Date(year, month - 1, day);
        setPickerOpen(null);

        if (pickerOpen === 'from') {
            const d = selected > toDate ? toDate : selected;
            setFromDate(d);
            fetchReport(d, toDate);
        } else {
            const d = selected < fromDate ? fromDate : selected;
            setToDate(d);
            fetchReport(fromDate, d);
        }
    };

    const handleReset = () => {
        setFromDate(yearStart);
        setToDate(today);
        fetchReport(yearStart, today);
    };

    // ── Computed KPI data ─────────────────────────────────────────────────────

    const ov = reportData?.overview || {};
    const kpiItems = [
        {
            icon: 'people-outline',
            iconBg: Colors.infoBg,
            label: 'Total Leads',
            value: String(ov.totalLeads ?? 0),
            trend: ov.totalLeadsTrend,
        },
        {
            icon: 'stats-chart-outline',
            iconBg: Colors.successBg,
            label: 'Conversion Rate',
            value: `${(ov.conversionRate ?? 0).toFixed(1)}%`,
            trend: ov.conversionRateTrend,
        },
        {
            icon: 'bar-chart-outline',
            iconBg: Colors.primaryBackground,
            label: 'Pipeline Value',
            value: formatINR(ov.pipelineValue),
            trend: ov.pipelineValueTrend,
        },
        {
            icon: 'cash-outline',
            iconBg: Colors.successBg,
            label: 'Closed Won',
            value: formatINR(ov.closedWonValue),
            trend: ov.closedWonTrend,
        },
        {
            icon: 'time-outline',
            iconBg: Colors.warningBg,
            label: 'Avg Sales Cycle',
            value: `${ov.avgSalesCycle ?? 0}d`,
            trend: ov.avgSalesCycleTrend,
        },
        {
            icon: 'person-outline',
            iconBg: Colors.infoBg,
            label: 'Active Contacts',
            value: String(ov.activeContacts ?? 0),
            trend: ov.activeContactsTrend,
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* ── Navigation Bar ── */}
            <View style={styles.navBar}>
                <TouchableOpacity style={styles.navBack} onPress={() => navigation.goBack()}>
                    <IonIcon name="arrow-back" size={ms(20)} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.navCenter}>
                    <Text style={styles.navTitle}>Reports & Analytics</Text>
                    <Text style={styles.navSub}>
                        {toDisplayFormat(fromDate)} – {toDisplayFormat(toDate)}
                    </Text>
                </View>
                <TouchableOpacity style={styles.navReset} onPress={handleReset}>
                    <IonIcon name="refresh-outline" size={ms(18)} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchReport(fromDate, toDate, true)}
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* ══ DATE FILTER CARD ══ */}
                <Card>
                    <SectionHeader icon="calendar-outline" title="Date Range" />
                    <Divider />
                    <View style={styles.dateRow}>
                        <View style={{ flex: 1 }}>
                            <DateButton label="From" date={fromDate} onPress={() => openPicker('from')} />
                        </View>
                        <View style={styles.dateArrow}>
                            <IonIcon name="arrow-forward" size={ms(14)} color={Colors.textTertiary} />
                        </View>
                        <View style={{ flex: 1 }}>
                            <DateButton label="To" date={toDate} onPress={() => openPicker('to')} />
                        </View>
                    </View>
                    <TouchableOpacity
                        style={[styles.applyBtn, loading && { opacity: 0.65 }]}
                        onPress={() => fetchReport(fromDate, toDate)}
                        disabled={loading}
                        activeOpacity={0.8}
                    >
                        {loading ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <>
                                <IonIcon name="search-outline" size={ms(15)} color="#fff" />
                                <Text style={styles.applyBtnText}>Fetch Report</Text>
                            </>
                        )}
                    </TouchableOpacity>
                </Card>

                {/* ══ REPORTS MODULE NAV ══ */}
                <Card style={{ paddingHorizontal: 0, paddingBottom: ms(6) }}>
                    <View style={{ paddingHorizontal: ms(14) }}>
                        <SectionHeader icon="grid-outline" title="Reports Module" />
                    </View>
                    <Divider />
                    {[
                        {
                            icon: 'bar-chart-outline',
                            label: 'Overview',
                            sub: 'CRM analytics & funnel',
                            accent: Colors.primary,
                            bg: Colors.primaryBackground,
                            route: null, // current screen
                        },
                        {
                            icon: 'people-outline',
                            label: 'Team Performance',
                            sub: 'Agent metrics & leaderboard',
                            accent: Colors.info,
                            bg: Colors.infoBg,
                            route: 'TeamPerformance',
                        },
                        {
                            icon: 'trending-up-outline',
                            label: 'Forecast',
                            sub: 'Pipeline & revenue projection',
                            accent: Colors.success,
                            bg: Colors.successBg,
                            route: 'Forecast',
                        },
                        {
                            icon: 'call-outline',
                            label: 'Smart Call Dashboard',
                            sub: 'Call quality & agent performance',
                            accent: Colors.warning,
                            bg: Colors.warningBg,
                            route: 'SmartCallDashboard',
                        },
                    ].map((item, idx, arr) => {
                        const isActive = item.route === null;
                        return (
                            <TouchableOpacity
                                key={idx}
                                style={[
                                    styles.moduleRow,
                                    isActive && styles.moduleRowActive,
                                    idx === arr.length - 1 && { borderBottomWidth: 0 },
                                ]}
                                onPress={() => !isActive && navigation.navigate(item.route)}
                                activeOpacity={isActive ? 1 : 0.7}
                            >
                                <View style={[styles.moduleRowIcon, { backgroundColor: item.bg }]}>
                                    <IonIcon name={item.icon} size={ms(17)} color={item.accent} />
                                </View>
                                <View style={styles.moduleRowText}>
                                    <Text style={[styles.moduleRowLabel, isActive && { color: item.accent }]}>
                                        {item.label}
                                    </Text>
                                    <Text style={styles.moduleRowSub}>{item.sub}</Text>
                                </View>
                                {isActive ? (
                                    <View style={[styles.moduleActiveDot, { backgroundColor: item.accent }]} />
                                ) : (
                                    <IonIcon name="chevron-forward" size={ms(14)} color={Colors.textTertiary} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </Card>


                {/* ── Date Picker Modal ──
 */}
                <Modal
                    visible={pickerOpen !== null}
                    transparent
                    animationType="fade"
                    onRequestClose={() => setPickerOpen(null)}
                >
                    <TouchableOpacity
                        style={styles.modalOverlay}
                        activeOpacity={1}
                        onPress={() => setPickerOpen(null)}
                    >
                        <TouchableOpacity activeOpacity={1} style={styles.modalBox}>
                            <View style={styles.modalHeader}>
                                <IonIcon name="calendar-outline" size={ms(18)} color={Colors.primary} />
                                <Text style={styles.modalTitle}>
                                    Select {pickerOpen === 'from' ? 'From' : 'To'} Date
                                </Text>
                            </View>

                            <View style={styles.dateInputRow}>
                                <View style={styles.dateInputBlock}>
                                    <Text style={styles.dateInputLabel}>Day</Text>
                                    <TextInput
                                        style={styles.dateInput}
                                        value={inputDay}
                                        onChangeText={setInputDay}
                                        keyboardType="numeric"
                                        maxLength={2}
                                        placeholder="DD"
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                                <Text style={styles.dateInputSep}>/</Text>
                                <View style={styles.dateInputBlock}>
                                    <Text style={styles.dateInputLabel}>Month</Text>
                                    <TextInput
                                        style={styles.dateInput}
                                        value={inputMonth}
                                        onChangeText={setInputMonth}
                                        keyboardType="numeric"
                                        maxLength={2}
                                        placeholder="MM"
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                                <Text style={styles.dateInputSep}>/</Text>
                                <View style={[styles.dateInputBlock, { flex: 1.5 }]}>
                                    <Text style={styles.dateInputLabel}>Year</Text>
                                    <TextInput
                                        style={styles.dateInput}
                                        value={inputYear}
                                        onChangeText={setInputYear}
                                        keyboardType="numeric"
                                        maxLength={4}
                                        placeholder="YYYY"
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                            </View>

                            <View style={styles.modalBtnRow}>
                                <TouchableOpacity
                                    style={styles.modalCancelBtn}
                                    onPress={() => setPickerOpen(null)}
                                >
                                    <Text style={styles.modalCancelText}>Cancel</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.modalConfirmBtn}
                                    onPress={confirmPicker}
                                >
                                    <Text style={styles.modalConfirmText}>Confirm</Text>
                                </TouchableOpacity>
                            </View>
                        </TouchableOpacity>
                    </TouchableOpacity>
                </Modal>

                {/* ── Content gating ── */}
                {loading && !reportData ? (
                    <View style={styles.loadingState}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.loadingText}>Generating report…</Text>
                    </View>
                ) : error && !reportData ? (
                    <Card style={styles.errorCard}>
                        <IonIcon name="alert-circle-outline" size={ms(44)} color={Colors.danger} />
                        <Text style={styles.errorTitle}>Failed to load</Text>
                        <Text style={styles.errorMsg}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchReport(fromDate, toDate)}>
                            <IonIcon name="refresh-outline" size={ms(14)} color="#fff" />
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </Card>
                ) : reportData ? (
                    <>
                        {/* ══ KPI METRICS ══ */}
                        <Card>
                            <SectionHeader icon="pulse-outline" title="Key Metrics" />
                            <Divider />
                            <View style={styles.kpiGrid}>
                                {kpiItems.map((item, idx) => (
                                    <KpiCard key={idx} {...item} />
                                ))}
                            </View>
                        </Card>

                        {/* ══ PIPELINE HIGHLIGHTS ══ */}
                        <View style={styles.highlightRow}>
                            <View style={[styles.highlightCard, { backgroundColor: Colors.primaryBackground }]}>
                                <IonIcon name="bar-chart" size={ms(22)} color={Colors.primary} />
                                <Text style={[styles.highlightValue, { color: Colors.primary }]}>
                                    {formatINR(ov.pipelineValue)}
                                </Text>
                                <Text style={styles.highlightLabel}>Pipeline</Text>
                            </View>
                            <View style={[styles.highlightCard, { backgroundColor: Colors.successBg }]}>
                                <IonIcon name="trophy" size={ms(22)} color={Colors.success} />
                                <Text style={[styles.highlightValue, { color: Colors.success }]}>
                                    {formatINR(ov.closedWonValue)}
                                </Text>
                                <Text style={styles.highlightLabel}>Won</Text>
                            </View>
                            <View style={[styles.highlightCard, { backgroundColor: Colors.infoBg }]}>
                                <IonIcon name="people" size={ms(22)} color={Colors.info} />
                                <Text style={[styles.highlightValue, { color: Colors.info }]}>
                                    {ov.activeContacts ?? 0}
                                </Text>
                                <Text style={styles.highlightLabel}>Contacts</Text>
                            </View>
                        </View>

                        {/* ══ SALES FUNNEL ══ */}
                        <Card>
                            <SectionHeader
                                icon="funnel-outline"
                                title="Sales Funnel by Stage"
                                badge={reportData.conversionFunnel?.length || 0}
                            />
                            <Divider />
                            <FunnelChart data={reportData.conversionFunnel} />
                        </Card>

                        {/* ══ SALES BY MONTH ══ */}
                        <Card>
                            <SectionHeader icon="trending-up-outline" title="Sales by Month" />
                            <Divider />
                            <SalesByMonthChart data={reportData.salesByMonth} />
                        </Card>

                        {/* ══ LEAD SOURCE PERFORMANCE ══ */}
                        <Card>
                            <SectionHeader
                                icon="git-branch-outline"
                                title="Lead Source Performance"
                                badge={reportData.leadSourceStats?.length || 0}
                            />
                            <Divider />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View>
                                    <TableHeader cols={['Source', 'Leads', 'Conv.', 'Conv.%', 'Value']} />
                                    {reportData.leadSourceStats && reportData.leadSourceStats.length > 0
                                        ? reportData.leadSourceStats.map((item, idx) => (
                                            <SourceRow
                                                key={idx}
                                                item={item}
                                                isLast={idx === reportData.leadSourceStats.length - 1}
                                            />
                                        ))
                                        : (
                                            <View style={styles.tableEmpty}>
                                                <Text style={styles.tableEmptyText}>No lead source data</Text>
                                            </View>
                                        )}
                                </View>
                            </ScrollView>
                        </Card>

                        {/* ══ USER PERFORMANCE ══ */}
                        <Card>
                            <SectionHeader
                                icon="people-circle-outline"
                                title="User Performance"
                                badge={reportData.userPerformance?.length || 0}
                            />
                            <Divider />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View>
                                    <TableHeader cols={['User', 'Leads', 'Won', 'Win%', 'Revenue']} />
                                    {reportData.userPerformance && reportData.userPerformance.length > 0
                                        ? reportData.userPerformance.map((item, idx) => (
                                            <UserRow
                                                key={idx}
                                                item={item}
                                                isLast={idx === reportData.userPerformance.length - 1}
                                            />
                                        ))
                                        : (
                                            <View style={styles.tableEmpty}>
                                                <Text style={styles.tableEmptyText}>No user performance data</Text>
                                            </View>
                                        )}
                                </View>
                            </ScrollView>
                        </Card>

                        {/* ══ COMMUNICATION OVERVIEW (optional) ══ */}
                        {reportData.communicationOverview && (
                            <Card>
                                <SectionHeader icon="chatbubbles-outline" title="Communication" />
                                <Divider />
                                <View style={styles.commGrid}>
                                    {Object.entries(reportData.communicationOverview).map(([key, val], idx) => (
                                        <View key={idx} style={styles.commItem}>
                                            <Text style={styles.commVal}>{val ?? 0}</Text>
                                            <Text style={styles.commLbl}>
                                                {key.replace(/([A-Z])/g, ' $1').trim()}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </Card>
                        )}
                    </>
                ) : null}

                <View style={{ height: ms(40) }} />
            </ScrollView>
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
    navBack: {
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
        marginTop: ms(1),
        fontWeight: '500',
    },
    navReset: {
        width: ms(36),
        height: ms(36),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
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

    // ── Divider ──
    divider: {
        height: 1,
        backgroundColor: Colors.surfaceBorder,
        marginVertical: ms(10),
    },

    // ── Section Header ──
    sectionHeaderRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: ms(10),
    },
    sectionHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
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
    sectionBadge: {
        backgroundColor: Colors.primaryBackground,
        borderRadius: BorderRadius.full,
        paddingHorizontal: ms(8),
        paddingVertical: ms(2),
        borderWidth: 1,
        borderColor: Colors.primaryBorder,
    },
    sectionBadgeText: {
        fontSize: ms(10),
        fontWeight: '700',
        color: Colors.primary,
    },

    // ── Trend Pill ──
    trendPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(3),
        paddingHorizontal: ms(5),
        paddingVertical: ms(2),
        borderRadius: BorderRadius.full,
        marginTop: ms(5),
        alignSelf: 'flex-start',
    },
    trendText: {
        fontSize: ms(9),
        fontWeight: '700',
    },

    // ── Date Picker ──
    dateRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
        marginBottom: ms(12),
    },
    dateArrow: {
        paddingTop: ms(16),
    },
    dateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        overflow: 'hidden',
    },
    dateBtnLeft: {
        width: ms(38),
        height: ms(50),
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
        borderRightWidth: 1,
        borderRightColor: Colors.primaryBorder,
    },
    dateBtnBody: {
        flex: 1,
        paddingHorizontal: ms(10),
    },
    dateBtnLabel: {
        fontSize: ms(9),
        fontWeight: '600',
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.4,
    },
    dateBtnValue: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginTop: ms(2),
    },
    applyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ms(7),
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
        paddingVertical: ms(12),
    },
    applyBtnText: {
        color: '#fff',
        fontSize: ms(14),
        fontWeight: '700',
    },

    // ── iOS Picker Card ──
    iosPickerCard: {
        padding: 0,
        overflow: 'hidden',
    },
    iosPickerHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: ms(16),
        paddingVertical: ms(12),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    iosPickerTitle: {
        fontSize: ms(15),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    iosPickerDone: {
        backgroundColor: Colors.primary,
        paddingHorizontal: ms(16),
        paddingVertical: ms(6),
        borderRadius: BorderRadius.md,
    },
    iosPickerDoneText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: ms(13),
    },

    // ── KPI Grid (3 cards × 2 rows) ──
    kpiGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ms(9),
    },
    kpiCard: {
        width: (SCREEN_WIDTH - ms(28) * 2 - ms(9) * 2) / 3,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        padding: ms(11),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        alignItems: 'flex-start',
    },
    kpiIconWrap: {
        width: ms(30),
        height: ms(30),
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: ms(8),
    },
    kpiValue: {
        fontSize: ms(15),
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    kpiLabel: {
        fontSize: ms(9),
        color: Colors.textTertiary,
        fontWeight: '600',
        marginTop: ms(2),
        lineHeight: ms(13),
    },

    // ── Highlight Strip ──
    highlightRow: {
        flexDirection: 'row',
        gap: ms(9),
    },
    highlightCard: {
        flex: 1,
        borderRadius: BorderRadius.md,
        padding: ms(12),
        alignItems: 'center',
        gap: ms(4),
    },
    highlightValue: {
        fontSize: ms(14),
        fontWeight: '800',
    },
    highlightLabel: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        fontWeight: '600',
    },

    // ── Funnel Chart ──
    funnelWrap: { gap: ms(9) },
    funnelRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
    },
    funnelStageLabel: {
        width: ms(60),
        fontSize: ms(10),
        color: Colors.textSecondary,
        fontWeight: '500',
        textAlign: 'right',
    },
    funnelTrack: {
        flex: 1,
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.xs,
        overflow: 'hidden',
    },
    funnelFill: {
        height: ms(24),
        borderRadius: BorderRadius.xs,
        justifyContent: 'center',
        paddingHorizontal: ms(6),
        minWidth: ms(6),
    },
    funnelCount: {
        color: '#fff',
        fontSize: ms(10),
        fontWeight: '700',
    },
    funnelValue: {
        width: ms(50),
        fontSize: ms(10),
        color: Colors.textTertiary,
        fontWeight: '500',
        textAlign: 'left',
    },
    funnelAxis: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingTop: ms(5),
        marginLeft: ms(68),
        borderTopWidth: 1,
        borderTopColor: Colors.surfaceBorder,
    },
    funnelAxLabel: {
        fontSize: ms(8),
        color: Colors.textTertiary,
    },
    legend: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: ms(6),
    },
    legendDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
    },
    legendText: {
        fontSize: ms(10),
        color: Colors.textSecondary,
        fontWeight: '500',
    },

    // ── Month Bar ──
    monthBar: {
        width: '70%',
        backgroundColor: Colors.success,
        borderRadius: BorderRadius.xs,
    },
    monthLabel: {
        fontSize: ms(8),
        color: Colors.textTertiary,
        marginTop: ms(4),
        textAlign: 'center',
    },

    // ── Tables ──
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: ms(8),
        paddingHorizontal: ms(4),
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.xs,
        marginBottom: ms(2),
        minWidth: SCREEN_WIDTH - ms(60),
    },
    tableHeaderCell: {
        fontSize: ms(9),
        fontWeight: '700',
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    colMain: {
        width: ms(110),
        paddingHorizontal: ms(4),
    },
    colNum: {
        width: ms(60),
        textAlign: 'center',
        paddingHorizontal: ms(4),
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(10),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
        minWidth: SCREEN_WIDTH - ms(60),
    },
    tableRowLast: { borderBottomWidth: 0 },
    tableRowMain: {
        fontSize: ms(12),
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    tableRowNum: {
        width: ms(60),
        fontSize: ms(12),
        color: Colors.textSecondary,
        fontWeight: '500',
        textAlign: 'center',
    },
    pctBadge: {
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.full,
        paddingHorizontal: ms(7),
        paddingVertical: ms(2),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    pctText: {
        fontSize: ms(9),
        fontWeight: '700',
        color: Colors.textSecondary,
    },
    userAvatar: {
        width: ms(24),
        height: ms(24),
        borderRadius: ms(12),
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
        flexShrink: 0,
    },
    userAvatarText: {
        fontSize: ms(8),
        fontWeight: '800',
        color: Colors.primary,
    },
    tableEmpty: {
        paddingVertical: ms(20),
        alignItems: 'center',
    },
    tableEmptyText: {
        fontSize: ms(12),
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },

    // ── Communication ──
    commGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: ms(9),
    },
    commItem: {
        width: '30%',
        alignItems: 'center',
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        paddingVertical: ms(12),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    commVal: {
        fontSize: ms(20),
        fontWeight: '800',
        color: Colors.textPrimary,
    },
    commLbl: {
        fontSize: ms(9),
        color: Colors.textTertiary,
        marginTop: ms(3),
        textAlign: 'center',
        textTransform: 'capitalize',
    },

    // ── Loading / Error ──
    loadingState: {
        alignItems: 'center',
        paddingVertical: ms(48),
        gap: ms(12),
    },
    loadingText: {
        fontSize: ms(14),
        color: Colors.textSecondary,
        fontWeight: '500',
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
        lineHeight: ms(18),
    },
    retryBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
        marginTop: ms(8),
        paddingHorizontal: ms(22),
        paddingVertical: ms(10),
        backgroundColor: Colors.primary,
        borderRadius: BorderRadius.md,
    },
    retryText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: ms(13),
    },

    // ── Chart: empty state ──
    chartEmpty: {
        alignItems: 'center',
        paddingVertical: ms(28),
        gap: ms(8),
    },
    chartEmptyText: {
        fontSize: ms(12),
        color: Colors.textTertiary,
        fontStyle: 'italic',
    },

    // ── Date Picker Modal ──
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: ms(24),
    },
    modalBox: {
        width: '100%',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: ms(20),
        ...Shadow.sm,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
        marginBottom: ms(18),
    },
    modalTitle: {
        fontSize: ms(15),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    dateInputRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: ms(4),
        marginBottom: ms(20),
    },
    dateInputBlock: {
        flex: 1,
    },
    dateInputLabel: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        fontWeight: '600',
        marginBottom: ms(4),
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },
    dateInput: {
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: ms(10),
        paddingVertical: ms(10),
        fontSize: ms(16),
        fontWeight: '700',
        color: Colors.textPrimary,
        textAlign: 'center',
        backgroundColor: Colors.background,
    },
    dateInputSep: {
        fontSize: ms(18),
        color: Colors.textTertiary,
        fontWeight: '700',
        paddingBottom: ms(10),
    },
    modalBtnRow: {
        flexDirection: 'row',
        gap: ms(10),
    },
    modalCancelBtn: {
        flex: 1,
        paddingVertical: ms(12),
        borderRadius: BorderRadius.md,
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: ms(14),
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    modalConfirmBtn: {
        flex: 1,
        paddingVertical: ms(12),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary,
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: ms(14),
        fontWeight: '700',
        color: '#fff',
    },

    // ── Module Nav List (sidebar-style) ──
    moduleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: ms(14),
        paddingVertical: ms(13),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
        gap: ms(12),
    },
    moduleRowActive: {
        backgroundColor: Colors.primaryBackground,
    },
    moduleRowIcon: {
        width: ms(38),
        height: ms(38),
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
    },
    moduleRowText: {
        flex: 1,
    },
    moduleRowLabel: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    moduleRowSub: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        marginTop: ms(2),
        fontWeight: '400',
    },
    moduleActiveDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
    },
});

export default ReportsScreen;
