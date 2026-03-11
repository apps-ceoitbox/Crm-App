/**
 * PipelineScreen.js
 * Pipeline Funnel View — Dynamic pipeline selector, lazy loading, clean architecture
 *
 * Flow:
 *  1. On mount → fetch all pipelines from GET /pipelines
 *  2. Render horizontal pipeline selector tabs (highlight default)
 *  3. On tab select → fetch leads for that pipeline ID with pagination
 *  4. Support pull-to-refresh + FlatList lazy loading (onEndReached)
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  memo,
} from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  TextInput,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';

import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import { pipelineAPI } from '../../api';
import { AppButton } from '../../components';
import { ROUTES } from '../../constants';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const PAGE_LIMIT = 20;

// ─── Static stage config ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'New', name: 'New', color: '#3B82F6', bg: '#EFF6FF', icon: 'sparkles' },
  {
    id: 'Contacted',
    name: 'Contacted',
    color: '#F59E0B',
    bg: '#FFFBEB',
    icon: 'chatbubble',
  },
  {
    id: 'Proposal Sent',
    name: 'Proposal',
    color: '#8B5CF6',
    bg: '#F3F0FF',
    icon: 'document-text',
  },
  {
    id: 'Negotiation',
    name: 'Negotiation',
    color: '#4D8733',
    bg: '#EEF5E6',
    icon: 'pie-chart',
  },
  {
    id: 'Final Review',
    name: 'Review',
    color: '#EC4899',
    bg: '#FDF2F8',
    icon: 'eye',
  },
  {
    id: 'Closed Won',
    name: 'Won',
    color: '#10B981',
    bg: '#ECFDF5',
    icon: 'trophy',
  },
  {
    id: 'Closed Lost',
    name: 'Lost',
    color: '#EF4444',
    bg: '#FEF2F2',
    icon: 'close-circle',
  },
];

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatValue(val) {
  if (!val) return '0';
  if (val >= 10000000) return `${(val / 10000000).toFixed(1)}Cr`;
  if (val >= 100000) return `${(val / 100000).toFixed(1)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return val.toLocaleString('en-IN');
}

function getInitials(name) {
  if (!name) return '??';
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getAvatarColor(name) {
  const palette = [
    '#4D8733',
    '#3B82F6',
    '#8B5CF6',
    '#EC4899',
    '#F59E0B',
    '#10B981',
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++)
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return palette[Math.abs(hash) % palette.length];
}

// ─── Sub-components ─────────────────────────────────────────────────────────

/** Pipeline selector tab */
const PipelineTab = memo(({ item, isSelected, onPress }) => (
  <TouchableOpacity
    style={[styles.pipelineTab, isSelected && styles.pipelineTabSelected]}
    onPress={() => onPress(item)}
    activeOpacity={0.75}
  >
    {item.isDefault && (
      <IonIcon
        name="star"
        size={ms(10)}
        color={isSelected ? '#fff' : Colors.primary}
        style={{ marginRight: 4 }}
      />
    )}
    <Text
      style={[
        styles.pipelineTabText,
        isSelected && styles.pipelineTabTextSelected,
      ]}
    >
      {item.name}
    </Text>
  </TouchableOpacity>
));

/** Lead row card inside expanded stage */
const LeadCard = memo(({ lead, onPress }) => {
  const name = lead.title || lead.name || 'Unnamed';
  const avatarColor = getAvatarColor(name);
  return (
    <TouchableOpacity
      style={styles.leadCard}
      activeOpacity={0.85}
      onPress={() => onPress(lead)}
    >
      <View
        style={[styles.leadAvatar, { backgroundColor: avatarColor + '18' }]}
      >
        <Text style={[styles.leadAvatarText, { color: avatarColor }]}>
          {getInitials(name)}
        </Text>
      </View>
      <View style={styles.leadInfo}>
        <Text style={styles.leadName} numberOfLines={1}>
          {name}
        </Text>
        {lead.company?.name || lead.company ? (
          <Text style={styles.leadCompany} numberOfLines={1}>
            {lead.company?.name || lead.company}
          </Text>
        ) : null}
      </View>
      {lead.value ? (
        <Text style={styles.leadValue}>₹{formatValue(lead.value)}</Text>
      ) : null}
      <IonIcon name="chevron-forward" size={16} color={Colors.textTertiary} />
    </TouchableOpacity>
  );
});

