/**
 * Tasks Screen
 * Display and manage tasks in a list view with pagination — UI matched to Expo
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
    Alert,
} from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { AppText, AppButton } from '../../components';
import { tasksAPI } from '../../api';
import { showError } from '../../utils';
import { useAuth } from '../../context';
import CommonHeader from '../../components/CommonHeader';

// Enable LayoutAnimation for Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const LIMIT = 50;

// Type icon configs matching Expo
const TYPE_ICONS = {
    Call: { icon: 'call', color: '#4D8733', bg: '#EEF5E6' },
    Email: { icon: 'mail', color: '#3B82F6', bg: '#EFF6FF' },
    Meeting: { icon: 'calendar', color: '#8B5CF6', bg: '#F3F0FF' },
    Document: { icon: 'document-text', color: '#F59E0B', bg: '#FFFBEB' },
};

const PRIORITY_CONFIG = {
    High: { color: '#EF4444', bg: '#FEF2F2' },
    Medium: { color: '#F59E0B', bg: '#FFFBEB' },
    Low: { color: '#3B82F6', bg: '#EFF6FF' },
    Urgent: { color: '#dc2626', bg: '#FEF2F2' },
    high: { color: '#EF4444', bg: '#FEF2F2' },
    medium: { color: '#F59E0B', bg: '#FFFBEB' },
    low: { color: '#3B82F6', bg: '#EFF6FF' },
    urgent: { color: '#dc2626', bg: '#FEF2F2' },
};

const FILTERS = ['All', 'Pending', 'In Progress', 'Completed'];

// Format due date helper matching Expo
function formatDueDate(dateStr) {
    if (!dateStr) return 'No date';

    try {
        const now = new Date();
        const due = new Date(dateStr);

        const diffMs = due.getTime() - now.getTime();
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffDays < -1) return `${Math.abs(diffDays)}d overdue`;
        if (diffDays === -1) return 'Yesterday';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';

        const day = String(due.getDate()).padStart(2, '0');
        const month = due.toLocaleString('en-IN', { month: 'short' });
        const year = due.getFullYear();

        return `${day}-${month}-${year}`;

    } catch {
        return 'N/A';
    }
}

function isDueOrOverdue(dateStr) {
    if (!dateStr) return false;
    return new Date(dateStr).getTime() < Date.now();
}

// Task Card Component — matching Expo design
const TaskCard = ({ task, onPress, onEdit, onDelete, onToggleComplete }) => {
    const status = task.status?.toLowerCase() || 'open';
    const isDone = status === 'completed';
    const taskType = task.taskType || task.type || 'Call';
    const typeConfig = TYPE_ICONS[taskType] || TYPE_ICONS.Call;
    const priority = task.priority || 'Medium';
    const prioConfig = PRIORITY_CONFIG[priority] || PRIORITY_CONFIG.Medium;
    const isOverdue = !isDone && isDueOrOverdue(task.dueAt || task.dueDate);

    const getRelatedToDetails = () => {
        let name = '';
        let email = '';
        const obj = task.relatedTo?.entityId || task.relatedTo || task.lead;
        if (obj && typeof obj === 'object') {
            name = obj.name || obj.title || (obj.contact && `${obj.contact.firstName || ''} ${obj.contact.lastName || ''}`.trim()) || '';
            email = obj.email || (obj.contact && obj.contact.email) || '';
        } else if (typeof obj === 'string') {
            name = obj;
        }

        return { name: name || 'Unknown', email };
    };

    const getAssignedToName = () => {
        const obj = task.assignedTo;
        if (obj && typeof obj === 'object') {
            return obj.name || obj.firstName || 'Unknown User';
        }
        return obj || 'None';
    };

    const relatedTo = getRelatedToDetails();
    const assignedTo = getAssignedToName();

    const statusConfig = {
        completed: { color: Colors.success, bg: '#ECFDF5', icon: 'checkmark-circle', label: 'Completed' },
        open: { color: '#F59E0B', bg: '#FFFBEB', icon: 'time', label: 'Pending' },
        in_progress: { color: Colors.info, bg: '#EFF6FF', icon: 'play-circle', label: 'In Progress' },
    };
    const currentStatusConfig = statusConfig[status] || statusConfig.open;

    return (
        <TouchableOpacity 
            style={[styles.taskCard, isDone && styles.taskCardDone]}
            onPress={onPress}
            activeOpacity={0.7}
        >
            {/* Header: Title + Date */}
            <View style={styles.taskCardHeader}>
                <View style={styles.taskTitleWrap}>
                    <Text style={[styles.taskTitle, isDone && styles.taskTitleDone]} numberOfLines={2}>
                        {task.title || 'Untitled Task'}
                    </Text>
                </View>
                <View style={styles.dateWrap}>
                    <IonIcon name="calendar" size={ms(12)} color={isOverdue && !isDone ? Colors.danger : Colors.textTertiary} />
                    <Text style={[styles.dateText, isOverdue && !isDone ? { color: Colors.danger } : null]}>
                        {formatDueDate(task.dueAt || task.dueDate)}
                    </Text>
                </View>
            </View>

            {/* Body: Assigned & Related Details */}
            <View style={styles.taskBody}>
                {assignedTo && assignedTo !== 'None' ? (
                    <View style={styles.detailRow}>
                        <IonIcon name="person" size={ms(13)} color={Colors.textTertiary} />
                        <Text style={styles.detailText} numberOfLines={1}>
                            <Text style={styles.detailLabel}>Assignee: </Text>
                            {assignedTo}
                        </Text>
                    </View>
                ) : null}

                {relatedTo.name && relatedTo.name !== 'Unknown' ? (
                    <View style={styles.detailRow}>
                        <IonIcon name="briefcase" size={ms(13)} color={Colors.textTertiary} />
                        <Text style={styles.detailText} numberOfLines={1}>
                            <Text style={styles.detailLabel}>Related to: </Text>
                            {relatedTo.name} {relatedTo.email ? `(${relatedTo.email})` : ''}
                        </Text>
                    </View>
                ) : null}
            </View>

            {/* Footer: Status, Priority, Actions */}
            <View style={styles.taskFooter}>
                <View style={styles.tagsContainer}>
                    <View style={[styles.pillTag, { backgroundColor: currentStatusConfig.bg }]}>
                        <IonIcon name={currentStatusConfig.icon} size={ms(12)} color={currentStatusConfig.color} />
                        <Text style={[styles.pillTagText, { color: currentStatusConfig.color }]}>
                            {currentStatusConfig.label}
                        </Text>
                    </View>
                    <View style={[styles.pillTag, { backgroundColor: prioConfig.bg }]}>
                        <IonIcon name="flag" size={ms(12)} color={prioConfig.color} />
                        <Text style={[styles.pillTagText, { color: prioConfig.color }]}>
                            {typeof priority === 'string' ? priority.charAt(0).toUpperCase() + priority.slice(1).toLowerCase() : priority}
                        </Text>
                    </View>
                </View>
                
                <View style={styles.actionButtons}>
                    <TouchableOpacity style={styles.miniActionBtn} onPress={() => onEdit?.(task)}>
                        <IonIcon name="create-outline" size={ms(17)} color={Colors.info} />
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.miniActionBtn} onPress={() => onDelete?.(task)}>
                        <IonIcon name="trash-outline" size={ms(17)} color={Colors.danger} />
                    </TouchableOpacity>
                </View>
            </View>
        </TouchableOpacity>
    );
};

