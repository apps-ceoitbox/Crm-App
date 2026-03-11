/**
 * Notifications Screen
 * Live list of notifications — UI matched to Expo NotificationsScreen
 */

import React, { useCallback, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    FlatList,
    ActivityIndicator,
    RefreshControl,
    Image,
    Modal,
    TouchableWithoutFeedback,
} from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import { ScreenWrapper, AppText } from '../../components';
import { useNotification } from '../../context';

const CATEGORIES = ['CRM', 'Marketing', 'Other'];
const CAT_ICONS = {
    CRM: 'people',
    Marketing: 'megaphone',
    Other: 'ellipsis-horizontal',
};

const SUB_ICONS = {
    Leads: 'trending-up',
    Tasks: 'checkbox',
    Companies: 'grid',
    Campaigns: 'megaphone-outline',
    Broadcasts: 'mail-outline',
};

const CRM_TYPES = ['lead', 'task', 'company'];
const MARKETING_TYPES = ['campaign', 'broadcast'];
const OTHER_TYPES = ['system', 'announcement'];

const CRM_SUBS = ['Leads', 'Tasks', 'Companies'];
const MARKETING_SUBS = ['Campaigns', 'Broadcasts'];

const getUnreadCount = (items) => (items || []).filter((n) => !n.read).length;

const isValidImageUrl = (url) =>
    typeof url === 'string' &&
    url.trim().length > 0 &&
    (url.startsWith('http://') || url.startsWith('https://'));

const timeAgo = (timestamp) => {
    if (!timestamp) return '';
    const diff = Date.now() - new Date(timestamp).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
};

const NotificationItem = ({ item, onPress, onImagePress, onMarkRead }) => (
    <TouchableOpacity
        style={[styles.notifCard, !item.read && styles.notifCardUnread]}
        onPress={() => {
            onMarkRead(item._id);
            onPress(item);
        }}
        activeOpacity={0.85}
    >
        {!item.read ? <View style={styles.unreadDot} /> : null}
        {isValidImageUrl(item.imageUrl) && (
            <TouchableOpacity
                style={styles.thumb}
                activeOpacity={0.8}
                onPress={() => {
                    onMarkRead(item._id);
                    if (onImagePress) onImagePress(item.imageUrl);
                }}
            >
                <Image source={{ uri: item.imageUrl }} style={styles.thumbImage} />
            </TouchableOpacity>
        )}
        <View style={styles.notifContent}>
            <Text style={[styles.notifTitle, !item.read && { fontWeight: '700' }]}>{item.title}</Text>
            <Text style={styles.notifBody} numberOfLines={2}>{item.description}</Text>
        </View>
        <Text style={styles.notifTime}>{timeAgo(item.createdAt)}</Text>
    </TouchableOpacity>
);

