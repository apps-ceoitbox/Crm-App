/**
 * EditTaskScreen — mirror of AddTaskScreen but pre-loaded with existing task data.
 * Calls tasksAPI.update(id, payload) on save.
 */

import React, { useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Keyboard,
  ScrollView,
  TextInput,
} from 'react-native';
import IonIcon from 'react-native-vector-icons/Ionicons';
import { Colors } from '../../constants/Colors';
import { Spacing, BorderRadius, Shadow } from '../../constants/Spacing';
import { ms, vs, wp } from '../../utils/Responsive';
import { formatDate } from '../../utils/Helpers';
import { useAuth } from '../../context/AuthContext';
import { leadsAPI, tasksAPI } from '../../api';
import {
  ScreenWrapper,
  AppText,
  AppInput,
  AppButton,
  ModalLoader,
  DatePickerModal,
} from '../../components';

const TASK_PRIORITIES = [
  { id: 'Low', color: '#3B82F6' },
  { id: 'Medium', color: '#F59E0B' },
  { id: 'High', color: '#EF4444' },
  { id: 'Urgent', color: '#dc2626' },
];

const TASK_STATUSES = [
  { id: 'Pending', color: '#F59E0B' },
  { id: 'In Progress', color: '#3B82F6' },
  { id: 'Completed', color: '#10B981' },
];

// Map API status to UI labels
const API_STATUS_TO_UI = {
  open: 'Pending',
  in_progress: 'In Progress',
  completed: 'Completed',
};

// Map UI label back to API value
const UI_STATUS_TO_API = {
  Pending: 'open',
  'In Progress': 'in_progress',
  Completed: 'completed',
};

