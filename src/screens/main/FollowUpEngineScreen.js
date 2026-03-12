/**
 * Follow Up Engine Screen
 * Configure follow-up automation — UI matched to Expo project
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    LayoutAnimation,
    Platform,
    UIManager,
    Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { useFocusEffect } from '@react-navigation/native';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { ROUTES } from '../../constants';
import CommonHeader from '../../components/CommonHeader';
import API from '../../api/services';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const TAB_DUE_TODAY = 'due_today';
const TAB_OVERDUE = 'overdue';
const TAB_RULE_GENERATED = 'rule_generated';

// Filter configuration matching Expo style
const FILTERS = [
    { id: TAB_DUE_TODAY, label: 'Due Today', icon: 'time-outline', color: Colors.primary },
    { id: TAB_OVERDUE, label: 'Overdue', icon: 'alert-circle-outline', color: Colors.danger },
    { id: TAB_RULE_GENERATED, label: 'Rule Based', icon: 'calendar-outline', color: Colors.info },
];

// Follow-Up Card — matching Expo FollowUpScreen design
const FollowUpCard = ({ lead, onPress, activeTab }) => {
    const getContactName = () => {
        if (!lead.contact) return 'N/A';
        const firstName = lead.contact.firstName || '';
        const lastName = lead.contact.lastName || '';
        const fullName = `${firstName} ${lastName}`.trim();
        return fullName || lead.contact.name || 'N/A';
    };

    const getCompanyName = () => lead.company?.name || '';
    const email = lead.contact?.email || '';
    const phone = lead.contact?.phone || lead.contact?.mobile || '';

    const getDaysLabel = () => {
        if (!lead.dueDate && !lead.followUpDate) return null;
        const dateStr = lead.dueDate || lead.followUpDate;
        try {
            const today = new Date();
            const dueDate = new Date(dateStr);
            today.setHours(0, 0, 0, 0);
            dueDate.setHours(0, 0, 0, 0);
            const diffDays = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));
            if (diffDays > 0) return `${diffDays}d overdue`;
            if (diffDays === 0) return 'Due today';
            return `In ${Math.abs(diffDays)} days`;
        } catch {
            return null;
        }
    };

    const contactName = getContactName();
    const company = getCompanyName();
    const daysLabel = getDaysLabel();

    return (
        <TouchableOpacity
            style={styles.card}
            activeOpacity={0.85}
            onPress={onPress}
        >
            <View style={styles.cardHeader}>
                <View style={[styles.avatar, { backgroundColor: Colors.primaryBackground }]}>
                    <IonIcon name="person" size={ms(18)} color={Colors.primary} />
                </View>
                <View style={styles.cardInfo}>
                    <Text style={styles.cardName} numberOfLines={1}>{contactName}</Text>
                    {company ? <Text style={styles.cardCompany}>{company}</Text> : null}
                </View>
                {daysLabel && (
                    <View style={[
                        styles.cardMeta,
                        activeTab === TAB_OVERDUE && { backgroundColor: Colors.dangerBg },
                    ]}>
                        <Text style={[
                            styles.timeText,
                            activeTab === TAB_OVERDUE && { color: Colors.danger },
                        ]}>{daysLabel}</Text>
                    </View>
                )}
            </View>
            <View style={styles.cardFooter}>
                <View style={styles.footerRow}>
                    {email ? (
                        <TouchableOpacity
                            style={styles.contactTag}
                            onPress={() => Linking.openURL(`mailto:${email}`)}
                        >
                            <IonIcon name="mail-outline" size={12} color={Colors.textTertiary} />
                            <Text style={styles.contactText} numberOfLines={1}>{email}</Text>
                        </TouchableOpacity>
                    ) : null}
                    {phone ? (
                        <TouchableOpacity
                            style={styles.contactTag}
                            onPress={() => Linking.openURL(`tel:${phone}`)}
                        >
                            <IonIcon name="call-outline" size={12} color={Colors.textTertiary} />
                            <Text style={styles.contactText}>{phone}</Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            </View>
        </TouchableOpacity>
    );
};

const FollowUpEngineScreen = ({ navigation }) => {
    const [activeTab, setActiveTab] = useState(TAB_DUE_TODAY);
    const [data, setData] = useState({
        [TAB_DUE_TODAY]: [],
        [TAB_OVERDUE]: [],
        [TAB_RULE_GENERATED]: []
    });
    const [pagination, setPagination] = useState({
        [TAB_DUE_TODAY]: { page: 1, total: 0, hasMore: true },
        [TAB_OVERDUE]: { page: 1, total: 0, hasMore: true },
        [TAB_RULE_GENERATED]: { page: 1, total: 0, hasMore: true }
    });
    const [loading, setLoading] = useState({
        [TAB_DUE_TODAY]: true,
        [TAB_OVERDUE]: true,
        [TAB_RULE_GENERATED]: true
    });
    const [isFetchingMore, setIsFetchingMore] = useState({
        [TAB_DUE_TODAY]: false,
        [TAB_OVERDUE]: false,
        [TAB_RULE_GENERATED]: false
    });
    const [refreshing, setRefreshing] = useState(false);

    const API_METHODS = {
        [TAB_DUE_TODAY]: (params) => API.followUp.getDueToday(params),
        [TAB_OVERDUE]: (params) => API.followUp.getOverdue(params),
        [TAB_RULE_GENERATED]: (params) => API.followUp.getRuleGenerated({ ...params, status: 'open' })
    };

    const getListData = (tabData) => {
        if (!tabData) return [];
        if (Array.isArray(tabData)) return tabData;
        return tabData.data || tabData.leads || [];
    };

    const fetchTabData = async (tab, page = 1, isLoadMore = false) => {
        try {
            if (isLoadMore) {
                setIsFetchingMore(prev => ({ ...prev, [tab]: true }));
            } else {
                setLoading(prev => ({ ...prev, [tab]: true }));
            }

            const apiCall = API_METHODS[tab];
            const response = await apiCall({ page, limit: 10 });

            if (response.success) {
                const responseData = response.data || {};
                const newList = getListData(responseData);
                const totalItems = responseData.pagination?.totalItems || responseData.total || responseData.count || 0;

                setData(prev => {
                    if (isLoadMore) {
                        const existingList = getListData(prev[tab]);
                        const existingIds = new Set(existingList.map(item => item._id || item.id));
                        const uniqueNewList = newList.filter(item => {
                            const id = item._id || item.id;
                            return !id || !existingIds.has(id);
                        });
                        const mergedList = [...existingList, ...uniqueNewList];
                        return {
                            ...prev,
                            [tab]: Array.isArray(prev[tab]) ? mergedList : { ...prev[tab], data: mergedList }
                        };
                    } else {
                        return { ...prev, [tab]: responseData };
                    }
                });

                setPagination(prev => ({
                    ...prev,
                    [tab]: { page, total: totalItems, hasMore: newList.length === 10 }
                }));
            }
        } catch (error) {
            console.error(`Error fetching data for ${tab}:`, error);
        } finally {
            if (isLoadMore) {
                setIsFetchingMore(prev => ({ ...prev, [tab]: false }));
            } else {
                setLoading(prev => ({ ...prev, [tab]: false }));
            }
        }
    };

    const fetchAllData = async () => {
        setPagination({
            [TAB_DUE_TODAY]: { page: 1, total: 0, hasMore: true },
            [TAB_OVERDUE]: { page: 1, total: 0, hasMore: true },
            [TAB_RULE_GENERATED]: { page: 1, total: 0, hasMore: true }
        });

        await Promise.all([
            fetchTabData(TAB_DUE_TODAY, 1, false),
            fetchTabData(TAB_OVERDUE, 1, false),
            fetchTabData(TAB_RULE_GENERATED, 1, false)
        ]);
    };

    useFocusEffect(
        useCallback(() => {
            fetchAllData();
        }, [])
    );

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        fetchAllData().then(() => setRefreshing(false));
    }, []);

    const handleLoadMore = () => {
        if (isFetchingMore[activeTab] || loading[activeTab] || !pagination[activeTab].hasMore) return;
        const nextPage = pagination[activeTab].page + 1;
        fetchTabData(activeTab, nextPage, true);
    };

    const renderFooter = () => {
        if (!isFetchingMore[activeTab]) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
            </View>
        );
    };

    // Filter pills — matching Expo FollowUpScreen design
    const renderFilters = () => (
        <View style={styles.filtersRow}>
            {FILTERS.map((f) => {
                const active = activeTab === f.id;
                const count = getListData(data[f.id]).length;
                return (
                    <TouchableOpacity
                        key={f.id}
                        style={[
                            styles.filterChip,
                            active && { backgroundColor: f.color, borderColor: f.color },
                        ]}
                        onPress={() => setActiveTab(f.id)}
                        activeOpacity={0.8}
                    >
                        <IonIcon
                            name={f.icon}
                            size={ms(16)}
                            color={active ? '#fff' : f.color}
                        />
                        <Text style={[styles.filterLabel, active && { color: '#fff' }]}>{f.label}</Text>
                        <View style={[styles.filterBadge, active && { backgroundColor: 'rgba(255,255,255,0.3)' }]}>
                            <Text style={[styles.filterBadgeText, active && { color: '#fff' }]}>
                                {pagination[f.id]?.total || count}
                            </Text>
                        </View>
                    </TouchableOpacity>
                );
            })}
        </View>
    );

    const renderEmptyState = () => {
        if (loading[activeTab]) return <View />;
        return (
            <View style={styles.emptyState}>
                <IonIcon name="checkmark-done-circle" size={ms(56)} color={Colors.primaryBackground} />
                <Text style={styles.emptyTitle}>All caught up!</Text>
                <Text style={styles.emptySubtitle}>No pending follow-ups</Text>
            </View>
        );
    };

    const handlePress = (item) => {
        if (item._id || item.id) {
            if (activeTab === TAB_OVERDUE) {
                navigation.navigate(ROUTES.LEAD_DETAILS, { lead: item, id: item._id || item.id });
            }
        }
    };

    const currentList = getListData(data[activeTab]);

    return (
        <SafeAreaView style={styles.container} edges={['top']}>
            <CommonHeader navigation={navigation} />
            {renderFilters()}

            {loading[activeTab] && !refreshing && !isFetchingMore ? (
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            ) : (
                <FlatList
                    data={currentList}
                    keyExtractor={(item) => (item._id || item.id || Math.random().toString())}
                    renderItem={({ item }) => (
                        <FollowUpCard lead={item} onPress={() => handlePress(item)} activeTab={activeTab} />
                    )}
                    contentContainerStyle={styles.listContent}
                    ListEmptyComponent={renderEmptyState}
                    refreshControl={
                        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
                    }
                    showsVerticalScrollIndicator={false}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                />
            )}
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.background,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Filters — matching Expo FollowUpScreen
    filtersRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    filterChip: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: ms(10),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        gap: 4,
    },
    filterLabel: {
        fontSize: ms(11),
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    filterBadge: {
        backgroundColor: Colors.background,
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    filterBadgeText: {
        fontSize: ms(10),
        fontWeight: '700',
        color: Colors.textSecondary,
    },

    // List
    listContent: {
        paddingHorizontal: Spacing.lg,
        paddingBottom: ms(100),
    },

    // Card — matching Expo FollowUpScreen
    card: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.lg,
        padding: ms(14),
        marginBottom: Spacing.md,
        ...Shadow.sm,
    },
    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    avatar: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(12),
        justifyContent: 'center',
        alignItems: 'center',
    },
    cardInfo: {
        flex: 1,
        marginLeft: Spacing.md,
    },
    cardName: {
        fontSize: ms(15),
        fontWeight: '700',
        color: Colors.textPrimary,
    },
    cardCompany: {
        fontSize: ms(12),
        color: Colors.textSecondary,
        marginTop: 1,
    },
    cardMeta: {
        backgroundColor: Colors.warningBg,
        paddingHorizontal: ms(8),
        paddingVertical: ms(4),
        borderRadius: ms(8),
    },
    timeText: {
        fontSize: ms(10),
        fontWeight: '600',
        color: Colors.warning,
    },
    cardFooter: {
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
    },
    footerRow: {
        flexDirection: 'row',
        gap: Spacing.md,
        flexWrap: 'wrap',
    },
    contactTag: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    contactText: {
        fontSize: ms(11),
        color: Colors.textTertiary,
    },

    // Empty State
    emptyState: {
        alignItems: 'center',
        paddingTop: ms(80),
    },
    emptyTitle: {
        fontSize: ms(18),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginTop: Spacing.md,
    },
    emptySubtitle: {
        fontSize: ms(14),
        color: Colors.textTertiary,
        marginTop: 4,
    },

    // Footer
    footerLoader: {
        paddingVertical: Spacing.md,
        alignItems: 'center',
        marginBottom: Spacing.xl,
    },
});

export default FollowUpEngineScreen;
