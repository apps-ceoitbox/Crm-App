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

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// ─── Constants ────────────────────────────────────────────────────────────────

const CALL_TYPES = [
    { label: 'All call types', value: 'all' },
    { label: 'Connected', value: 'connected' },
    { label: 'Missed', value: 'missed' },
    { label: 'Rejected', value: 'rejected' },
];

const DATE_PRESETS = [
    { label: 'Today', value: 'today' },
    { label: 'Yesterday', value: 'yesterday' },
    { label: 'Last 7 Days', value: 'last_7_days' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Last Month', value: 'last_month' },
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

const getPresetDates = (value) => {
    const now = new Date();
    const y = now.getFullYear(), m = now.getMonth();
    switch (value) {
        case 'today': return { from: toYMD(now), to: toYMD(now) };
        case 'yesterday': {
            const d = new Date(now); d.setDate(d.getDate() - 1);
            return { from: toYMD(d), to: toYMD(d) };
        }
        case 'last_7_days': {
            const d = new Date(now); d.setDate(d.getDate() - 6);
            return { from: toYMD(d), to: toYMD(now) };
        }
        case 'this_month':
            return { from: toYMD(new Date(y, m, 1)), to: toYMD(now) };
        case 'last_month': {
            const start = new Date(y, m - 1, 1);
            const end = new Date(y, m, 0);
            return { from: toYMD(start), to: toYMD(end) };
        }
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

/** Custom date entry modal (DD / MM / YYYY) */
const DateInputModal = ({ visible, title, initialYMD, onConfirm, onClose }) => {
    const [d, setD] = useState('');
    const [mo, setMo] = useState('');
    const [y, setY] = useState('');

    React.useEffect(() => {
        if (visible && initialYMD) {
            const [yr, mn, dy] = initialYMD.split('-');
            setD(dy); setMo(mn); setY(yr);
        }
    }, [visible, initialYMD]);

    const confirm = () => {
        const day = parseInt(d, 10), month = parseInt(mo, 10), year = parseInt(y, 10);
        if (!day || !month || !year || day < 1 || day > 31 || month < 1 || month > 12 || year < 2000 || year > 2100) {
            Alert.alert('Invalid Date', 'Please enter a valid date.');
            return;
        }
        const mm = String(month).padStart(2, '0'), dd = String(day).padStart(2, '0');
        onConfirm(`${year}-${mm}-${dd}`);
        onClose();
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <TouchableOpacity style={styles.modalOverlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={styles.pickerBox}>
                    <View style={styles.dateModalHeader}>
                        <IonIcon name="calendar-outline" size={ms(16)} color={Colors.primary} />
                        <Text style={styles.pickerTitle}>{title}</Text>
                    </View>
                    <Divider />
                    <View style={styles.dateInputRow}>
                        {[
                            { label: 'Day', val: d, set: setD, ph: 'DD', max: 2 },
                            { label: 'Month', val: mo, set: setMo, ph: 'MM', max: 2 },
                            { label: 'Year', val: y, set: setY, ph: 'YYYY', max: 4, flex: 1.5 },
                        ].map((f, i) => (
                            <React.Fragment key={i}>
                                {i > 0 && <Text style={styles.dateInputSep}>/</Text>}
                                <View style={[styles.dateInputBlock, f.flex && { flex: f.flex }]}>
                                    <Text style={styles.dateInputLabel}>{f.label}</Text>
                                    <TextInput
                                        style={styles.dateInput}
                                        value={f.val}
                                        onChangeText={f.set}
                                        keyboardType="numeric"
                                        maxLength={f.max}
                                        placeholder={f.ph}
                                        placeholderTextColor={Colors.textTertiary}
                                    />
                                </View>
                            </React.Fragment>
                        ))}
                    </View>
                    <View style={styles.dateModalBtns}>
                        <TouchableOpacity style={styles.dateCancelBtn} onPress={onClose}>
                            <Text style={styles.dateCancelText}>Cancel</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.dateConfirmBtn} onPress={confirm}>
                            <Text style={styles.dateConfirmText}>Confirm</Text>
                        </TouchableOpacity>
                    </View>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

// ─── KPI Hero Card ────────────────────────────────────────────────────────────

const KpiHeroCard = ({ label, value, sub, icon, iconBg, iconColor, accent }) => (
    <View style={styles.kpiHero}>
        <View style={styles.kpiHeroTop}>
            <Text style={styles.kpiHeroLabel}>{label}</Text>
            <View style={[styles.kpiHeroIcon, { backgroundColor: iconBg || Colors.primaryBackground }]}>
                <IonIcon name={icon} size={ms(20)} color={iconColor || Colors.primary} />
            </View>
        </View>
        <Text style={[styles.kpiHeroValue, accent && { color: accent }]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
        </Text>
        {sub ? <Text style={styles.kpiHeroSub}>{sub}</Text> : null}
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
            cfg && { backgroundColor: cfg.bg },
            isLast && { borderBottomWidth: 0 },
        ]}>
            <View style={styles.lbRank}>
                {cfg ? (
                    <IonIcon name={`${cfg.icon}-outline`} size={ms(18)} color={cfg.color} />
                ) : (
                    <Text style={styles.lbRankNum}>{rank}</Text>
                )}
            </View>
            <View style={styles.lbAgent}>
                <View style={styles.lbAvatar}>
                    <Text style={styles.lbAvatarText}>{getInitials(item.agentName || item.name)}</Text>
                </View>
                <Text style={styles.lbName} numberOfLines={1}>{item.agentName || item.name}</Text>
            </View>
            <Text style={styles.lbCell}>{item.totalCalls ?? 0}</Text>
            <Text style={[styles.lbCell, { color: Colors.success }]}>{item.connectedCalls ?? item.connected ?? 0}</Text>
            <Text style={[styles.lbCell, { color: Colors.danger }]}>{item.missedCalls ?? item.missed ?? 0}</Text>
            <Text style={styles.lbCell}>{fmtDuration(item.avgDuration ?? item.avgCallDuration)}</Text>
            <Text style={[styles.lbCell, { color: Colors.info, fontWeight: '700' }]}>
                {pct(item.connectRate ?? item.connectionRate)}
            </Text>
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
    const [dateInputFor, setDateInputFor] = useState(null); // 'from' | 'to' | null

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
            if (res.success) setData(res.data);
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
            setDateInputFor('from');
        }
    };

    const applyCallType = (opt) => {
        setCallType(opt);
        fetchData(fromDate, toDate, opt);
    };

    const onDateConfirm = (ymd) => {
        if (dateInputFor === 'from') {
            setFromDate(ymd);
            fetchData(ymd, toDate, callType);
        } else {
            setToDate(ymd);
            fetchData(fromDate, ymd, callType);
        }
        setDatePreset(DATE_PRESETS.find(d => d.value === 'custom'));
    };

    // ── Derived ───────────────────────────────────────────────────────────────

    const summary = data?.summary || data?.stats || {};
    const quality = data?.callQualityMetrics || data?.quality || {};
    const leaderboard = data?.agentLeaderboard || data?.agents || data?.leaderboard || [];

    const totalCalls = summary.totalCalls ?? 0;
    const connected = summary.connectedCalls ?? summary.connected ?? 0;
    const connectRate = summary.connectRate ?? summary.connectionRate ?? 0;
    const rejected = summary.rejectedCalls ?? summary.rejected ?? 0;
    const uniqueClients = summary.uniqueClients ?? summary.uniqueNumbers ?? 0;

    const avgDuration = quality.avgCallDuration ?? quality.avgDuration ?? summary.avgCallDuration;
    const connectionRatePct = quality.connectionRate ?? quality.connectRate ?? connectRate;
    const sClientsQ = quality.uniqueClients ?? uniqueClients;
    const shortCalls = quality.shortCalls;
    const longCalls = quality.longCalls;

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
                <TouchableOpacity style={styles.filterBtn} onPress={() => setShowPresetPicker(true)}>
                    <IonIcon name="calendar-outline" size={ms(13)} color={Colors.primary} />
                    <Text style={styles.filterBtnText} numberOfLines={1}>{dateLabel}</Text>
                    <IonIcon name="chevron-down" size={ms(11)} color={Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setShowCallTypePicker(true)}>
                    <IonIcon name="call-outline" size={ms(13)} color={Colors.primary} />
                    <Text style={styles.filterBtnText} numberOfLines={1}>{callType.label}</Text>
                    <IonIcon name="chevron-down" size={ms(11)} color={Colors.textTertiary} />
                </TouchableOpacity>
            </View>

            {/* Custom date range row (only when custom selected) */}
            {datePreset?.value === 'custom' && (
                <View style={styles.customDateBar}>
                    <TouchableOpacity style={styles.customDateBtn} onPress={() => setDateInputFor('from')}>
                        <IonIcon name="calendar-outline" size={ms(12)} color={Colors.textTertiary} />
                        <Text style={styles.customDateText}>From: {toDisplay(fromDate)}</Text>
                    </TouchableOpacity>
                    <View style={styles.customDateArrow}>
                        <IonIcon name="arrow-forward" size={ms(12)} color={Colors.textTertiary} />
                    </View>
                    <TouchableOpacity style={styles.customDateBtn} onPress={() => setDateInputFor('to')}>
                        <IonIcon name="calendar-outline" size={ms(12)} color={Colors.textTertiary} />
                        <Text style={styles.customDateText}>To: {toDisplay(toDate)}</Text>
                    </TouchableOpacity>
                </View>
            )}

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
                                value={String(connected)}
                                sub={`${pct(connectRate)} connect rate`}
                                icon="call-outline"
                                iconBg={Colors.successBg}
                                iconColor={Colors.success}
                                accent={Colors.success}
                            />
                            <KpiHeroCard
                                label="Rejected Calls"
                                value={String(rejected)}
                                sub="Declined"
                                icon="close-circle-outline"
                                iconBg={Colors.warningBg}
                                iconColor={Colors.warning}
                                accent={Colors.warning}
                            />
                            <KpiHeroCard
                                label="Unique Clients"
                                value={String(uniqueClients)}
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
                                        value={fmtDuration(avgDuration)}
                                    />
                                    <QualityTile
                                        icon="call-outline"
                                        iconColor={Colors.primary}
                                        label="Connection Rate"
                                        value={pct(connectionRatePct)}
                                    />
                                    <QualityTile
                                        icon="people-outline"
                                        iconColor={Colors.info}
                                        label="Unique Clients"
                                        value={String(sClientsQ)}
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
                                        <Text style={styles.lbHeaderCell}>Total↑↓</Text>
                                        <Text style={[styles.lbHeaderCell, { color: Colors.success }]}>Conn↑↓</Text>
                                        <Text style={[styles.lbHeaderCell, { color: Colors.danger }]}>Missed↑↓</Text>
                                        <Text style={styles.lbHeaderCell}>Avg Dur↑↓</Text>
                                        <Text style={[styles.lbHeaderCell, { color: Colors.info }]}>Rate↑↓</Text>
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
            <DateInputModal
                visible={dateInputFor !== null}
                title={dateInputFor === 'from' ? 'Select From Date' : 'Select To Date'}
                initialYMD={dateInputFor === 'from' ? fromDate : toDate}
                onConfirm={onDateConfirm}
                onClose={() => setDateInputFor(null)}
            />
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
        flexDirection: 'row', gap: ms(10),
        paddingHorizontal: ms(14), paddingVertical: ms(10),
        backgroundColor: Colors.surface,
        borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    },
    filterBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: ms(6),
        borderWidth: 1.5, borderColor: Colors.surfaceBorder,
        borderRadius: BorderRadius.md,
        paddingHorizontal: ms(10), paddingVertical: ms(9),
        backgroundColor: Colors.background,
    },
    filterBtnText: { flex: 1, fontSize: ms(12), fontWeight: '600', color: Colors.textPrimary },
    customDateBar: {
        flexDirection: 'row', alignItems: 'center',
        paddingHorizontal: ms(14), paddingVertical: ms(8),
        backgroundColor: Colors.surface,
        borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
        gap: ms(6),
    },
    customDateBtn: {
        flex: 1, flexDirection: 'row', alignItems: 'center', gap: ms(4),
        backgroundColor: Colors.background, borderRadius: BorderRadius.sm,
        paddingHorizontal: ms(8), paddingVertical: ms(7),
        borderWidth: 1, borderColor: Colors.surfaceBorder,
    },
    customDateText: { fontSize: ms(11), color: Colors.textSecondary, fontWeight: '500' },
    customDateArrow: { paddingHorizontal: ms(4) },

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
    heroGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(10) },
    kpiHero: {
        width: CARD_W,
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: ms(14),
        borderWidth: 1, borderColor: Colors.surfaceBorder,
        ...Shadow.sm,
    },
    kpiHeroTop: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start',
        marginBottom: ms(10),
    },
    kpiHeroLabel: {
        fontSize: ms(11), fontWeight: '600', color: Colors.textTertiary,
        flex: 1, textTransform: 'uppercase', letterSpacing: 0.3,
    },
    kpiHeroIcon: {
        width: ms(36), height: ms(36), borderRadius: BorderRadius.sm,
        justifyContent: 'center', alignItems: 'center',
    },
    kpiHeroValue: {
        fontSize: ms(28), fontWeight: '900', color: Colors.textPrimary,
        letterSpacing: -1, marginBottom: ms(4),
    },
    kpiHeroSub: { fontSize: ms(10), color: Colors.textTertiary, fontWeight: '500' },

    // ── Quality Metrics ──
    qualityRow: { flexDirection: 'row', gap: ms(8), paddingBottom: ms(4) },
    qualityTile: {
        width: ms(108),
        backgroundColor: Colors.background,
        borderRadius: BorderRadius.md,
        borderWidth: 1, borderColor: Colors.surfaceBorder,
        padding: ms(12),
    },
    qualityTileTop: {
        flexDirection: 'row', alignItems: 'center', gap: ms(5), marginBottom: ms(8),
    },
    qualityTileLabel: {
        fontSize: ms(10), color: Colors.textTertiary, fontWeight: '600', flex: 1,
        lineHeight: ms(13),
    },
    qualityTileValue: {
        fontSize: ms(20), fontWeight: '800', color: Colors.textPrimary, letterSpacing: -0.5,
    },

    // ── Leaderboard ──
    lbHeader: {
        flexDirection: 'row', paddingVertical: ms(8),
        borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    },
    lbHeaderRank: {
        width: ms(44), fontSize: ms(10), fontWeight: '700',
        color: Colors.textTertiary, textTransform: 'uppercase', textAlign: 'center',
    },
    lbHeaderAgent: {
        width: ms(140), fontSize: ms(10), fontWeight: '700',
        color: Colors.textTertiary, textTransform: 'uppercase',
    },
    lbHeaderCell: {
        width: ms(72), fontSize: ms(10), fontWeight: '700',
        color: Colors.textTertiary, textTransform: 'uppercase', textAlign: 'center',
    },
    lbRow: {
        flexDirection: 'row', alignItems: 'center',
        paddingVertical: ms(12),
        borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
        borderRadius: BorderRadius.sm,
        marginVertical: ms(1),
    },
    lbRank: {
        width: ms(44), alignItems: 'center', justifyContent: 'center',
    },
    lbRankNum: { fontSize: ms(13), fontWeight: '700', color: Colors.textTertiary },
    lbAgent: {
        width: ms(140), flexDirection: 'row', alignItems: 'center', gap: ms(8),
    },
    lbAvatar: {
        width: ms(30), height: ms(30), borderRadius: ms(15),
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center', alignItems: 'center',
    },
    lbAvatarText: { fontSize: ms(10), fontWeight: '800', color: Colors.primary },
    lbName: { fontSize: ms(12), fontWeight: '700', color: Colors.textPrimary, flex: 1 },
    lbCell: {
        width: ms(72), fontSize: ms(12), fontWeight: '600',
        color: Colors.textPrimary, textAlign: 'center',
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
        flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
        justifyContent: 'center', alignItems: 'center', paddingHorizontal: ms(24),
    },
    pickerBox: {
        width: '100%', backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg, paddingVertical: ms(8), paddingHorizontal: ms(4),
        ...Shadow.sm,
    },
    pickerTitle: {
        fontSize: ms(14), fontWeight: '700', color: Colors.textPrimary,
        paddingHorizontal: ms(16), paddingVertical: ms(12),
    },
    pickerOption: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
        paddingHorizontal: ms(16), paddingVertical: ms(13),
    },
    pickerOptionActive: { backgroundColor: Colors.primaryBackground, borderRadius: BorderRadius.sm },
    pickerOptionText: { fontSize: ms(14), color: Colors.textPrimary, fontWeight: '500' },
    pickerOptionTextActive: { color: Colors.primary, fontWeight: '700' },

    // ── Date Input Modal ──
    dateModalHeader: { flexDirection: 'row', alignItems: 'center', gap: ms(8), paddingHorizontal: ms(16), paddingTop: ms(12) },
    dateInputRow: {
        flexDirection: 'row', alignItems: 'flex-end', gap: ms(4),
        paddingHorizontal: ms(16), marginBottom: ms(16),
    },
    dateInputBlock: { flex: 1 },
    dateInputLabel: {
        fontSize: ms(10), color: Colors.textTertiary, fontWeight: '600',
        marginBottom: ms(4), textTransform: 'uppercase', letterSpacing: 0.5,
    },
    dateInput: {
        borderWidth: 1.5, borderColor: Colors.surfaceBorder,
        borderRadius: BorderRadius.sm, paddingHorizontal: ms(10), paddingVertical: ms(10),
        fontSize: ms(16), fontWeight: '700', color: Colors.textPrimary,
        textAlign: 'center', backgroundColor: Colors.background,
    },
    dateInputSep: {
        fontSize: ms(18), color: Colors.textTertiary, fontWeight: '700', paddingBottom: ms(10),
    },
    dateModalBtns: { flexDirection: 'row', gap: ms(10), paddingHorizontal: ms(16), paddingBottom: ms(16) },
    dateCancelBtn: {
        flex: 1, paddingVertical: ms(12), borderRadius: BorderRadius.md,
        borderWidth: 1.5, borderColor: Colors.surfaceBorder, alignItems: 'center',
    },
    dateCancelText: { fontSize: ms(14), fontWeight: '600', color: Colors.textSecondary },
    dateConfirmBtn: {
        flex: 1, paddingVertical: ms(12), borderRadius: BorderRadius.md,
        backgroundColor: Colors.primary, alignItems: 'center',
    },
    dateConfirmText: { fontSize: ms(14), fontWeight: '700', color: '#fff' },
});

export default SmartCallDashboardScreen;
