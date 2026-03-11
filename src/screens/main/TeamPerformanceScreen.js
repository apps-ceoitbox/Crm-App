/**
 * TeamPerformanceScreen.js
 * CRM Team Performance Report — Mobile Optimised
 * API: GET /reports/team-performance?dateRange=this_month
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
    Modal,
    FlatList,
    TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { BorderRadius, Shadow, Spacing } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import { reportsAPI } from '../../api';

// ─── Constants ────────────────────────────────────────────────────────────────

const DATE_RANGES = [
    { label: 'Today', value: 'today' },
    { label: 'This Week', value: 'this_week' },
    { label: 'This Month', value: 'this_month' },
    { label: 'Last Month', value: 'last_month' },
    { label: 'This Quarter', value: 'this_quarter' },
    { label: 'Last Quarter', value: 'last_quarter' },
    { label: 'This Year', value: 'this_year' },
];

const TEAM_FILTERS = [
    { label: 'My Team', value: 'team' },
    { label: 'Just Me', value: 'me' },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatINR = (val) => {
    if (!val && val !== 0) return '₹0';
    const n = Number(val);
    if (n >= 10000000) return `₹${(n / 10000000).toFixed(1)}Cr`;
    if (n >= 100000) return `₹${(n / 100000).toFixed(1)}L`;
    if (n >= 1000) return `₹${(n / 1000).toFixed(0)}K`;
    return `₹${n.toLocaleString('en-IN')}`;
};

const pct = (val) => `${Number(val ?? 0).toFixed(1)}%`;

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

/** KPI metric card */
const KpiCard = ({ icon, iconBg, label, value, valueColor }) => (
    <View style={styles.kpiCard}>
        <View style={[styles.kpiIconWrap, { backgroundColor: iconBg || Colors.primaryBackground }]}>
            <IonIcon name={icon} size={ms(18)} color={valueColor || Colors.primary} />
        </View>
        <Text style={[styles.kpiValue, valueColor && { color: valueColor }]} numberOfLines={1} adjustsFontSizeToFit>
            {value}
        </Text>
        <Text style={styles.kpiLabel} numberOfLines={2}>{label}</Text>
    </View>
);

