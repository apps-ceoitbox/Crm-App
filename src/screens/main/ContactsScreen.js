/**
 * Contacts Screen
 * Screen for managing contacts — UI matched to Expo ContactsScreen
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    View,
    Text,
    StyleSheet,
    FlatList,
    TouchableOpacity,
    ActivityIndicator,
    RefreshControl,
    TextInput,
    Linking,
    Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText, AppButton } from '../../components';
import { useAuth } from '../../context';
import { contactsAPI } from '../../api';
import { showError } from '../../utils';

const LIMIT = 50;

const STATUS_COLORS = {
    Active: { color: '#10B981', bg: '#ECFDF5' },
    Inactive: { color: '#9CA3AF', bg: '#F3F4F6' },
    Prospect: { color: '#3B82F6', bg: '#EFF6FF' },
};

const AVATAR_PALETTE = ['#4D8733', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#6366F1'];

function getInitials(first, last) {
    const f = first?.[0] || '';
    const l = last?.[0] || '';
    return (f + l).toUpperCase() || '?';
}

function getAvatarColor(name) {
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return AVATAR_PALETTE[Math.abs(hash) % AVATAR_PALETTE.length];
}

// Contact Card — matching Expo ContactsScreen
const ContactCard = ({ contact, onEdit, onDelete, onPress }) => {
    const firstName = contact.firstName || contact.first_name || '';
    const lastName = contact.lastName || contact.last_name || '';
    const fullName = `${firstName} ${lastName}`.trim() || contact.name || 'Unknown';
    const avatarColor = getAvatarColor(fullName);
    const statusCfg = STATUS_COLORS[contact.status] || STATUS_COLORS.Active;
    const location = [contact.city, contact.state, contact.country].filter(Boolean).join(', ');

    return (
        <TouchableOpacity style={styles.contactCard} onPress={onPress} activeOpacity={0.85}>
            {/* Top section */}
            <View style={styles.cardTop}>
                <View style={[styles.avatar, { backgroundColor: avatarColor + '18' }]}>
                    <Text style={[styles.avatarText, { color: avatarColor }]}>
                        {getInitials(firstName, lastName)}
                    </Text>
                </View>
                <View style={styles.cardTopInfo}>
                    <Text style={styles.contactName}>{fullName}</Text>
                    {(contact.designation || contact.company || contact.companyName) ? (
                        <Text style={styles.contactRole} numberOfLines={1}>
                            {[contact.designation || contact.title, contact.company || contact.companyName].filter(Boolean).join(' at ')}
                        </Text>
                    ) : null}
                </View>
                <View style={[styles.statusBadge, { backgroundColor: statusCfg.bg }]}>
                    <Text style={[styles.statusText, { color: statusCfg.color }]}>{contact.status || 'Active'}</Text>
                </View>
            </View>

            {/* Quick info chips */}
            <View style={styles.infoChipsRow}>
                {contact.email ? (
                    <TouchableOpacity
                        style={styles.infoChip}
                        onPress={() => Linking.openURL(`mailto:${contact.email}`)}
                    >
                        <IonIcon name="mail-outline" size={13} color={Colors.info} />
                        <Text style={styles.infoChipText} numberOfLines={1}>{contact.email}</Text>
                    </TouchableOpacity>
                ) : null}
                {(contact.phone || contact.mobile) ? (
                    <TouchableOpacity
                        style={styles.infoChip}
                        onPress={() => Linking.openURL(`tel:${contact.phone || contact.mobile}`)}
                    >
                        <IonIcon name="call-outline" size={13} color={Colors.primary} />
                        <Text style={styles.infoChipText}>{contact.phone || contact.mobile}</Text>
                    </TouchableOpacity>
                ) : null}
                {location ? (
                    <View style={styles.infoChip}>
                        <IonIcon name="location-outline" size={13} color={Colors.textTertiary} />
                        <Text style={styles.infoChipText} numberOfLines={1}>{location}</Text>
                    </View>
                ) : null}
            </View>

            {/* Actions */}
            <View style={styles.cardActions}>
                <TouchableOpacity style={styles.cardActionBtn} onPress={() => onEdit?.(contact)}>
                    <IonIcon name="create-outline" size={16} color={Colors.info} />
                    <Text style={[styles.cardActionText, { color: Colors.info }]}>Edit</Text>
                </TouchableOpacity>
                {(contact.phone || contact.mobile) ? (
                    <TouchableOpacity
                        style={styles.cardActionBtn}
                        onPress={() => Linking.openURL(`tel:${contact.phone || contact.mobile}`)}
                    >
                        <IonIcon name="call-outline" size={16} color={Colors.primary} />
                        <Text style={[styles.cardActionText, { color: Colors.primary }]}>Call</Text>
                    </TouchableOpacity>
                ) : null}
                <TouchableOpacity style={styles.cardActionBtn} onPress={() => onDelete?.(contact)}>
                    <IonIcon name="trash-outline" size={16} color={Colors.danger} />
                    <Text style={[styles.cardActionText, { color: Colors.danger }]}>Delete</Text>
                </TouchableOpacity>
            </View>
        </TouchableOpacity>
    );
};