/** Stage card row */
const StageCard = memo(
  ({ stage, totalLeads, isExpanded, onToggle, onLeadPress }) => {
    const percentage =
      totalLeads > 0 ? Math.round((stage.leads.length / totalLeads) * 100) : 0;
    return (
      <View>
        <TouchableOpacity
          style={styles.stageCard}
          activeOpacity={0.85}
          onPress={() => onToggle(stage.id)}
        >
          <View style={styles.stageHeader}>
            <View style={[styles.stageIcon, { backgroundColor: stage.bg }]}>
              <IonIcon name={stage.icon} size={ms(18)} color={stage.color} />
            </View>
            <View style={styles.stageInfo}>
              <Text style={styles.stageName}>{stage.name}</Text>
              <Text style={styles.stageCount}>{stage.leads.length} deals</Text>
            </View>
            <View style={styles.stageRight}>
              <Text style={[styles.stageValue, { color: stage.color }]}>
                ₹
                {formatValue(
                  stage.leads.reduce((s, l) => s + (l.value || 0), 0),
                )}
              </Text>
              <Text style={styles.stagePercentage}>{percentage}%</Text>
            </View>
            <IonIcon
              name={isExpanded ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={Colors.textTertiary}
              style={{ marginLeft: 8 }}
            />
          </View>
          <View style={styles.progressBarBg}>
            <View
              style={[
                styles.progressBarFill,
                {
                  width: `${Math.max(percentage, 2)}%`,
                  backgroundColor: stage.color,
                },
              ]}
            />
          </View>
        </TouchableOpacity>

        {isExpanded && stage.leads.length > 0 && (
          <View style={styles.expandedLeads}>
            {stage.leads.map(lead => (
              <LeadCard
                key={lead._id || lead.id}
                lead={lead}
                onPress={onLeadPress}
              />
            ))}
          </View>
        )}

        {isExpanded && stage.leads.length === 0 && (
          <View style={styles.emptyStage}>
            <Text style={styles.emptyStageText}>No deals in this stage</Text>
          </View>
        )}
      </View>
    );
  },
);

// ─── Main Screen ─────────────────────────────────────────────────────────────

const PipelineScreen = ({ navigation }) => {
  // ── Pipeline list state ───────────────────────────────────────────────────
  const [pipelineList, setPipelineList] = useState([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);

  // ── Leads / pipeline data state ───────────────────────────────────────────
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  // ── UI state ──────────────────────────────────────────────────────────────
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);

  const searchTimeoutRef = useRef(null);
  const isFetchingRef = useRef(false); // true while any fetch is in-flight
  const isInitialLoad = useRef(true); // true only on the very first fetch

  // ── Step 1: Fetch all pipelines on mount ─────────────────────────────────
  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    setPipelinesLoading(true);
    try {
      const res = await pipelineAPI.getAll();
      if (res.success) {
        const list = Array.isArray(res.data?.data)
          ? res.data.data
          : Array.isArray(res.data)
          ? res.data
          : [];
        setPipelineList(list);
        // Select the default pipeline automatically
        const defaultPipeline = list.find(p => p.isDefault) || list[0];
        if (defaultPipeline) {
          setSelectedPipelineId(defaultPipeline._id);
        }
      }
    } catch {
      // silently fail — no pipelines will show
    } finally {
      setPipelinesLoading(false);
    }
  };

  // ── Step 2: Fetch leads when selectedPipelineId or searchQuery changes ───
  useEffect(() => {
    if (!selectedPipelineId) return;
    // Reset pagination and fetch fresh
    setLeads([]);
    setPage(1);
    setHasMore(true);
    fetchLeads(selectedPipelineId, 1, searchQuery.trim(), false);
  }, [selectedPipelineId]);

  // Debounced search
  useEffect(() => {
    if (!selectedPipelineId) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      setLeads([]);
      setPage(1);
      setHasMore(true);
      fetchLeads(selectedPipelineId, 1, searchQuery.trim(), false);
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  const fetchLeads = async (
    pipelineId,
    pageNum,
    search = '',
    isMore = false,
  ) => {
    // Hard guard: don't fire if already in-flight
    if (isFetchingRef.current) return;
    // If loading-more, also check hasMore
    if (isMore && !hasMore) return;

    isFetchingRef.current = true;

    // Show the right loader
    if (isMore) {
      setLoadingMore(true);
    } else if (!refreshing) {
      setLoading(true);
    }

    try {
      const params = { page: pageNum, limit: PAGE_LIMIT };
      if (search) params.search = search;

      const res = await pipelineAPI.getLeadsByPipeline(pipelineId, params);
      if (res.success) {
        const newLeads =
          res.data?.data ||
          res.data?.leads ||
          (Array.isArray(res.data) ? res.data : []);

        setLeads(prev => (isMore ? [...prev, ...newLeads] : newLeads));
        setPage(pageNum);
        // If fewer items than limit, no more pages
        setHasMore(newLeads.length >= PAGE_LIMIT);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
      setRefreshing(false);
      // Small delay before hiding footer loader to avoid flicker
      setTimeout(() => {
        setLoadingMore(false);
        isFetchingRef.current = false;
      }, 150);
      isInitialLoad.current = false;
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePipelineSelect = useCallback(
    pipeline => {
      if (pipeline._id === selectedPipelineId) return;
      setSelectedPipelineId(pipeline._id);
      setSearchQuery('');
      setExpandedStage(null);
    },
    [selectedPipelineId],
  );

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    setLeads([]);
    setPage(1);
    setHasMore(true);
    fetchLeads(selectedPipelineId, 1, searchQuery.trim(), false);
  }, [selectedPipelineId, searchQuery]);

  const handleLoadMore = useCallback(() => {
    // Block if: already fetching, no more pages, currently loading initial data, or pulling to refresh
    if (
      !hasMore ||
      loadingMore ||
      loading ||
      refreshing ||
      isFetchingRef.current
    )
      return;
    const nextPage = page + 1;
    fetchLeads(selectedPipelineId, nextPage, searchQuery.trim(), true);
  }, [
    hasMore,
    loadingMore,
    loading,
    refreshing,
    page,
    selectedPipelineId,
    searchQuery,
  ]);

  const handleLeadPress = useCallback(
    lead => {
      navigation.navigate('LeadDetails', { lead });
    },
    [navigation],
  );

  const handleStageToggle = useCallback(stageId => {
    setExpandedStage(prev => (prev === stageId ? null : stageId));
  }, []);

  // ── Computed stats ────────────────────────────────────────────────────────

  const { stageData, totalValue, activeValue, convRate, totalLeads } =
    useMemo(() => {
      const filtered = searchQuery.trim()
        ? leads.filter(
            l =>
              (l.title || l.name || '')
                .toLowerCase()
                .includes(searchQuery.toLowerCase()) ||
              (l.company?.name || l.company || '')
                .toLowerCase()
                .includes(searchQuery.toLowerCase()),
          )
        : leads;

      const totalValue = filtered.reduce((s, l) => s + (l.value || 0), 0);
      const activeValue = filtered
        .filter(l => l.status !== 'Closed Lost')
        .reduce((s, l) => s + (l.value || 0), 0);
      const convWon = filtered.filter(l => l.status === 'Closed Won').length;
      const convRate =
        filtered.length > 0 ? Math.round((convWon / filtered.length) * 100) : 0;
      const totalLeads = filtered.length;

      const stageData = PIPELINE_STAGES.map(stage => {
        const stageLeads = filtered.filter(l => {
          const s = l.status || l.stage?.name || l.stage;
          return s === stage.id || s === stage.name;
        });
        return { ...stage, leads: stageLeads };
      });

      return { stageData, totalValue, activeValue, convRate, totalLeads };
    }, [leads, searchQuery]);

  // ── List footer ───────────────────────────────────────────────────────────

  const ListFooter = useCallback(() => {
    if (!loadingMore) return <View style={{ height: ms(100) }} />;
    return (
      <View style={styles.footerLoader}>
        <ActivityIndicator size="small" color={Colors.primary} />
        <Text style={styles.footerLoaderText}>Loading more deals…</Text>
      </View>
    );
  }, [loadingMore]);

  // ── Prepare FlatList data ────────────────────────────────────────────────
  // We render everything as a single FlatList with a header; each item = a stage card

  const headerComponent = useMemo(
    () => (
      <View>
        {/* Summary card */}
        <LinearGradient
          colors={['#4D8733', '#6BA344']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryGrid}>
            {[
              { label: 'Total Deals', value: totalLeads },
              { label: 'Total Value', value: `₹${formatValue(totalValue)}` },
              { label: 'Active Value', value: `₹${formatValue(activeValue)}` },
              { label: 'Conversion', value: `${convRate}%` },
            ].map(item => (
              <View key={item.label} style={styles.summaryItem}>
                <Text style={styles.summaryValue}>{item.value}</Text>
                <Text style={styles.summaryLabel}>{item.label}</Text>
              </View>
            ))}
          </View>
        </LinearGradient>

        {/* Funnel bars */}
        <Text style={styles.sectionLabel}>PIPELINE FUNNEL</Text>
        <View style={styles.funnelCard}>
          {stageData.map((stage, index) => {
            const funnelRatio = 1 - index * 0.1;
            const barWidth =
              Math.max(
                totalLeads > 0
                  ? Math.round((stage.leads.length / totalLeads) * 100)
                  : 0,
                5,
              ) * funnelRatio;
            return (
              <TouchableOpacity
                key={stage.id}
                style={styles.funnelRow}
                activeOpacity={0.7}
                onPress={() => handleStageToggle(stage.id)}
              >
                <View style={styles.funnelLeft}>
                  <View
                    style={[styles.funnelDot, { backgroundColor: stage.color }]}
                  />
                  <Text style={styles.funnelLabel}>{stage.name}</Text>
                </View>
                <View style={styles.funnelBarWrap}>
                  <View
                    style={[
                      styles.funnelBar,
                      {
                        width: `${Math.max(barWidth, 8)}%`,
                        backgroundColor: stage.color + '30',
                      },
                    ]}
                  >
                    <View
                      style={[
                        styles.funnelBarInner,
                        {
                          width: `${Math.min(
                            totalLeads > 0
                              ? (stage.leads.length / totalLeads) * 100
                              : 0,
                            100,
                          )}%`,
                          backgroundColor: stage.color,
                        },
                      ]}
                    />
                  </View>
                </View>
                <View style={styles.funnelRight}>
                  <Text style={[styles.funnelCount, { color: stage.color }]}>
                    {stage.leads.length}
                  </Text>
                  <IonIcon
                    name={
                      expandedStage === stage.id ? 'chevron-up' : 'chevron-down'
                    }
                    size={14}
                    color={Colors.textTertiary}
                  />
                </View>
              </TouchableOpacity>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>STAGE BREAKDOWN</Text>
      </View>
    ),
    [
      stageData,
      totalLeads,
      totalValue,
      activeValue,
      convRate,
      expandedStage,
      handleStageToggle,
    ],
  );

  // ─── Loading state (initial pipelines fetch) ─────────────────────────────

  if (pipelinesLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.navBar}>
          <Text style={styles.title}>Pipeline</Text>
        </View>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Loading Pipelines…</Text>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* ── Header ── */}
      <View style={styles.navBar}>
        <Text style={styles.title}>Pipeline</Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => {
              setSearchOpen(o => !o);
              if (searchOpen) setSearchQuery('');
            }}
          >
            <IonIcon
              name={searchOpen ? 'close' : 'search-outline'}
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* ── Search bar ── */}
      {searchOpen && (
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <IonIcon name="search" size={17} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search deals…"
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoFocus
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
      )}

      {/* ── Pipeline Selector ── */}
      {pipelineList.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.pipelineTabsContainer}
          style={styles.pipelineTabsScroll}
        >
          {pipelineList.map(pipeline => (
            <PipelineTab
              key={pipeline._id}
              item={pipeline}
              isSelected={selectedPipelineId === pipeline._id}
              onPress={handlePipelineSelect}
            />
          ))}
        </ScrollView>
      )}

      {/* ── Content ── */}
      {loading && leads.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <Text style={styles.loadingText}>Fetching pipeline data…</Text>
        </View>
      ) : (
        <FlatList
          data={stageData}
          keyExtractor={item => item.id}
          renderItem={({ item }) => (
            <StageCard
              stage={item}
              totalLeads={totalLeads}
              isExpanded={expandedStage === item.id}
              onToggle={handleStageToggle}
              onLeadPress={handleLeadPress}
            />
          )}
          ListHeaderComponent={headerComponent}
          ListFooterComponent={ListFooter}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
              tintColor={Colors.primary}
            />
          }
          onEndReached={handleLoadMore}
          onEndReachedThreshold={0.4}
          removeClippedSubviews
          maxToRenderPerBatch={8}
          windowSize={10}
          initialNumToRender={8}
        />
      )}

      {/* ── FAB ── */}
      <View style={styles.floatingAction}>
        <AppButton
          title="Add"
          onPress={() => navigation.navigate(ROUTES.ADD_LEAD)}
          fullWidth={false}
          size="small"
          icon="add"
        />
      </View>
    </SafeAreaView>
  );
};

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: vs(40),
  },
  loadingText: {
    marginTop: ms(12),
    color: Colors.textTertiary,
    fontSize: ms(13),
  },

  // Header
  navBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: ms(26),
    fontWeight: '700',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  headerIconBtn: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(14),
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },

  // Search
  searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
  searchBar: {
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

  // Pipeline selector
  pipelineTabsScroll: {
    flexGrow: 0,
    // borderBottomWidth: 1,
    // borderBottomColor: Colors.divider,
    marginBottom: ms(10),
  },
  pipelineTabsContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: ms(8),
    gap: ms(10),
  },
  pipelineTab: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(16),
    paddingVertical: ms(8),
    minHeight: ms(40),
    marginBottom: ms(5),
    borderRadius: ms(24),
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    ...Shadow.sm,
  },
  pipelineTabSelected: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  pipelineTabText: {
    fontSize: ms(14),
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  pipelineTabTextSelected: {
    color: '#fff',
    fontWeight: '700',
  },

  // List content
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: vs(20) },

  // Summary card
  summaryCard: {
    borderRadius: BorderRadius.xl,
    // padding: Spacing.lg,
    marginBottom: Spacing.lg,
    marginTop: Spacing.sm,
    ...Shadow.md,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryItem: { width: '50%', alignItems: 'center', paddingVertical: ms(10) },
  summaryValue: { fontSize: ms(22), fontWeight: '800', color: '#fff' },
  summaryLabel: {
    fontSize: ms(11),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.75)',
    marginTop: 3,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  sectionLabel: {
    fontSize: ms(13),
    fontWeight: '700',
    color: Colors.textTertiary,
    letterSpacing: 1,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },

  // Funnel
  funnelCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: ms(14),
    marginBottom: Spacing.md,
    ...Shadow.sm,
  },
  funnelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: ms(8),
  },
  funnelLeft: {
    width: ms(100),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  funnelDot: { width: 9, height: 9, borderRadius: 5 },
  funnelLabel: {
    fontSize: ms(14),
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  funnelBarWrap: { flex: 1, height: ms(20), justifyContent: 'center' },
  funnelBar: { height: '100%', borderRadius: ms(6), overflow: 'hidden' },
  funnelBarInner: { height: '100%', borderRadius: ms(6) },
  funnelRight: {
    width: ms(48),
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 4,
  },
  funnelCount: { fontSize: ms(14), fontWeight: '800' },

  // Stage card
  stageCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: ms(14),
    marginBottom: Spacing.sm,
    ...Shadow.sm,
  },
  stageHeader: { flexDirection: 'row', alignItems: 'center' },
  stageIcon: {
    width: ms(40),
    height: ms(40),
    borderRadius: ms(12),
    justifyContent: 'center',
    alignItems: 'center',
  },
  stageInfo: { flex: 1, marginLeft: Spacing.md },
  stageName: { fontSize: ms(17), fontWeight: '700', color: Colors.textPrimary },
  stageCount: { fontSize: ms(13), color: Colors.textTertiary, marginTop: 2 },
  stageRight: { alignItems: 'flex-end' },
  stageValue: { fontSize: ms(16), fontWeight: '800' },
  stagePercentage: {
    fontSize: ms(10),
    color: Colors.textTertiary,
    marginTop: 1,
  },
  progressBarBg: {
    height: ms(4),
    backgroundColor: Colors.divider,
    borderRadius: 2,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 2 },

  // Expanded leads
  expandedLeads: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.sm,
    marginTop: -Spacing.sm + 2,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
    overflow: 'hidden',
    ...Shadow.sm,
  },
  leadCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: ms(14),
    paddingVertical: ms(10),
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  leadAvatar: {
    width: ms(36),
    height: ms(36),
    borderRadius: ms(10),
    justifyContent: 'center',
    alignItems: 'center',
  },
  leadAvatarText: { fontSize: ms(14), fontWeight: '700' },
  leadInfo: { flex: 1, marginLeft: Spacing.sm },
  leadName: { fontSize: ms(16), fontWeight: '600', color: Colors.textPrimary },
  leadCompany: { fontSize: ms(13), color: Colors.textTertiary, marginTop: 2 },
  leadValue: {
    fontSize: ms(14),
    fontWeight: '700',
    color: Colors.success,
    marginRight: 8,
  },

  emptyStage: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: ms(16),
    alignItems: 'center',
    marginBottom: Spacing.sm,
    marginTop: -Spacing.sm + 2,
  },
  emptyStageText: { fontSize: ms(14), color: Colors.textTertiary },

  // Footer loader — smooth, visible, not jarring
  footerLoader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ms(20),
    gap: ms(10),
    backgroundColor: Colors.background,
  },
  footerLoaderText: {
    fontSize: ms(14),
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // FAB
  floatingAction: {
    position: 'absolute',
    bottom: vs(20),
    right: Spacing.lg,
    ...Shadow.md,
  },
});

export default PipelineScreen;
