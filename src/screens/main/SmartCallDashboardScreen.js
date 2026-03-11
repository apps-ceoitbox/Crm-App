/**
 * SmartCallDashboardScreen.js
 * Smart Call Dashboard — Mobile Optimised
 * API: GET /settings/calling-integration/webhook-delivery-dashboard
 *      ?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD&limit=100&callType=all
 */

import React, { useState, useCallback } from 'react';
import {
    View, Text, StyleSheet, TouchableOpacity, ScrollView,
    ActivityIndicator, RefreshControl, Modal, TextInput,
    Alert, Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import { reportsAPI } from '../../api';
import DateTimePicker from '@react-native-community/datetimepicker';


const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_TYPES = [
    { label: 'All call types', value: 'all' },
    { label: 'Incoming', value: 'incoming' },
    { label: 'Outgoing', value: 'outgoing' },
    { label: 'Missed', value: 'missed' },
    { label: 'Rejected', value: 'rejected' },
];

const DATE_PRESETS = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Custom Range', value: 'custom' },
];


// ─── Helpers ──────────────────────────────────────────────────────────────────

const toYMD = (d) => {
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${d.getFullYear()}-${mm}-${dd}`;
};

const toDisplay = (ymd) => {
    if (!ymd) return '';
    const [y, m, d] = ymd.split('-');
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return `${d} ${months[parseInt(m, 10) - 1]} ${y}`;
};

const parseYMD = (ymd) => {
    if (!ymd) return new Date();
    const [y, m, d] = ymd.split('-');
    return new Date(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10));
};


const getPresetDates = (value) => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    const day = now.getDay(); // 0 (Sun) to 6 (Sat)

    switch (value) {
        case 'today': return { from: toYMD(now), to: toYMD(now) };
        case 'this_week': {
            const start = new Date(now);
            // Adjust to Monday (assuming week starts on Monday)
            const diff = now.getDay() === 0 ? 6 : now.getDay() - 1;
            start.setDate(now.getDate() - diff);
            return { from: toYMD(start), to: toYMD(now) };
        }
        case 'this_month':
            return { from: toYMD(new Date(y, m, 1)), to: toYMD(now) };
        default: return { from: toYMD(now), to: toYMD(now) };
    }
};


const fmtDuration = (secs) => {
    if (!secs && secs !== 0) return '—';
    const s = Number(secs);
    if (isNaN(s)) return secs; // already formatted like "0:52"
    const m = Math.floor(s / 60);
    const ss = String(Math.floor(s % 60)).padStart(2, '0');
    return `${m}:${ss}`;
};

const pct = (v) => `${Number(v ?? 0).toFixed(1)}%`;
const getInitials = (name = '') =>
    name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase() || '?';

// ─── Shared UI ────────────────────────────────────────────────────────────────

const Card = ({ children, style }) => (
    <View style={[styles.card, style]}>{children}</View>
);
const Divider = () => <View style={styles.divider} />;

const SectionHeader = ({ icon, title, accent }) => (
    <View style={styles.secHeaderRow}>
        <View style={[styles.secIconWrap, accent && { backgroundColor: accent + '22' }]}>
            <IonIcon name={icon} size={ms(13)} color={accent || Colors.primary} />
        </View>
        <Text style={styles.secTitle}>{title}</Text>
    </View>
);

/** Preset + call type picker modal */
const SelectorModal = ({ visible, title, options, selected, onSelect, onClose }) => (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
        <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
            <View style={styles.pickerBox}>
                <View style={styles.pickerContent}>
                    {options.map(opt => {
                        const active = opt.value === selected;
                        return (
                            <TouchableOpacity
                                key={opt.value}
                                style={[styles.pickerOption, active && styles.pickerOptionActive]}
                                onPress={() => { onSelect(opt); onClose(); }}
                            >
                                {active && (
                                    <IonIcon name="checkmark" size={ms(18)} color="#00875A" style={styles.pickerCheck} />
                                )}
                                <Text style={[styles.pickerOptionText, active && styles.pickerOptionTextActive]}>
                                    {opt.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </View>
        </TouchableOpacity>
    </Modal>
);


/** Custom date entry modal (DD / MM / YYYY) */
/** Removed manual DateInputModal in favor of native picker */


// ─── KPI Hero Card ────────────────────────────────────────────────────────────

// ─── KPI Hero Card ────────────────────────────────────────────────────────────

const KpiHeroCard = ({ label, value, sub, icon, iconBg, iconColor, accent }) => (
    <View style={styles.kpiHero}>
        <View style={styles.kpiHeroTop}>
            <View style={[styles.kpiHeroIcon, { backgroundColor: iconBg || Colors.primaryBackground }]}>
                <IonIcon name={icon} size={ms(18)} color={iconColor || Colors.primary} />
            </View>
            <View style={styles.kpiHeroTextWrap}>
                <Text style={styles.kpiHeroLabel}>{label}</Text>
                {sub ? <Text style={styles.kpiHeroSubText}>{sub}</Text> : null}
            </View>
        </View>
        <Text style={[styles.kpiHeroValue, accent && { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
        </Text>
    </View>
);


// ─── Quality Metric Tile ──────────────────────────────────────────────────────

const QualityTile = ({ icon, iconColor, label, value }) => (
    <View style={styles.qualityTile}>
        <View style={styles.qualityTileTop}>
            <IonIcon name={icon} size={ms(12)} color={iconColor || Colors.textTertiary} />
            <Text style={styles.qualityTileLabel}>{label}</Text>
        </View>
        <Text style={styles.qualityTileValue}>{value ?? '—'}</Text>
    </View>
);

// ─── Leaderboard Row ──────────────────────────────────────────────────────────

const RANK_CONFIG = [
    { bg: '#FEF9C3', icon: 'trophy', color: '#D97706' },   // 1st — gold
    { bg: '#F1F5F9', icon: 'medal', color: '#64748B' },    // 2nd — silver
    { bg: '#FFF7ED', icon: 'medal', color: '#B45309' },    // 3rd — bronze
];

const LeaderboardRow = ({ item, rank, isLast }) => {
    const cfg = RANK_CONFIG[rank - 1];
    return (
        <View style={[
            styles.lbRow,
            cfg && { backgroundColor: cfg.bg + '44' }, // Subtle tint for top 3
            isLast && { borderBottomWidth: 0 },
        ]}>
            <View style={styles.lbRank}>
                {cfg ? (
                    <View style={[styles.lbRankBadge, { backgroundColor: cfg.color }]}>
                        <IonIcon name={`${cfg.icon}`} size={ms(12)} color="#FFF" />
                    </View>
                ) : (
                    <Text style={styles.lbRankNum}>{rank}</Text>
                )}
            </View>
            <View style={styles.lbAgent}>
                <View style={styles.lbAvatar}>
                    <Text style={styles.lbAvatarText}>{getInitials(item.agentName || item.name || 'Agent')}</Text>
                </View>
                <Text style={styles.lbName} numberOfLines={1}>{item.agentName || item.name || 'N/A'}</Text>
            </View>
            <Text style={styles.lbCell}>{item.totalCalls ?? 0}</Text>
            <Text style={[styles.lbCell, { color: Colors.success, fontWeight: '700' }]}>{item.totalConnectedCalls ?? item.connectedCalls ?? 0}</Text>
            <Text style={styles.lbCell}>{item.conversions ?? 0}</Text>
            <Text style={styles.lbCell}>{item.avgDuration ?? item.totalDuration ?? '0:00'}</Text>
            <Text style={[styles.lbCell, { color: Colors.info, fontWeight: '600' }]}>{item.followUpPercentage ?? '0'}%</Text>
            <Text style={[styles.lbCell, { fontWeight: '800', color: Colors.textPrimary }]}>{item.score ?? 0}</Text>
        </View>
    );
};




// ─── Main Screen ──────────────────────────────────────────────────────────────

const SmartCallDashboardScreen = ({ navigation }) => {
    const today = toYMD(new Date());

    const [datePreset, setDatePreset] = useState(DATE_PRESETS[0]);
    const [fromDate, setFromDate] = useState(today);
    const [toDate, setToDate] = useState(today);
    const [callType, setCallType] = useState(CALL_TYPES[0]);

    const [showPresetPicker, setShowPresetPicker] = useState(false);
    const [showCallTypePicker, setShowCallTypePicker] = useState(false);
    const [showNativePicker, setShowNativePicker] = useState(false);


    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchData = useCallback(async (from, to, ct, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const res = await reportsAPI.getSmartCallDashboard({
                fromDate: from,
                toDate: to,
                limit: 100,
                callType: ct.value === 'all' ? undefined : ct.value,
            });
            console.log('SmartCallDashboardScreen API Response:', res.data);
            if (res.success) {
                // Map data from data.data according to the provided sample
                setData(res.data.data || res.data);
            }
            else setError(res.error || 'Failed to load call dashboard');

        } catch {
            setError('An unexpected error occurred');
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, []);

    useFocusEffect(useCallback(() => {
        fetchData(fromDate, toDate, callType);
    }, []));

    const applyPreset = (opt) => {
        setDatePreset(opt);
        if (opt.value !== 'custom') {
            const { from, to } = getPresetDates(opt.value);
            setFromDate(from); setToDate(to);
            fetchData(from, to, callType);
        } else {
            setShowNativePicker(true);
        }
    };


    const applyCallType = (opt) => {
        setCallType(opt);
        fetchData(fromDate, toDate, opt);
    };

    const onNativeDateChange = (event, selectedDate) => {
        setShowNativePicker(false);
        if (selectedDate) {
            const ymd = toYMD(selectedDate);
            setFromDate(ymd);
            setToDate(ymd);
            setDatePreset(DATE_PRESETS.find(d => d.value === 'custom'));
            fetchData(ymd, ymd, callType);
        }
    };


    // ── Derived ───────────────────────────────────────────────────────────────

    // ── Exact Mapping ──
    const summary = data?.summary || {};
    const leaderboard = data?.leaderboard || [];

    const totalCalls = summary.totalCalls ?? 0;
    const totalConnectedCalls = summary.totalConnectedCalls ?? 0;
    const totalRejectedCalls = summary.totalRejectedCalls ?? 0;
    const totalUniqueClients = summary.totalUniqueClients ?? 0;
    const totalDuration = summary.totalDuration ?? 0;

    // Additional metrics for quality tiles
    const connectRate = totalCalls > 0 ? (totalConnectedCalls / totalCalls) * 100 : 0;
    const shortCalls = summary.shortCalls ?? data?.shortCalls;
    const longCalls = summary.longCalls ?? data?.longCalls;



    const dateLabel = datePreset?.value === 'custom'
        ? `${toDisplay(fromDate)} – ${toDisplay(toDate)}`
        : datePreset?.label;

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* ── Nav Bar ── */}
            <View style={styles.navBar}>
                <TouchableOpacity style={styles.navBack} onPress={() => navigation.goBack()}>
                    <IonIcon name="arrow-back" size={ms(20)} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.navCenter}>
                    <Text style={styles.navTitle}>Smart Call Dashboard</Text>
                    <Text style={styles.navSub}>Your personal calling performance</Text>
                </View>
                <TouchableOpacity
                    style={styles.navRefresh}
                    onPress={() => fetchData(fromDate, toDate, callType, true)}
                >
                    <IonIcon name="refresh-outline" size={ms(18)} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* ── Filter Bar ── */}
            <View style={styles.filterBar}>
                <TouchableOpacity style={styles.dateSelector} onPress={() => setShowPresetPicker(true)}>
                    <Text style={styles.selectorText} numberOfLines={1}>{dateLabel}</Text>
                    <IonIcon name="chevron-down" size={ms(16)} color={Colors.textSecondary} />
                </TouchableOpacity>


                <TouchableOpacity style={styles.calendarIconBtn} onPress={() => setShowNativePicker(true)}>
                    <IonIcon name="calendar-outline" size={ms(18)} color={Colors.textPrimary} />
                </TouchableOpacity>

                <TouchableOpacity style={styles.callTypeSelector} onPress={() => setShowCallTypePicker(true)}>
                    <Text style={styles.selectorText}>{callType.label}</Text>
                    <IonIcon name="chevron-down" size={ms(16)} color={Colors.textSecondary} />
                </TouchableOpacity>
            </View>




            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchData(fromDate, toDate, callType, true)}
                        colors={[Colors.primary]} tintColor={Colors.primary}
                    />
                }
            >
                {loading && !data ? (
                    <View style={styles.centeredState}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.stateText}>Loading dashboard…</Text>
                    </View>
                ) : error && !data ? (
                    <Card style={styles.errorCard}>
                        <IonIcon name="alert-circle-outline" size={ms(44)} color={Colors.danger} />
                        <Text style={styles.errorTitle}>Failed to load</Text>
                        <Text style={styles.errorMsg}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(fromDate, toDate, callType)}>
                            <IonIcon name="refresh-outline" size={ms(14)} color="#fff" />
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </Card>
                ) : (
                    <>
                        {/* ══ KPI HERO CARDS (2 × 2 grid) ══ */}
                        <View style={styles.heroGrid}>
                            <KpiHeroCard
                                label="Total Calls"
                                value={String(totalCalls)}
                                sub="Webhook data"
                                icon="call-outline"
                                iconBg={Colors.primaryBackground}
                                iconColor={Colors.primary}
                            />
                            <KpiHeroCard
                                label="Connected Calls"
                                value={String(totalConnectedCalls)}
                                sub={`${connectRate.toFixed(0)}% connect rate`}
                                icon="call-outline"
                                iconBg={Colors.successBg}
                                iconColor={Colors.success}
                                accent={Colors.success}
                            />
                            <KpiHeroCard
                                label="Rejected Calls"
                                value={String(totalRejectedCalls)}
                                sub="Declined"
                                icon="close-circle-outline"
                                iconBg={Colors.warningBg}
                                iconColor={Colors.warning}
                                accent={Colors.warning}
                            />
                            <KpiHeroCard
                                label="Unique Clients"
                                value={String(totalUniqueClients)}
                                sub="Distinct contacts"
                                icon="people-outline"
                                iconBg={Colors.infoBg}
                                iconColor={Colors.info}
                                accent={Colors.info}
                            />
                        </View>

                        {/* ══ CALL QUALITY METRICS ══ */}
                        <Card>
                            <SectionHeader icon="pulse-outline" title="Call Quality Metrics" />
                            <Divider />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.qualityRow}>
                                    <QualityTile
                                        icon="time-outline"
                                        iconColor={Colors.success}
                                        label="Avg Call Duration"
                                        value={totalDuration || '0:00'}
                                    />
                                    <QualityTile
                                        icon="call-outline"
                                        iconColor={Colors.primary}
                                        label="Connection Rate"
                                        value={`${connectRate.toFixed(0)}%`}
                                    />
                                    <QualityTile
                                        icon="people-outline"
                                        iconColor={Colors.info}
                                        label="Unique Clients"
                                        value={String(totalUniqueClients)}
                                    />
                                    <QualityTile
                                        icon="warning-outline"
                                        iconColor={Colors.warning}
                                        label="Short Calls (<10s)"
                                        value={shortCalls != null ? String(shortCalls) : '—'}
                                    />
                                    <QualityTile
                                        icon="trending-up-outline"
                                        iconColor={Colors.success}
                                        label="Long Calls (>2min)"
                                        value={longCalls != null ? String(longCalls) : '—'}
                                    />
                                </View>
                            </ScrollView>
                        </Card>



                        {/* ══ AGENT PERFORMANCE LEADERBOARD ══ */}
                        <Card>
                            <SectionHeader icon="trophy-outline" title="Agent Performance Leaderboard" accent={Colors.warning} />
                            <Divider />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View>
                                    {/* Header */}
                                    <View style={styles.lbHeader}>
                                        <Text style={styles.lbHeaderRank}>Rank</Text>
                                        <Text style={styles.lbHeaderAgent}>Agent</Text>
                                        <Text style={styles.lbHeaderCell}>Total Calls</Text>
                                        <Text style={[styles.lbHeaderCell, { color: Colors.success }]}>Connected</Text>
                                        <Text style={styles.lbHeaderCell}>Conversions</Text>
                                        <Text style={styles.lbHeaderCell}>Avg Duration</Text>
                                        <Text style={[styles.lbHeaderCell, { color: Colors.info }]}>Follow-Up %</Text>
                                        <Text style={styles.lbHeaderCell}>Score</Text>
                                    </View>

                                    {leaderboard.length === 0 ? (
                                        <View style={styles.emptyLb}>
                                            <IonIcon name="people-outline" size={ms(36)} color={Colors.surfaceBorder} />
                                            <Text style={styles.emptyLbText}>No agent data available</Text>
                                        </View>
                                    ) : (
                                        leaderboard.map((item, idx) => (
                                            <LeaderboardRow
                                                key={idx}
                                                item={item}
                                                rank={idx + 1}
                                                isLast={idx === leaderboard.length - 1}
                                            />
                                        ))
                                    )}
                                </View>
                            </ScrollView>
                        </Card>

                        <View style={{ height: ms(40) }} />
                    </>
                )}
            </ScrollView>

            {/* ── Modals ── */}
            <SelectorModal
                visible={showPresetPicker}
                title="Select Date Range"
                options={DATE_PRESETS}
                selected={datePreset.value}
                onSelect={applyPreset}
                onClose={() => setShowPresetPicker(false)}
            />
            <SelectorModal
                visible={showCallTypePicker}
                title="Select Call Type"
                options={CALL_TYPES}
                selected={callType.value}
                onSelect={applyCallType}
                onClose={() => setShowCallTypePicker(false)}
            />
            {showNativePicker && (
                <DateTimePicker
                    value={parseYMD(fromDate)}
                    mode="date"
                    display="default"
                    onChange={onNativeDateChange}
                />
            )}

        </SafeAreaView>
    );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const CARD_W = (SCREEN_WIDTH - ms(28) - ms(10)) / 2;

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },

    // ── Nav ──
    navBar: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: ms(14), paddingVertical: ms(10),
        backgroundColor: Colors.surface,
        borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
        gap: ms(10),
    },
    navBack: {
        width: ms(36), height: ms(36), borderRadius: BorderRadius.md,
        backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
    },
    navCenter: { flex: 1 },
    navTitle: { fontSize: ms(15), fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.2 },
    navSub: { fontSize: ms(10), color: Colors.textTertiary, fontWeight: '500', marginTop: ms(1) },
    navRefresh: {
        width: ms(36), height: ms(36), borderRadius: BorderRadius.md,
        backgroundColor: Colors.primaryBackground, justifyContent: 'center', alignItems: 'center',
    },

    // ── Filter ──
    filterBar: {
        flexDirection: 'row', alignItems: 'center', gap: ms(10),
        paddingHorizontal: ms(14), paddingVertical: ms(12),
        backgroundColor: Colors.surface,
        borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    },
    dateSelector: {
        flex: 1.4, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: ms(14), paddingVertical: ms(8),
        backgroundColor: '#F1F5F9', borderRadius: ms(20),
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    selectorLabel: { fontSize: ms(10), color: Colors.textTertiary, fontWeight: '700', textTransform: 'uppercase', position: 'absolute', top: -ms(7), left: ms(12), backgroundColor: Colors.surface, paddingHorizontal: ms(4) },
    calendarIconBtn: {
        width: ms(40), height: ms(40),
        backgroundColor: Colors.primaryBackground, borderRadius: ms(20),
        justifyContent: 'center', alignItems: 'center',
        // ...Shadow.sm,
    },
    callTypeSelector: {
        flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: ms(14), paddingVertical: ms(8),
        backgroundColor: '#F1F5F9', borderRadius: ms(20),
        borderWidth: 1, borderColor: '#E2E8F0',
    },
    selectorText: { fontSize: ms(13), color: Colors.textPrimary, fontWeight: '600' },



    // ── Scroll ──
    scrollContent: { padding: ms(14), gap: ms(12) },

    // ── Card ──
    card: {
        backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
        padding: ms(14), borderWidth: 1, borderColor: Colors.surfaceBorder,
        ...Shadow.sm,
    },
    divider: { height: 1, backgroundColor: Colors.surfaceBorder, marginVertical: ms(10) },

    // ── Section Header ──
    secHeaderRow: { flexDirection: 'row', alignItems: 'center', gap: ms(8), marginBottom: ms(4) },
    secIconWrap: {
        width: ms(26), height: ms(26), borderRadius: BorderRadius.xs,
        backgroundColor: Colors.primaryBackground, justifyContent: 'center', alignItems: 'center',
    },
    secTitle: { fontSize: ms(13), fontWeight: '700', color: Colors.textPrimary },

    // ── KPI Hero ──
    heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(12) },
    kpiHero: {
        width: (SCREEN_WIDTH - ms(28) - ms(12)) / 2,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderRadius: ms(20),
        padding: ms(16),
        borderWidth: 0.5, borderColor: 'rgba(0,0,0,0.05)',
        ...Shadow.md,
    },
    kpiHeroTop: {
        flexDirection: 'row', alignItems: 'center',
        marginBottom: ms(12), gap: ms(10),
    },
    kpiHeroIcon: {
        width: ms(34), height: ms(34), borderRadius: ms(17),
        justifyContent: 'center', alignItems: 'center',
    },
    kpiHeroTextWrap: { flex: 1 },
    kpiHeroLabel: {
        fontSize: ms(10), fontWeight: '700', color: Colors.textTertiary,
        textTransform: 'uppercase', letterSpacing: 0.6,
    },
    kpiHeroSubText: { fontSize: ms(9), color: Colors.textTertiary, fontWeight: '500', marginTop: ms(1) },
    kpiHeroValue: {
        fontSize: ms(26), fontWeight: '900', color: Colors.textPrimary,
        letterSpacing: -0.8,
    },

    // ── Quality Metrics ──
    qualityRow: { flexDirection: 'row', gap: ms(10), paddingBottom: ms(4) },
    qualityTile: {
        width: ms(114),
        backgroundColor: Colors.surface,
        borderRadius: ms(18),
        borderWidth: 0.5, borderColor: Colors.surfaceBorder,
        padding: ms(14),
        ...Shadow.sm,
    },
    qualityTileTop: {
        flexDirection: 'row', alignItems: 'center', gap: ms(6), marginBottom: ms(10),
    },
    qualityTileLabel: {
        fontSize: ms(10), color: Colors.textTertiary, fontWeight: '700', flex: 1,
        lineHeight: ms(13),
    },
    qualityTileValue: {
        fontSize: ms(22), fontWeight: '900', color: Colors.textPrimary, letterSpacing: -0.5,
    },

    // ── Leaderboard ──
    lbHeader: {
        flexDirection: 'row', paddingVertical: ms(12),
        backgroundColor: '#F8FAFC', borderTopLeftRadius: ms(12), borderTopRightRadius: ms(12),
    },
    lbHeaderRank: {
        width: ms(50), fontSize: ms(10), fontWeight: '800',
        color: Colors.textTertiary, textTransform: 'uppercase', textAlign: 'center', letterSpacing: 0.5,
    },
    lbHeaderAgent: {
        width: ms(150), fontSize: ms(10), fontWeight: '800',
        color: Colors.textTertiary, textTransform: 'uppercase', letterSpacing: 0.5,
    },
    lbHeaderCell: {
        width: ms(85), fontSize: ms(10), fontWeight: '800',
        color: Colors.textTertiary, textTransform: 'uppercase', textAlign: 'center', letterSpacing: 0.5,
    },
    lbRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: ms(14),
        borderBottomWidth: 1, borderBottomColor: '#F1F5F9',
    },
    lbRank: {
        width: ms(50), alignItems: 'center', justifyContent: 'center',
    },
    lbRankBadge: {
        width: ms(22), height: ms(22), borderRadius: ms(11),
        justifyContent: 'center', alignItems: 'center', ...Shadow.sm,
    },
    lbRankNum: { fontSize: ms(14), fontWeight: '700', color: Colors.textTertiary },
    lbAgent: {
        width: ms(150), flexDirection: 'row', alignItems: 'center', gap: ms(10),
    },
    lbAvatar: {
        width: ms(34), height: ms(34), borderRadius: ms(17),
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#FFF', ...Shadow.sm,
    },
    lbAvatarText: { fontSize: ms(11), fontWeight: '800', color: Colors.primary },
    lbName: { fontSize: ms(13), fontWeight: '700', color: Colors.textPrimary, flex: 1 },
    lbCell: {
        width: ms(85), fontSize: ms(13), fontWeight: '600',
        color: Colors.textSecondary, textAlign: 'center',
    },

    emptyLb: { alignItems: 'center', paddingVertical: ms(28), gap: ms(8) },
    emptyLbText: { fontSize: ms(12), color: Colors.textTertiary },

    // ── States ──
    centeredState: { alignItems: 'center', paddingVertical: ms(60), gap: ms(12) },
    stateText: { fontSize: ms(14), color: Colors.textSecondary },
    errorCard: { alignItems: 'center', paddingVertical: ms(32), gap: ms(8) },
    errorTitle: { fontSize: ms(16), fontWeight: '800', color: Colors.textPrimary },
    errorMsg: { fontSize: ms(12), color: Colors.textSecondary, textAlign: 'center' },
    retryBtn: {
        flexDirection: 'row', alignItems: 'center', gap: ms(6),
        paddingHorizontal: ms(20), paddingVertical: ms(10),
        backgroundColor: Colors.primary, borderRadius: BorderRadius.md, marginTop: ms(6),
    },
    retryText: { color: '#fff', fontWeight: '700', fontSize: ms(13) },

    // ── Picker Modal ──
    modalOverlay: {
        flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: ms(20),
    },
    pickerBox: {
        width: '100%', backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg, overflow: 'hidden',
        ...Shadow.md,
    },
    pickerContent: { padding: ms(8) },
    pickerOption: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: ms(16), paddingVertical: ms(14),
        borderRadius: BorderRadius.md, gap: ms(12),
    },
    pickerOptionActive: { backgroundColor: '#E6F4EA' },
    pickerCheck: { width: ms(20) },
    pickerOptionText: { fontSize: ms(16), color: '#333', fontWeight: '400' },
    pickerOptionTextActive: { color: '#00875A', fontWeight: '500' },


});

export default SmartCallDashboardScreen;
