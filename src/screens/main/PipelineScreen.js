/**
 * PipelineScreen.js
 * Pipeline Funnel View — Per-stage pagination (10 items/stage), lazy loading
 *
 * Flow:
 *  1. On mount → fetch all pipelines from GET /pipelines
 *  2. Render horizontal pipeline selector tabs
 *  3. On tab select → fetch page 1 of ALL 7 stages in parallel (limit=10 each)
 *  4. Each stage shows its 10 leads; "Load More" fetches next page on demand
 *  5. Pull-to-refresh resets and re-fetches all stage data
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
const STAGE_PAGE_LIMIT = 10;

// ─── Static stage config ────────────────────────────────────────────────────

const PIPELINE_STAGES = [
  { id: 'New', name: 'New', color: '#3B82F6', bg: '#EFF6FF', icon: 'sparkles' },
  { id: 'Contacted', name: 'Contacted', color: '#F59E0B', bg: '#FFFBEB', icon: 'chatbubble' },
  { id: 'Proposal Sent', name: 'Proposal', color: '#8B5CF6', bg: '#F3F0FF', icon: 'document-text' },
  { id: 'Negotiation', name: 'Negotiation', color: '#4D8733', bg: '#EEF5E6', icon: 'pie-chart' },
  { id: 'Final Review', name: 'Review', color: '#EC4899', bg: '#FDF2F8', icon: 'eye' },
  { id: 'Closed Won', name: 'Won', color: '#10B981', bg: '#ECFDF5', icon: 'trophy' },
  { id: 'Closed Lost', name: 'Lost', color: '#EF4444', bg: '#FEF2F2', icon: 'close-circle' },
];

/** Default empty state for one stage */
const initStageState = () => ({
  leads: [],
  page: 0,          // 0 = never fetched
  hasMore: true,
  loading: false,
  loadingMore: false,
  total: 0,         // backend total count for this stage
});

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
  const palette = ['#4D8733', '#3B82F6', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];
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
    <Text style={[styles.pipelineTabText, isSelected && styles.pipelineTabTextSelected]}>
      {item.name}
    </Text>
  </TouchableOpacity>
));