const TasksScreen = ({ navigation }) => {
    const nav = useNavigation();
    const { user } = useAuth();
    const searchTimeoutRef = useRef(null);
    const currentSearchRef = useRef('');
    const isInitialLoadRef = useRef(true);

    // State
    const [filter, setFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');
    const [searchOpen, setSearchOpen] = useState(false);
    const [page, setPage] = useState(1);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [refreshing, setRefreshing] = useState(false);
    const [hasMore, setHasMore] = useState(true);
    const [tasks, setTasks] = useState([]);

    // Map filter name to the matching API status(es)
    const statusMatchesFilter = (taskStatus, filterName) => {
        const s = taskStatus?.toLowerCase() || 'open';
        switch (filterName) {
            case 'All': return true;
            case 'Pending': return s === 'open';
            case 'In Progress': return s === 'in_progress';
            case 'Completed': return s === 'completed';
            default: return true;
        }
    };

    // Filter tasks by the active filter
    const filtered = tasks.filter((t) => statusMatchesFilter(t.status, filter));

    // Count helper — used by both the subtitle and filter pills
    const getCount = (f) => tasks.filter((t) => statusMatchesFilter(t.status, f)).length;
    const pendingCount = getCount('Pending');

    // Debounced search effect
    useEffect(() => {
        if (isInitialLoadRef.current) return;
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        currentSearchRef.current = searchQuery;
        if (!searchQuery.trim()) {
            fetchTasks(1, false, '');
            return;
        }
        searchTimeoutRef.current = setTimeout(() => {
            fetchTasks(1, false, searchQuery.trim());
        }, 300);
        return () => {
            if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        };
    }, [searchQuery]);

    // Refetch tasks every time screen gains focus (covers create, edit, delete from other screens)
    useFocusEffect(
        useCallback(() => {
            fetchTasks(1, true, searchQuery.trim());
            isInitialLoadRef.current = false;
        }, [])
    );

    const fetchTasks = async (pageNum = 1, showLoader = false, search = '') => {
        try {
            if (showLoader) {
                setLoading(true);
            } else if (pageNum > 1) {
                setLoadingMore(true);
            }
            const params = { page: pageNum, limit: LIMIT };
            if (search) params.search = search;
            const response = await tasksAPI.getAll(params);
            if (search !== currentSearchRef.current && search !== '') return;
            if (response.success) {
                const tasksData = response.data?.data?.items || [];
                const newTasks = Array.isArray(tasksData) ? tasksData : [];
                if (pageNum === 1) {
                    setTasks(newTasks);
                } else {
                    setTasks(prev => [...prev, ...newTasks]);
                }
                setHasMore(newTasks.length === LIMIT);
                setPage(pageNum);
            } else {
                console.error('Failed to fetch tasks:', response.error);
                showError('Error', response.error || 'Failed to load tasks');
            }
        } catch (error) {
            console.error('Error fetching tasks:', error);
            showError('Error', 'Failed to load tasks');
        } finally {
            setLoading(false);
            setLoadingMore(false);
            setRefreshing(false);
        }
    };

    const onRefresh = useCallback(() => {
        setRefreshing(true);
        setHasMore(true);
        fetchTasks(1, false, searchQuery.trim());
    }, [searchQuery]);

    const loadMore = useCallback(() => {
        if (!loadingMore && hasMore && !loading) {
            fetchTasks(page + 1, false, searchQuery.trim());
        }
    }, [loadingMore, hasMore, loading, page, searchQuery]);

    const handleEditTask = (task) => {
        nav.navigate('EditTask', { task });
    };

    const handleDeleteTask = (task) => {
        const taskId = task._id || task.id;
        Alert.alert(
            'Delete Task',
            `Are you sure you want to delete "${task.title}"?`,
            [
                { text: 'Cancel', style: 'cancel' },
                {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: async () => {
                        try {
                            const response = await tasksAPI.delete(taskId);
                            console.log('Delete response:', response);
                            if (response.success) {
                                // Remove from local state
                                setTasks(prev => prev.filter(t => (t._id || t.id) !== taskId));
                            } else {
                                Alert.alert('Error', response.error || 'Failed to delete task');
                            }
                        } catch (error) {
                            console.error('Error deleting task:', error);
                            Alert.alert('Error', 'Failed to delete task');
                        }
                    },
                },
            ],
        );
    };

    const handleTaskPress = (task) => {
        navigation.navigate('TaskDetails', { task });
    };

    const handleToggleComplete = (task) => {
        // Toggle logic can be implemented here
        console.log('Toggle complete:', task._id);
    };

    const renderTaskCard = ({ item: task }) => (
        <TaskCard
            task={task}
            onPress={() => handleTaskPress(task)}
            onEdit={handleEditTask}
            onDelete={handleDeleteTask}
            onToggleComplete={handleToggleComplete}
        />
    );

    const renderFooter = () => {
        if (!loadingMore) return null;
        return (
            <View style={styles.footerLoader}>
                <ActivityIndicator size="small" color={Colors.primary} />
                <Text style={styles.footerText}>Loading more tasks...</Text>
            </View>
        );
    };

    const renderEmpty = () => {
        if (loading) return null;
        return (
            <View style={styles.emptyState}>
                <View style={styles.emptyCircle}>
                    <IonIcon name="checkbox-outline" size={ms(40)} color={Colors.primary} />
                </View>
                <Text style={styles.emptyTitle}>No tasks yet</Text>
                <Text style={styles.emptySubtitle}>
                    {searchQuery ? 'Try adjusting your search' : 'Tap + Add Task to get started'}
                </Text>
            </View>
        );
    };

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
            {/* Header */}
            <CommonHeader navigation={navigation} />

            {/* Search bar (toggle) */}
            {searchOpen ? (
                <View style={styles.searchWrap}>
                    <View style={styles.searchBar}>
                        <IonIcon name="search" size={17} color={Colors.textTertiary} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="Search tasks..."
                            placeholderTextColor={Colors.textTertiary}
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoFocus
                        />
                        <TouchableOpacity onPress={() => { setSearchOpen(false); setSearchQuery(''); }}>
                            <IonIcon name="close-circle" size={17} color={Colors.textTertiary} />
                        </TouchableOpacity>
                    </View>
                </View>
            ) : null}

            {/* Title + Actions row */}
            <View style={styles.titleRow}>
                <View>
                    <Text style={styles.sectionTitle}>Tasks</Text>
                    <Text style={styles.subtitleText}>{pendingCount} pending</Text>
                </View>
                <View style={styles.titleActions}>
                    <TouchableOpacity style={styles.iconBtn} onPress={() => setSearchOpen(!searchOpen)}>
                        <IonIcon name="search" size={18} color={Colors.textPrimary} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.addBtn}
                        onPress={() => navigation.navigate('AddTask')}
                    >
                        <IonIcon name="add" size={18} color="#fff" />
                        <Text style={styles.addBtnText}>Add Task</Text>
                    </TouchableOpacity>
                </View>
            </View>

            {/* Filter pills */}
            <View style={styles.filterRow}>
                {FILTERS.map((f) => {
                    const count = getCount(f);
                    const isActive = filter === f;
                    return (
                        <TouchableOpacity
                            key={f}
                            style={[styles.filterPill, isActive && styles.filterPillActive]}
                            onPress={() => setFilter(f)}
                        >
                            <Text style={[styles.filterPillText, isActive && styles.filterPillTextActive]}>
                                {f}
                            </Text>
                            <View style={[styles.filterCount, isActive && styles.filterCountActive]}>
                                <Text style={[styles.filterCountText, isActive && { color: '#fff' }]}>{count}</Text>
                            </View>
                        </TouchableOpacity>
                    );
                })}
            </View>

            <FlatList
                data={filtered}
                keyExtractor={(item) => item._id || item.id || String(Math.random())}
                renderItem={renderTaskCard}
                ListFooterComponent={renderFooter}
                ListEmptyComponent={renderEmpty}
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
    container: { flex: 1, backgroundColor: Colors.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },

    // Search
    searchWrap: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm },
    searchBar: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.surface, borderRadius: BorderRadius.md,
        paddingHorizontal: Spacing.md, height: ms(42),
        borderWidth: 1, borderColor: Colors.surfaceBorder,
    },
    searchInput: { flex: 1, marginLeft: Spacing.sm, fontSize: ms(14), color: Colors.textPrimary },

    // Title row
    titleRow: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingHorizontal: Spacing.lg, paddingBottom: Spacing.sm,
    },
    sectionTitle: { fontSize: ms(24), fontWeight: '800', color: Colors.textPrimary },
    subtitleText: { fontSize: ms(12), color: Colors.textTertiary, marginTop: 1 },
    titleActions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
    iconBtn: {
        width: ms(38), height: ms(38), borderRadius: ms(12),
        backgroundColor: Colors.surface, justifyContent: 'center', alignItems: 'center', ...Shadow.sm,
    },
    addBtn: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: Colors.primary, paddingHorizontal: ms(14),
        paddingVertical: ms(10), borderRadius: ms(14), gap: 4,
    },
    addBtnText: { fontSize: ms(13), fontWeight: '700', color: '#fff' },

    // Filter pills
    filterRow: {
        flexDirection: 'row', paddingHorizontal: Spacing.lg,
        gap: Spacing.sm, marginBottom: Spacing.md,
    },
    filterPill: {
        flexDirection: 'row', alignItems: 'center', paddingHorizontal: ms(14),
        paddingVertical: ms(8), borderRadius: 999,
        backgroundColor: Colors.surface, borderWidth: 1.5, borderColor: Colors.surfaceBorder, gap: 6,
    },
    filterPillActive: { backgroundColor: Colors.primary, borderColor: Colors.primary },
    filterPillText: { fontSize: ms(12), fontWeight: '600', color: Colors.textSecondary },
    filterPillTextActive: { color: '#fff' },
    filterCount: { backgroundColor: Colors.background, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 1 },
    filterCountActive: { backgroundColor: 'rgba(255,255,255,0.3)' },
    filterCountText: { fontSize: ms(10), fontWeight: '700', color: Colors.textSecondary },

    listContent: { paddingHorizontal: Spacing.lg, paddingBottom: ms(100) },

    // Task card — Redesigned Premium Style
    taskCard: {
        backgroundColor: Colors.surface,
        borderRadius: ms(16),
        padding: ms(16),
        marginBottom: Spacing.md,
        borderWidth: 1.5,
        borderColor: Colors.surfaceBorder,
        ...Shadow.sm,
    },
    taskCardDone: { opacity: 0.65 },
    
    // Header
    taskCardHeader: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        marginBottom: Spacing.md,
    },
    taskTitleWrap: { flex: 1, paddingRight: Spacing.md, justifyContent: 'flex-start' },
    taskTitle: { fontSize: ms(16), fontWeight: '700', color: Colors.textPrimary, lineHeight: ms(22) },
    taskTitleDone: { textDecorationLine: 'line-through', color: Colors.textTertiary },
    
    dateWrap: { flexDirection: 'row', alignItems: 'center', gap: ms(4), marginTop: ms(2) },
    dateText: { fontSize: ms(12), color: Colors.textSecondary, fontWeight: '600' },

    // Body
    taskBody: { marginBottom: Spacing.md, paddingLeft: ms(2) },
    detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: ms(6) },
    detailLabel: { color: Colors.textSecondary, fontWeight: '500' },
    detailText: { flex: 1, fontSize: ms(13), color: Colors.textPrimary, marginLeft: ms(6) },

    // Footer
    taskFooter: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingTop: Spacing.md, borderTopWidth: 1, borderTopColor: Colors.surfaceBorder,
    },
    tagsContainer: { flexDirection: 'row', flexWrap: 'wrap', gap: ms(8), flex: 1, paddingRight: ms(8) },
    pillTag: {
        flexDirection: 'row', alignItems: 'center', gap: ms(4),
        paddingHorizontal: ms(8), paddingVertical: ms(4),
        borderRadius: ms(6),
    },
    pillTagText: { fontSize: ms(12), fontWeight: '600' },
    
    actionButtons: { flexDirection: 'row', alignItems: 'center', gap: ms(12) },
    miniActionBtn: { padding: ms(4) },
    actionRow: {
        flexDirection: 'row', justifyContent: 'flex-end', gap: Spacing.sm,
        marginTop: Spacing.sm, paddingTop: Spacing.sm,
        borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: Colors.divider,
    },
    actionBtn: {
        width: ms(32), height: ms(32), borderRadius: ms(8),
        backgroundColor: Colors.background, justifyContent: 'center', alignItems: 'center',
    },

    // Footer
    footerLoader: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        paddingVertical: vs(16), gap: Spacing.sm,
    },
    footerText: { fontSize: ms(13), color: Colors.textTertiary, marginLeft: Spacing.sm },

    // Empty State
    emptyState: { alignItems: 'center', paddingTop: ms(80) },
    emptyCircle: {
        width: ms(80), height: ms(80), borderRadius: 40,
        backgroundColor: Colors.primaryBackground, justifyContent: 'center', alignItems: 'center', marginBottom: Spacing.lg,
    },
    emptyTitle: { fontSize: ms(18), fontWeight: '700', color: Colors.textPrimary },
    emptySubtitle: { fontSize: ms(13), color: Colors.textTertiary, marginTop: 4 },
});

export default TasksScreen;
