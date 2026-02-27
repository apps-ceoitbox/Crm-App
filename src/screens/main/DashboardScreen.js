/**
 * Dashboard Screen
 * Company list with pagination — UI matched to Expo CompaniesScreen
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
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
import { ROUTES } from '../../constants';
import { ms, vs, wp } from '../../utils/Responsive';
import { useAuth } from '../../context';
import { AppText } from '../../components';
import { companiesAPI } from '../../api';
import { showError } from '../../utils';

const LIMIT = 50;

// Industry icon mapping — matching Expo CompaniesScreen
function getIndustryConfig(industry) {
  const map = {
    SaaS: { icon: 'cloud', color: '#3B82F6', bg: '#EFF6FF' },
    Finance: { icon: 'wallet', color: '#10B981', bg: '#ECFDF5' },
    Design: { icon: 'color-palette', color: '#EC4899', bg: '#FDF2F8' },
    Tech: { icon: 'hardware-chip', color: '#6366F1', bg: '#EEF2FF' },
  };
  return (
    map[industry || ''] || { icon: 'business', color: '#4D8733', bg: '#EEF5E6' }
  );
}

// Company Card — matching Expo CompaniesScreen design
const CompanyCard = ({ company, onPress, onEdit, onDelete }) => {
  const ic = getIndustryConfig(company.industry);
  const location = [company.city, company.state].filter(Boolean).join(', ');

  return (
    <View style={styles.card}>
      {/* Card header */}
      <TouchableOpacity
        style={styles.cardTop}
        onPress={onPress}
        activeOpacity={0.8}
      >
        <View style={[styles.industryIcon, { backgroundColor: ic.bg }]}>
          <IonIcon name={ic.icon} size={20} color={ic.color} />
        </View>
        <View style={styles.cardTopText}>
          <Text style={styles.companyName} numberOfLines={1}>
            {company.name || 'Untitled'}
          </Text>
          {company.industry ? (
            <View style={[styles.industryTag, { backgroundColor: ic.bg }]}>
              <Text style={[styles.industryTagText, { color: ic.color }]}>
                {company.industry}
              </Text>
            </View>
          ) : null}
        </View>
      </TouchableOpacity>

      {/* Key metrics row */}
      <View style={styles.metricsRow}>
        {company.salesperson ? (
          <View style={styles.metricItem}>
            <IonIcon
              name="person-outline"
              size={13}
              color={Colors.textTertiary}
            />
            <Text style={styles.metricText}>{company.salesperson}</Text>
          </View>
        ) : null}
        {location ? (
          <View style={styles.metricItem}>
            <IonIcon
              name="location-outline"
              size={13}
              color={Colors.textTertiary}
            />
            <Text style={styles.metricText}>{location}</Text>
          </View>
        ) : null}
        {company.email ? (
          <TouchableOpacity
            style={styles.metricItem}
            onPress={() => Linking.openURL(`mailto:${company.email}`)}
          >
            <IonIcon name="mail-outline" size={13} color={Colors.info} />
            <Text
              style={[styles.metricText, { color: Colors.info }]}
              numberOfLines={1}
            >
              {company.email}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Action strip */}
      <View style={styles.actionStrip}>
        <TouchableOpacity
          style={styles.actionPill}
          onPress={() => onEdit?.(company)}
        >
          <IonIcon name="create-outline" size={14} color={Colors.info} />
          <Text style={[styles.actionPillText, { color: Colors.info }]}>
            Edit
          </Text>
        </TouchableOpacity>
        {company.phone ? (
          <TouchableOpacity
            style={styles.actionPill}
            onPress={() => Linking.openURL(`tel:${company.phone}`)}
          >
            <IonIcon name="call-outline" size={14} color={Colors.primary} />
            <Text style={[styles.actionPillText, { color: Colors.primary }]}>
              Call
            </Text>
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          style={styles.actionPill}
          onPress={() => onDelete?.(company)}
        >
          <IonIcon name="trash-outline" size={14} color={Colors.danger} />
          <Text style={[styles.actionPillText, { color: Colors.danger }]}>
            Remove
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const DashboardScreen = ({ navigation }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [overlayLoading, setOverlayLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [companies, setCompanies] = useState([]);
  const { user } = useAuth();
  const searchTimeoutRef = useRef(null);
  const currentSearchRef = useRef('');
  const isInitialLoadRef = useRef(true);
  const nav = useNavigation();

  // Debounced search
  useEffect(() => {
    if (isInitialLoadRef.current) return;
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    currentSearchRef.current = searchQuery;
    if (!searchQuery.trim()) {
      fetchCompanies(1, false, '');
      return;
    }
    searchTimeoutRef.current = setTimeout(() => {
      fetchCompanies(1, false, searchQuery.trim());
    }, 300);
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, [searchQuery]);

  useEffect(() => {
    fetchCompanies(1, true, '');
    isInitialLoadRef.current = false;
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!loading) fetchCompanies(1, true);
    }, []),
  );

  const fetchCompanies = async (
    pageNum = 1,
    showLoader = false,
    search = '',
  ) => {
    try {
      if (showLoader) setLoading(true);
      else if (pageNum > 1) setLoadingMore(true);

      const params = { page: pageNum, limit: LIMIT };
      if (search) params.search = search;

      const response = await companiesAPI.getAll(params);
      if (search !== currentSearchRef.current && search !== '') return;

      if (response.success) {
        const companiesData =
          response.data?.data ||
          response.data?.companies ||
          response.data ||
          [];
        const newCompanies = Array.isArray(companiesData) ? companiesData : [];
        if (pageNum === 1) setCompanies(newCompanies);
        else setCompanies(prev => [...prev, ...newCompanies]);
        setHasMore(newCompanies.length === LIMIT);
        setPage(pageNum);
      } else {
        showError('Error', response.error || 'Failed to load companies');
      }
    } catch (error) {
      showError('Error', 'Failed to load companies');
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    setHasMore(true);
    fetchCompanies(1, true, searchQuery.trim());
  }, [searchQuery]);

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      fetchCompanies(page + 1, false, searchQuery.trim());
    }
  }, [loadingMore, hasMore, loading, page, searchQuery]);

  const handleEditCompany = company => {
    nav.navigate('EditCompany', { company });
  };

  const handleDeleteCompany = company => {
    Alert.alert('Delete Company', `Remove "${company.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const id = company._id || company.id;
          try {
            setOverlayLoading(true);
            const res = await companiesAPI.delete(id);
            if (res && res.success) {
              // Remove from local state without refetch
              setCompanies(prev => prev.filter(c => (c._id || c.id) !== id));
              Alert.alert('Deleted', 'Company removed successfully.');
            } else {
              showError('Error', res?.error || 'Failed to delete company');
            }
          } catch (error) {
            showError('Error', 'Failed to delete company');
          } finally {
            setOverlayLoading(false);
          }
        },
      },
    ]);
  };

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
          <IonIcon name="business" size={ms(40)} color={Colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>No companies yet</Text>
        <Text style={styles.emptySubtitle}>
          Tap + to add your first company
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView edges={['top']} style={{ flex: 1 }}>
        {/* Header — matching Expo CompaniesScreen */}
        <View style={styles.header}>
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backBtn}
          >
            <IonIcon name="arrow-back" size={22} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <Text style={styles.headerTitle}>Companies</Text>
            <Text style={styles.headerCount}>{companies.length} total</Text>
          </View>
          <TouchableOpacity
            style={styles.addBtnRound}
            onPress={() =>
              navigation.navigate('AddCompany', {
                onCreate: newCompany =>
                  setCompanies(prev => [newCompany, ...prev]),
              })
            }
          >
            <IonIcon name="add" size={22} color="#fff" />
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchWrap}>
          <View style={styles.searchBar}>
            <IonIcon name="search" size={16} color={Colors.textTertiary} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search companies..."
              placeholderTextColor={Colors.textTertiary}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery ? (
              <TouchableOpacity onPress={() => setSearchQuery('')}>
                <IonIcon
                  name="close-circle"
                  size={16}
                  color={Colors.textTertiary}
                />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* List */}
        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={companies}
            keyExtractor={item => item._id || item.id || String(Math.random())}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CompanyCard
                company={item}
                onPress={() =>
                  navigation.navigate('CompanyDetails', { company: item })
                }
                onEdit={handleEditCompany}
                onDelete={handleDeleteCompany}
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
        {overlayLoading ? (
          <View style={styles.overlay} pointerEvents="none">
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : null}
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
  headerTitle: {
    fontSize: ms(22),
    fontWeight: '800',
    color: Colors.textPrimary,
  },
  headerCount: { fontSize: ms(11), color: Colors.textTertiary, marginTop: 1 },
  addBtnRound: {
    width: ms(42),
    height: ms(42),
    borderRadius: ms(14),
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Search
  searchWrap: { paddingHorizontal: Spacing.lg, marginBottom: Spacing.md },
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

  // List
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: ms(100) },

  // Card — matching Expo CompaniesScreen
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    padding: ms(16),
    marginBottom: Spacing.md,
    borderLeftWidth: ms(3),
    borderLeftColor: Colors.primary,
    ...Shadow.sm,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center' },
  industryIcon: {
    width: ms(44),
    height: ms(44),
    borderRadius: ms(14),
    justifyContent: 'center',
    alignItems: 'center',
  },
  cardTopText: { flex: 1, marginLeft: Spacing.md },
  companyName: {
    fontSize: ms(16),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  industryTag: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    marginTop: 4,
  },
  industryTagText: { fontSize: ms(10), fontWeight: '600' },

  // Metrics
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: ms(10),
    marginTop: Spacing.md,
  },
  metricItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metricText: { fontSize: ms(11), color: Colors.textSecondary },

  // Actions
  actionStrip: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.divider,
  },
  actionPill: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actionPillText: { fontSize: ms(12), fontWeight: '600' },

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
  emptyTitle: {
    fontSize: ms(18),
    fontWeight: '700',
    color: Colors.textPrimary,
  },
  emptySubtitle: { fontSize: ms(13), color: Colors.textTertiary, marginTop: 4 },

  // Overlay
  overlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.12)',
  },

  // Footer
  footerLoader: { paddingVertical: Spacing.md, alignItems: 'center' },
});

export default DashboardScreen;