/** Individual lead row */
const LeadCard = memo(({ lead, onPress }) => {
  const name = lead.title || lead.name || 'Unnamed';
  const avatarColor = getAvatarColor(name);
  return (
    <TouchableOpacity
      style={styles.leadCard}
      activeOpacity={0.85}
      onPress={() => onPress(lead)}
    >
      <View style={[styles.leadAvatar, { backgroundColor: avatarColor + '18' }]}>
        <Text style={[styles.leadAvatarText, { color: avatarColor }]}>
          {getInitials(name)}
        </Text>
      </View>
      <View style={styles.leadInfo}>
        <Text style={styles.leadName} numberOfLines={1}>{name}</Text>
        {(lead.company?.name || lead.company) ? (
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

/**
 * Stage card with per-stage pagination.
 * stageState = { leads, loading, loadingMore, hasMore, total }
 */
const StageCard = memo(({
  stage,
  stageState,
  totalLeadCount,
  isExpanded,
  onToggle,
  onLeadPress,
  onLoadMore,
}) => {
  const { leads, loading, loadingMore, hasMore, total } = stageState;
  const percentage = totalLeadCount > 0 ? Math.round((total / totalLeadCount) * 100) : 0;

  return (
    <View>
      {/* ── Stage header row ── */}
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
            <Text style={styles.stageCount}>
              {loading && total === 0 ? '…' : `${total} deals`}
            </Text>
          </View>
          <View style={styles.stageRight}>
            <Text style={[styles.stageValue, { color: stage.color }]}>
              ₹{formatValue(leads.reduce((s, l) => s + (l.value || 0), 0))}
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
              { width: `${Math.max(percentage, 2)}%`, backgroundColor: stage.color },
            ]}
          />
        </View>
      </TouchableOpacity>

      {/* ── Expanded leads list ── */}
      {isExpanded && (
        <View style={styles.expandedLeads}>
          {/* Initial stage loading */}
          {loading && leads.length === 0 ? (
            <View style={styles.stageLoadingWrap}>
              <ActivityIndicator size="small" color={stage.color} />
              <Text style={styles.stageLoadingText}>Loading deals…</Text>
            </View>
          ) : leads.length === 0 ? (
            <View style={styles.emptyStage}>
              <Text style={styles.emptyStageText}>No deals in this stage</Text>
            </View>
          ) : (
            <>
              {leads.map(lead => (
                <LeadCard
                  key={lead._id || lead.id}
                  lead={lead}
                  onPress={onLeadPress}
                />
              ))}

              {/* Load More button */}
              {loadingMore ? (
                <View style={styles.stageLoadMoreWrap}>
                  <ActivityIndicator size="small" color={stage.color} />
                  <Text style={styles.stageLoadingText}>Loading more…</Text>
                </View>
              ) : hasMore ? (
                <TouchableOpacity
                  style={[styles.loadMoreBtn, { borderColor: stage.color + '50' }]}
                  onPress={() => onLoadMore(stage.id)}
                  activeOpacity={0.7}
                >
                  <IonIcon name="add-circle-outline" size={ms(16)} color={stage.color} />
                  <Text style={[styles.loadMoreText, { color: stage.color }]}>
                    Load More
                  </Text>
                </TouchableOpacity>
              ) : leads.length > 0 ? (
                <View style={styles.allLoadedWrap}>
                  <Text style={styles.allLoadedText}>All {total} deals loaded</Text>
                </View>
              ) : null}
            </>
          )}
        </View>
      )}
    </View>
  );
});

// ─── Main Screen ─────────────────────────────────────────────────────────────

const PipelineScreen = ({ navigation }) => {
  // ── Pipeline list ─────────────────────────────────────────────────────────
  const [pipelineList, setPipelineList] = useState([]);
  const [pipelinesLoading, setPipelinesLoading] = useState(true);
  const [selectedPipelineId, setSelectedPipelineId] = useState(null);

  // ── Per-stage pagination state ────────────────────────────────────────────
  const [stagePagination, setStagePagination] = useState(() =>
    Object.fromEntries(PIPELINE_STAGES.map(s => [s.id, initStageState()]))
  );

  // ── UI state ──────────────────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);

  /**
   * Per-stage in-flight guard — keyed by stageId.
   * Prevents duplicate concurrent requests for the same stage.
   */
  const stageFetchingRef = useRef({});

  // ── Step 1: Fetch all pipelines on mount ─────────────────────────────────
  useEffect(() => {
    fetchPipelines();
  }, []);

  const fetchPipelines = async () => {
    setPipelinesLoading(true);
    try {
      const res = await pipelineAPI.getAll();
      if (res.success) {
        const list = Array.isArray(res.data?.data) ? res.data.data
          : Array.isArray(res.data) ? res.data
            : [];
        setPipelineList(list);
        const defaultPipeline = list.find(p => p.isDefault) || list[0];
        if (defaultPipeline) {
          setSelectedPipelineId(defaultPipeline._id);
        }
      }
    } catch {
      // silently fail
    } finally {
      setPipelinesLoading(false);
    }
  };

  // ── Step 2: On pipeline select → fetch page 1 of all stages in parallel ──
  useEffect(() => {
    if (!selectedPipelineId) return;
    resetAndFetchAllStages(selectedPipelineId);
  }, [selectedPipelineId]);

  /**
   * Reset all stage state then fire parallel page-1 fetches for all 7 stages.
   * Each fetch is independent — they resolve/fail independently.
   */
  const resetAndFetchAllStages = useCallback(async (pipelineId) => {
    // Clear per-stage locks
    stageFetchingRef.current = {};

    // Set all stages to loading=true, empty leads (shows global spinner)
    setStagePagination(
      Object.fromEntries(
        PIPELINE_STAGES.map(s => [s.id, { ...initStageState(), loading: true }])
      )
    );

    // Fetch page 1 of every stage concurrently (70 items max across 7 stages)
    await Promise.allSettled(
      PIPELINE_STAGES.map(stage => _fetchStageLeads(pipelineId, stage.id, 1, false))
    );
  }, []);

  /**
   * Fetch one page of leads for a specific stage.
   * Uses per-stage lock to prevent concurrent fetches for the same stage.
   *
   * @param {string} pipelineId
   * @param {string} stageId      — maps to `status` query param
   * @param {number} pageNum
   * @param {boolean} isMore      — true = appending, false = replacing
   */
  const _fetchStageLeads = useCallback(async (pipelineId, stageId, pageNum, isMore) => {
    if (stageFetchingRef.current[stageId]) return;
    stageFetchingRef.current[stageId] = true;

    // Show appropriate loader without overwriting leads
    setStagePagination(prev => ({
      ...prev,
      [stageId]: {
        ...prev[stageId],
        loading: !isMore,
        loadingMore: isMore,
      },
    }));

    try {
      const res = await pipelineAPI.getLeadsByPipeline(pipelineId, {
        page: pageNum,
        limit: STAGE_PAGE_LIMIT,
        status: stageId,
      });

      if (res.success) {
        const newLeads =
          res.data?.data ||
          res.data?.leads ||
          (Array.isArray(res.data) ? res.data : []);

        // Backend may return total count in various shapes
        const backendTotal =
          res.data?.total ??
          res.data?.pagination?.total ??
          res.data?.totalCount ??
          null;

        setStagePagination(prev => ({
          ...prev,
          [stageId]: {
            leads: isMore ? [...prev[stageId].leads, ...newLeads] : newLeads,
            page: pageNum,
            // If we got fewer than limit, no more pages
            hasMore: newLeads.length >= STAGE_PAGE_LIMIT,
            loading: false,
            loadingMore: false,
            // Prefer backend total; fall back to count of what we have
            total: backendTotal !== null
              ? backendTotal
              : isMore
                ? prev[stageId].total
                : newLeads.length,
          },
        }));
      } else {
        setStagePagination(prev => ({
          ...prev,
          [stageId]: { ...prev[stageId], loading: false, loadingMore: false },
        }));
      }
    } catch {
      setStagePagination(prev => ({
        ...prev,
        [stageId]: { ...prev[stageId], loading: false, loadingMore: false },
      }));
    } finally {
      // Small debounce before releasing the lock
      setTimeout(() => {
        stageFetchingRef.current[stageId] = false;
      }, 150);
    }
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handlePipelineSelect = useCallback((pipeline) => {
    if (pipeline._id === selectedPipelineId) return;
    setSelectedPipelineId(pipeline._id);
    setSearchQuery('');
    setExpandedStage(null);
  }, [selectedPipelineId]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    setExpandedStage(null);
    await resetAndFetchAllStages(selectedPipelineId);
    setRefreshing(false);
  }, [selectedPipelineId, resetAndFetchAllStages]);

  const handleStageToggle = useCallback((stageId) => {
    setExpandedStage(prev => (prev === stageId ? null : stageId));
  }, []);

  /** Trigger next-page load for a given stage */
  const handleLoadMore = useCallback((stageId) => {
    const st = stagePagination[stageId];
    if (!st || !st.hasMore || st.loadingMore || stageFetchingRef.current[stageId]) return;
    _fetchStageLeads(selectedPipelineId, stageId, st.page + 1, true);
  }, [stagePagination, selectedPipelineId, _fetchStageLeads]);

  const handleLeadPress = useCallback((lead) => {
    navigation.navigate('LeadDetails', {
      lead,
      refreshPipeline: () => resetAndFetchAllStages(selectedPipelineId),
    });
  }, [navigation, selectedPipelineId, resetAndFetchAllStages]);

  // ── Computed stats ────────────────────────────────────────────────────────

  const { stageData, totalLeads, totalValue, activeValue, convRate } = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const stageData = PIPELINE_STAGES.map(stage => {
      const st = stagePagination[stage.id] ?? initStageState();

      // Apply client-side search filter on cached leads
      const filteredLeads = q
        ? st.leads.filter(l =>
          (l.title || l.name || '').toLowerCase().includes(q) ||
          (l.company?.name || l.company || '').toLowerCase().includes(q)
        )
        : st.leads;

      return {
        ...stage,
        leads: filteredLeads,
        // While searching, total = matched count; otherwise backend total
        total: q ? filteredLeads.length : st.total,
        loading: st.loading,
        loadingMore: st.loadingMore,
        // Don't show Load More while searching (client-side only)
        hasMore: q ? false : st.hasMore,
      };
    });

    // Totals: counts from backend metadata, values from currently-loaded leads
    const totalLeads = stageData.reduce((s, st) => s + st.total, 0);
    const totalValue = stageData.reduce(
      (s, st) => s + st.leads.reduce((a, l) => a + (l.value || 0), 0), 0
    );
    const activeValue = stageData
      .filter(st => st.id !== 'Closed Lost')
      .reduce((s, st) => s + st.leads.reduce((a, l) => a + (l.value || 0), 0), 0);
    const convWon = stagePagination['Closed Won']?.total ?? 0;
    const convRate = totalLeads > 0 ? Math.round((convWon / totalLeads) * 100) : 0;

    return { stageData, totalLeads, totalValue, activeValue, convRate };
  }, [stagePagination, searchQuery]);

  /**
   * Show full-screen spinner only when:
   * - At least one stage is still loading its first page AND
   * - No stage has any data yet
   */
  const isInitialLoading = useMemo(
    () =>
      PIPELINE_STAGES.some(s => stagePagination[s.id]?.loading) &&
      PIPELINE_STAGES.every(s => (stagePagination[s.id]?.leads?.length ?? 0) === 0),
    [stagePagination]
  );

  // ── Header component (summary + funnel chart) ─────────────────────────────

  const headerComponent = useMemo(() => (
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
          const barWidth = Math.max(
            totalLeads > 0 ? Math.round((stage.total / totalLeads) * 100) : 0,
            5
          ) * funnelRatio;
          return (
            <TouchableOpacity
              key={stage.id}
              style={styles.funnelRow}
              activeOpacity={0.7}
              onPress={() => handleStageToggle(stage.id)}
            >
              <View style={styles.funnelLeft}>
                <View style={[styles.funnelDot, { backgroundColor: stage.color }]} />
                <Text style={styles.funnelLabel}>{stage.name}</Text>
              </View>
              <View style={styles.funnelBarWrap}>
                <View
                  style={[
                    styles.funnelBar,
                    { width: `${Math.max(barWidth, 8)}%`, backgroundColor: stage.color + '30' },
                  ]}
                >
                  <View
                    style={[
                      styles.funnelBarInner,
                      {
                        width: `${Math.min(
                          totalLeads > 0 ? (stage.total / totalLeads) * 100 : 0,
                          100
                        )}%`,
                        backgroundColor: stage.color,
                      },
                    ]}
                  />
                </View>
              </View>
              <View style={styles.funnelRight}>
                <Text style={[styles.funnelCount, { color: stage.color }]}>
                  {stage.loading && stage.total === 0 ? '…' : stage.total}
                </Text>
                <IonIcon
                  name={expandedStage === stage.id ? 'chevron-up' : 'chevron-down'}
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
  ), [stageData, totalLeads, totalValue, activeValue, convRate, expandedStage, handleStageToggle]);

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

      {/* ── Nav bar ── */}
      <View style={styles.navBar}>
        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          {navigation?.openDrawer && (
            <TouchableOpacity
              onPress={() => navigation.openDrawer()}
              style={styles.menuBtn}
            >
              <IonIcon name="menu-outline" size={ms(28)} color={Colors.textPrimary} />
            </TouchableOpacity>
          )}
          <Text style={styles.title}>Pipeline</Text>
        </View>
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
                <IonIcon name="close-circle" size={17} color={Colors.textTertiary} />
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
      {isInitialLoading ? (
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
              stageState={{
                leads: item.leads,
                loading: item.loading,
                loadingMore: item.loadingMore,
                hasMore: item.hasMore,
                total: item.total,
              }}
              totalLeadCount={totalLeads}
              isExpanded={expandedStage === item.id}
              onToggle={handleStageToggle}
              onLeadPress={handleLeadPress}
              onLoadMore={handleLoadMore}
            />
          )}
          ListHeaderComponent={headerComponent}
          ListFooterComponent={<View style={{ height: vs(100) }} />}
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
          onPress={() => navigation.navigate(ROUTES.ADD_LEAD, {
            refreshPipeline: () => {
              if (selectedPipelineId) {
                resetAndFetchAllStages(selectedPipelineId);
              }
            },
          })}
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
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: vs(40) },
  loadingText: { marginTop: ms(12), color: Colors.textTertiary, fontSize: ms(13) },

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
  menuBtn: {
    marginRight: Spacing.xs,
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
    padding: Spacing.lg,
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
  funnelRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: ms(8) },
  funnelLeft: { width: ms(100), flexDirection: 'row', alignItems: 'center', gap: 6 },
  funnelDot: { width: 9, height: 9, borderRadius: 5 },
  funnelLabel: { fontSize: ms(14), fontWeight: '600', color: Colors.textSecondary },
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
  stagePercentage: { fontSize: ms(10), color: Colors.textTertiary, marginTop: 1 },
  progressBarBg: {
    height: ms(4),
    backgroundColor: Colors.divider,
    borderRadius: 2,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressBarFill: { height: '100%', borderRadius: 2 },

  // Expanded leads container
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

  // Per-stage loading states
  stageLoadingWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ms(16),
    gap: ms(8),
  },
  stageLoadMoreWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: ms(12),
    gap: ms(8),
  },
  stageLoadingText: {
    fontSize: ms(13),
    color: Colors.textTertiary,
    fontWeight: '500',
  },

  // Load More button
  loadMoreBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: ms(14),
    marginTop: ms(2),
    marginBottom: ms(10),
    paddingVertical: ms(10),
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    gap: ms(6),
    backgroundColor: Colors.background,
  },
  loadMoreText: {
    fontSize: ms(13),
    fontWeight: '600',
  },

  // "All X deals loaded" footer
  allLoadedWrap: {
    alignItems: 'center',
    paddingVertical: ms(10),
  },
  allLoadedText: {
    fontSize: ms(12),
    color: Colors.textTertiary,
    fontStyle: 'italic',
  },

  // Lead card
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
  leadValue: { fontSize: ms(14), fontWeight: '700', color: Colors.success, marginRight: 8 },

  emptyStage: {
    padding: ms(16),
    alignItems: 'center',
  },
  emptyStageText: { fontSize: ms(14), color: Colors.textTertiary },

  // FAB
  floatingAction: {
    position: 'absolute',
    bottom: vs(20),
    right: Spacing.lg,
    ...Shadow.md,
  },
});

export default PipelineScreen;
