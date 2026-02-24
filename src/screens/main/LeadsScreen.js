/**
 * Leads Screen
 * Display and manage leads — UI matched to Expo project
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  TextInput,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText } from '../../components';
import { leadsAPI } from '../../api';
import { showError } from '../../utils';
import { useAuth, useNotification } from '../../context';
import { ROUTES } from '../../constants';

// Enable LayoutAnimation for Android
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LIMIT = 50;

// Status configuration matching Expo
const STATUS_CONFIG = {
  New: { color: '#3B82F6', bg: '#EFF6FF', icon: 'sparkles' },
  Contacted: { color: '#F59E0B', bg: '#FFFBEB', icon: 'chatbubble' },
  Qualified: { color: '#4D8733', bg: '#EEF5E6', icon: 'checkmark-circle' },
  Converted: { color: '#10B981', bg: '#ECFDF5', icon: 'trophy' },
  Lost: { color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle' },
};

const SOURCE_ICONS = {
  Website: 'globe-outline',
  Referral: 'people-outline',
  LinkedIn: 'logo-linkedin',
  Event: 'calendar-outline',
  Ads: 'megaphone-outline',
  'Cold Call': 'call-outline',
};

function formatValue(val) {
  if (!val) return null;
  if (val >= 100000)
    return `₹${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 1)}L`;
  if (val >= 1000) return `₹${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}K`;
  return `₹${val.toLocaleString('en-IN')}`;
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  if (!name) return '#4D8733';
  const palette = [
    '#4D8733',
    '#3B82F6',
    '#8B5CF6',
    '#EC4899',
    '#F59E0B',
    '#10B981',
    '#EF4444',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// Lead Card - matching Expo design
const LeadCard = ({ lead, onPress, onEdit, onDelete }) => {
  const leadName = lead.contact
    ? `${lead.contact.firstName || ''} ${lead.contact.lastName || ''}`.trim() ||
      lead.title
    : lead.title || 'Untitled Lead';
  const companyName = lead.company?.name || '';
  const statusKey = lead.stage?.name || 'New';
  const sc = STATUS_CONFIG[statusKey] || STATUS_CONFIG.New;
  const avatarColor = getAvatarColor(leadName);
  const phone = lead.contact?.mobile || lead.contact?.phone || '';
  const email = lead.contact?.email || '';
  const source = lead.source?.name || '';
  const salesperson = lead.salesperson?.name || '';
  const leadValue = lead.value || lead.estimatedValue || 0;

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={onPress}
      onLongPress={() => onDelete?.(lead)}
      style={styles.card}
    >
      {/* Status accent strip */}
      <View style={[styles.cardAccent, { backgroundColor: sc.color }]} />

      <View style={styles.cardContent}>
        {/* Row 1: Avatar + Info + Value */}
        <View style={styles.cardTop}>
          <View
            style={[styles.avatar, { backgroundColor: avatarColor + '18' }]}
          >
            <Text style={[styles.avatarText, { color: avatarColor }]}>
              {getInitials(leadName)}
            </Text>
          </View>

          <View style={styles.cardInfo}>
            <Text style={styles.leadName} numberOfLines={1}>
              {leadName}
            </Text>
            {companyName ? (
              <View style={styles.companyRow}>
                <IonIcon
                  name="business-outline"
                  size={12}
                  color={Colors.textTertiary}
                />
                <Text style={styles.companyText} numberOfLines={1}>
                  {companyName}
                </Text>
              </View>
            ) : null}
          </View>

          {leadValue ? (
            <View style={styles.valueContainer}>
              <Text style={styles.valueText}>{formatValue(leadValue)}</Text>
            </View>
          ) : null}
        </View>

        {/* Row 2: Tags + Quick Actions */}
        <View style={styles.cardBottom}>
          <View style={styles.tagsRow}>
            <View style={[styles.statusTag, { backgroundColor: sc.bg }]}>
              <IonIcon name={sc.icon} size={11} color={sc.color} />
              <Text style={[styles.tagText, { color: sc.color }]}>
                {statusKey}
              </Text>
            </View>
            {source ? (
              <View style={styles.sourceTag}>
                <IonIcon
                  name={SOURCE_ICONS[source] || 'ellipsis-horizontal'}
                  size={11}
                  color={Colors.textTertiary}
                />
                <Text style={[styles.tagText, { color: Colors.textSecondary }]}>
                  {source}
                </Text>
              </View>
            ) : null}
          </View>

          <View style={styles.quickActions}>
            {phone ? (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => Linking.openURL(`tel:${phone}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IonIcon name="call" size={15} color={Colors.primary} />
              </TouchableOpacity>
            ) : null}
            {email ? (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => Linking.openURL(`mailto:${email}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IonIcon name="mail" size={15} color="#3B82F6" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Salesperson */}
        {salesperson ? (
          <View style={styles.salespersonRow}>
            <IonIcon
              name="person-circle"
              size={14}
              color={Colors.textTertiary}
            />
            <Text style={styles.salespersonText}>{salesperson}</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

// Stats Card with gradient
const StatsCard = ({ leads }) => {
  const total = leads.length;
  const totalValue = leads.reduce(
    (s, l) => s + (l.value || l.estimatedValue || 0),
    0,
  );
  const qualified = leads.filter(l => {
    const stage = l.stage?.name || '';
    return (
      stage === 'Qualified' || stage === 'Converted' || stage === 'Closed Won'
    );
  }).length;
  const convRate = total > 0 ? Math.round((qualified / total) * 100) : 0;

  return (
    <LinearGradient
      colors={['#4D8733', '#6BA344']}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 0 }}
      style={styles.statsCard}
    >
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{total}</Text>
          <Text style={styles.statLabel}>Total Leads</Text>
        </View>

        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {formatValue(totalValue) || '₹0'}
          </Text>
          <Text style={styles.statLabel}>Pipeline</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{convRate}%</Text>
          <Text style={styles.statLabel}>Qualified</Text>
        </View>
      </View>
    </LinearGradient>
  );
};

const FILTER_STATUSES = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];

const LeadsScreen = ({ navigation }) => {
  const nav = useNavigation();
  const { user } = useAuth();
  const { unreadCount } = useNotification();
  const searchTimeoutRef = useRef(null);
  const currentSearchRef = useRef('');
  const isInitialLoadRef = useRef(true);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [leads, setLeads] = useState([]);

  // Debounced search effect
  useEffect(() => {
    if (isInitialLoadRef.current) return;

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    currentSearchRef.current = searchQuery;

    if (!searchQuery.trim()) {
      fetchLeads(1, false, '');
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      fetchLeads(1, false, searchQuery.trim());
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery]);

  useEffect(() => {
    fetchLeads(1, true, '');
    isInitialLoadRef.current = false;
  }, []);

  const fetchLeads = async (pageNum = 1, showLoader = false, search = '') => {
    try {
      if (showLoader) {
        setLoading(true);
      } else if (pageNum > 1) {
        setLoadingMore(true);
      }

      const params = { page: pageNum, limit: LIMIT };
      if (search) params.search = search;

      const response = await leadsAPI.getAll(params);

      if (search !== currentSearchRef.current && search !== '') return;

      if (response.success) {
        const leadsData =
          response.data?.data || response.data?.leads || response.data || [];
        const newLeads = Array.isArray(leadsData) ? leadsData : [];

        if (pageNum === 1) {
          setLeads(newLeads);
        } else {
          setLeads(prev => [...prev, ...newLeads]);
        }

        setHasMore(newLeads.length === LIMIT);
        setPage(pageNum);
      } else {
        showError('Error', response.error || 'Failed to load leads');
      }
    } catch (error) {
      showError('Error', 'Failed to load leads');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    fetchLeads(1, false, searchQuery.trim());
  }, [searchQuery]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchLeads(page + 1, false, searchQuery.trim());
    }
  }, [loadingMore, hasMore, loading, page, searchQuery]);

  const handleEditLead = lead => {
    nav.navigate('EditLead', { lead });
  };

  const handleDeleteLead = lead => {
    console.log('Delete lead:', lead._id);
  };

  const handleLeadPress = lead => {
    navigation.navigate('LeadDetails', { lead });
  };

  // Filter leads based on active filter
  const filteredLeads = activeFilter
    ? leads.filter(l => (l.stage?.name || 'New') === activeFilter)
    : leads;

  // Render header - matching Expo design
  const renderHeader = () => (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.headerTitle}>Leads</Text>
        {leads.length > 0 && (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{leads.length}</Text>
          </View>
        )}
      </View>
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => {
            LayoutAnimation.configureNext(
              LayoutAnimation.Presets.easeInEaseOut,
            );
            setSearchVisible(!searchVisible);
            if (searchVisible) setSearchQuery('');
          }}
        >
          <IonIcon
            name={searchVisible ? 'close' : 'search'}
            size={20}
            color={Colors.textPrimary}
          />
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => navigation.navigate(ROUTES.NOTIFICATIONS)}
        >
          <IonIcon
            name="notifications-outline"
            size={ms(22)}
            color={Colors.textPrimary}
          />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <Text style={styles.notificationBadgeText}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </Text>
            </View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddLead')}
          activeOpacity={0.85}
        >
          <IonIcon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Search bar
  const renderSearchBar = () => {
    if (!searchVisible) return null;
    return (
      <View style={styles.searchWrap}>
        <View style={styles.searchBar}>
          <IonIcon name="search" size={17} color={Colors.textTertiary} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by name..."
            placeholderTextColor={Colors.textTertiary}
            value={searchQuery}
            onChangeText={setSearchQuery}
            autoFocus
            returnKeyType="search"
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <IonIcon
                name="close-circle"
                size={17}
                color={Colors.textTertiary}
              />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>
    );
  };

  // Filter pills
  const renderFilterPills = () => {
    if (leads.length === 0) return null;
    const allFilters = [null, ...FILTER_STATUSES];
    return (
      <View style={styles.filterWrap}>
        <FlatList
          horizontal
          showsHorizontalScrollIndicator={false}
          data={allFilters}
          keyExtractor={item => item || 'all'}
          renderItem={({ item }) => {
            const active = activeFilter === item;
            const sc = item ? STATUS_CONFIG[item] : null;
            const count = item
              ? leads.filter(l => (l.stage?.name || 'New') === item).length
              : leads.length;
            return (
              <TouchableOpacity
                style={[
                  styles.filterPill,
                  active && {
                    backgroundColor: item ? sc?.bg : Colors.primaryBackground,
                    borderColor: item ? sc?.color : Colors.primary,
                  },
                ]}
                onPress={() => setActiveFilter(item)}
                activeOpacity={0.8}
              >
                {item && sc ? (
                  <View
                    style={[styles.filterDot, { backgroundColor: sc.color }]}
                  />
                ) : null}
                <Text
                  style={[
                    styles.filterText,
                    {
                      color: active
                        ? item
                          ? sc?.color
                          : Colors.primary
                        : Colors.textTertiary,
                    },
                  ]}
                >
                  {item || 'All'}
                </Text>
                <Text
                  style={[
                    styles.filterCount,
                    {
                      color: active
                        ? item
                          ? sc?.color
                          : Colors.primary
                        : Colors.textTertiary,
                    },
                  ]}
                >
                  {count}
                </Text>
              </TouchableOpacity>
            );
          }}
        />
      </View>
    );
  };

  // Render Lead Card
  const renderLeadCard = ({ item }) => (
    <LeadCard
      lead={item}
      onPress={() => handleLeadPress(item)}
      onEdit={handleEditLead}
      onDelete={handleDeleteLead}
    />
  );

  // Footer loader
  const renderFooter = () => {
    if (!loadingMore) return null;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.footerText}>Loading more leads...</Text>
      </View>
    );
  };

  // Empty State
  const renderEmptyState = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyCircle}>
          <IonIcon name="people" size={40} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>
          {activeFilter ? `No ${activeFilter} leads` : 'No leads yet'}
        </Text>
        <Text style={styles.emptySubtitle}>
          {activeFilter
            ? 'Try a different filter'
            : 'Tap + to add your first lead'}
        </Text>
      </View>
    );
  };

  // Loading State
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading leads...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderSearchBar()}
      <FlatList
        data={filteredLeads}
        keyExtractor={item => item._id || item.id}
        renderItem={renderLeadCard}
        ListHeaderComponent={
          <>
            {leads.length > 0 && <StatsCard leads={leads} />}
            {renderFilterPills()}
          </>
        }
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
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
  loadingText: {
    fontSize: ms(14),
    color: Colors.textTertiary,
    marginTop: Spacing.md,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: vs(100),
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  headerTitle: {
    fontSize: ms(28),
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  countBadge: {
    backgroundColor: Colors.primaryBackground,
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    borderRadius: ms(10),
  },
  countText: {
    fontSize: ms(13),
    fontWeight: '700',
    color: Colors.primary,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
  },
  headerIconBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(20),
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  notificationBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    minWidth: ms(18),
    height: ms(18),
    borderRadius: ms(9),
    backgroundColor: Colors.error,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 4,
  },
  notificationBadgeText: {
    color: '#fff',
    fontSize: ms(10),
    fontWeight: '700',
  },
  fab: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(14),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.md,
  },

  // Search
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    height: ms(44),
    borderWidth: 1,
    borderColor: Colors.surfaceBorder,
  },
  searchInput: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: ms(15),
    color: Colors.textPrimary,
  },

  // Stats Card
  statsCard: {
    borderRadius: BorderRadius.xl,
    // padding: Spacing.lg,
    marginBottom: Spacing.lg,
    // paddingVertical: ms(35),
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: ms(20),
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: ms(20),
    fontWeight: '800',
    color: '#fff',
    letterSpacing: -0.3,
  },
  statLabel: {
    fontSize: ms(11),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: ms(30),
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // Filters
  filterWrap: {
    marginBottom: Spacing.md,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingVertical: ms(7),
    borderRadius: BorderRadius.full,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    marginRight: Spacing.sm,
    backgroundColor: Colors.surface,
    gap: ms(5),
  },
  filterDot: {
    width: ms(7),
    height: ms(7),
    borderRadius: ms(4),
  },
  filterText: {
    fontSize: ms(13),
    fontWeight: '600',
  },
  filterCount: {
    fontSize: ms(11),
    fontWeight: '700',
    opacity: 0.7,
  },

  // Card
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
    flexDirection: 'row',
    overflow: 'hidden',
    ...Shadow.sm,
  },
  cardAccent: {
    width: ms(4),
  },
  cardContent: {
    flex: 1,
    padding: ms(14),
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: ms(16),
    fontWeight: '700',
  },
  cardInfo: {
    flex: 1,
    marginLeft: ms(12),
  },
  leadName: {
    fontSize: ms(16),
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.2,
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: ms(4),
  },
  companyText: {
    fontSize: ms(12),
    color: Colors.textSecondary,
    fontWeight: '400',
  },
  valueContainer: {
    backgroundColor: Colors.successBg,
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    borderRadius: ms(10),
  },
  valueText: {
    fontSize: ms(14),
    fontWeight: '800',
    color: '#059669',
    letterSpacing: -0.3,
  },
  cardBottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: ms(12),
  },
  tagsRow: {
    flexDirection: 'row',
    gap: ms(6),
    flex: 1,
    flexWrap: 'wrap',
  },
  statusTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
    borderRadius: ms(8),
    gap: ms(4),
  },
  sourceTag: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(8),
    paddingVertical: ms(4),
    borderRadius: ms(8),
    backgroundColor: Colors.background,
    gap: ms(4),
  },
  tagText: {
    fontSize: ms(11),
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: ms(6),
  },
  quickActionBtn: {
    width: ms(32),
    height: ms(32),
    borderRadius: ms(10),
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  salespersonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: ms(10),
    paddingTop: ms(10),
    borderTopWidth: 1,
    borderTopColor: Colors.surfaceBorder,
    gap: ms(5),
  },
  salespersonText: {
    fontSize: ms(12),
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // Footer
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(16),
    gap: Spacing.sm,
  },
  footerText: {
    marginLeft: Spacing.sm,
    fontSize: ms(13),
    color: Colors.textTertiary,
  },

  // Empty State
  emptyState: {
    alignItems: 'center',
    paddingTop: ms(80),
  },
  emptyCircle: {
    width: ms(88),
    height: ms(88),
    borderRadius: ms(44),
    backgroundColor: Colors.primaryBackground,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: ms(18),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtitle: {
    fontSize: ms(14),
    color: Colors.textTertiary,
    marginTop: 4,
  },
});

export default LeadsScreen;