const ContactsScreen = ({ navigation }) => {
    const [searchQuery, setSearchQuery] = useState('');
    const [statusFilter, setStatusFilter] = useState(null);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [contacts, setContacts] = useState([]);
    const { user } = useAuth();
    const searchTimeoutRef = useRef(null);
    const currentSearchRef = useRef('');
    const isInitialLoadRef = useRef(true);

    // Debounced search effect
    useEffect(() => {
        if (isInitialLoadRef.current) return;
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        currentSearchRef.current = searchQuery;
        if (!searchQuery.trim()) {
            fetchContacts(1, false, '');
            return;
        }
        searchTimeoutRef.current = setTimeout(() => {
            fetchContacts(1, false, searchQuery.trim());
        }, 300);
        return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
    }, [searchQuery]);

    useEffect(() => {
        fetchContacts(1, true, '');
        isInitialLoadRef.current = false;
    }, []);

    const fetchContacts = async (pageNum = 1, showLoader = false, search = '') => {
        try {
            if (showLoader) setLoading(true);
            else if (pageNum > 1) setLoadingMore(true);

            const params = { page: pageNum, limit: LIMIT };
            if (search) params.search = search;

            const response = await contactsAPI.getAll(params);
            if (search !== currentSearchRef.current && search !== '') return;

            if (response.success) {
                const contactsData = response.data?.data || response.data?.contacts || response.data || [];
                const newContacts = Array.isArray(contactsData) ? contactsData : [];
                if (pageNum === 1) setContacts(newContacts);
                else setContacts(prev => [...prev, ...newContacts]);
                setHasMore(newContacts.length === LIMIT);
                setPage(pageNum);
            } else {
                showError('Error', response.error || 'Failed to load contacts');
            }
        } catch (error) {
            showError('Error', 'Failed to load contacts');
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setHasMore(true);
        fetchContacts(1, false, searchQuery.trim());
    }, [searchQuery]);

    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore && !loading) {
            fetchContacts(page + 1, false, searchQuery.trim());
        }
    }, [loadingMore, hasMore, loading, page, searchQuery]);

    const handleEditContact = (contact) => {
        navigation.navigate('EditContact', { contact });
    };

    const handleDeleteContact = (contact) => {
        const name = `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || 'this contact';
        Alert.alert('Delete Contact', `Remove "${name}"?`, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete:', contact._id) },
        ]);
    };

    // Filtered contacts
    const filteredContacts = statusFilter
        ? contacts.filter(c => c.status === statusFilter)
        : contacts;

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyState}>
                <View style={styles.emptyCircle}>
                    <IonIcon name="people" size={ms(40)} color={Colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No contacts yet</Text>
                <Text style={styles.emptySubtitle}>Tap + to add your first contact</Text>
            </View>
        );
    };

    return (
        <View style={styles.container}>
            <SafeAreaView edges={['top']} style={{ flex: 1 }}>
                {/* Header — matching Expo */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                        <IonIcon name="arrow-back" size={22} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <View style={styles.headerCenter}>
                        <Text style={styles.headerTitle}>Contacts</Text>
                        <Text style={styles.headerCount}>{contacts.length} contacts</Text>
                    </View>
                    <TouchableOpacity
                        style={styles.addBtnSmall}
                        onPress={() => navigation.navigate('AddContact')}
                    >
                        <IonIcon name="add" size={22} color="#fff" />
                    </TouchableOpacity>
                </View>

                {/* Search */}
                <View style={styles.searchFilterRow}>
                    <View style={styles.searchBarInline}>
                        <IonIcon name="search" size={16} color={Colors.textTertiary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search contacts..."
                            placeholderTextColor={Colors.textTertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                        {searchQuery ? (
                            <TouchableOpacity onPress={() => setSearchQuery('')}>
                                <IonIcon name="close-circle" size={16} color={Colors.textTertiary} />
                            </TouchableOpacity>
                        ) : null}
                    </View>
                </View>

                {/* Status filter chips */}
                <View style={styles.filterRow}>
                    <TouchableOpacity
                        style={[styles.filterChip, !statusFilter && styles.filterChipActive]}
                        onPress={() => setStatusFilter(null)}
                    >
                        <Text style={[styles.filterChipText, !statusFilter && styles.filterChipTextActive]}>All</Text>
                    </TouchableOpacity>
                    {Object.entries(STATUS_COLORS).map(([status, cfg]) => (
                        <TouchableOpacity
                            key={status}
                            style={[
                                styles.filterChip,
                                statusFilter === status && { backgroundColor: cfg.color, borderColor: cfg.color },
                            ]}
                            onPress={() => setStatusFilter(statusFilter === status ? null : status)}
                        >
                            <View style={[styles.filterDot, { backgroundColor: statusFilter === status ? '#fff' : cfg.color }]} />
                            <Text style={[styles.filterChipText, statusFilter === status && { color: '#fff' }]}>{status}</Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {/* List */}
                {loading ? (
                    <View style={styles.centered}>
                        <ActivityIndicator size="large" color={Colors.primary} />
                    </View>
                ) : (
                    <FlatList
                        data={filteredContacts}
                        keyExtractor={(item) => item._id || item.id || String(Math.random())}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <ContactCard
                                contact={item}
                                onPress={() => navigation.navigate('ContactDetails', {
                                    contact: item,
                                    contactId: item._id || item.id,
                                })}
                                onEdit={handleEditContact}
                                onDelete={handleDeleteContact}
                            />
                        )}
                        ListEmptyComponent={renderEmpty}
                        ListFooterComponent={renderFooter}
                        onEndReached={loadMore}
                        onEndReachedThreshold={0.5}
                        refreshControl={
                            <RefreshControl
                                refreshing={refreshing}
                                onRefresh={onRefresh}
                                colors={[Colors.primary]}
                            />
                        }
                    />
                )}
            </SafeAreaView>
        </View>
    );
};

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Header — matching Expo
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: Spacing.lg,
        paddingTop: Spacing.sm,
        paddingBottom: Spacing.md,
    },
    backBtn: {
        width: ms(40),
        height: ms(40),
        borderRadius: ms(20),
        backgroundColor: Colors.surface,
        justifyContent: 'center',
        alignItems: 'center',
        ...Shadow.sm,
    },
    headerCenter: { flex: 1, marginLeft: Spacing.md },
    headerTitle: { fontSize: ms(22), fontWeight: '800', color: Colors.textPrimary },
    headerCount: { fontSize: ms(11), color: Colors.textTertiary, marginTop: 1 },
    addBtnSmall: {
        width: ms(42),
        height: ms(42),
        borderRadius: ms(14),
        backgroundColor: Colors.primary,
        justifyContent: 'center',
        alignItems: 'center',
    },

    // Search
    searchFilterRow: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm },
    searchBarInline: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md,
        height: ms(42),
        borderWidth: 1,
        borderColor: Colors.surfaceBorder,
    },
    searchInput: {
        flex: 1,
        marginLeft: Spacing.sm,
        fontSize: ms(14),
        color: Colors.textPrimary,
    },

    // Filters
    filterRow: {
        flexDirection: 'row',
        paddingHorizontal: Spacing.lg,
        gap: Spacing.sm,
        marginBottom: Spacing.md,
    },
    filterChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: ms(12),
        paddingVertical: ms(7),
        borderRadius: BorderRadius.round,
        backgroundColor: Colors.surface,
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
    },
    filterChipActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    filterChipText: { fontSize: ms(11), fontWeight: '600', color: Colors.textSecondary },
    filterChipTextActive: { color: '#fff' },
    filterDot: { width: 6, height: 6, borderRadius: 3 },

    // List
    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: ms(100) },

    // Contact card — matching Expo
    contactCard: {
        backgroundColor: Colors.surface,
        borderRadius: BorderRadius.xl,
        padding: ms(16),
        marginBottom: Spacing.md,
        ...Shadow.sm,
    },
    cardTop: { flexDirection: 'row', alignItems: 'center' },
    avatar: {
        width: ms(44),
        height: ms(44),
        borderRadius: ms(14),
        justifyContent: 'center',
        alignItems: 'center',
    },
    avatarText: { fontSize: ms(16), fontWeight: '700' },
    cardTopInfo: { flex: 1, marginLeft: Spacing.md },
    contactName: { fontSize: ms(16), fontWeight: '700', color: Colors.textPrimary },
    contactRole: { fontSize: ms(12), color: Colors.textSecondary, marginTop: 1 },
    statusBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    statusText: { fontSize: ms(10), fontWeight: '700' },

    // Info chips
    infoChipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: Spacing.md },
    infoChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: Colors.background,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
        maxWidth: '100%',
    },
    infoChipText: { fontSize: ms(11), color: Colors.textSecondary, flexShrink: 1 },

    // Actions
    cardActions: {
        flexDirection: 'row',
        gap: Spacing.md,
        marginTop: Spacing.md,
        paddingTop: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: Colors.divider,
    },
    cardActionBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    cardActionText: { fontSize: ms(12), fontWeight: '600' },

    // Empty
    emptyState: { alignItems: 'center', paddingTop: ms(80) },
    emptyCircle: {
        width: ms(80),
        height: ms(80),
        borderRadius: 40,
        backgroundColor: Colors.primaryBackground,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: Spacing.lg,
    },
    emptyTitle: { fontSize: ms(18), fontWeight: '700', color: Colors.textPrimary },
    emptySubtitle: { fontSize: ms(13), color: Colors.textTertiary, marginTop: 4 },

    // Footer
    footerLoader: { paddingVertical: Spacing.md, alignItems: 'center' },
});

export default ContactsScreen;