/** User table row */
const UserRow = ({ item, isLast }) => {
    const initials = getInitials(item.userName || item.name);
    const winRate = pct(item.winRate);
    const lossRate = pct(item.dealsLost);
    // console.log(item);
    return (
        <View style={[styles.tableRow, isLast && { borderBottomWidth: 0 }]}>
            <View style={styles.tableColUser}>
                <View style={styles.userAvatar}>
                    <Text style={styles.userAvatarText}>{initials}</Text>
                </View>
                <View style={{ flex: 1 }}>
                    <Text style={styles.tableUserName} numberOfLines={1}>{item.userName || 'Unknown'}</Text>
                    {item.role ? (
                        <View style={styles.roleBadge}>
                            <Text style={styles.roleBadgeText}>{item.role}</Text>
                        </View>
                    ) : null}
                </View>
            </View>
            <Text style={styles.tableCell}>{item.leadsAssigned ?? 0}</Text>
            <Text style={styles.tableCell}>{item.leadsContacted ?? 0}</Text>
            <Text style={styles.tableCell}>{item.dealsWon ?? 0}</Text>
            <Text style={[styles.tableCell, { color: Colors.success }]}>{winRate}</Text>
            <Text style={[styles.tableCell, { color: Colors.danger }]}>{lossRate}</Text>
            <Text style={[styles.tableCell, { color: Colors.info }]}>{formatINR(item.revenueClosed)}</Text>
            <Text style={styles.tableCell}>{item.followUpsDue ?? 0}</Text>
        </View>
    );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────

const TeamPerformanceScreen = ({ navigation }) => {
    const [dateRange, setDateRange] = useState(DATE_RANGES[2]); // This Month
    const [teamFilter, setTeamFilter] = useState(TEAM_FILTERS[0]); // My Team
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [showTeamPicker, setShowTeamPicker] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');

    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState(null);

    // ── Fetch ─────────────────────────────────────────────────────────────────

    const fetchData = useCallback(async (dRange, tFilter, isRefresh = false) => {
        if (isRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        try {
            const res = await reportsAPI.getTeamPerformance({
                dateRange: dRange.value,
                teamFilter: tFilter.value,
            });
            if (res.success) {
                setData(res.data);
            } else {
                setError(res.error || 'Failed to load team performance');
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
            fetchData(dateRange, teamFilter);
        }, [])
    );

    const onDateRangeSelect = (opt) => {
        setDateRange(opt);
        fetchData(opt, teamFilter);
    };

    const onTeamFilterSelect = (opt) => {
        setTeamFilter(opt);
        fetchData(dateRange, opt);
    };

    // ── Derived data ──────────────────────────────────────────────────────────

    const summary = data?.summary || {};
    const users = (data?.users || data?.teamPerformance || []).filter(u => {
        if (!searchQuery.trim()) return true;
        const name = (u.userName || u.name || '').toLowerCase();
        return name.includes(searchQuery.toLowerCase());
    });
    const topByDeals = data?.topByDeals || data?.topPerformerByDeals || null;
    const topByRevenue = data?.topByRevenue || data?.topPerformerByRevenue || null;

    const kpiItems = [
        {
            icon: 'people-outline',
            iconBg: Colors.infoBg,
            label: 'Total Leads Assigned',
            value: String(summary.totalLeadsAssigned ?? 0),
            valueColor: Colors.info,
        },
        {
            icon: 'trophy-outline',
            iconBg: Colors.successBg,
            label: 'Total Deals Won',
            value: String(summary.totalDealsWon ?? 0),
            valueColor: Colors.success,
        },
        {
            icon: 'cash-outline',
            iconBg: Colors.primaryBackground,
            label: 'Total Revenue Closed',
            value: formatINR(summary.totalRevenueClosed),
            valueColor: Colors.primary,
        },
        {
            icon: 'stats-chart-outline',
            iconBg: Colors.successBg,
            label: 'Avg Win Rate',
            value: pct(summary.avgWinRate),
            valueColor: Colors.success,
        },
        {
            icon: 'trending-down-outline',
            iconBg: Colors.dangerBg,
            label: 'Avg Loss Rate',
            value: pct(summary.avgLossRate),
            valueColor: Colors.danger,
        },
    ];

    // ── Render ────────────────────────────────────────────────────────────────

    return (
        <SafeAreaView style={styles.container} edges={['top']}>

            {/* ── Nav Bar ── */}
            <View style={styles.navBar}>
                <TouchableOpacity style={styles.navIconBtn} onPress={() => navigation.goBack()}>
                    <IonIcon name="arrow-back" size={ms(20)} color={Colors.textPrimary} />
                </TouchableOpacity>
                <View style={styles.navCenter}>
                    <Text style={styles.navTitle}>Team Performance</Text>
                </View>
                <TouchableOpacity
                    style={styles.navRefreshBtn}
                    onPress={() => fetchData(dateRange, teamFilter, true)}
                >
                    <IonIcon name="refresh-outline" size={ms(18)} color={Colors.primary} />
                </TouchableOpacity>
            </View>

            {/* ── Filters ── */}
            <View style={styles.filtersBar}>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setShowDatePicker(true)}>
                    <IonIcon name="calendar-outline" size={ms(14)} color={Colors.primary} />
                    <Text style={styles.filterBtnText} numberOfLines={1}>{dateRange.label}</Text>
                    <IonIcon name="chevron-down" size={ms(12)} color={Colors.textTertiary} />
                </TouchableOpacity>
                <TouchableOpacity style={styles.filterBtn} onPress={() => setShowTeamPicker(true)}>
                    <IonIcon name="people-outline" size={ms(14)} color={Colors.primary} />
                    <Text style={styles.filterBtnText} numberOfLines={1}>{teamFilter.label}</Text>
                    <IonIcon name="chevron-down" size={ms(12)} color={Colors.textTertiary} />
                </TouchableOpacity>
            </View>

            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => fetchData(dateRange, teamFilter, true)}
                        colors={[Colors.primary]}
                        tintColor={Colors.primary}
                    />
                }
            >
                {/* ── Loading ── */}
                {loading && !data ? (
                    <View style={styles.centeredState}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                        <Text style={styles.stateText}>Loading report…</Text>
                    </View>
                ) : error && !data ? (
                    <Card style={styles.errorCard}>
                        <IonIcon name="alert-circle-outline" size={ms(44)} color={Colors.danger} />
                        <Text style={styles.errorTitle}>Failed to load</Text>
                        <Text style={styles.errorMsg}>{error}</Text>
                        <TouchableOpacity style={styles.retryBtn} onPress={() => fetchData(dateRange, teamFilter)}>
                            <IonIcon name="refresh-outline" size={ms(14)} color="#fff" />
                            <Text style={styles.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </Card>
                ) : (
                    <>
                        {/* ══ KPI METRICS ══ */}
                        <Card>
                            <SectionHeader icon="pulse-outline" title="Summary" />
                            <Divider />
                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View style={styles.kpiRow}>
                                    {kpiItems.map((item, idx) => (
                                        <KpiCard key={idx} {...item} />
                                    ))}
                                </View>
                            </ScrollView>
                        </Card>

                        {/* ══ TEAM PERFORMANCE TABLE ══ */}
                        <Card>
                            <View style={styles.tableTopRow}>
                                <SectionHeader icon="bar-chart-outline" title="Team Performance" />
                            </View>
                            {/* Search */}
                            <View style={styles.searchWrap}>
                                <IonIcon name="search-outline" size={ms(14)} color={Colors.textTertiary} />
                                <TextInput
                                    style={styles.searchInput}
                                    placeholder="Search by name…"
                                    placeholderTextColor={Colors.textTertiary}
                                    value={searchQuery}
                                    onChangeText={setSearchQuery}
                                />
                            </View>
                            <Divider />

                            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                                <View>
                                    {/* Table Header */}
                                    <View style={styles.tableHeader}>
                                        <Text style={styles.tableHeaderUser}>User</Text>
                                        <Text style={styles.tableHeaderCell}>Leads</Text>
                                        <Text style={styles.tableHeaderCell}>Contacted</Text>
                                        <Text style={styles.tableHeaderCell}>Won</Text>
                                        <Text style={[styles.tableHeaderCell, { color: Colors.success }]}>Win%</Text>
                                        <Text style={[styles.tableHeaderCell, { color: Colors.danger }]}>Loss%</Text>
                                        <Text style={[styles.tableHeaderCell, { color: Colors.info }]}>Revenue</Text>
                                        <Text style={styles.tableHeaderCell}>F/Ups</Text>
                                    </View>
                                    {users.length === 0 ? (
                                        <View style={styles.tableEmpty}>
                                            <IonIcon name="people-outline" size={ms(36)} color={Colors.surfaceBorder} />
                                            <Text style={styles.tableEmptyText}>No team data available</Text>
                                        </View>
                                    ) : (
                                        users.map((user, idx) => (
                                            <UserRow key={idx} item={user} isLast={idx === users.length - 1} />
                                        ))
                                    )}
                                </View>
                            </ScrollView>
                        </Card>

                        {/* ══ TOP PERFORMERS ══ */}
                        <Card>
                            <SectionHeader icon="ribbon-outline" title="Top Performers" />
                            <Divider />

                            {/* Top by Deals Won */}
                            <View style={styles.topCard}>
                                <View style={styles.topCardHeader}>
                                    <Text style={styles.topCardIcon}>🏆</Text>
                                    <Text style={styles.topCardTitle}>Top by Deals Won</Text>
                                </View>
                                {topByDeals ? (
                                    <View style={styles.topCardContent}>
                                        <View style={styles.topUserRow}>
                                            <View style={[styles.userAvatar, { backgroundColor: Colors.successBg }]}>
                                                <Text style={[styles.userAvatarText, { color: Colors.success }]}>
                                                    {getInitials(topByDeals.userName || topByDeals.name)}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.topUserName}>{topByDeals.userName || topByDeals.name}</Text>
                                                <Text style={styles.topUserStat}>{topByDeals.dealsWon ?? 0} deals won</Text>
                                            </View>
                                            <Text style={[styles.topUserValue, { color: Colors.success }]}>
                                                {formatINR(topByDeals.revenueClosed)}
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={styles.topEmpty}>
                                        No closed deals yet this period. Keep pushing — the next win is just around the corner!
                                    </Text>
                                )}
                            </View>

                            <View style={styles.topCardSeparator} />

                            {/* Top by Revenue */}
                            <View style={styles.topCard}>
                                <View style={styles.topCardHeader}>
                                    <Text style={styles.topCardIcon}>💰</Text>
                                    <Text style={styles.topCardTitle}>Top by Revenue</Text>
                                </View>
                                {topByRevenue ? (
                                    <View style={styles.topCardContent}>
                                        <View style={styles.topUserRow}>
                                            <View style={[styles.userAvatar, { backgroundColor: Colors.primaryBackground }]}>
                                                <Text style={[styles.userAvatarText, { color: Colors.primary }]}>
                                                    {getInitials(topByRevenue.userName || topByRevenue.name)}
                                                </Text>
                                            </View>
                                            <View style={{ flex: 1 }}>
                                                <Text style={styles.topUserName}>{topByRevenue.userName || topByRevenue.name}</Text>
                                                <Text style={styles.topUserStat}>{topByRevenue.dealsWon ?? 0} deals won</Text>
                                            </View>
                                            <Text style={[styles.topUserValue, { color: Colors.primary }]}>
                                                {formatINR(topByRevenue.revenueClosed)}
                                            </Text>
                                        </View>
                                    </View>
                                ) : (
                                    <Text style={styles.topEmpty}>
                                        No revenue closed yet. Every conversation gets you closer — keep going!
                                    </Text>
                                )}
                            </View>
                        </Card>

                        <View style={{ height: ms(40) }} />
                    </>
                )}
            </ScrollView>

            {/* ── Date Range Picker Modal ── */}
            <SelectorModal
                visible={showDatePicker}
                title="Select Date Range"
                options={DATE_RANGES}
                selected={dateRange.value}
                onSelect={onDateRangeSelect}
                onClose={() => setShowDatePicker(false)}
            />

            {/* ── Team Filter Modal ── */}
            <SelectorModal
                visible={showTeamPicker}
                title="Select Team / User"
                options={TEAM_FILTERS}
                selected={teamFilter.value}
                onSelect={onTeamFilterSelect}
                onClose={() => setShowTeamPicker(false)}
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
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
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

    // ── KPI ──
    kpiRow: {
        flexDirection: 'row',
        gap: ms(10),
        paddingVertical: ms(4),
    },
    kpiCard: {
        width: ms(100),
        alignItems: 'center',
        padding: ms(12),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.background,
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    kpiIconWrap: {
        width: ms(38),
        height: ms(38),
        borderRadius: BorderRadius.sm,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: ms(8),
    },
    kpiValue: {
        fontSize: ms(18),
        fontWeight: '800',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    kpiLabel: {
        fontSize: ms(10),
        color: Colors.textTertiary,
        textAlign: 'center',
        marginTop: ms(4),
        lineHeight: ms(14),
        fontWeight: '500',
    },

    // ── State ──
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

    // ── Table ──
    tableTopRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    searchWrap: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
        borderRadius: BorderRadius.sm,
        paddingHorizontal: ms(10),
        paddingVertical: ms(8),
        backgroundColor: Colors.background,
        marginTop: ms(10),
    },
    searchInput: {
        flex: 1,
        fontSize: ms(13),
        color: Colors.textPrimary,
        padding: 0,
    },
    tableHeader: {
        flexDirection: 'row',
        paddingVertical: ms(8),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    tableHeaderUser: {
        width: ms(130),
        fontSize: ms(11),
        fontWeight: '700',
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
    },
    tableHeaderCell: {
        width: ms(72),
        fontSize: ms(11),
        fontWeight: '700',
        color: Colors.textTertiary,
        textTransform: 'uppercase',
        letterSpacing: 0.3,
        textAlign: 'center',
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: ms(12),
        borderBottomWidth: 1,
        borderBottomColor: Colors.surfaceBorder,
    },
    tableColUser: {
        width: ms(130),
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(8),
    },
    tableCell: {
        width: ms(72),
        fontSize: ms(13),
        fontWeight: '600',
        color: Colors.textPrimary,
        textAlign: 'center',
    },
    tableEmpty: {
        alignItems: 'center',
        paddingVertical: ms(28),
        gap: ms(8),
    },
    tableEmptyText: {
        fontSize: ms(13),
        color: Colors.textTertiary,
    },
    userAvatar: {
        width: ms(30),
        height: ms(30),
        borderRadius: ms(15),
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
    },
    userAvatarText: {
        fontSize: ms(11),
        fontWeight: '800',
        color: Colors.primary,
    },
    tableUserName: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    roleBadge: {
        marginTop: ms(2),
        backgroundColor: Colors.infoBg,
        paddingHorizontal: ms(6),
        paddingVertical: ms(1),
        borderRadius: BorderRadius.xs,
        alignSelf: 'flex-start',
    },
    roleBadgeText: {
        fontSize: ms(9),
        fontWeight: '700',
        color: Colors.info,
        textTransform: 'capitalize',
    },

    // ── Top Performers ──
    topCard: {
        paddingVertical: ms(8),
    },
    topCardSeparator: {
        height: 1,
        backgroundColor: Colors.surfaceBorder,
        marginVertical: ms(8),
    },
    topCardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(6),
        marginBottom: ms(10),
    },
    topCardIcon: {
        fontSize: ms(16),
    },
    topCardTitle: {
        fontSize: ms(13),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    topCardContent: {},
    topUserRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: ms(10),
    },
    topUserName: {
        fontSize: ms(14),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    topUserStat: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        marginTop: ms(1),
    },
    topUserValue: {
        fontSize: ms(15),
        fontWeight: '800',
        color: Colors.primary,
    },
    topEmpty: {
        fontSize: ms(12),
        color: Colors.textTertiary,
        lineHeight: ms(18),
        fontStyle: 'italic',
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

export default TeamPerformanceScreen;
