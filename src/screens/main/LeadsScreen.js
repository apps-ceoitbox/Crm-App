/**
 * LeadsScreen
 * Design: 1:1 match with Expo crmapp LeadsScreen
 * Built using shared components: AppText, AppInput, AppButton,
 * CenteredLoader, SkeletonCard from Loader.js, ScreenWrapper
 * All business logic (API, pagination, search, navigation) preserved.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  RefreshControl,
  LayoutAnimation,
  Platform,
  UIManager,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

// Shared components
import AppText from '../../components/AppText';
import AppInput from '../../components/AppInput';
import { CenteredLoader } from '../../components/Loader';

// Constants
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import { ROUTES } from '../../constants';

// API / Context
import { leadsAPI } from '../../api';
import { showError } from '../../utils';
import { useNotification } from '../../context';

// ─── Enable LayoutAnimation on Android ───────────────────────────────────────
if (
  Platform.OS === 'android' &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// ─── Constants ────────────────────────────────────────────────────────────────
const LIMIT = 50;

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

const FILTER_STATUSES = ['New', 'Contacted', 'Qualified', 'Converted', 'Lost'];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function formatValue(val) {
  if (!val) return null;
  if (val >= 100000) return `₹${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 1)}L`;
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
  const palette = ['#4D8733', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981', '#EF4444'];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ─── LeadCard ─────────────────────────────────────────────────────────────────
const LeadCard = ({ lead, onPress, onDelete }) => {
  const leadName =
    lead.contact
      ? `${lead.contact.firstName || ''} ${lead.contact.lastName || ''}`.trim() || lead.title
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

        {/* Row 1: Avatar + Name + Value */}
        <View style={styles.cardTop}>
          <View style={[styles.avatar, { backgroundColor: avatarColor + '18' }]}>
            <AppText
              style={[styles.avatarText, { color: avatarColor }]}
              size="md"
              weight="bold"
            >
              {getInitials(leadName)}
            </AppText>
          </View>

          <View style={styles.cardInfo}>
            <AppText
              size="md"
              weight="bold"
              color={Colors.textPrimary}
              numberOfLines={1}
              style={{ letterSpacing: -0.2 }}
            >
              {leadName}
            </AppText>
            {companyName ? (
              <View style={styles.companyRow}>
                <IonIcon name="business-outline" size={13} color={Colors.textTertiary} />
                <AppText
                  size="sm"
                  weight="regular"
                  color={Colors.textSecondary}
                  numberOfLines={1}
                >
                  {companyName}
                </AppText>
              </View>
            ) : null}
          </View>

          {leadValue ? (
            <View style={styles.valueContainer}>
              <AppText size="base" weight="extraBold" color="#059669" style={{ letterSpacing: -0.3 }}>
                {formatValue(leadValue)}
              </AppText>
            </View>
          ) : null}
        </View>

        {/* Row 2: Status/Source tags + Quick call/mail actions */}
        <View style={styles.cardBottom}>
          <View style={styles.tagsRow}>
            {/* Status tag */}
            <View style={[styles.statusTag, { backgroundColor: sc.bg }]}>
              <IonIcon name={sc.icon} size={11} color={sc.color} />
              <AppText size="sm" weight="semiBold" color={sc.color}>
                {statusKey}
              </AppText>
            </View>
            {/* Source tag */}
            {source ? (
              <View style={styles.sourceTag}>
                <IonIcon
                  name={SOURCE_ICONS[source] || 'ellipsis-horizontal'}
                  size={11}
                  color={Colors.textTertiary}
                />
                <AppText size="sm" weight="semiBold" color={Colors.textSecondary}>
                  {source}
                </AppText>
              </View>
            ) : null}
          </View>

          {/* Quick actions */}
          <View style={styles.quickActions}>
            {phone ? (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => Linking.openURL(`tel:${phone}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IonIcon name="call" size={16} color={Colors.primary} />
              </TouchableOpacity>
            ) : null}
            {email ? (
              <TouchableOpacity
                style={styles.quickActionBtn}
                onPress={() => Linking.openURL(`mailto:${email}`)}
                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              >
                <IonIcon name="mail" size={16} color="#3B82F6" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Salesperson row */}
        {salesperson ? (
          <View style={styles.salespersonRow}>
            <IonIcon name="person-circle" size={16} color={Colors.textTertiary} />
            <AppText size={14} weight="medium" color={Colors.textTertiary}>
              {salesperson}
            </AppText>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
};

// ─── StatsCard ────────────────────────────────────────────────────────────────
const StatsCard = ({ leads }) => {
  const total = leads.length;
  const totalValue = leads.reduce((s, l) => s + (l.value || l.estimatedValue || 0), 0);
  const qualified = leads.filter(l => {
    const stage = l.stage?.name || '';
    return stage === 'Qualified' || stage === 'Converted' || stage === 'Closed Won';
  }).length;
  const convRate = total > 0 ? Math.round((qualified / total) * 100) : 0;

  return (
    <LinearGradient
      colors={['#4D8733', '#6BA344']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.statsCard}
    >
      <View style={styles.statsRow}>
        <View style={styles.statItem}>
          <AppText size="lg" weight="extraBold" color="#fff" style={{ letterSpacing: -0.3 }}>
            {total}
          </AppText>
          <AppText
            size="sm"
            weight="medium"
            color="rgba(255,255,255,0.75)"
            style={styles.statLabel}
          >
            TOTAL LEADS
          </AppText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <AppText size="lg" weight="extraBold" color="#fff" style={{ letterSpacing: -0.3 }}>
            {formatValue(totalValue) || '₹0'}
          </AppText>
          <AppText
            size="sm"
            weight="medium"
            color="rgba(255,255,255,0.75)"
            style={styles.statLabel}
          >
            PIPELINE
          </AppText>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <AppText size="lg" weight="extraBold" color="#fff" style={{ letterSpacing: -0.3 }}>
            {convRate}%
          </AppText>
          <AppText
            size="sm"
            weight="medium"
            color="rgba(255,255,255,0.75)"
            style={styles.statLabel}
          >
            QUALIFIED
          </AppText>
        </View>
      </View>
    </LinearGradient>
  );
};

// ─── Main Screen ──────────────────────────────────────────────────────────────
const LeadsScreen = ({ navigation }) => {
  const { unreadCount } = useNotification();
  const searchTimeoutRef = useRef(null);
  const currentSearchRef = useRef('');
  const isInitialLoadRef = useRef(true);
  const isFetchingRef = useRef(false);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchVisible, setSearchVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [leads, setLeads] = useState([]);

  // Client-side filter on top of API search
  const filteredLeads = activeFilter
    ? leads.filter(l => (l.stage?.name || '') === activeFilter)
    : leads;

  // ── Debounced search ──
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    currentSearchRef.current = searchQuery;

    if (!searchQuery.trim()) {
      setLeads([]);
      setPage(1);
      setHasMore(true);
      fetchLeads(1, false, '');
      return;
    }

    searchTimeoutRef.current = setTimeout(() => {
      setLeads([]);
      setPage(1);
      setHasMore(true);
      fetchLeads(1, false, searchQuery.trim());
    }, 300);

    return () => { if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current); };
  }, [searchQuery]);

  // ── Initial load ──
  useEffect(() => {
    fetchLeads(1, true, '');
    isInitialLoadRef.current = false;
  }, []);

  // ── API fetch ──
  const fetchLeads = async (pageNum = 1, showLoader = false, search = '') => {
    if (isFetchingRef.current) return;
    if (pageNum > 1 && !hasMore) return;
    isFetchingRef.current = true;

    try {
      if (showLoader) setLoading(true);
      else if (pageNum > 1) setLoadingMore(true);

      const params = { page: pageNum, limit: LIMIT };
      if (search) params.search = search;

      const response = await leadsAPI.getAll(params);
      if (search !== currentSearchRef.current && search !== '') return;

      if (response.success) {
        const leadsData = response.data?.data || response.data?.leads || response.data || [];
        const newLeads = Array.isArray(leadsData) ? leadsData : [];

        setLeads(prev => pageNum === 1 ? newLeads : [...prev, ...newLeads]);
        setHasMore(newLeads.length === LIMIT || newLeads.length >= LIMIT);
        setPage(pageNum);
      } else {
        showError('Error', response.error || 'Failed to load leads');
      }
    } catch {
      showError('Error', 'Failed to load leads');
    } finally {
      setLoading(false);
      setRefreshing(false);
      setTimeout(() => {
        setLoadingMore(false);
        isFetchingRef.current = false;
      }, 150);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    setLeads([]);
    setPage(1);
    fetchLeads(1, false, searchQuery.trim());
  }, [searchQuery]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading && !refreshing && !isFetchingRef.current) {
      fetchLeads(page + 1, false, searchQuery.trim());
    }
  }, [loadingMore, hasMore, loading, refreshing, page, searchQuery]);

  const handleDeleteLead = lead => {
    Alert.alert(
      'Delete Lead',
      `Remove "${lead.title || 'this lead'}" from your leads?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => console.log('Delete:', lead._id) },
      ]
    );
  };

  // ── Render: Header ──
  const renderHeader = () => (
    <View style={styles.header}>
      {/* Left: Title + count badge */}
      <View style={styles.headerLeft}>
        <AppText size={28} weight="extraBold" color={Colors.textPrimary} style={{ letterSpacing: -0.5 }}>
          Leads
        </AppText>
        {leads.length > 0 && (
          <View style={styles.countBadge}>
            <AppText size={13} weight="bold" color={Colors.primary}>
              {leads.length}
            </AppText>
          </View>
        )}
      </View>

      {/* Right: Search toggle, Notifications, Add FAB */}
      <View style={styles.headerRight}>
        <TouchableOpacity
          style={styles.headerIconBtn}
          onPress={() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
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
          <IonIcon name="notifications-outline" size={ms(22)} color={Colors.textPrimary} />
          {unreadCount > 0 && (
            <View style={styles.notificationBadge}>
              <AppText size={10} weight="bold" color="#fff">
                {unreadCount > 9 ? '9+' : unreadCount}
              </AppText>
            </View>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.fab}
          onPress={() => navigation.navigate('AddLead', {
            onCreate: newLead => {
              setLeads(prev => [newLead, ...prev]);
              setPage(1); // Optional: reset pagination to show the new item at the top cleanly
            }
          })}
          activeOpacity={0.85}
        >
          <IonIcon name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // ── Render: Search Bar (using AppInput) ──
  const renderSearchBar = () => {
    if (!searchVisible) return null;
    return (
      <View style={styles.searchWrap}>
        <AppInput
          placeholder="Search leads by name or company..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          leftIcon="search-outline"
          rightIcon={searchQuery ? 'close-circle' : undefined}
          onRightIconPress={() => setSearchQuery('')}
          returnKeyType="search"
          autoFocus
          containerStyle={{ marginBottom: 0 }}
        />
      </View>
    );
  };

  // ── Render: Gradient Stats + Filter Pills (list header) ──
  const renderListHeader = () => (
    <>
      {leads.length > 0 ? <StatsCard leads={leads} /> : null}

      {leads.length > 0 ? (
        <View style={styles.filterWrap}>
          <FlatList
            horizontal
            showsHorizontalScrollIndicator={false}
            data={[null, ...FILTER_STATUSES]}
            keyExtractor={item => item || 'all'}
            renderItem={({ item }) => {
              const active = activeFilter === item;
              const sc = item ? STATUS_CONFIG[item] : null;
              const count = item
                ? leads.filter(l => (l.stage?.name || '') === item).length
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
                >
                  {item && sc ? (
                    <View style={[styles.filterDot, { backgroundColor: sc.color }]} />
                  ) : null}
                  <AppText
                    size={ms(13)}
                    weight="semiBold"
                    color={active ? (item ? sc?.color : Colors.primary) : Colors.textTertiary}
                  >
                    {item || 'All'}
                  </AppText>
                  <AppText
                    size={11}
                    weight="bold"
                    color={active ? (item ? sc?.color : Colors.primary) : Colors.textTertiary}
                    style={{ opacity: 0.7 }}
                  >
                    {count}
                  </AppText>
                </TouchableOpacity>
              );
            }}
          />
        </View>
      ) : null}
    </>
  );

  // ── Render: Individual lead card ──
  const renderLeadCard = ({ item }) => (
    <LeadCard
      lead={item}
      onPress={() => navigation.navigate('LeadDetails', {
        lead: item,
        onUpdate: updatedLead => {
          setLeads(prev => prev.map(l =>
            (l._id === updatedLead._id || l.id === updatedLead.id) ? updatedLead : l
          ));
        }
      })}
      onDelete={handleDeleteLead}
    />
  );

  // ── Render: Footer spinner ──
  const renderFooter = () => {
    if (!loadingMore) return <View style={{ height: ms(20) }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <AppText size="sm" weight="medium" color={Colors.textTertiary} style={{ marginLeft: Spacing.sm }}>
          Loading more leads...
        </AppText>
      </View>
    );
  };

  // ── Render: Empty state ──
  const renderEmptyState = () => {
    if (loading) return null;
    return (
      <View style={styles.emptyState}>
        <View style={styles.emptyCircle}>
          <IonIcon name="people" size={40} color={Colors.primary} />
        </View>
        <AppText size={18} weight="bold" color={Colors.textPrimary} align="center">
          {activeFilter ? `No ${activeFilter} leads` : searchQuery ? `No results for "${searchQuery}"` : 'No leads yet'}
        </AppText>
        <AppText
          size="sm"
          weight="regular"
          color={Colors.textTertiary}
          align="center"
          style={{ marginTop: 4 }}
        >
          {activeFilter
            ? 'Try a different filter'
            : searchQuery
              ? 'Try checking spelling or use broader terms'
              : 'Tap + to add your first lead'}
        </AppText>
      </View>
    );
  };

  // ── Full-screen loading state ──
  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        {renderHeader()}
        <CenteredLoader text="Loading leads..." />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader()}
      {renderSearchBar()}
      <FlatList
        data={filteredLeads}
        keyExtractor={item => item._id || item.id || Math.random().toString()}
        renderItem={renderLeadCard}
        ListHeaderComponent={renderListHeader}
        ListEmptyComponent={renderEmptyState}
        ListFooterComponent={renderFooter}
        onEndReached={loadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={10}
        windowSize={10}
        removeClippedSubviews={Platform.OS === 'android'}
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

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContent: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xs,
    paddingBottom: vs(100),
  },

  // ── Header ──
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
  countBadge: {
    backgroundColor: Colors.primaryBackground,
    paddingHorizontal: ms(8),
    paddingVertical: ms(2),
    borderRadius: ms(10),
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
  fab: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(14),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.md,
  },

  // ── Search (AppInput wrapper) ──
  searchWrap: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
  },

  // ── Stats Card ──
  statsCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
  },
  statLabel: {
    marginTop: 4,
    letterSpacing: 0.5,
  },
  statDivider: {
    width: 1,
    height: ms(30),
    backgroundColor: 'rgba(255,255,255,0.25)',
  },

  // ── Filter Pills ──
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

  // ── Lead Card ──
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
    includeFontPadding: false,
  },
  cardInfo: {
    flex: 1,
    marginLeft: ms(12),
  },
  companyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
    gap: ms(4),
  },
  valueContainer: {
    backgroundColor: '#ECFDF5',
    paddingHorizontal: ms(10),
    paddingVertical: ms(5),
    borderRadius: ms(10),
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

  // ── Footer ──
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: vs(16),
    gap: Spacing.sm,
  },

  // ── Empty State ──
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
});

export default LeadsScreen;