const EditTaskScreen = ({ navigation, route }) => {
  const task = route.params?.task || {};
  const { fetchAllUsers, allUsers } = useAuth();

  // Pre-fill form with existing task data
  const [formData, setFormData] = useState({
    title: task.title || '',
    description: task.description || '',
    addRemark: task.remark || task.remarks || '',
    dueDate: task.dueAt ? new Date(task.dueAt) : (task.dueDate ? new Date(task.dueDate) : new Date()),
    priority: task.priority
      ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1).toLowerCase()
      : 'Medium',
    status: API_STATUS_TO_UI[task.status?.toLowerCase()] || 'Pending',
    assignedTo: typeof task.assignedTo === 'object' ? (task.assignedTo?._id || task.assignedTo?.id || null) : (task.assignedTo || null),
    leadId: task.relatedTo?.entityId
      ? (typeof task.relatedTo.entityId === 'object' ? (task.relatedTo.entityId._id || task.relatedTo.entityId.id) : task.relatedTo.entityId)
      : null,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState({});
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Assignee inline dropdown state
  const [isAssigneeDropdownOpen, setIsAssigneeDropdownOpen] = useState(false);

  // Lead inline dropdown state
  const [isLeadDropdownOpen, setIsLeadDropdownOpen] = useState(false);
  const [leadSearchQuery, setLeadSearchQuery] = useState('');
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [loadingMoreLeads, setLoadingMoreLeads] = useState(false);
  const [leadsPage, setLeadsPage] = useState(1);
  const [leadsHasMore, setLeadsHasMore] = useState(true);
  const leadSearchTimerRef = useRef(null);

  const descriptionRef = useRef(null);
  const LEADS_LIMIT = 20;

  React.useEffect(() => {
    if (!allUsers || allUsers.length === 0) {
      fetchAllUsers();
    }
    fetchLeads('', 1);
  }, []);

  // Debounced lead search — reset page and fetch from page 1
  React.useEffect(() => {
    if (leadSearchTimerRef.current) clearTimeout(leadSearchTimerRef.current);
    leadSearchTimerRef.current = setTimeout(() => {
      setLeadsPage(1);
      setLeadsHasMore(true);
      fetchLeads(leadSearchQuery.trim(), 1);
    }, 300);
    return () => {
      if (leadSearchTimerRef.current) clearTimeout(leadSearchTimerRef.current);
    };
  }, [leadSearchQuery]);

  const fetchLeads = async (search = '', page = 1) => {
    try {
      if (page === 1) setLeadsLoading(true);
      else setLoadingMoreLeads(true);
      const params = { limit: LEADS_LIMIT, page };
      if (search) params.search = search;
      const response = await leadsAPI.getAll(params);
      if (response.success && response.data) {
        const leadsData = Array.isArray(response.data.data) ? response.data.data :
          Array.isArray(response.data) ? response.data :
            response.data.leads || [];
        if (page === 1) {
          setLeads(leadsData);
        } else {
          setLeads(prev => [...prev, ...leadsData]);
        }
        setLeadsHasMore(leadsData.length === LEADS_LIMIT);
        setLeadsPage(page);
      }
    } catch (error) {
      console.log('Error fetching leads:', error);
    } finally {
      setLeadsLoading(false);
      setLoadingMoreLeads(false);
    }
  };

  const handleLeadScroll = ({ nativeEvent }) => {
    const { layoutMeasurement, contentOffset, contentSize } = nativeEvent;
    const isNearBottom = layoutMeasurement.height + contentOffset.y >= contentSize.height - 40;
    if (isNearBottom && !loadingMoreLeads && leadsHasMore) {
      fetchLeads(leadSearchQuery.trim(), leadsPage + 1);
    }
  };

  const formattedUsers = [
    { label: 'None (will use current user)', value: null },
    ...(allUsers || []).map(u => ({
      label: `${u.name} (${u.email})`,
      value: u.id || u._id,
    })),
  ];

  const updateField = (field, value) => {
    setFormData({ ...formData, [field]: value });
    if (errors[field]) {
      setErrors({ ...errors, [field]: null });
    }
  };

  const formattedLeads = [
    { label: 'Select Lead', value: null, isDefault: true },
    ...leads.map(lead => {
      const contact = lead.contact || {};
      const firstName = contact.firstName || '';
      const lastName = contact.lastName || '';
      const email = contact.email || '';
      const title = lead.title || '';
      const fullName = `${firstName} ${lastName}`.trim();
      return {
        label: fullName || email || 'Unknown Lead',
        name: fullName,
        email,
        title,
        value: lead.id || lead._id,
      };
    }),
  ];

  const validateForm = () => {
    const newErrors = {};
    if (!formData.title.trim()) newErrors.title = 'Title is required*';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleUpdate = async () => {
    Keyboard.dismiss();
    if (!validateForm()) return;
    setLoading(true);

    const taskId = task._id || task.id;

    const apiPayload = {
      assignedTo: formData.assignedTo || undefined,
      description: formData.description,
      dueAt: formData.dueDate ? new Date(formData.dueDate).toISOString() : undefined,
      priority: formData.priority.toLowerCase(),
      relatedTo: formData.leadId ? {
        entityType: 'lead',
        entityId: formData.leadId,
      } : undefined,
      addRemark: formData.remarks,
      status: UI_STATUS_TO_API[formData.status] || 'open',
      title: formData.title,
    };

    try {
      console.log('Update payload:', apiPayload, 'task id ', taskId);
      const result = await tasksAPI.update(taskId, apiPayload);
      console.log('Update result:', result);
      setLoading(false);
      if (result.success) {
        Alert.alert('Success', 'Task updated successfully!', [
          { text: 'OK', onPress: () => navigation.goBack() },
        ]);
      } else {
        Alert.alert('Error', result.error || 'Failed to update task');
      }
    } catch (error) {
      setLoading(false);
      Alert.alert('Error', 'Failed to update task');
    }
  };

  const renderHeader = () => (
    <View style={styles.header}>
      <TouchableOpacity
        style={styles.backButton}
        onPress={() => navigation.goBack()}
      >
        <IonIcon name="close" size={22} color={Colors.textPrimary} />
      </TouchableOpacity>

      <View style={styles.headerCenter}>
        <Text style={styles.headerTitle}>Edit Task</Text>
        <Text style={styles.headerSubtitle}>Update the task details below</Text>
      </View>
    </View>
  );

  return (
    <ScreenWrapper
      withScrollView
      withPadding
      backgroundColor={Colors.background}
      style={{ paddingTop: vs(6) }}
    >
      {renderHeader()}

      <View style={styles.formContainer}>
        {/* Task Details */}
        <Text style={styles.sectionLabel}>TASK DETAILS</Text>
        <View style={styles.sectionCard}>
          <AppInput
            label="Title"
            placeholder="What needs to be done?"
            value={formData.title}
            onChangeText={text => updateField('title', text)}
            leftIcon="clipboard-outline"
            error={!!errors.title}
            errorMessage={errors.title}
            returnKeyType="next"
            onSubmitEditing={() => descriptionRef.current?.focus()}
            required
          />

          <AppInput
            ref={descriptionRef}
            label="Description"
            placeholder="Add description..."
            value={formData.description}
            onChangeText={text => updateField('description', text)}
            multiline
            numberOfLines={3}
          />

          <AppInput
            label="Remarks"
            placeholder="Add remarks..."
            value={formData.remarks}
            onChangeText={text => updateField('remarks', text)}
            multiline
            numberOfLines={2}
          />

          {/* Due Date */}
          <Text style={styles.inputLabelmarginTop}>Due Date *</Text>
          <TouchableOpacity
            style={styles.dropdownButton}
            onPress={() => setShowDatePicker(true)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IonIcon name="calendar-outline" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.dropdownText}>
                {formatDate(formData.dueDate, 'long')}
              </Text>
            </View>
          </TouchableOpacity>

          {/* Assigned To */}
          <Text style={styles.inputLabelmarginTop}>Assigned To</Text>
          <TouchableOpacity
            style={[
              styles.dropdownButton,
              isAssigneeDropdownOpen && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
            ]}
            onPress={() => setIsAssigneeDropdownOpen(!isAssigneeDropdownOpen)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <IonIcon name="person-outline" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.dropdownText} numberOfLines={1}>
                {formattedUsers.find(u => u.value === formData.assignedTo)?.label || 'None (will use current user)'}
              </Text>
            </View>
            <IonIcon name={isAssigneeDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          {isAssigneeDropdownOpen && (
            <View style={styles.inlineDropdownContainer}>
              <ScrollView style={styles.inlineListContainer} nestedScrollEnabled={true}>
                {formattedUsers.map(item => {
                  const isSelected = formData.assignedTo === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value || 'null'}
                      style={[
                        styles.inlineOptionItem,
                        isSelected && { backgroundColor: '#ECFDF5' },
                      ]}
                      onPress={() => {
                        updateField('assignedTo', item.value);
                        setIsAssigneeDropdownOpen(false);
                      }}
                    >
                      {isSelected && (
                        <IonIcon name="checkmark" size={20} color={Colors.primary} style={{ marginRight: Spacing.sm }} />
                      )}
                      <Text style={[
                        styles.inlineOptionText,
                        isSelected && { color: Colors.primary },
                      ]}>{item.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Lead */}
        <Text style={styles.sectionLabel}>LEAD</Text>
        <View style={styles.sectionCard}>
          <TouchableOpacity
            style={[
              styles.dropdownButton,
              isLeadDropdownOpen && { borderBottomLeftRadius: 0, borderBottomRightRadius: 0, marginBottom: 0 },
            ]}
            onPress={() => setIsLeadDropdownOpen(!isLeadDropdownOpen)}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
              <IonIcon name="person-add-outline" size={20} color={Colors.textSecondary} style={{ marginRight: 8 }} />
              <Text style={styles.dropdownText} numberOfLines={1}>
                {formattedLeads.find(l => l.value === formData.leadId)?.label || 'Search and select lead'}
              </Text>
            </View>
            <IonIcon name={isLeadDropdownOpen ? "chevron-up" : "chevron-down"} size={20} color={Colors.textTertiary} />
          </TouchableOpacity>

          {isLeadDropdownOpen && (
            <View style={styles.inlineDropdownContainer}>
              <View style={styles.inlineSearchContainer}>
                <IonIcon name="search-outline" size={20} color={Colors.textSecondary} style={styles.inlineSearchIcon} />
                <TextInput
                  style={styles.inlineSearchInput}
                  placeholder="Search by contact name, email or product..."
                  placeholderTextColor={Colors.textTertiary}
                  value={leadSearchQuery}
                  onChangeText={setLeadSearchQuery}
                />
              </View>
              <ScrollView style={styles.inlineListContainer} nestedScrollEnabled={true} onScroll={handleLeadScroll} scrollEventThrottle={100}>
                {leadsLoading ? (
                  <Text style={styles.inlineEmptyText}>Searching...</Text>
                ) : formattedLeads.length <= 1 ? (
                  <Text style={styles.inlineEmptyText}>No leads found</Text>
                ) : formattedLeads.map(item => {
                  const isSelected = formData.leadId === item.value;
                  return (
                    <TouchableOpacity
                      key={item.value || 'null'}
                      style={[
                        styles.inlineOptionItem,
                        isSelected && { backgroundColor: '#ECFDF5' },
                      ]}
                      onPress={() => {
                        updateField('leadId', item.value);
                        setIsLeadDropdownOpen(false);
                        setLeadSearchQuery('');
                      }}
                    >
                      {isSelected && (
                        <IonIcon name="checkmark" size={20} color={Colors.primary} style={{ marginRight: Spacing.sm, alignSelf: 'flex-start', marginTop: 2 }} />
                      )}
                      {item.isDefault ? (
                        <Text style={[
                          styles.inlineOptionText,
                          isSelected && { color: Colors.primary },
                        ]}>{item.label}</Text>
                      ) : (
                        <View style={{ flex: 1, marginLeft: isSelected ? 0 : Spacing.md + 4 }}>
                          {!!item.name && (
                            <Text style={[
                              styles.inlineOptionText,
                              { fontWeight: '600', marginBottom: 2 },
                              isSelected && { color: Colors.primary },
                            ]}>{item.name}</Text>
                          )}
                          {!!item.email && (
                            <Text style={[
                              styles.inlineOptionText,
                              { fontSize: ms(13), color: isSelected ? Colors.primary : Colors.textSecondary, marginBottom: 2 },
                            ]}>{item.email}</Text>
                          )}
                          {!!item.title && (
                            <Text style={[
                              styles.inlineOptionText,
                              { fontSize: ms(12), color: isSelected ? Colors.primary : Colors.textTertiary },
                            ]}>{item.title}</Text>
                          )}
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
                {loadingMoreLeads && (
                  <Text style={styles.inlineEmptyText}>Loading more...</Text>
                )}
              </ScrollView>
            </View>
          )}
        </View>

        {/* Priority */}
        <Text style={styles.sectionLabel}>PRIORITY</Text>
        <View style={styles.pillRow}>
          {TASK_PRIORITIES.map(p => {
            const active = formData.priority === p.id;
            return (
              <TouchableOpacity
                key={p.id}
                style={[
                  styles.pill,
                  active && { backgroundColor: p.color, borderColor: p.color },
                ]}
                onPress={() => updateField('priority', p.id)}
              >
                <IonIcon name="flag" size={13} color={active ? '#fff' : p.color} />
                <Text style={[styles.pillText, active && { color: '#fff' }]}>{p.id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Status */}
        <Text style={styles.sectionLabel}>STATUS</Text>
        <View style={styles.pillRow}>
          {TASK_STATUSES.map(s => {
            const active = formData.status === s.id;
            return (
              <TouchableOpacity
                key={s.id}
                style={[
                  styles.pill,
                  active && { backgroundColor: s.color, borderColor: s.color },
                ]}
                onPress={() => updateField('status', s.id)}
              >
                <Text style={[styles.pillText, active && { color: '#fff' }]}>{s.id}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          <AppButton
            title="Update Task"
            onPress={handleUpdate}
            loading={loading}
            icon="checkmark-outline"
            style={styles.updateButton}
          />
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.bottomSpacer} />
      <ModalLoader visible={loading} text="Updating task..." />

      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        initialDate={formData.dueDate}
        onSelect={(date) => updateField('dueDate', date)}
      />
    </ScreenWrapper>
  );
};

const styles = StyleSheet.create({
  header: {
    height: ms(48),
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  backButton: {
    position: 'absolute', right: 0, top: 0, bottom: 0,
    justifyContent: 'center', paddingHorizontal: Spacing.xs,
    zIndex: 10,
  },
  headerCenter: { alignItems: 'center' },
  headerTitle: { fontSize: ms(18), fontWeight: '700', color: Colors.textPrimary },
  headerSubtitle: { fontSize: ms(12), color: Colors.textTertiary, marginTop: 2 },

  formContainer: { paddingBottom: vs(30) },
  sectionLabel: {
    fontSize: ms(12), fontWeight: '700', color: Colors.textTertiary,
    letterSpacing: 1, marginBottom: Spacing.sm, marginTop: Spacing.lg,
    paddingLeft: Spacing.xs,
  },
  sectionCard: {
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.lg, ...Shadow.sm,
  },
  inputLabelmarginTop: {
    fontSize: ms(13), fontWeight: '600', color: Colors.textSecondary,
    marginBottom: Spacing.xs, marginTop: Spacing.md, paddingLeft: Spacing.xs,
  },
  dropdownButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    height: vs(48), marginBottom: Spacing.md,
  },
  dropdownText: { fontSize: ms(15), color: Colors.textPrimary },
  pillRow: {
    flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm,
    backgroundColor: Colors.surface, borderRadius: BorderRadius.lg,
    padding: Spacing.md, ...Shadow.sm,
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.xl, borderWidth: 1.5,
    borderColor: Colors.surfaceBorder, backgroundColor: Colors.surface,
  },
  pillText: { fontSize: ms(13), fontWeight: '600', color: Colors.textSecondary },
  actionButtons: {
    marginTop: Spacing.xl,
    gap: Spacing.md,
  },
  updateButton: {
    marginTop: 0,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.md,
    borderWidth: 1.5,
    borderColor: Colors.surfaceBorder,
    backgroundColor: Colors.surface,
  },
  cancelButtonText: {
    fontSize: ms(15),
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  bottomSpacer: { height: vs(40) },

  // Inline dropdown styles
  inlineDropdownContainer: {
    backgroundColor: Colors.surface, borderWidth: 1, borderColor: '#E5E7EB',
    borderTopWidth: 0, borderBottomLeftRadius: BorderRadius.md,
    borderBottomRightRadius: BorderRadius.md, marginBottom: Spacing.md, overflow: 'hidden',
  },
  inlineSearchContainer: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.surface,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    paddingHorizontal: Spacing.md, paddingVertical: Spacing.xs,
  },
  inlineSearchIcon: { marginRight: Spacing.xs },
  inlineSearchInput: { flex: 1, height: vs(48), fontSize: ms(14), color: Colors.textPrimary },
  inlineListContainer: { maxHeight: vs(200) },
  inlineOptionItem: {
    paddingVertical: Spacing.md, paddingHorizontal: Spacing.md,
    borderBottomWidth: 1, borderBottomColor: Colors.surfaceBorder,
    flexDirection: 'row', alignItems: 'center',
  },
  inlineOptionText: { fontSize: ms(15), color: Colors.textPrimary },
  inlineEmptyText: {
    padding: Spacing.md, textAlign: 'center',
    color: Colors.textSecondary, fontSize: ms(14),
  },
  errorText: {
    color: Colors.error, fontSize: ms(12),
    marginTop: -Spacing.sm, marginBottom: Spacing.sm, paddingLeft: Spacing.xs,
  },
});

export default EditTaskScreen;