const NotificationsScreen = () => {
    const navigation = useNavigation();
    const [activeCat, setActiveCat] = useState('CRM');
    const [activeSub, setActiveSub] = useState('Leads');

    // Image Preview State
    const [previewVisible, setPreviewVisible] = useState(false);
    const [previewImageUri, setPreviewImageUri] = useState(null);
    const {
        notifications,
        notificationsLoading,
        unreadCount,
        fetchNotifications,
        markNotificationAsRead,
        markAllNotificationsAsRead,
    } = useNotification();

    // Get sub-categories based on active main category
    const currentSubCategories = useMemo(() => {
        if (activeCat === 'CRM') return CRM_SUBS;
        if (activeCat === 'Marketing') return MARKETING_SUBS;
        return [];
    }, [activeCat]);

    // Update activeSub when category changes
    const handleCatPress = (cat) => {
        setActiveCat(cat);
        if (cat === 'CRM') setActiveSub('Leads');
        else if (cat === 'Marketing') setActiveSub('Campaigns');
        else setActiveSub(null);
    };

    const { crmNotifications, marketingNotifications, otherNotifications, filteredList } = useMemo(() => {
        const crm = (notifications || []).filter((n) => CRM_TYPES.includes(n.type));
        const marketing = (notifications || []).filter((n) => MARKETING_TYPES.includes(n.type));
        const other = (notifications || []).filter((n) => OTHER_TYPES.includes(n.type));

        const catList =
            activeCat === 'CRM'
                ? crm
                : activeCat === 'Marketing'
                    ? marketing
                    : other;

        // Filter by sub-category if applicable
        let list = catList;
        if (activeCat === 'CRM') {
            list = catList.filter((n) => {
                if (activeSub === 'Leads') return n.type === 'lead';
                if (activeSub === 'Tasks') return n.type === 'task';
                if (activeSub === 'Companies') return n.type === 'company';
                return true;
            });
        } else if (activeCat === 'Marketing') {
            list = catList.filter((n) => {
                if (activeSub === 'Campaigns') return n.type === 'campaign';
                if (activeSub === 'Broadcasts') return n.type === 'broadcast';
                return true;
            });
        }

        return {
            crmNotifications: crm,
            marketingNotifications: marketing,
            otherNotifications: other,
            filteredList: list,
        };
    }, [notifications, activeCat, activeSub]);

    const catCounts = useMemo(() => ({
        CRM: getUnreadCount(crmNotifications),
        Marketing: getUnreadCount(marketingNotifications),
        Other: getUnreadCount(otherNotifications),
    }), [crmNotifications, marketingNotifications, otherNotifications]);

    const subCounts = useMemo(() => {
        const counts = {};
        if (activeCat === 'CRM') {
            counts.Leads = crmNotifications.filter((n) => n.type === 'lead' && !n.read).length;
            counts.Tasks = crmNotifications.filter((n) => n.type === 'task' && !n.read).length;
            counts.Companies = crmNotifications.filter((n) => n.type === 'company' && !n.read).length;
        } else if (activeCat === 'Marketing') {
            counts.Campaigns = marketingNotifications.filter((n) => n.type === 'campaign' && !n.read).length;
            counts.Broadcasts = marketingNotifications.filter((n) => n.type === 'broadcast' && !n.read).length;
        }
        return counts;
    }, [activeCat, crmNotifications, marketingNotifications]);


    useFocusEffect(
        useCallback(() => {
            fetchNotifications();
        }, [fetchNotifications])
    );

    const handleNotificationPress = (item) => {
        if (item.entityId && item.type === 'lead') {
            navigation.navigate('LeadDetails', { id: item.entityId });
        } else if (item.entityId && item.type === 'task') {
            navigation.navigate('TaskDetails', { id: item.entityId });
        }
    };

    const handleImagePress = (uri) => {
        setPreviewImageUri(uri);
        setPreviewVisible(true);
    };

    const closeImagePreview = () => {
        setPreviewVisible(false);
        setPreviewImageUri(null);
    };

    if (notificationsLoading && notifications.length === 0) {
        return (
            <ScreenWrapper>
                <View style={styles.centered}>
                    <ActivityIndicator size="large" color={Colors.primary} />
                </View>
            </ScreenWrapper>
        );
    }

    return (
        <ScreenWrapper backgroundColor={Colors.background}>
            {/* Header — Expo style */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <IonIcon name="arrow-back" size={ms(22)} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Notifications</Text>
                <View style={styles.liveIndicator}>
                    <View style={styles.liveDot} />
                    <Text style={styles.liveText}>Live</Text>
                </View>
            </View>

            {/* Category tabs — Expo style */}
            <View style={styles.catRow}>
                {CATEGORIES.map((cat) => {
                    const active = activeCat === cat;
                    return (
                        <TouchableOpacity
                            key={cat}
                            style={[styles.catTab, active && styles.catTabActive]}
                            onPress={() => handleCatPress(cat)}
                        >
                            <IonIcon
                                name={CAT_ICONS[cat]}
                                size={ms(16)}
                                color={active ? Colors.primary : Colors.textTertiary}
                            />
                            <Text style={[styles.catText, active && styles.catTextActive]}>{cat}</Text>
                            {catCounts[cat] > 0 ? (
                                <View style={styles.catBadge}>
                                    <Text style={styles.catBadgeText}>{catCounts[cat]}</Text>
                                </View>
                            ) : null}
                        </TouchableOpacity>
                    );
                })}
            </View>

            {/* Sub-category pills — Expo style */}
            {activeCat !== 'Other' && (
                <View style={styles.subRow}>
                    {currentSubCategories.map((sub) => {
                        const active = activeSub === sub;
                        return (
                            <TouchableOpacity
                                key={sub}
                                style={[styles.subPill, active && styles.subPillActive]}
                                onPress={() => setActiveSub(sub)}
                                activeOpacity={0.8}
                            >
                                <IonIcon
                                    name={SUB_ICONS[sub]}
                                    size={ms(14)}
                                    color={active ? '#fff' : Colors.textSecondary}
                                />
                                <Text style={[styles.subText, active && styles.subTextActive]}>{sub}</Text>
                                {subCounts[sub] > 0 ? (
                                    <View style={[styles.subBadge, active && styles.subBadgeActive]}>
                                        <Text style={[styles.subBadgeText, active && { color: '#fff' }]}>{subCounts[sub]}</Text>
                                    </View>
                                ) : null}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* Notification list */}
            <FlatList
                data={filteredList}
                keyExtractor={(n) => n._id}
                contentContainerStyle={styles.listContent}
                showsVerticalScrollIndicator={false}
                renderItem={({ item }) => (
                    <NotificationItem
                        item={item}
                        onPress={handleNotificationPress}
                        onImagePress={handleImagePress}
                        onMarkRead={markNotificationAsRead}
                    />
                )}
                ListFooterComponent={
                    notifications.length > 0 ? (
                        <TouchableOpacity
                            style={styles.markAllBtn}
                            onPress={markAllNotificationsAsRead}
                        >
                            <Text style={styles.markAllText}>Mark all as read</Text>
                        </TouchableOpacity>
                    ) : null
                }
                ListEmptyComponent={
                    <View style={styles.emptyState}>
                        <IonIcon name="notifications-off-outline" size={ms(48)} color={Colors.surfaceBorder} />
                        <Text style={styles.emptyTitle}>No notifications</Text>
                        <Text style={styles.emptySubtitle}>
                            You're all caught up in {activeCat}{activeSub ? ` / ${activeSub}` : ''}
                        </Text>
                    </View>
                }
                refreshControl={
                    <RefreshControl
                        refreshing={notificationsLoading}
                        onRefresh={fetchNotifications}
                        colors={[Colors.primary]}
                    />
                }
            />

            {/* Image Preview Modal */}
            <Modal
                visible={previewVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={closeImagePreview}
            >
                <TouchableWithoutFeedback onPress={closeImagePreview}>
                    <View style={styles.modalOverlay}>
                        <TouchableWithoutFeedback onPress={(e) => e.stopPropagation()}>
                            <View style={styles.modalContent}>
                                <TouchableOpacity
                                    style={styles.closePreviewBtn}
                                    onPress={closeImagePreview}
                                    activeOpacity={0.7}
                                >
                                    <IonIcon name="close" size={ms(28)} color="#fff" />
                                </TouchableOpacity>
                                {previewImageUri && (
                                    <Image
                                        source={{ uri: previewImageUri }}
                                        style={styles.previewImage}
                                        resizeMode="contain"
                                    />
                                )}
                            </View>
                        </TouchableWithoutFeedback>
                    </View>
                </TouchableWithoutFeedback>
            </Modal>
        </ScreenWrapper>
    );
};

const styles = StyleSheet.create({
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Header — matching Expo
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingBottom: Spacing.sm,
    },
    backBtn: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(14),
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.sm,
    },
    headerTitle: {
        flex: 1,
        fontSize: ms(22),
        fontWeight: '800',
        color: Colors.textPrimary,
        marginLeft: Spacing.md,
    },
    liveIndicator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    liveDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
        backgroundColor: Colors.primary,
    },
    liveText: {
        fontSize: ms(13),
        fontWeight: '600',
        color: Colors.primary,
    },

    // Category tabs — Expo style
    catRow: {
        flexDirection: 'row',
        // paddingHorizontal: Spacing.lg,
        borderBottomWidth: 1,
        borderBottomColor: Colors.divider,
        marginBottom: Spacing.sm,
    },
    catTab: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: ms(12),
        gap: 5,
        borderBottomWidth: 2,
        borderBottomColor: 'transparent',
    },
    catTabActive: {
        borderBottomColor: Colors.primary,
    },
    catText: {
        fontSize: ms(14),
        fontWeight: '600',
        color: Colors.textTertiary,
    },
    catTextActive: {
        color: Colors.primary,
    },
    catBadge: {
        backgroundColor: Colors.danger,
        borderRadius: 8,
        minWidth: ms(18),
        height: ms(18),
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 4,
    },
    catBadgeText: {
        color: '#fff',
        fontSize: ms(10),
        fontWeight: '700',
    },

    // Sub-category pills — Expo style
    subRow: {
        flexDirection: 'row',
        // paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    subPill: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: ms(10),
        borderRadius: BorderRadius.md,
        backgroundColor: Colors.surface,
        gap: 4,
        ...Shadow.sm,
    },
    subPillActive: {
        backgroundColor: Colors.primary,
    },
    subText: {
        fontSize: ms(14),
        fontWeight: '600',
        color: Colors.textSecondary,
    },
    subTextActive: {
        color: '#fff',
    },
    subBadge: {
        backgroundColor: Colors.divider,
        borderRadius: 8,
        paddingHorizontal: 5,
        paddingVertical: 1,
    },
    subBadgeActive: {
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    subBadgeText: {
        fontSize: ms(10),
        fontWeight: '700',
        color: Colors.textSecondary,
    },

    // Notification cards — Expo style
    listContent: {
        paddingHorizontal: Spacing.sm,
        paddingBottom: ms(40),
    },
    notifCard: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        backgroundColor: Colors.primaryBackground + '30',
        borderRadius: BorderRadius.lg,
        padding: ms(14),
        marginBottom: Spacing.sm,
        // ...Shadow.sm,
    },
    notifCardUnread: {
        backgroundColor: Colors.primaryBackground,
    },
    unreadDot: {
        width: ms(8),
        height: ms(8),
        borderRadius: ms(4),
        backgroundColor: Colors.primary,
        marginTop: ms(6),
        marginRight: Spacing.sm,
    },
    thumb: {
        width: ms(44),
        height: ms(44),
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: Colors.divider,
        marginRight: Spacing.sm,
    },
    thumbImage: {
        width: '100%',
        height: '100%',
    },
    notifContent: {
        flex: 1,
    },
    notifTitle: {
        fontSize: ms(14.5),
        fontWeight: '600',
        color: Colors.textPrimary,
    },
    notifBody: {
        fontSize: ms(12.5),
        color: Colors.textSecondary,
        marginTop: 2,
        lineHeight: ms(18),
    },
    notifTime: {
        fontSize: ms(11),
        color: Colors.textTertiary,
        marginLeft: Spacing.sm,
    },
    markAllBtn: {
        alignItems: 'center',
        paddingVertical: ms(14),
        borderTopWidth: 1,
        borderTopColor: Colors.divider,
        marginTop: Spacing.sm,
    },
    markAllText: {
        fontSize: ms(14),
        fontWeight: '600',
        color: Colors.textTertiary,
    },
    emptyState: {
        alignItems: 'center',
        paddingTop: ms(60),
    },
    emptyTitle: {
        fontSize: ms(16),
        fontWeight: '700',
        color: Colors.textPrimary,
        marginTop: Spacing.md,
    },
    emptySubtitle: {
        fontSize: ms(13),
        color: Colors.textTertiary,
        marginTop: 4,
        textAlign: 'center',
    },

    // Image Preview Modal Styles
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalContent: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    closePreviewBtn: {
        position: 'absolute',
        top: vs(50),
        right: ms(20),
        zIndex: 10,
        padding: ms(8),
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        borderRadius: ms(20),
    },
    previewImage: {
        width: '100%',
        height: '75%',
    },
});

export default NotificationsScreen;
