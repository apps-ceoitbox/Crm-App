/**
 * Pipeline Screen
 * Display leads grouped by pipeline stages with funnel visualization — UI matched to Expo
 */

import React, {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
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
  Dimensions,
  TextInput,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import LinearGradient from 'react-native-linear-gradient';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText, AppButton } from '../../components';
import { leadsAPI } from '../../api';
import { showError } from '../../utils';
import { useAuth } from '../../context';
import CommonHeader from '../../components/CommonHeader';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const LIMIT = 1000;

// Pipeline stages configuration with Expo-matched icons/colors where possible
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

function formatValue(val) {
  if (!val) return '0';
  if (val >= 100000)
    return `${(val / 100000).toFixed(val % 100000 === 0 ? 0 : 1)}L`;
  if (val >= 1000) return `${(val / 1000).toFixed(val % 1000 === 0 ? 0 : 1)}K`;
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

const PipelineScreen = ({ navigation }) => {
  const nav = useNavigation();
  const { user } = useAuth();
  const searchTimeoutRef = useRef(null);
  const currentSearchRef = useRef('');
  const isInitialLoadRef = useRef(true);

  // State
  const [searchQuery, setSearchQuery] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [leads, setLeads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [expandedStage, setExpandedStage] = useState(null);

  // Group leads by stage and calculate stats
  const { stageData, totalValue, activeValue, convRate, totalLeads } =
    useMemo(() => {
      const filteredLeads = searchQuery.trim()
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

      const totalValue = filteredLeads.reduce((s, l) => s + (l.value || 0), 0);
      const activeValue = filteredLeads
        .filter(l => l.status !== 'Closed Lost')
        .reduce((s, l) => s + (l.value || 0), 0);

      const convWon = filteredLeads.filter(
        l => l.status === 'Closed Won',
      ).length;
      const convRate =
        filteredLeads.length > 0
          ? Math.round((convWon / filteredLeads.length) * 100)
          : 0;
      const totalLeads = filteredLeads.length;

      const stageData = PIPELINE_STAGES.map(stage => {
        const stageLeads = filteredLeads.filter(l => {
          const leadStage = l.status || l.stage?.name || l.stage;
          return leadStage === stage.id || leadStage === stage.name;
        });
        const stageValue = stageLeads.reduce((s, l) => s + (l.value || 0), 0);
        const percentage =
          totalLeads > 0
            ? Math.round((stageLeads.length / totalLeads) * 100)
            : 0;
        return {
          ...stage,
          leads: stageLeads,
          value: stageValue,
          percentage,
          count: stageLeads.length,
        };
      });

      return { stageData, totalValue, activeValue, convRate, totalLeads };
    }, [leads, searchQuery]);

  // Debounced search effect
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    currentSearchRef.current = searchQuery;
    if (!searchQuery.trim()) {
      fetchLeads(false, '');
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchLeads(false, searchQuery.trim());
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads(true, '');
    isInitialLoadRef.current = false;
  }, []);

  const fetchLeads = async (showLoader = false, search = '') => {
    try {
      if (showLoader) setLoading(true);
      const params = { page: 1, limit: LIMIT };
      if (search) params.search = search;
      const response = await leadsAPI.getAll(params);
      if (search !== currentSearchRef.current && search !== '') return;
      if (response.success) {
        const leadsData =
          response.data?.data || response.data?.leads || response.data || [];
        setLeads(Array.isArray(leadsData) ? leadsData : []);
      } else {
        showError('Error', response.error || 'Failed to load pipeline');
      }
    } catch (error) {
      showError('Error', 'Failed to load pipeline');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeads(false, searchQuery.trim());
  }, [searchQuery]);

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <CommonHeader navigation={navigation} />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Pipeline</Text>
        <View style={{ flexDirection: 'row', gap: Spacing.sm }}>
          <TouchableOpacity
            style={styles.headerIconBtn}
            onPress={() => setSearchOpen(!searchOpen)}
          >
            <IonIcon
              name={searchOpen ? 'close' : 'search'}
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.headerIconBtn}>
            <IonIcon
              name="options-outline"
              size={20}
              color={Colors.textPrimary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {searchOpen ? (
        <View
          style={{ paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm }}
        >
          <View style={styles.searchBar}>
            <IonIcon name="search" size={17} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search deals..."
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
      ) : null}

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Summary gradient card — matches Expo */}
        <LinearGradient
          colors={['#4D8733', '#6BA344']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 0 }}
          style={styles.summaryCard}
        >
          <View style={styles.summaryGrid}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{totalLeads}</Text>
              <Text style={styles.summaryLabel}>Total Deals</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                ₹{formatValue(totalValue)}
              </Text>
              <Text style={styles.summaryLabel}>Total Value</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>
                ₹{formatValue(activeValue)}
              </Text>
              <Text style={styles.summaryLabel}>Active Value</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryValue}>{convRate}%</Text>
              <Text style={styles.summaryLabel}>Conversion</Text>
            </View>
          </View>
        </LinearGradient>

        {/* Visual funnel bars — matches Expo */}
        <Text style={styles.sectionLabel}>PIPELINE FUNNEL</Text>
        <View style={styles.funnelCard}>
          {stageData.map((stage, index) => {
            const funnelRatio = 1 - index * 0.1; // Slightly wider funnel
            const barWidth = Math.max(stage.percentage, 5) * funnelRatio;

            return (
              <TouchableOpacity
                key={stage.id}
                style={styles.funnelRow}
                activeOpacity={0.7}
                onPress={() =>
                  setExpandedStage(expandedStage === stage.id ? null : stage.id)
                }
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
                            (stage.count / Math.max(totalLeads, 1)) * 100,
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
                    {stage.count}
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

        {/* Stage cards breakdown — matches Expo */}
        <Text style={styles.sectionLabel}>STAGE BREAKDOWN</Text>
        {stageData.map(stage => {
          const isExpanded = expandedStage === stage.id;
          return (
            <View key={stage.id}>
              <TouchableOpacity
                style={styles.stageCard}
                activeOpacity={0.85}
                onPress={() => setExpandedStage(isExpanded ? null : stage.id)}
              >
                <View style={styles.stageHeader}>
                  <View
                    style={[styles.stageIcon, { backgroundColor: stage.bg }]}
                  >
                    <IonIcon
                      name={stage.icon}
                      size={ms(18)}
                      color={stage.color}
                    />
                  </View>
                  <View style={styles.stageInfo}>
                    <Text style={styles.stageName}>{stage.name}</Text>
                    <Text style={styles.stageCount}>{stage.count} deals</Text>
                  </View>
                  <View style={styles.stageRight}>
                    <Text style={[styles.stageValue, { color: stage.color }]}>
                      ₹{formatValue(stage.value)}
                    </Text>
                    <Text style={styles.stagePercentage}>
                      {stage.percentage}%
                    </Text>
                  </View>
                  <IonIcon
                    name={isExpanded ? 'chevron-up' : 'chevron-down'}
                    size={18}
                    color={Colors.textTertiary}
                    style={{ marginLeft: 8 }}
                  />
                </View>

                {/* Progress bar */}
                <View style={styles.progressBarBg}>
                  <View
                    style={[
                      styles.progressBarFill,
                      {
                        width: `${Math.max(stage.percentage, 2)}%`,
                        backgroundColor: stage.color,
                      },
                    ]}
                  />
                </View>
              </TouchableOpacity>

              {/* Expanded leads cards */}
              {isExpanded && stage.leads.length > 0 ? (
                <View style={styles.expandedLeads}>
                  {stage.leads.map(lead => {
                    const avatarColor = getAvatarColor(
                      lead.title || lead.name || '',
                    );
                    return (
                      <TouchableOpacity
                        key={lead._id || lead.id}
                        style={styles.leadCard}
                        activeOpacity={0.85}
                        onPress={() =>
                          navigation.navigate('LeadDetails', { lead })
                        }
                      >
                        <View
                          style={[
                            styles.leadAvatar,
                            { backgroundColor: avatarColor + '18' },
                          ]}
                        >
                          <Text
                            style={[
                              styles.leadAvatarText,
                              { color: avatarColor },
                            ]}
                          >
                            {getInitials(lead.title || lead.name)}
                          </Text>
                        </View>
                        <View style={styles.leadInfo}>
                          <Text style={styles.leadName} numberOfLines={1}>
                            {lead.title || lead.name}
                          </Text>
                          {lead.company?.name || lead.company ? (
                            <Text style={styles.leadCompany} numberOfLines={1}>
                              {lead.company?.name || lead.company}
                            </Text>
                          ) : null}
                        </View>
                        {lead.value ? (
                          <Text style={styles.leadValue}>
                            ₹{formatValue(lead.value)}
                          </Text>
                        ) : null}
                        <IonIcon
                          name="chevron-forward"
                          size={16}
                          color={Colors.textTertiary}
                        />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              ) : null}

              {isExpanded && stage.leads.length === 0 ? (
                <View style={styles.emptyStage}>
                  <Text style={styles.emptyStageText}>
                    No deals in this stage
                  </Text>
                </View>
              ) : null}
            </View>
          );
        })}

        {/* Floating Add Button logic placeholder - keep existing logic if needed */}
        <View style={{ height: ms(100) }} />
      </ScrollView>

      <View style={styles.floatingAction}>
        <AppButton
          title="Add Deal"
          onPress={() => navigation.navigate('AddLead')}
          fullWidth={false}
          size="small"
          icon="add"
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
    paddingBottom: Spacing.md,
  },
  title: {
    fontSize: ms(28),
    fontWeight: '800',
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
  scrollContent: { paddingHorizontal: Spacing.lg },

  // Summary Card
  summaryCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadow.md,
  },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryItem: { width: '50%', alignItems: 'center', paddingVertical: ms(8) },
  summaryValue: { fontSize: ms(20), fontWeight: '800', color: '#fff' },
  summaryLabel: {
    fontSize: ms(10),
    fontWeight: '500',
    color: 'rgba(255,255,255,0.7)',
    marginTop: 2,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  sectionLabel: {
    fontSize: ms(11),
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
    width: ms(90),
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  funnelDot: { width: 8, height: 8, borderRadius: 4 },
  funnelLabel: {
    fontSize: ms(11),
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

  // Stage cards
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
  stageName: { fontSize: ms(15), fontWeight: '700', color: Colors.textPrimary },
  stageCount: { fontSize: ms(11), color: Colors.textTertiary, marginTop: 1 },
  stageRight: { alignItems: 'flex-end' },
  stageValue: { fontSize: ms(15), fontWeight: '800' },
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
  leadAvatarText: { fontSize: ms(13), fontWeight: '700' },
  leadInfo: { flex: 1, marginLeft: Spacing.sm },
  leadName: { fontSize: ms(14), fontWeight: '600', color: Colors.textPrimary },
  leadCompany: { fontSize: ms(11), color: Colors.textTertiary, marginTop: 1 },
  leadValue: {
    fontSize: ms(13),
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
  emptyStageText: { fontSize: ms(12), color: Colors.textTertiary },

  floatingAction: {
    position: 'absolute',
    bottom: vs(20),
    right: Spacing.lg,
    ...Shadow.md,
  },
});

export default PipelineScreen;
