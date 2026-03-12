/**
 * Task Details Screen
 * Detailed view of a single task with API integration and actions
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs } from '../../utils/Responsive';
import { ScreenWrapper, AppText, AppButton, DeleteConfirmationModal } from '../../components';
import { tasksAPI, leadsAPI } from '../../api';
import { useFocusEffect } from '@react-navigation/native';
import { ROUTES } from '../../constants';

const TaskDetailsScreen = ({ route, navigation }) => {
  const { task: initialTask, taskId } = route.params || {};
  const [currentTask, setCurrentTask] = useState(initialTask || null);
  const [loading, setLoading] = useState(!initialTask);
  const [refreshing, setRefreshing] = useState(false);
  const [isCompleted, setIsCompleted] = useState(
    initialTask?.status === 'completed',
  );
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch task details from API
  const fetchTaskDetails = useCallback(
    async (showLoader = true) => {
      const id = taskId || initialTask?._id || initialTask?.id;
      if (!id) {
        console.error('Task ID not found');
        return;
      }

      try {
        if (showLoader) setLoading(true);
        console.log('Fetching task details for ID:', id);
        const response = await tasksAPI.getById(id);
        console.log('Task details response:', response);

        if (response.success) {
          const taskData = response.data?.data || response.data;
          console.log('Task data:', taskData);
          setCurrentTask(taskData);
          setIsCompleted(taskData?.status === 'completed');
        } else {
          console.error('Failed to fetch task:', response.error);
        }
      } catch (error) {
        console.error('Error fetching task:', error);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [taskId, initialTask],
  );

  // Refetch task details every time screen gains focus (after edit, etc.)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      fetchTaskDetails(false);
    });
    return unsubscribe;
  }, [navigation, fetchTaskDetails]);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTaskDetails(false);
  };

  // Helper functions
  const getPriorityColor = priority => {
    const colors = {
      high: Colors.error,
      medium: '#f97316',
      low: Colors.success,
      urgent: '#dc2626',
    };
    return colors[priority?.toLowerCase()] || Colors.textMuted;
  };

  const getStatusColor = status => {
    const colors = {
      open: '#f97316',
      pending: '#f97316',
      in_progress: Colors.info,
      'in progress': Colors.info,
      completed: Colors.success,
      cancelled: Colors.textMuted,
    };
    return colors[status?.toLowerCase()] || Colors.textMuted;
  };

  const getStatusName = status => {
    const names = {
      open: 'Pending',
      pending: 'Pending',
      in_progress: 'In Progress',
      'in progress': 'In Progress',
      completed: 'Completed',
      cancelled: 'Cancelled',
    };
    return names[status?.toLowerCase()] || status || 'Pending';
  };

  const formatDate = dateString => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    } catch {
      return 'N/A';
    }
  };

  const formatDateTime = dateString => {
    if (!dateString) return 'N/A';
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return 'N/A';
    }
  };

  const handleEdit = () => {
    navigation.navigate(ROUTES.EDIT_TASK, { task: currentTask });
  };

  const handleDelete = () => {
    setIsDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    setIsDeleting(true);
    try {
      const id = currentTask?._id || currentTask?.id;
      const response = await tasksAPI.delete(id);
      if (response.success) {
        setIsDeleteModalVisible(false);
        navigation.navigate(ROUTES.MAIN_TABS, {
          screen: ROUTES.TASKS,
          params: { refresh: true },
        });
      } else {
        Alert.alert('Error', 'Failed to delete task');
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to delete task');
    } finally {
      setIsDeleting(false);
    }
  };

  // Loading State
  if (loading) {
    return (
      <ScreenWrapper backgroundColor={Colors.background}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="close" size={ms(20)} color={Colors.textPrimary} />
          </TouchableOpacity>
          <View style={styles.headerCenter}>
            <AppText size="lg" weight="semiBold" style={styles.headerTitle}>
              Task Details
            </AppText>
            {/* <AppText
              size="sm"
              color={Colors.textMuted}
              style={styles.headerSubtitle}
            >
              Loading…
            </AppText> */}
          </View>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={Colors.primary} />
          <AppText
            size="base"
            color={Colors.textMuted}
            style={{ marginTop: Spacing.md }}
          >
            Loading task details...
          </AppText>
        </View>
      </ScreenWrapper>
    );
  }

  // Error State
  if (!currentTask) {
    return (
      <ScreenWrapper withPadding backgroundColor={Colors.background}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Icon name="arrow-back" size={ms(24)} color={Colors.textPrimary} />
          </TouchableOpacity>
          <AppText size="lg" weight="semiBold">
            Task Details
          </AppText>
          <View style={{ width: ms(44) }} />
        </View>
        <View style={styles.errorContainer}>
          <Icon
            name="alert-circle-outline"
            size={ms(60)}
            color={Colors.textMuted}
          />
          <AppText
            size="lg"
            weight="semiBold"
            color={Colors.textSecondary}
            style={{ marginTop: Spacing.md }}
          >
            Task not found
          </AppText>
          <TouchableOpacity
            onPress={() => fetchTaskDetails()}
            style={{ marginTop: Spacing.md }}
          >
            <AppText size="base" color={Colors.primary}>
              Try Again
            </AppText>
          </TouchableOpacity>
        </View>
      </ScreenWrapper>
    );
  }

  const renderHeader = () => (
    <View style={styles.header}>

      {/* Back Button */}
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <Icon name="close" size={ms(20)} color={Colors.textPrimary} />
      </TouchableOpacity>

      {/* Title Section */}
      <View style={styles.headerCenter}>
        <AppText
          size='md'
          weight="semiBold"
          numberOfLines={1}
          style={styles.headerTitle}
        >
          {currentTask?.title || 'Task Details'}
        </AppText>

        {!!(currentTask?.subtitle || currentTask?.leadName) && (
          <AppText
            size="sm"
            color={Colors.textMuted}
            numberOfLines={1}
            style={styles.headerSubtitle}
          >
            {currentTask?.subtitle ||
              (currentTask?.leadName ? `for ${currentTask.leadName}` : '')}
          </AppText>
        )}
      </View>

      {/* Header Actions */}
      <View style={styles.headerActions}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleDelete}
        >
          <Icon name="trash-outline" size={ms(18)} color={Colors.error} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.headerButton}
          onPress={handleEdit}
        >
          <Icon name="create-outline" size={ms(18)} color={Colors.info} />
        </TouchableOpacity>
      </View>

    </View>
  );
  const renderTaskCard = () => (
    <View style={styles.taskCard}>
      {/* Title with Status & Priority Badges */}
      <AppText size="md" weight="semiBold" style={styles.taskTitle}>
        {currentTask.title || 'Untitled Task'}
      </AppText>

      {/* Badges Row */}
      <View style={styles.badgesRow}>
        <View
          style={[
            styles.statusBadge,
            { backgroundColor: getStatusColor(currentTask.status) },
          ]}
        >
          <Icon name="time-outline" size={ms(12)} color={Colors.white} />
          <AppText
            size="xs"
            weight="semiBold"
            color={Colors.white}
            style={styles.badgeText}
          >
            {getStatusName(currentTask.status)}
          </AppText>
        </View>
        <View
          style={[
            styles.priorityBadge,
            { backgroundColor: getPriorityColor(currentTask.priority) },
          ]}
        >
          <AppText size="xs" weight="semiBold" color={Colors.white}>
            {currentTask.priority?.charAt(0).toUpperCase() +
              currentTask.priority?.slice(1).toLowerCase()}{' '}
            Priority
          </AppText>
        </View>
      </View>

      {/* Due Date */}
      <View style={styles.dueDateRow}>
        <Icon name="calendar-outline" size={ms(16)} color={Colors.textMuted} />
        <AppText
          size="sm"
          color={Colors.textSecondary}
          style={{ marginLeft: Spacing.xs }}
        >
          Due: {formatDate(currentTask.dueAt || currentTask.dueDate)}
        </AppText>
      </View>
    </View>
  );

  const renderDescriptionSection = () => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Icon
          name="document-text-outline"
          size={ms(20)}
          color={Colors.primary}
        />
        <AppText
          size="base"
          weight="semiBold"
          style={styles.sectionHeaderTitle}
        >
          Description
        </AppText>
      </View>
      <View style={styles.sectionCard}>
        <AppText
          size="sm"
          color={
            currentTask.description ? Colors.textPrimary : Colors.textMuted
          }
        >
          {currentTask.description || 'No description provided'}
        </AppText>
      </View>
    </View>
  );

  const renderRelatedToSection = () => {
    // Try to extract the contact name from the relatedTo entityId object
    const entityObj = currentTask.relatedTo?.entityId;
    let relatedName = null;

    if (entityObj && typeof entityObj === 'object') {
      // entityId is a populated lead object with a contact sub-object
      const contact = entityObj.contact;
      if (contact) {
        const fullName = `${contact.firstName || ''} ${contact.lastName || ''}`.trim();
        relatedName = fullName || contact.email || entityObj.title || null;
      } else {
        relatedName = entityObj.name || entityObj.title || null;
      }
    } else if (typeof entityObj === 'string') {
      relatedName = entityObj;
    }

    // Fallback to legacy fields
    if (!relatedName) {
      relatedName = currentTask.lead?.title || currentTask.lead?.name || currentTask.relatedTo?.name || null;
    }

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="link-outline" size={ms(20)} color={Colors.primary} />
          <AppText
            size="base"
            weight="semiBold"
            style={styles.sectionHeaderTitle}
          >
            Related To
          </AppText>
        </View>
        <View style={styles.sectionCard}>
          <AppText size="sm" color={relatedName ? Colors.info : Colors.textMuted}>
            {relatedName || 'No related entity'}
          </AppText>
        </View>
      </View>
    );
  };

  const renderActivitySection = () => {
    const activities = currentTask.activities || currentTask.history || [];
    if (activities.length === 0) return null;

    return (
      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon
            name="chatbubble-outline"
            size={ms(20)}
            color={Colors.primary}
          />
          <AppText
            size="base"
            weight="semiBold"
            style={styles.sectionHeaderTitle}
          >
            Activity
          </AppText>
        </View>
        <View style={styles.sectionCard}>
          {activities.map((activity, index) => (
            <View key={index}>
              {index > 0 && <View style={styles.divider} />}
              <View style={styles.activityItem}>
                <View style={styles.activityIndicator} />
                <View style={styles.activityContent}>
                  <AppText size="sm" weight="medium" color={Colors.textPrimary}>
                    {activity.title || activity.action || 'Task updated'}
                  </AppText>
                  {activity.description && (
                    <AppText
                      size="xs"
                      color={Colors.textMuted}
                      style={{ marginTop: 2 }}
                    >
                      {activity.description}
                    </AppText>
                  )}
                  <View style={styles.activityMeta}>
                    {activity.type && (
                      <View style={styles.activityBadge}>
                        <AppText size="xs" color={Colors.textSecondary}>
                          {activity.type}
                        </AppText>
                      </View>
                    )}
                    <AppText size="xs" color={Colors.textMuted}>
                      {formatDateTime(activity.createdAt || activity.date)}
                    </AppText>
                  </View>
                  {activity.user?.name && (
                    <AppText
                      size="xs"
                      color={Colors.textMuted}
                      style={{ marginTop: 2 }}
                    >
                      by {activity.user.name}
                    </AppText>
                  )}
                </View>
              </View>
            </View>
          ))}
        </View>
      </View>
    );
  };

  const renderTaskDetailsSection = () => (
    <>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Icon name="time-outline" size={ms(20)} color={Colors.primary} />
          <AppText
            size="base"
            weight="semiBold"
            style={styles.sectionHeaderTitle}
          >
            Task Details
          </AppText>
        </View>
        <View style={styles.sectionCard}>
          {/* Status */}
          <View style={styles.detailRow}>
            <AppText
              size="sm"
              color={Colors.textMuted}
              style={styles.detailLabel}
            >
              Status
            </AppText>
            <View
              style={[
                styles.detailBadge,
                { backgroundColor: getStatusColor(currentTask.status) },
              ]}
            >
              <AppText size="xs" weight="semiBold" color={Colors.white}>
                {getStatusName(currentTask.status)}
              </AppText>
            </View>
          </View>
          <View style={styles.divider} />

          {/* Priority */}
          <View style={styles.detailRow}>
            <AppText
              size="sm"
              color={Colors.textMuted}
              style={styles.detailLabel}
            >
              Priority
            </AppText>
            <View
              style={[
                styles.detailBadge,
                { backgroundColor: getPriorityColor(currentTask.priority) },
              ]}
            >
              <AppText size="xs" weight="semiBold" color={Colors.white}>
                {currentTask.priority?.charAt(0).toUpperCase() +
                  currentTask.priority?.slice(1).toLowerCase()}
              </AppText>
            </View>
          </View>
          <View style={styles.divider} />

          {/* Due Date */}
          <View style={styles.detailRow}>
            <AppText
              size="sm"
              color={Colors.textMuted}
              style={styles.detailLabel}
            >
              Due Date
            </AppText>
            <AppText size="sm" weight="medium" color={Colors.textPrimary}>
              {formatDate(currentTask.dueAt || currentTask.dueDate)}
            </AppText>
          </View>
          <View style={styles.divider} />

          {/* Assigned To */}
          <View style={styles.detailRow}>
            <AppText
              size="sm"
              color={Colors.textMuted}
              style={styles.detailLabel}
            >
              Assigned To
            </AppText>
            <AppText size="sm" weight="medium" color={Colors.textPrimary}>
              {currentTask.assignedTo?.name ||
                currentTask.assignedTo?.firstName ||
                'N/A'}
            </AppText>
          </View>
          <View style={styles.divider} />

          {/* Created */}
          <View style={styles.detailRow}>
            <AppText
              size="sm"
              color={Colors.textMuted}
              style={styles.detailLabel}
            >
              Created
            </AppText>
            <AppText size="sm" weight="medium" color={Colors.textPrimary}>
              {formatDate(currentTask.createdAt)}
            </AppText>
          </View>

          {/* Created By */}
          {currentTask.createdBy && (
            <>
              <View style={styles.divider} />
              <View style={styles.detailRow}>
                <AppText
                  size="sm"
                  color={Colors.textMuted}
                  style={styles.detailLabel}
                >
                  Created By
                </AppText>
                <AppText size="sm" weight="medium" color={Colors.textPrimary}>
                  {currentTask.createdBy?.name || 'N/A'}
                </AppText>
              </View>
            </>
          )}
        </View>
      </View>
    </>
  );


  return (
    <ScreenWrapper withPadding backgroundColor={Colors.background}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
      >
        {renderHeader()}
        {renderTaskCard()}
        {renderDescriptionSection()}
        {renderRelatedToSection()}
        {renderActivitySection()}
        {renderTaskDetailsSection()}
        <View style={styles.bottomSpacer} />
      </ScrollView>

      <DeleteConfirmationModal
        visible={isDeleteModalVisible}
        title="Delete Task"
        message={`Are you sure you want to delete "${currentTask?.title}"? This action cannot be undone.`}
        onCancel={() => setIsDeleteModalVisible(false)}
        onDelete={handleConfirmDelete}
        loading={isDeleting}
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: ms(1),
    marginBottom: vs(15),
    backgroundColor: Colors.background,
  },

  headerCenter: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: ms(8),
  },

  headerTitle: {
    textAlign: 'center',
    fontWeight: '600',
  },

  headerSubtitle: {
    textAlign: 'center',
  },

  backButton: {
    width: ms(40),
    height: ms(40),
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },

  headerButton: {
    width: ms(36),
    height: ms(36),
    borderRadius: BorderRadius.round,
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    ...Shadow.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: ms(8),
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Task Title Card
  taskCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.lg,
    marginBottom: vs(16),
    marginHorizontal: ms(1),
    ...Shadow.md,
  },
  taskTitle: {
    marginBottom: Spacing.sm,
  },
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  badgeText: {
    marginLeft: 4,
  },
  priorityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  dueDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },

  // Sections
  section: {
    marginBottom: vs(16),
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionHeaderTitle: {
    marginLeft: Spacing.sm,
  },
  sectionCard: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.card,
    padding: Spacing.md,
    marginHorizontal: ms(1),
    ...Shadow.sm,
  },

  // Detail Rows
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: vs(10),
  },
  detailLabel: {
    flex: 1,
  },
  detailBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: BorderRadius.round,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.borderLight,
  },

  // Activity
  activityItem: {
    flexDirection: 'row',
    paddingVertical: Spacing.sm,
  },
  activityIndicator: {
    width: 4,
    backgroundColor: '#f97316',
    borderRadius: 2,
    marginRight: Spacing.md,
  },
  activityContent: {
    flex: 1,
  },
  activityMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: Spacing.xs,
    gap: Spacing.sm,
  },
  activityBadge: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.badge,
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginTop: vs(8),
  },
  editButton: {
    flex: 2,
  },
  deleteButton: {
    flex: 1,
    borderColor: Colors.error,
  },
  bottomSpacer: {
    height: vs(40),
  },
});

export default TaskDetailsScreen;
